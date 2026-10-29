from pydantic import BaseModel, ConfigDict
from typing import Optional
from app.schemas.user import UserOfficerSchema

class LoginRequest(BaseModel):
    officerId: Optional[str] = None
    badgeNumber: Optional[str] = None
    password: Optional[str] = None

class RefreshTokenRequest(BaseModel):
    refresh_token: str

class Token(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    officer: UserOfficerSchema

class OfficerSchema(UserOfficerSchema):
    pass
