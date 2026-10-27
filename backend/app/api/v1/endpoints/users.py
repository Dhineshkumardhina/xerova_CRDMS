import uuid
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, status, Request, Query
from sqlalchemy.orm import Session
from sqlalchemy import or_, and_, desc
from typing import List, Optional

from app.db.session import get_db
from app.core.security import require_permission, require_any_permission, get_password_hash, get_current_user
from app.core.rbac import (
    resolve_jurisdiction,
    validate_user_management_authority,
    has_criminal_create_permission,
    ROLE_SUPER_ADMIN,
    ROLE_SUPER_ADMIN_ALIAS,
    ROLE_STATE_ADMIN,
    ROLE_REGIONAL_ADMIN,
    ROLE_DISTRICT_ADMIN,
    ROLE_STATION_ADMIN,
    PERM_CRIMINAL_CREATE,
    PERM_CRIMINAL_CREATE_LEGACY
)
from app.services.audit_service import log_audit_event
from app.models.user import UserModel
from app.models.role_permission import RoleModel, PermissionModel, UserPermissionGrantModel
from app.models.police_station import PoliceStationModel
from app.schemas.user import (
    UserOfficerSchema,
    UserCreateRequest,
    UserUpdateRequest,
    PermissionGrantRevokeRequest,
    PermissionGrantItemSchema
)

router = APIRouter()

def user_to_schema(u: UserModel, db: Session) -> UserOfficerSchema:
    can_create = has_criminal_create_permission(u, db)
    
    perms = set()
    if u.is_superuser or (u.role and u.role.name in (ROLE_SUPER_ADMIN, ROLE_SUPER_ADMIN_ALIAS)):
        all_perms = db.query(PermissionModel.code).all()
        perms = {p[0] for p in all_perms}
    else:
        if u.role and u.role.permissions:
            perms = {p.code for p in u.role.permissions}
        # Add active explicit grants
        active_grants = db.query(UserPermissionGrantModel.permission_code).filter(
            UserPermissionGrantModel.user_id == u.id,
            UserPermissionGrantModel.is_granted == True
        ).all()
        for g in active_grants:
            perms.add(g[0])

    if can_create:
        perms.add(PERM_CRIMINAL_CREATE)
        perms.add(PERM_CRIMINAL_CREATE_LEGACY)

    return UserOfficerSchema(
        id=u.id,
        username=u.username,
        name=u.full_name,
        badgeNumber=u.badge_number,
        rank=u.rank,
        department=u.department,
        clearanceLevel=u.clearance_level,
        avatarUrl=u.avatar_url or "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=256",
        status="Active" if u.is_active else "Suspended",
        isActive=u.is_active,
        isSuperuser=u.is_superuser,
        role=u.role.name if u.role else None,
        roleId=u.role_id,
        policeStationId=u.police_station_id,
        district=u.district,
        state=u.state,
        region=u.region,
        canCreateCriminals=can_create,
        permissions=sorted(list(perms))
    )

def filter_users_by_jurisdiction(query, current_user: UserModel, db: Session):
    jurisdiction = resolve_jurisdiction(current_user, db)
    if jurisdiction.is_global:
        return query

    if jurisdiction.role_name == ROLE_STATE_ADMIN and jurisdiction.state:
        return query.filter(
            or_(
                UserModel.state.ilike(jurisdiction.state.strip()),
                UserModel.police_station.has(PoliceStationModel.state.ilike(jurisdiction.state.strip()))
            )
        )

    if jurisdiction.role_name == ROLE_REGIONAL_ADMIN and jurisdiction.region:
        return query.filter(
            or_(
                UserModel.region.ilike(jurisdiction.region.strip()),
                UserModel.police_station.has(PoliceStationModel.region.ilike(jurisdiction.region.strip()))
            )
        )

    if jurisdiction.role_name == ROLE_DISTRICT_ADMIN and jurisdiction.district:
        return query.filter(
            or_(
                UserModel.district.ilike(jurisdiction.district.strip()),
                UserModel.police_station.has(PoliceStationModel.district.ilike(jurisdiction.district.strip()))
            )
        )

    if jurisdiction.role_name == ROLE_STATION_ADMIN and jurisdiction.station_id:
        return query.filter(UserModel.police_station_id == jurisdiction.station_id)

    # Deny by default
    return query.filter(UserModel.id == current_user.id)

# ---------------------------------------------------------
# PERMISSION GRANT & REVOCATION MANAGEMENT (SUPER ADMIN ONLY)
# ---------------------------------------------------------

