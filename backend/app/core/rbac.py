from typing import Optional, Set, List, Any
from dataclasses import dataclass
from fastapi import HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import or_, and_

from app.models.user import UserModel
from app.models.role_permission import RoleModel, UserPermissionGrantModel
from app.models.police_station import PoliceStationModel
from app.models.criminal import CriminalProfileModel
from app.models.case import CaseRecordModel, CriminalCaseModel

# Standard Canonical Role Constants
ROLE_SUPER_ADMIN = "Administrator"
ROLE_SUPER_ADMIN_ALIAS = "Super Administrator"
ROLE_STATE_ADMIN = "State-level Administrator"
ROLE_REGIONAL_ADMIN = "Regional Administrator"
ROLE_DISTRICT_ADMIN = "District Administrator"
ROLE_STATION_ADMIN = "Station Administrator"
ROLE_OFFICER = "Officer"
ROLE_OFFICER_ALIAS = "Investigating Officer"
ROLE_AUTHORIZED_PERSONNEL = "Authorized Personnel"

# Role Hierarchy Rank for Privilege Escalation Prevention (Higher number = Greater Authority)
ROLE_HIERARCHY_RANK = {
    ROLE_SUPER_ADMIN: 100,
    ROLE_SUPER_ADMIN_ALIAS: 100,
    ROLE_STATE_ADMIN: 80,
    ROLE_REGIONAL_ADMIN: 60,
    ROLE_DISTRICT_ADMIN: 40,
    ROLE_STATION_ADMIN: 20,
    ROLE_OFFICER: 10,
    ROLE_OFFICER_ALIAS: 10,
    ROLE_AUTHORIZED_PERSONNEL: 5
}

PERM_CRIMINAL_CREATE = "criminal_records.create"
PERM_CRIMINAL_CREATE_LEGACY = "criminal:create"

@dataclass
class UserJurisdiction:
    user_id: str
    role_name: str
    is_global: bool
    state: Optional[str]
    region: Optional[str]
    district: Optional[str]
    station_id: Optional[str]
    permissions: Set[str]

    def has_permission(self, permission_code: str) -> bool:
        if self.is_global:
            return True
        if permission_code in (PERM_CRIMINAL_CREATE, PERM_CRIMINAL_CREATE_LEGACY):
            return PERM_CRIMINAL_CREATE in self.permissions or PERM_CRIMINAL_CREATE_LEGACY in self.permissions
        return permission_code in self.permissions

def has_criminal_create_permission(user: UserModel, db: Session) -> bool:
    """
    Checks if a user is explicitly authorized to create criminal records.
    By default:
    - Super Admins (is_superuser or Administrator role) ALWAYS have permission.
    - Regional Admins, police members, and all other roles have permission DISABLED by default.
    - Ordinary users/Regional Admins can only create criminal records if the Super Admin
      has explicitly granted 'criminal_records.create' in user_permission_grants.
    """
    if user.is_superuser:
        return True

    role_name = user.role.name if user.role else ""
    if role_name in (ROLE_SUPER_ADMIN, ROLE_SUPER_ADMIN_ALIAS):
        return True

    # Check for active explicit grant in user_permission_grants
    grant = db.query(UserPermissionGrantModel).filter(
        UserPermissionGrantModel.user_id == user.id,
        UserPermissionGrantModel.permission_code.in_([PERM_CRIMINAL_CREATE, PERM_CRIMINAL_CREATE_LEGACY]),
        UserPermissionGrantModel.is_granted == True
    ).first()

    return grant is not None

def resolve_jurisdiction(user: UserModel, db: Optional[Session] = None) -> UserJurisdiction:
    role_name = user.role.name if user.role else "Authorized Personnel"
    is_global = (
        user.is_superuser or 
        role_name in (ROLE_SUPER_ADMIN, ROLE_SUPER_ADMIN_ALIAS)
    )

    # Resolve state, district, region from user profile or assigned police station
    station = user.police_station
    state = user.state or (station.state if station else None)
    district = user.district or (station.district if station else None)
    region = user.region or (station.region if station else None)
    station_id = user.police_station_id

    permissions = set()
    if user.role and user.role.permissions:
        permissions = {p.code for p in user.role.permissions}

    # If database session is provided, merge active explicit user permission grants
    if db:
        active_grants = db.query(UserPermissionGrantModel.permission_code).filter(
            UserPermissionGrantModel.user_id == user.id,
            UserPermissionGrantModel.is_granted == True
        ).all()
        for g in active_grants:
            permissions.add(g[0])

    return UserJurisdiction(
        user_id=user.id,
        role_name=role_name,
        is_global=is_global,
        state=state,
        region=region,
        district=district,
        station_id=station_id,
        permissions=permissions
    )

