from pydantic import BaseModel
from typing import List, Optional

class BulkStatusUpdateRequest(BaseModel):
    caseIds: List[str]
    newStatus: str

class CaseRecordCreate(BaseModel):
    caseNumber: str
    description: str
    dateFiled: str
    status: str
    category: str
    jurisdiction: Optional[str] = None
    officerInCharge: Optional[str] = None
    courtroomNotes: Optional[str] = None
    penalties: Optional[str] = None
    courtRoom: Optional[str] = None
    presidingJudge: Optional[str] = None
    penalCode: Optional[str] = None
    notes: Optional[str] = None