permissions_router = APIRouter()

@router.get("/permissions/criminal-create-grants", response_model=List[PermissionGrantItemSchema])
@permissions_router.get("/criminal-create-grants", response_model=List[PermissionGrantItemSchema])
def list_criminal_create_grants(
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(get_current_user)
):
    """
    Super Admin inspects who has criminal_records.create permission and who granted it,
    along with full revocation history.
    """
    jurisdiction = resolve_jurisdiction(current_user, db)
    if not jurisdiction.is_global:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access Denied: Only Super Administrators can inspect permission grants and audit records."
        )

    grants = db.query(UserPermissionGrantModel).order_by(desc(UserPermissionGrantModel.created_at)).all()
    results = []
    for g in grants:
        target_u = g.user
        granter_u = g.granted_by
        revoker_u = g.revoked_by
        results.append(PermissionGrantItemSchema(
            id=g.id,
            userId=g.user_id,
            username=target_u.username if target_u else "unknown",
            officerName=target_u.full_name if target_u else "Unknown Officer",
            badgeNumber=target_u.badge_number if target_u else "N/A",
            region=target_u.region if target_u else None,
            permissionCode=g.permission_code,
            isGranted=g.is_granted,
            grantedById=g.granted_by_id,
            grantedByName=granter_u.full_name if granter_u else None,
            grantedAt=str(g.granted_at),
            revokedById=g.revoked_by_id,
            revokedByName=revoker_u.full_name if revoker_u else None,
            revokedAt=str(g.revoked_at) if g.revoked_at else None,
            reason=g.reason
        ))
    return results

@router.post("/permissions/grant")
@permissions_router.post("/grant")
def grant_permission_endpoint(
    req: PermissionGrantRevokeRequest,
    request: Request,
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(get_current_user)
):
    """
    Super Admin grants criminal record creation or other protected permissions to an eligible account.
    """
    return execute_permission_change(req.userId, req.permission or PERM_CRIMINAL_CREATE, True, req.reason, request, db, current_user)

@router.post("/permissions/revoke")
@permissions_router.post("/revoke")
def revoke_permission_endpoint(
    req: PermissionGrantRevokeRequest,
    request: Request,
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(get_current_user)
):
    """
    Super Admin revokes criminal record creation or other protected permissions immediately.
    """
    return execute_permission_change(req.userId, req.permission or PERM_CRIMINAL_CREATE, False, req.reason, request, db, current_user)

@router.post("/{user_id}/permissions/criminal-create")
def toggle_user_criminal_permission(
    user_id: str,
    req: PermissionGrantRevokeRequest,
    request: Request,
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(get_current_user)
):
    """
    Direct endpoint for Super Admin to grant or revoke criminal record creation for a designated user.
    """
    return execute_permission_change(user_id, PERM_CRIMINAL_CREATE, req.granted, req.reason, request, db, current_user)