# ---------------------------------------------------------
# REGIONAL AUTHORIZATION BOUNDARY ENFORCEMENT
# ---------------------------------------------------------

def can_access_criminal(user: UserModel, criminal: CriminalProfileModel, db: Session) -> bool:
    jurisdiction = resolve_jurisdiction(user, db)
    if jurisdiction.is_global:
        return True

    # 1. State-Level Administrator Boundary
    if jurisdiction.role_name == ROLE_STATE_ADMIN:
        if criminal.state and jurisdiction.state:
            return criminal.state.lower().strip() == jurisdiction.state.lower().strip()
        if criminal.police_station and jurisdiction.state:
            return bool(criminal.police_station.state and criminal.police_station.state.lower().strip() == jurisdiction.state.lower().strip())
        return False

    # 2. Regional Administrator Boundary
    if jurisdiction.role_name == ROLE_REGIONAL_ADMIN:
        # Check explicit criminal region
        if getattr(criminal, "region", None) and jurisdiction.region:
            if criminal.region.lower().strip() == jurisdiction.region.lower().strip():
                return True
        # Check associated police station region
        if criminal.police_station and jurisdiction.region:
            return bool(criminal.police_station.region and criminal.police_station.region.lower().strip() == jurisdiction.region.lower().strip())
        return False

    # 3. District Administrator Boundary
    if jurisdiction.role_name == ROLE_DISTRICT_ADMIN:
        if criminal.district and jurisdiction.district:
            return criminal.district.lower().strip() == jurisdiction.district.lower().strip()
        if criminal.police_station and jurisdiction.district:
            return bool(criminal.police_station.district and criminal.police_station.district.lower().strip() == jurisdiction.district.lower().strip())
        return False

    # 4. Station Administrator, Investigating Officer, & Authorized Personnel
    if jurisdiction.station_id:
        if criminal.police_station_id and criminal.police_station_id == jurisdiction.station_id:
            return True
        # Also accessible if criminal is linked to any case originating from this station
        linked_station_cases = db.query(CriminalCaseModel).join(
            CaseRecordModel, CriminalCaseModel.case_id == CaseRecordModel.id
        ).filter(
            CriminalCaseModel.criminal_id == criminal.id,
            CaseRecordModel.police_station_id == jurisdiction.station_id
        ).first()
        if linked_station_cases is not None:
            return True

    # Fallback to regional match if officer has region assigned
    if jurisdiction.region:
        if getattr(criminal, "region", None) and criminal.region.lower().strip() == jurisdiction.region.lower().strip():
            return True
        if criminal.police_station and criminal.police_station.region and criminal.police_station.region.lower().strip() == jurisdiction.region.lower().strip():
            return True

    return False

def can_access_case(user: UserModel, case: CaseRecordModel) -> bool:
    jurisdiction = resolve_jurisdiction(user)
    if jurisdiction.is_global:
        return True

    station = case.police_station
    if not station:
        return False

    if jurisdiction.role_name == ROLE_STATE_ADMIN:
        return bool(jurisdiction.state and station.state.lower().strip() == jurisdiction.state.lower().strip())

    if jurisdiction.role_name == ROLE_REGIONAL_ADMIN:
        return bool(jurisdiction.region and station.region and station.region.lower().strip() == jurisdiction.region.lower().strip())

    if jurisdiction.role_name == ROLE_DISTRICT_ADMIN:
        return bool(jurisdiction.district and station.district.lower().strip() == jurisdiction.district.lower().strip())

    # Station Administrator, Investigating Officer, Authorized Personnel
    return bool(jurisdiction.station_id and case.police_station_id == jurisdiction.station_id)

