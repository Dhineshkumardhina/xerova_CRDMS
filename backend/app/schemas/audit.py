from pydantic import BaseModel, ConfigDict
from typing import Optional

class AuditLogSchema(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    subjectName: str
    subjectId: str
    profileId: str
    action: str
    time: str
    timestamp: Optional[str] = None
    mugshotUrl: Optional[str] = None
    badgeType: Optional[str] = None