def execute_permission_change(
    user_id: Optional[str],
    permission_code: str,
    grant: bool,
    reason: Optional[str],
    request: Request,
    db: Session,
    current_user: UserModel
):
    # Strictly Super Admin Only
    jurisdiction = resolve_jurisdiction(current_user, db)
    if not jurisdiction.is_global:
        log_audit_event(
            db=db,
            action="UNAUTHORIZED_PERMISSION_ATTEMPT",
            resource_type="Permission",
            resource_id=user_id or "unknown",
            subject_name=current_user.full_name,
            result="DENIED",
            user_id=current_user.id,
            officer_name=current_user.full_name,
            request=request,
            details={"attempted_action": "GRANT" if grant else "REVOKE", "permission": permission_code}
        )
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access Denied: Only Super Administrators can grant or revoke criminal record creation permissions."
        )

    if not user_id:
        raise HTTPException(status_code=400, detail="Target user ID is required.")

    target_user = db.query(UserModel).filter(UserModel.id == user_id).first()
    if not target_user:
        raise HTTPException(status_code=404, detail="Target user not found.")

    now_utc = datetime.now(timezone.utc)
    canonical_perm = PERM_CRIMINAL_CREATE

    grant_record = db.query(UserPermissionGrantModel).filter(
        UserPermissionGrantModel.user_id == target_user.id,
        UserPermissionGrantModel.permission_code.in_([PERM_CRIMINAL_CREATE, PERM_CRIMINAL_CREATE_LEGACY])
    ).first()

    if grant:
        if not grant_record:
            grant_record = UserPermissionGrantModel(
                id=str(uuid.uuid4()),
                user_id=target_user.id,
                permission_code=canonical_perm,
                is_granted=True,
                granted_by_id=current_user.id,
                granted_at=now_utc,
                reason=reason or "Authorized by Super Admin"
            )
            db.add(grant_record)
        else:
            grant_record.permission_code = canonical_perm
            grant_record.is_granted = True
            grant_record.granted_by_id = current_user.id
            grant_record.granted_at = now_utc
            grant_record.revoked_by_id = None
            grant_record.revoked_at = None
            grant_record.reason = reason or "Re-authorized by Super Admin"

        log_audit_event(
            db=db,
            action="GRANT_CRIMINAL_CREATE_PERMISSION",
            resource_type="Permission",
            resource_id=target_user.id,
            subject_name=target_user.full_name,
            result="SUCCESS",
            user_id=current_user.id,
            officer_name=current_user.full_name,
            request=request,
            details={
                "permission": canonical_perm,
                "badge": target_user.badge_number,
                "granted_by": current_user.full_name,
                "reason": reason
            }
        )
    else:
        if grant_record:
            grant_record.is_granted = False
            grant_record.revoked_by_id = current_user.id
            grant_record.revoked_at = now_utc
            grant_record.reason = reason or "Revoked by Super Admin"
        else:
            grant_record = UserPermissionGrantModel(
                id=str(uuid.uuid4()),
                user_id=target_user.id,
                permission_code=canonical_perm,
                is_granted=False,
                granted_by_id=current_user.id,
                granted_at=now_utc,
                revoked_by_id=current_user.id,
                revoked_at=now_utc,
                reason=reason or "Explicitly disabled by Super Admin"
            )
            db.add(grant_record)

        log_audit_event(
            db=db,
            action="REVOKE_CRIMINAL_CREATE_PERMISSION",
            resource_type="Permission",
            resource_id=target_user.id,
            subject_name=target_user.full_name,
            result="SUCCESS",
            user_id=current_user.id,
            officer_name=current_user.full_name,
            request=request,
            details={
                "permission": canonical_perm,
                "badge": target_user.badge_number,
                "revoked_by": current_user.full_name,
                "reason": reason
            }
        )

    db.commit()
    db.refresh(grant_record)
    return {
        "status": "success",
        "userId": target_user.id,
        "permission": canonical_perm,
        "isGranted": grant_record.is_granted,
        "message": f"Criminal record creation permission {'granted to' if grant else 'revoked from'} {target_user.full_name}"
    }

# ---------------------------------------------------------
# USER ACCOUNTS MANAGEMENT
# ---------------------------------------------------------

@router.get("", response_model=List[UserOfficerSchema])
def get_users(
    include_inactive: bool = Query(False),
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(require_any_permission("users:manage", "case:assign"))
):
    query = db.query(UserModel)
    if not include_inactive:
        query = query.filter(UserModel.is_active == True)
    query = filter_users_by_jurisdiction(query, current_user, db)
    users = query.all()
    return [user_to_schema(u, db) for u in users]

@router.get("/{user_id}", response_model=UserOfficerSchema)
def get_user_by_id(
    user_id: str,
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(require_permission("users:manage"))
):
    u = db.query(UserModel).filter(UserModel.id == user_id).first()
    if not u:
        raise HTTPException(status_code=404, detail="User not found")

    # Jurisdictional check
    jurisdiction = resolve_jurisdiction(current_user, db)
    if not jurisdiction.is_global:
        allowed = filter_users_by_jurisdiction(
            db.query(UserModel).filter(UserModel.id == user_id), current_user, db
        ).first()
        if not allowed:
            raise HTTPException(status_code=403, detail="Access Denied: User is outside your administrative jurisdiction.")

    return user_to_schema(u, db)