def can_modify_case(user: UserModel, case: CaseRecordModel, new_status: Optional[str] = None) -> bool:
    if not can_access_case(user, case):
        return False

    jurisdiction = resolve_jurisdiction(user)
    if jurisdiction.is_global:
        return True

    # Investigating Officer: Must be the assigned lead officer
    if jurisdiction.role_name in (ROLE_OFFICER, ROLE_OFFICER_ALIAS):
        if case.lead_officer_id and case.lead_officer_id != user.id:
            return False
        # Sensitive status transitions require 'case:approve'
        if new_status in ("Closed", "Warrant Issued") and not jurisdiction.has_permission("case:approve"):
            return False
        return True

    # Station Admin, District Admin, Regional Admin, State Admin require case:update permission
    return jurisdiction.has_permission("case:update")

# ---------------------------------------------------------
# DATABASE QUERY JURISDICTIONAL FILTERS
# ---------------------------------------------------------

def apply_criminal_scope(query, user: UserModel, db: Session):
    jurisdiction = resolve_jurisdiction(user, db)
    if jurisdiction.is_global:
        return query

    if jurisdiction.role_name == ROLE_STATE_ADMIN and jurisdiction.state:
        return query.filter(
            or_(
                CriminalProfileModel.state.ilike(jurisdiction.state.strip()),
                CriminalProfileModel.police_station.has(PoliceStationModel.state.ilike(jurisdiction.state.strip()))
            )
        )

    if jurisdiction.role_name == ROLE_REGIONAL_ADMIN and jurisdiction.region:
        return query.filter(
            or_(
                CriminalProfileModel.region.ilike(jurisdiction.region.strip()),
                CriminalProfileModel.police_station.has(PoliceStationModel.region.ilike(jurisdiction.region.strip()))
            )
        )

    if jurisdiction.role_name == ROLE_DISTRICT_ADMIN and jurisdiction.district:
        return query.filter(
            or_(
                CriminalProfileModel.district.ilike(jurisdiction.district.strip()),
                CriminalProfileModel.police_station.has(PoliceStationModel.district.ilike(jurisdiction.district.strip()))
            )
        )

    if jurisdiction.station_id:
        station_case_subq = db.query(CriminalCaseModel.criminal_id).join(
            CaseRecordModel, CriminalCaseModel.case_id == CaseRecordModel.id
        ).filter(CaseRecordModel.police_station_id == jurisdiction.station_id)

        return query.filter(
            or_(
                CriminalProfileModel.police_station_id == jurisdiction.station_id,
                CriminalProfileModel.id.in_(station_case_subq)
            )
        )

    # Deny by default if user has no valid regional assignment
    return query.filter(CriminalProfileModel.id == "DENY_ACCESS_BY_DEFAULT")

def apply_case_scope(query, user: UserModel, db: Session):
    jurisdiction = resolve_jurisdiction(user)
    if jurisdiction.is_global:
        return query

    if jurisdiction.role_name == ROLE_STATE_ADMIN and jurisdiction.state:
        return query.join(PoliceStationModel, CaseRecordModel.police_station_id == PoliceStationModel.id).filter(
            PoliceStationModel.state.ilike(jurisdiction.state.strip())
        )

    if jurisdiction.role_name == ROLE_REGIONAL_ADMIN and jurisdiction.region:
        return query.join(PoliceStationModel, CaseRecordModel.police_station_id == PoliceStationModel.id).filter(
            PoliceStationModel.region.ilike(jurisdiction.region.strip())
        )

    if jurisdiction.role_name == ROLE_DISTRICT_ADMIN and jurisdiction.district:
        return query.join(PoliceStationModel, CaseRecordModel.police_station_id == PoliceStationModel.id).filter(
            PoliceStationModel.district.ilike(jurisdiction.district.strip())
        )

    if jurisdiction.station_id:
        return query.filter(CaseRecordModel.police_station_id == jurisdiction.station_id)

    return query.filter(CaseRecordModel.id == "DENY_ACCESS_BY_DEFAULT")

# ---------------------------------------------------------
# PRIVILEGE ESCALATION & USER MANAGEMENT CONTROLS
# ---------------------------------------------------------

