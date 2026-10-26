from pydantic import BaseModel
from typing import Optional
from datetime import datetime

class CriminalPhotoResponseSchema(BaseModel):
    id: str
    criminal_id: str
    photo_url: str
    storage_key: Optional[str] = None
    filename: Optional[str] = None
    content_type: Optional[str] = "image/jpeg"
    size_bytes: Optional[int] = None
    is_primary_mugshot: bool
    created_at: Optional[datetime] = None

class UploadPhotoResponseSchema(BaseModel):
    status: str
    message: str
    photo: CriminalPhotoResponseSchema
