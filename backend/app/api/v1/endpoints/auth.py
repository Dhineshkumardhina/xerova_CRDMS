import uuid
from datetime import datetime, timezone, timedelta
from fastapi import APIRouter, Depends, HTTPException, status, Request
from sqlalchemy.orm import Session
from sqlalchemy import or_

from app.db.session import get_db
from app.core.config import settings
from app.core.security import (
    verify_password,
    create_access_token,
    create_refresh_token,
    decode_refresh_token,
    decode_jwt,
    get_current_user,
    get_current_user_optional,
)
from app.services.audit_service import log_audit_event
from app.models.user import UserModel
from app.models.refresh_token import RefreshTokenModel
from app.models.token_blacklist import RevokedTokenModel
from app.schemas.auth import LoginRequest, Token, RefreshTokenRequest
from app.schemas.user import UserOfficerSchema
from app.api.v1.endpoints.users import user_to_schema

router = APIRouter()


# Constant-time dummy hash for timing-attack protection against account enumeration
_DUMMY_PBKDF2_HASH = (
    "pbkdf2_sha256$100000$e3b0c44298fc1c149afbf4c8996fb924$5e884898da28047151d0e56f8dc6292773603d0d6aabbdd62a11ef721d1542d8"
)

@router.post("/login", response_model=Token)
def login(
    login_data: LoginRequest,
    request: Request,
    db: Session = Depends(get_db)
):
    officer_id = (login_data.officerId or login_data.badgeNumber or "").strip()
    password = login_data.password or ""

    if not officer_id or not password:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Officer badge number/ID and password are required.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    user = db.query(UserModel).filter(
        or_(
            UserModel.username == officer_id,
            UserModel.badge_number == officer_id
        )
    ).first()

    # Timing-attack mitigation: compute verification even when user does not exist
    if not user:
        verify_password(password, _DUMMY_PBKDF2_HASH)
        log_audit_event(
            db=db,
            action="Failed Login",
            resource_type="Auth",
            resource_id=officer_id,
            subject_name=f"Badge #{officer_id}",
            result="FAILED",
            request=request,
            details={"officer_id": officer_id, "reason": "Invalid credentials"}
        )
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect officer badge number or password",
            headers={"WWW-Authenticate": "Bearer"},
        )

    if not verify_password(password, user.hashed_password):
        log_audit_event(
            db=db,
            action="Failed Login",
            resource_type="Auth",
            resource_id=user.id,
            subject_name=user.full_name,
            result="FAILED",
            request=request,
            details={"officer_id": officer_id, "reason": "Invalid credentials"}
        )
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect officer badge number or password",
            headers={"WWW-Authenticate": "Bearer"},
        )

    if not user.is_active:
        log_audit_event(
            db=db,
            action="Failed Login",
            resource_type="Auth",
            resource_id=user.id,
            subject_name=user.full_name,
            result="FAILED",
            request=request,
            details={"reason": "User account inactive"}
        )
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Account is inactive or suspended. Please contact your precinct administrator.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    access_token = create_access_token(subject=user.id)
    refresh_token = create_refresh_token(subject=user.id)
    refresh_expires_at = datetime.now(timezone.utc) + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS)

    db_token = RefreshTokenModel(
        id=str(uuid.uuid4()),
        user_id=user.id,
        token=refresh_token,
        expires_at=refresh_expires_at,
        is_revoked=False
    )
    db.add(db_token)
    db.commit()

    # Audit Successful Login
    log_audit_event(
        db=db,
        action="Login",
        resource_type="Auth",
        resource_id=user.id,
        subject_name=user.full_name,
        result="SUCCESS",
        user_id=user.id,
        officer_name=user.full_name,
        request=request
    )

    officer_schema = user_to_schema(user, db)


    return Token(
        access_token=access_token,
        refresh_token=refresh_token,
        token_type="bearer",
        officer=officer_schema
    )

