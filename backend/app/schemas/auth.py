from pydantic import BaseModel, ConfigDict
from typing import Optional

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
    officer: "OfficerSchema"

class OfficerSchema(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    badgeNumber: str
    name: str
    rank: str
    department: str
    clearanceLevel: str
    avatarUrl: str
    status: str

Token.model_rebuild()
