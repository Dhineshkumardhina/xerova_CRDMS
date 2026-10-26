import uuid
from fastapi import APIRouter, Depends, HTTPException, status, Request
from sqlalchemy.orm import Session
from app.db.session import get_db
from app.core.security import (
    verify_password,
    create_access_token,
    create_refresh_token,
    decode_refresh_token,
    get_current_user,
)
from app.services.audit_service import log_audit_event
from app.models.user import UserModel
from app.models.refresh_token import RefreshTokenModel
from app.schemas.auth import LoginRequest, Token, RefreshTokenRequest
from app.schemas.user import UserOfficerSchema
from datetime import datetime, timezone

router = APIRouter()

from sqlalchemy import or_

@router.post("/login", response_model=Token)
def login(
    login_data: LoginRequest,
    request: Request,
    db: Session = Depends(get_db)
):
    officer_id = login_data.officerId or login_data.badgeNumber or ""
    user = db.query(UserModel).filter(
        or_(
            UserModel.username == officer_id,
            UserModel.badge_number == officer_id
        )
    ).first()
    
    if not user or not verify_password(login_data.password, user.hashed_password):
        # Audit Failed Login (Passwords/Secrets are NEVER logged)
        log_audit_event(
            db=db,
            action="Failed Login",
            resource_type="Auth",
            resource_id=login_data.officerId,
            subject_name=f"Badge #{login_data.officerId}",
            result="FAILED",
            request=request,
            details={"officer_id": login_data.officerId, "reason": "Invalid credentials"}
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
        raise HTTPException(status_code=400, detail="Inactive officer user account")

    access_token = create_access_token(subject=user.id)
    refresh_token = create_refresh_token(subject=user.id)

    db_token = RefreshTokenModel(
        id=str(uuid.uuid4()),
        user_id=user.id,
        token=refresh_token,
        expires_at=datetime.now(timezone.utc),
        is_revoked=False
    )
    db.add(db_token)

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

    officer_schema = UserOfficerSchema(
        id=user.id,
        username=user.username,
        name=user.full_name,
        badgeNumber=user.badge_number,
        rank=user.rank,
        department=user.department,
        clearanceLevel=user.clearance_level,
        avatarUrl=user.avatar_url or "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=256",
        isSuperuser=user.is_superuser
    )

    return Token(
        access_token=access_token,
        refresh_token=refresh_token,
        token_type="bearer",
        officer=officer_schema
    )

@router.post("/refresh", response_model=Token)
def refresh_token_endpoint(
    refresh_data: RefreshTokenRequest,
    db: Session = Depends(get_db)
):
    payload = decode_refresh_token(refresh_data.refresh_token)
    if not payload:
        raise HTTPException(status_code=401, detail="Invalid or expired refresh token")

    user_id = payload.get("sub")
    db_token = db.query(RefreshTokenModel).filter(
        RefreshTokenModel.token == refresh_data.refresh_token,
        RefreshTokenModel.is_revoked == False
    ).first()

    if not db_token:
        raise HTTPException(status_code=401, detail="Revoked refresh token")

    user = db.query(UserModel).filter(UserModel.id == user_id, UserModel.is_active == True).first()
    if not user:
        raise HTTPException(status_code=401, detail="User not found or inactive")

    db_token.is_revoked = True

    new_access_token = create_access_token(subject=user.id)
    new_refresh_token = create_refresh_token(subject=user.id)

    new_db_token = RefreshTokenModel(
        user_id=user.id,
        token=new_refresh_token,
        expires_at=datetime.now(timezone.utc),
        is_revoked=False
    )
    db.add(new_db_token)
    db.commit()

    officer_schema = UserOfficerSchema(
        id=user.id,
        username=user.username,
        name=user.full_name,
        badgeNumber=user.badge_number,
        rank=user.rank,
        department=user.department,
        clearanceLevel=user.clearance_level,
        avatarUrl=user.avatar_url or "",
        isSuperuser=user.is_superuser
    )

    return Token(
        access_token=new_access_token,
        refresh_token=new_refresh_token,
        token_type="bearer",
        officer=officer_schema
    )

@router.post("/logout")
def logout(
    refresh_data: RefreshTokenRequest,
    request: Request,
    db: Session = Depends(get_db)
):
    if refresh_data.refresh_token:
        db_token = db.query(RefreshTokenModel).filter(RefreshTokenModel.token == refresh_data.refresh_token).first()
        if db_token:
            db_token.is_revoked = True
            log_audit_event(
                db=db,
                action="Logout",
                resource_type="Auth",
                resource_id=db_token.user_id,
                subject_name="Officer Session",
                result="SUCCESS",
                user_id=db_token.user_id,
                request=request
            )
            db.commit()
    return {"status": "success", "message": "Logged out successfully"}

@router.get("/me", response_model=UserOfficerSchema)
def get_me(current_user: UserModel = Depends(get_current_user)):
    return UserOfficerSchema(
        id=current_user.id,
        username=current_user.username,
        name=current_user.full_name,
        badgeNumber=current_user.badge_number,
        rank=current_user.rank,
        department=current_user.department,
        clearanceLevel=current_user.clearance_level,
        avatarUrl=current_user.avatar_url or "",
        isSuperuser=current_user.is_superuser
    )
