from pydantic import BaseModel
from typing import List, Optional
from app.schemas.criminal import CriminalProfileSchema

class SearchResponseSchema(BaseModel):
    success: bool = True
    query: str
    records: List[CriminalProfileSchema]
    results: Optional[List[CriminalProfileSchema]] = None
    total: Optional[int] = None
    totalCount: int
    page: int
    pageSize: int
    totalPages: int
    executionTimeMs: float
