from pydantic import BaseModel, ConfigDict
from typing import Optional

class UserOfficerSchema(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    username: str
    name: str
    badgeNumber: str
    rank: str
    department: str
    clearanceLevel: str
    avatarUrl: str
    status: Optional[str] = "Active"
    isSuperuser: bool = False
