import os
import hashlib
import hmac
import base64
import json
from datetime import datetime, timedelta, timezone
from typing import Any, Optional, Union, Dict, List
from fastapi import Depends, HTTPException, status, Header
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session, joinedload
from app.core.config import settings
from app.db.session import get_db
from app.models.user import UserModel
from app.models.role_permission import RoleModel, PermissionModel
from app.models.token_blacklist import RevokedTokenModel

oauth2_scheme = OAuth2PasswordBearer(tokenUrl=f"{settings.API_V1_STR}/auth/login", auto_error=False)

def get_password_hash(password: str) -> str:
    """
    Secure password hashing using PBKDF2 HMAC SHA-256 with 100,000 iterations and a random salt.
    Result format: pbkdf2_sha256$iterations$salt_hex$hash_hex
    """
    if not password:
        password = ""
    salt = os.urandom(16)
    iterations = 100000
    hash_bytes = hashlib.pbkdf2_hmac('sha256', password.encode('utf-8'), salt, iterations)
    return f"pbkdf2_sha256${iterations}${salt.hex()}${hash_bytes.hex()}"

def verify_password(plain_password: str, hashed_password: str) -> bool:
    if not plain_password or not hashed_password:
        return False

    parts = hashed_password.split('$')
    if len(parts) == 4 and parts[0] == "pbkdf2_sha256":
        try:
            iterations = int(parts[1])
            salt = bytes.fromhex(parts[2])
            expected_hash = parts[3]
            computed_hash = hashlib.pbkdf2_hmac('sha256', plain_password.encode('utf-8'), salt, iterations).hex()
            return hmac.compare_digest(computed_hash, expected_hash)
        except Exception:
            return False

    legacy_salted = f"crms_salt_{plain_password}_netra".encode('utf-8')
    legacy_hash = hashlib.sha256(legacy_salted).hexdigest()
    return hmac.compare_digest(legacy_hash, hashed_password)

from jose import jwt, JWTError
import uuid

def create_access_token(subject: Union[str, Any], expires_delta: Optional[timedelta] = None) -> str:
    now = datetime.now(timezone.utc)
    if expires_delta:
        expire = now + expires_delta
    else:
        expire = now + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    
    to_encode = {
        "sub": str(subject),
        "type": "access",
        "jti": str(uuid.uuid4()),
        "iat": int(now.timestamp()),
        "exp": int(expire.timestamp())
    }
    return jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)

def create_refresh_token(subject: Union[str, Any], expires_delta: Optional[timedelta] = None) -> str:
    now = datetime.now(timezone.utc)
    if expires_delta:
        expire = now + expires_delta
    else:
        expire = now + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS)
    
    to_encode = {
        "sub": str(subject),
        "type": "refresh",
        "jti": str(uuid.uuid4()),
        "iat": int(now.timestamp()),
        "exp": int(expire.timestamp())
    }
    return jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)

def decode_jwt(token: str) -> Dict[str, Any]:
    try:
        return jwt.decode(
            token,
            settings.SECRET_KEY,
            algorithms=[settings.ALGORITHM],
            options={"verify_exp": True, "verify_signature": True}
        )
    except JWTError:
        return {}

def decode_refresh_token(token: str) -> Optional[Dict[str, Any]]:
    payload = decode_jwt(token)
    if payload and payload.get("type") == "refresh":
        return payload
    return None

