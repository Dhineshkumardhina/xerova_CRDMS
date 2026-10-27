from pydantic import BaseModel, ConfigDict
from typing import Optional, List
from datetime import datetime

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
    isActive: bool = True
    isSuperuser: bool = False
    role: Optional[str] = None
    roleId: Optional[str] = None
    policeStationId: Optional[str] = None
    district: Optional[str] = None
    state: Optional[str] = None
    region: Optional[str] = None
    canCreateCriminals: bool = False
    permissions: List[str] = []

class UserCreateRequest(BaseModel):
    username: str
    password: str
    fullName: str
    badgeNumber: str
    rank: Optional[str] = "Patrol Officer"
    department: Optional[str] = "General Policing"
    clearanceLevel: Optional[str] = "Level 2 - Confidential"
    roleId: Optional[str] = None
    roleName: Optional[str] = None
    policeStationId: Optional[str] = None
    district: Optional[str] = None
    state: Optional[str] = None
    region: Optional[str] = None

class UserUpdateRequest(BaseModel):
    fullName: Optional[str] = None
    rank: Optional[str] = None
    department: Optional[str] = None
    clearanceLevel: Optional[str] = None
    roleId: Optional[str] = None
    roleName: Optional[str] = None
    policeStationId: Optional[str] = None
    district: Optional[str] = None
    state: Optional[str] = None
    region: Optional[str] = None
    isActive: Optional[bool] = None

class PermissionGrantRevokeRequest(BaseModel):
    userId: Optional[str] = None
    permission: Optional[str] = "criminal_records.create"
    granted: bool = True
    reason: Optional[str] = None

class PermissionGrantItemSchema(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    userId: str
    username: str
    officerName: str
    badgeNumber: str
    region: Optional[str] = None
    permissionCode: str
    isGranted: bool
    grantedById: Optional[str] = None
    grantedByName: Optional[str] = None
    grantedAt: str
    revokedById: Optional[str] = None
    revokedByName: Optional[str] = None
    revokedAt: Optional[str] = None
    reason: Optional[str] = None