@router.post("", response_model=UserOfficerSchema)
def create_user(
    req: UserCreateRequest,
    request: Request,
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(require_permission("users:manage"))
):
    curr_jurisdiction = resolve_jurisdiction(current_user, db)

    # Check for duplicate username or badge number
    existing_user = db.query(UserModel).filter(
        or_(UserModel.username == req.username, UserModel.badge_number == req.badgeNumber)
    ).first()
    if existing_user:
        raise HTTPException(status_code=400, detail="Username or badge number is already registered.")

    # Resolve target role
    target_role = None
    if req.roleId:
        target_role = db.query(RoleModel).filter(RoleModel.id == req.roleId).first()
    elif req.roleName:
        target_role = db.query(RoleModel).filter(RoleModel.name == req.roleName).first()

    if not target_role:
        target_role = db.query(RoleModel).filter(RoleModel.name == "Officer").first()

    # Determine region assignment: if created by Regional Admin, bind to their region
    assigned_region = req.region
    if curr_jurisdiction.role_name == ROLE_REGIONAL_ADMIN:
        assigned_region = curr_jurisdiction.region or req.region

    # Enforce privilege escalation and jurisdiction boundaries
    validate_user_management_authority(
        current_user=current_user,
        target_user=None,
        assigned_role=target_role,
        target_station_id=req.policeStationId,
        db=db,
        target_region=assigned_region
    )

    new_user = UserModel(
        id=str(uuid.uuid4()),
        username=req.username.strip(),
        hashed_password=get_password_hash(req.password),
        full_name=req.fullName.strip(),
        badge_number=req.badgeNumber.strip(),
        rank=req.rank or "Patrol Officer",
        department=req.department or "General Policing",
        clearance_level=req.clearanceLevel or "Level 2 - Confidential",
        role_id=target_role.id if target_role else None,
        police_station_id=req.policeStationId,
        district=req.district,
        state=req.state or current_user.state,
        region=assigned_region,
        is_active=True,
        is_superuser=False
    )
    db.add(new_user)
    db.flush()

    audit_action = "CREATE_REGIONAL_ADMIN" if target_role and target_role.name == ROLE_REGIONAL_ADMIN else "CREATE_USER"
    log_audit_event(
        db=db,
        action=audit_action,
        resource_type="User",
        resource_id=new_user.id,
        subject_name=new_user.full_name,
        result="SUCCESS",
        user_id=current_user.id,
        officer_name=current_user.full_name,
        request=request,
        details={
            "badge": new_user.badge_number,
            "role": target_role.name if target_role else "None",
            "region": new_user.region
        }
    )
    db.commit()
    db.refresh(new_user)
    return user_to_schema(new_user, db)

@router.put("/{user_id}", response_model=UserOfficerSchema)
def update_user(
    user_id: str,
    req: UserUpdateRequest,
    request: Request,
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(require_permission("users:manage"))
):
    target_user = db.query(UserModel).filter(UserModel.id == user_id).first()
    if not target_user:
        raise HTTPException(status_code=404, detail="User not found")

    target_role = None
    if req.roleId:
        target_role = db.query(RoleModel).filter(RoleModel.id == req.roleId).first()
    elif req.roleName:
        target_role = db.query(RoleModel).filter(RoleModel.name == req.roleName).first()

    # Enforce privilege escalation and self-escalation guards
    validate_user_management_authority(
        current_user=current_user,
        target_user=target_user,
        assigned_role=target_role,
        target_station_id=req.policeStationId,
        db=db,
        target_region=req.region
    )

    status_changed = False
    new_status_action = None

    if req.fullName is not None:
        target_user.full_name = req.fullName.strip()
    if req.rank is not None:
        target_user.rank = req.rank
    if req.department is not None:
        target_user.department = req.department
    if req.clearanceLevel is not None:
        if current_user.id == target_user.id and not current_user.is_superuser:
            raise HTTPException(status_code=403, detail="Security Violation: Cannot modify your own clearance level.")
        target_user.clearance_level = req.clearanceLevel
    if target_role is not None:
        target_user.role_id = target_role.id
    if req.policeStationId is not None:
        target_user.police_station_id = req.policeStationId
    if req.district is not None:
        target_user.district = req.district
    if req.state is not None:
        target_user.state = req.state
    if req.region is not None:
        target_user.region = req.region
    if req.isActive is not None:
        if target_user.is_active != req.isActive:
            status_changed = True
            new_status_action = "ACTIVATE_USER" if req.isActive else "SUSPEND_USER"
        target_user.is_active = req.isActive

    audit_action = new_status_action if status_changed else "UPDATE_USER"
    log_audit_event(
        db=db,
        action=audit_action,
        resource_type="User",
        resource_id=target_user.id,
        subject_name=target_user.full_name,
        result="SUCCESS",
        user_id=current_user.id,
        officer_name=current_user.full_name,
        request=request,
        details={
            "updated_fields": list(req.model_dump(exclude_unset=True).keys()),
            "status": "Active" if target_user.is_active else "Suspended"
        }
    )
    db.commit()
    db.refresh(target_user)
    return user_to_schema(target_user, db)
