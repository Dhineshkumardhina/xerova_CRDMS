from pydantic import BaseModel, ConfigDict
from typing import Optional

class DocumentResponseSchema(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    title: str
    filename: str
    size: str
    type: str
    dateUploaded: str
    url: Optional[str] = None
    fileHashSha256: Optional[str] = None