def get_current_user(
    token: Optional[str] = Depends(oauth2_scheme),
    authorization: Optional[str] = Header(None),
    db: Session = Depends(get_db)
) -> UserModel:
    raw_token = token
    if not raw_token and authorization and authorization.startswith("Bearer "):
        raw_token = authorization.split(" ")[1]

    if not raw_token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication token missing",
            headers={"WWW-Authenticate": "Bearer"},
        )

    payload = decode_jwt(raw_token)
    if not payload or payload.get("type") != "access":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not validate credentials or token expired",
            headers={"WWW-Authenticate": "Bearer"},
        )

    # Persistent Access Token Blacklist Verification
    jti = payload.get("jti")
    if jti:
        revoked = db.query(RevokedTokenModel).filter(RevokedTokenModel.jti == jti).first()
        if revoked:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Token has been revoked",
                headers={"WWW-Authenticate": "Bearer"},
            )

    user_id: str = payload.get("sub")
    if not user_id:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token payload")

    user = db.query(UserModel).options(
        joinedload(UserModel.role).joinedload(RoleModel.permissions)
    ).filter(UserModel.id == user_id, UserModel.is_active == True).first()

    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found or inactive")

    return user

def get_current_user_optional(
    token: Optional[str] = Depends(oauth2_scheme),
    authorization: Optional[str] = Header(None),
    db: Session = Depends(get_db)
) -> Optional[UserModel]:
    raw_token = token
    if not raw_token and authorization and authorization.startswith("Bearer "):
        raw_token = authorization.split(" ")[1]

    if not raw_token:
        return None

    payload = decode_jwt(raw_token)
    if not payload or payload.get("type") != "access":
        return None

    jti = payload.get("jti")
    if jti:
        revoked = db.query(RevokedTokenModel).filter(RevokedTokenModel.jti == jti).first()
        if revoked:
            return None

    user_id = payload.get("sub")
    if not user_id:
        return None

    return db.query(UserModel).filter(UserModel.id == user_id, UserModel.is_active == True).first()

class PermissionChecker:
    def __init__(self, permission_code: str):
        self.permission_code = permission_code

    def __call__(
        self,
        current_user: UserModel = Depends(get_current_user),
        db: Session = Depends(get_db)
    ) -> UserModel:
        if current_user.is_superuser:
            return current_user

        # Dedicated check for criminal record creation permission
        if self.permission_code in ("criminal_records.create", "criminal:create"):
            from app.core.rbac import has_criminal_create_permission
            if not has_criminal_create_permission(current_user, db):
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Access Denied: Explicit 'criminal_records.create' permission granted by Super Admin is required for this operation."
                )
            return current_user

        from app.core.rbac import resolve_jurisdiction
        jurisdiction = resolve_jurisdiction(current_user, db)
        if not jurisdiction.has_permission(self.permission_code):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Access Denied: Permission '{self.permission_code}' is required for this operation."
            )

        return current_user

def require_permission(permission_code: str):
    return PermissionChecker(permission_code)

def require_super_admin(
    current_user: UserModel = Depends(get_current_user)
) -> UserModel:
    from app.core.rbac import ROLE_SUPER_ADMIN, ROLE_SUPER_ADMIN_ALIAS
    role_name = current_user.role.name if current_user.role else ""
    if not (current_user.is_superuser or role_name in (ROLE_SUPER_ADMIN, ROLE_SUPER_ADMIN_ALIAS)):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access Denied: Super Administrator privileges are required for this action."
        )
    return current_user

class AnyPermissionChecker:
    def __init__(self, *permission_codes: str):
        self.permission_codes = set(permission_codes)

    def __call__(
        self,
        current_user: UserModel = Depends(get_current_user),
        db: Session = Depends(get_db)
    ) -> UserModel:
        if current_user.is_superuser:
            return current_user

        from app.core.rbac import resolve_jurisdiction, has_criminal_create_permission
        jurisdiction = resolve_jurisdiction(current_user, db)

        for code in self.permission_codes:
            if code in ("criminal_records.create", "criminal:create"):
                if has_criminal_create_permission(current_user, db):
                    return current_user
            elif jurisdiction.has_permission(code):
                return current_user

        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Access Denied: One of permissions {sorted(list(self.permission_codes))} is required for this operation."
        )

def require_any_permission(*permission_codes: str):
    return AnyPermissionChecker(*permission_codes)


