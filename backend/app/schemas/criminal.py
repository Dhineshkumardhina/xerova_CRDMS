from pydantic import BaseModel, ConfigDict
from typing import List, Optional

class IdentificationMarkSchema(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    type: str
    description: str
    location: Optional[str] = None
    detail: Optional[str] = None

class CaseRecordSchema(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    caseNumber: str
    description: str
    dateFiled: str
    status: str
    jurisdiction: Optional[str] = None
    officerInCharge: Optional[str] = None
    category: str
    courtroomNotes: Optional[str] = None
    penalties: Optional[str] = None
    courtRoom: Optional[str] = None
    presidingJudge: Optional[str] = None
    penalCode: Optional[str] = None
    notes: Optional[str] = None

class DocumentItemSchema(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    title: str
    filename: str
    size: str
    type: str
    uploadedAt: Optional[str] = None
    dateUploaded: Optional[str] = None
    url: Optional[str] = None

class MediaItemSchema(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    title: str
    filename: str
    type: str
    url: str
    caption: Optional[str] = None
    dateTaken: Optional[str] = None
    dateUploaded: Optional[str] = None

class RelativeDetailSchema(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    name: str
    relation: str
    phone: Optional[str] = None
    aadhaar: Optional[str] = None
    imei: Optional[str] = None
    address: Optional[str] = None
    photoUrl: Optional[str] = None
    notes: Optional[str] = None

class SocialMediaDetailSchema(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    platform: str
    handle: str
    profileUrl: Optional[str] = None
    notes: Optional[str] = None

class CriminalProfileSchema(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    name: str
    alias: Optional[str] = None
    fatherName: Optional[str] = ""
    dob: Optional[str] = "1990-01-01"
    age: Optional[int] = 30
    gender: Optional[str] = "Male"
    phone: Optional[str] = ""
    identificationNumber: Optional[str] = ""
    rawIdNumber: Optional[str] = None
    imei: Optional[str] = None
    primaryAddress: Optional[str] = ""
    city: Optional[str] = ""
    state: Optional[str] = ""
    height: Optional[str] = ""
    weight: Optional[str] = ""
    eyeColor: Optional[str] = ""
    hairColor: Optional[str] = None
    mugshotUrl: Optional[str] = ""
    mugshotDate: Optional[str] = "Today"
    riskLevel: Optional[str] = "Medium Risk"
    status: Optional[str] = "Active"
    isHistorical: Optional[bool] = False
    totalCases: int = 0
    convictions: int = 0
    activeCasesCount: int = 0
    category: Optional[str] = "Theft"
    identificationMarks: List[IdentificationMarkSchema] = []
    cases: List[CaseRecordSchema] = []
    documents: List[DocumentItemSchema] = []
    media: List[MediaItemSchema] = []
    relatives: List[RelativeDetailSchema] = []
    socialMedia: List[SocialMediaDetailSchema] = []
    isArchived: Optional[bool] = False
    notes: Optional[str] = None