def validate_user_management_authority(
    current_user: UserModel,
    target_user: Optional[UserModel],
    assigned_role: Optional[RoleModel],
    target_station_id: Optional[str],
    db: Session,
    target_region: Optional[str] = None
):
    """
    Enforces strict hierarchical administrative boundaries:
    - Super Admin: global authority, manages Regional Admins and all users.
    - Regional Admin:
        * Can only create and manage police-member accounts within their authorized region.
        * Cannot create or promote Super Admin accounts.
        * Cannot create or promote Regional Admin accounts.
        * Cannot modify accounts with equal or higher rank.
        * Cannot assign users outside their authorized region.
    - Police Members:
        * Cannot create or promote administrator or officer accounts.
        * Cannot modify their own role or clearance.
    """
    curr_jurisdiction = resolve_jurisdiction(current_user, db)

    # 1. Prevent self-escalation
    if target_user and current_user.id == target_user.id:
        if assigned_role and target_user.role_id != assigned_role.id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Security Violation: You cannot modify your own administrative role or clearance."
            )

    curr_rank = ROLE_HIERARCHY_RANK.get(curr_jurisdiction.role_name, 0)

    # Super Admin has universal administrative clearance
    if curr_jurisdiction.is_global:
        return

    # Non-superusers cannot grant equal or higher rank
    if assigned_role:
        target_role_rank = ROLE_HIERARCHY_RANK.get(assigned_role.name, 0)
        if target_role_rank >= curr_rank:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Privilege Escalation Detected: Cannot create or promote accounts to role '{assigned_role.name}' with equal or higher rank than your own."
            )

    # Target User Rank Protection
    if target_user:
        target_current_role = target_user.role.name if target_user.role else ""
        target_current_rank = ROLE_HIERARCHY_RANK.get(target_current_role, 0)
        if target_current_rank >= curr_rank:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Access Denied: You cannot modify accounts with equal or higher administrative rank ({target_current_role})."
            )

    # Regional Administrator Boundaries
    if curr_jurisdiction.role_name in (ROLE_REGIONAL_ADMIN, ROLE_STATE_ADMIN):
        # 1. Check target region
        if target_region and curr_jurisdiction.region:
            if target_region.lower().strip() != curr_jurisdiction.region.lower().strip():
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Cross-Region Violation: Cannot assign police members outside your authorized administrative region."
                )

        # 2. Check existing target user region
        if target_user and curr_jurisdiction.region:
            t_region = target_user.region or (target_user.police_station.region if target_user.police_station else None)
            if t_region and t_region.lower().strip() != curr_jurisdiction.region.lower().strip():
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Cross-Region Violation: Cannot manage users outside your authorized region."
                )

        # 3. Check target station region
        if target_station_id:
            station = db.query(PoliceStationModel).filter(PoliceStationModel.id == target_station_id).first()
            if not station:
                raise HTTPException(status_code=404, detail="Assigned police station not found.")

            if curr_jurisdiction.region and station.region:
                if station.region.lower().strip() != curr_jurisdiction.region.lower().strip():
                    raise HTTPException(
                        status_code=status.HTTP_403_FORBIDDEN,
                        detail="Cross-Region Violation: Station is outside your authorized administrative region."
                    )

    # District Administrator Boundaries
    elif curr_jurisdiction.role_name == ROLE_DISTRICT_ADMIN and curr_jurisdiction.district:
        if target_station_id:
            station = db.query(PoliceStationModel).filter(PoliceStationModel.id == target_station_id).first()
            if not station:
                raise HTTPException(status_code=404, detail="Assigned police station not found.")
            if station.district.lower().strip() != curr_jurisdiction.district.lower().strip():
                raise HTTPException(status_code=403, detail="Cross-Region Violation: Station is outside your assigned district.")

    # Station Administrator Boundaries
    elif curr_jurisdiction.role_name == ROLE_STATION_ADMIN:
        if target_station_id and target_station_id != curr_jurisdiction.station_id:
            raise HTTPException(status_code=403, detail="Cross-Station Violation: Cannot manage users outside your police station.")

    # Police Members (Officers & Authorized Personnel) cannot create/manage any users
    elif curr_rank <= 10:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access Denied: Police members are not authorized to create or manage user accounts."
        )