@router.post("/refresh", response_model=Token)
def refresh_token_endpoint(
    refresh_data: RefreshTokenRequest,
    request: Request,
    db: Session = Depends(get_db)
):
    if not refresh_data.refresh_token:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Refresh token required")

    payload = decode_refresh_token(refresh_data.refresh_token)
    if not payload:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid or expired refresh token")

    user_id = payload.get("sub")
    now_utc = datetime.now(timezone.utc)

    # Check for existing token record
    db_token = db.query(RefreshTokenModel).filter(
        RefreshTokenModel.token == refresh_data.refresh_token
    ).first()

    if not db_token:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid refresh token")

    # Refresh Token Reuse Detection (RFC 6749 Threat Mitigation):
    # If a previously revoked token is presented again, someone may have intercepted it.
    # Invalidate all active tokens for this user immediately as a defensive measure.
    if db_token.is_revoked:
        db.query(RefreshTokenModel).filter(
            RefreshTokenModel.user_id == user_id,
            RefreshTokenModel.is_revoked == False
        ).update({RefreshTokenModel.is_revoked: True})
        db.commit()

        log_audit_event(
            db=db,
            action="Security Warning",
            resource_type="Auth",
            resource_id=user_id or "unknown",
            subject_name="Token Reuse Detected",
            result="REVOKED",
            request=request,
            details={"warning": "Previously revoked refresh token reused. All sessions invalidated."}
        )
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Revoked refresh token reuse detected. All sessions invalidated for security."
        )

    # Check token expiration timestamp
    # Note: sqlite stores naive datetimes, so ensure comparison handles timezone
    db_expires_at = db_token.expires_at
    if db_expires_at.tzinfo is None:
        db_expires_at = db_expires_at.replace(tzinfo=timezone.utc)

    if db_expires_at < now_utc:
        db_token.is_revoked = True
        db.commit()
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Refresh token has expired")

    user = db.query(UserModel).filter(UserModel.id == user_id, UserModel.is_active == True).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found or inactive")

    # Rotate refresh token: revoke current token and issue replacement pair
    db_token.is_revoked = True

    new_access_token = create_access_token(subject=user.id)
    new_refresh_token = create_refresh_token(subject=user.id)
    new_expires_at = now_utc + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS)

    new_db_token = RefreshTokenModel(
        id=str(uuid.uuid4()),
        user_id=user.id,
        token=new_refresh_token,
        expires_at=new_expires_at,
        is_revoked=False
    )
    db.add(new_db_token)
    db.commit()

    officer_schema = user_to_schema(user, db)

    return Token(
        access_token=new_access_token,
        refresh_token=new_refresh_token,
        token_type="bearer",
        officer=officer_schema
    )

@router.post("/logout")
def logout(
    request: Request,
    refresh_data: Optional[RefreshTokenRequest] = None,
    current_user: Optional[UserModel] = Depends(get_current_user_optional),
    db: Session = Depends(get_db)
):
    logged_out_user_id = current_user.id if current_user else None

    # Blacklist current access token if bearer authorization header is provided
    auth_header = request.headers.get("Authorization")
    if auth_header and auth_header.startswith("Bearer "):
        access_token_str = auth_header.split(" ")[1]
        payload = decode_jwt(access_token_str)
        if payload and payload.get("jti"):
            jti = payload["jti"]
            exp_ts = payload.get("exp")
            exp_dt = datetime.fromtimestamp(exp_ts, tz=timezone.utc) if exp_ts else datetime.now(timezone.utc) + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
            existing_revocation = db.query(RevokedTokenModel).filter(RevokedTokenModel.jti == jti).first()
            if not existing_revocation:
                revoked_token = RevokedTokenModel(
                    id=str(uuid.uuid4()),
                    jti=jti,
                    user_id=logged_out_user_id or payload.get("sub"),
                    expires_at=exp_dt
                )
                db.add(revoked_token)

    if refresh_data and refresh_data.refresh_token:
        db_token = db.query(RefreshTokenModel).filter(RefreshTokenModel.token == refresh_data.refresh_token).first()
        if db_token:
            db_token.is_revoked = True
            logged_out_user_id = db_token.user_id

    # If current user is identified, also revoke all active refresh tokens for maximum security
    if logged_out_user_id:
        db.query(RefreshTokenModel).filter(
            RefreshTokenModel.user_id == logged_out_user_id,
            RefreshTokenModel.is_revoked == False
        ).update({RefreshTokenModel.is_revoked: True})

        log_audit_event(
            db=db,
            action="Logout",
            resource_type="Auth",
            resource_id=logged_out_user_id,
            subject_name="Officer Session",
            result="SUCCESS",
            user_id=logged_out_user_id,
            request=request
        )

    db.commit()
    return {"status": "success", "message": "Logged out successfully"}

@router.get("/me", response_model=UserOfficerSchema)
def get_me(
    current_user: UserModel = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    return user_to_schema(current_user, db)

