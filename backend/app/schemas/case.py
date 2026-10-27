from pydantic import BaseModel, ConfigDict
from typing import List, Optional
from app.schemas.criminal import DocumentItemSchema

class BulkStatusUpdateRequest(BaseModel):
    caseIds: List[str]
    newStatus: str

class CaseRecordCreate(BaseModel):
    caseNumber: Optional[str] = None
    title: Optional[str] = None
    description: str
    dateFiled: Optional[str] = None
    status: Optional[str] = "Under Investigation"
    category: str = "Theft"
    jurisdiction: Optional[str] = None
    officerInCharge: Optional[str] = None
    incidentDate: Optional[str] = None
    incidentLocation: Optional[str] = None
    complainantName: Optional[str] = None
    complainantPhone: Optional[str] = None
    penalCode: Optional[str] = None
    courtRoom: Optional[str] = None
    presidingJudge: Optional[str] = None
    courtroomNotes: Optional[str] = None
    notes: Optional[str] = None
    penalties: Optional[str] = None
    policeStationId: Optional[str] = None
    leadOfficerId: Optional[str] = None
    suspectIds: Optional[List[str]] = []

class CaseRecordUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    status: Optional[str] = None
    category: Optional[str] = None
    incidentDate: Optional[str] = None
    incidentLocation: Optional[str] = None
    complainantName: Optional[str] = None
    complainantPhone: Optional[str] = None
    penalCode: Optional[str] = None
    courtRoom: Optional[str] = None
    presidingJudge: Optional[str] = None
    courtroomNotes: Optional[str] = None
    notes: Optional[str] = None
    penalties: Optional[str] = None

class CaseActivityCreate(BaseModel):
    activityType: str = "Investigation Note"
    title: str
    description: str

class CaseActivityResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    caseId: str
    officerName: Optional[str] = "Authorized Officer"
    activityType: str
    title: str
    description: str
    createdAt: str

class LinkedPersonResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    name: str
    role: str
    mugshotUrl: Optional[str] = None
    status: Optional[str] = None
    identificationNumber: Optional[str] = None

class LinkPersonRequest(BaseModel):
    criminalId: str
    roleInCase: str = "Primary Suspect"

class CaseDetailResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    caseNumber: str
    title: Optional[str] = None
    description: str
    dateFiled: str
    status: str
    category: str
    jurisdiction: Optional[str] = None
    officerInCharge: Optional[str] = None
    incidentDate: Optional[str] = None
    incidentLocation: Optional[str] = None
    complainantName: Optional[str] = None
    complainantPhone: Optional[str] = None
    penalCode: Optional[str] = None
    courtRoom: Optional[str] = None
    presidingJudge: Optional[str] = None
    courtroomNotes: Optional[str] = None
    notes: Optional[str] = None
    penalties: Optional[str] = None
    linkedPersons: List[LinkedPersonResponse] = []
    documents: List[DocumentItemSchema] = []
    activities: List[CaseActivityResponse] = []
