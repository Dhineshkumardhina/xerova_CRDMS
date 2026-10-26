from pydantic import BaseModel
from typing import List, Optional
from app.schemas.criminal import CriminalProfileSchema

class FaceMatchItem(BaseModel):
    profile: CriminalProfileSchema
    confidence: float

class FaceSearchResponse(BaseModel):
    matches: List[FaceMatchItem]
    facialLandmarksExtracted: int = 128
    algorithm: str = "DOJ Neural Mesh Biometrics v4.2"
