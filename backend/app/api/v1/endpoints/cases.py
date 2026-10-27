from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import datetime, timezone

from app.db.session import get_db
from app.core.security import require_permission
from app.core.rbac import (
    can_access_case,
    can_modify_case,
    apply_case_scope,
    resolve_jurisdiction
)
from app.services.case_service import case_service
from app.services.audit_service import log_audit_event
import uuid
from app.models.case import CaseRecordModel, CaseActivityModel, CriminalCaseModel
from app.models.document import CaseDocumentModel
from app.models.criminal import CriminalProfileModel
from app.models.user import UserModel
from app.models.police_station import PoliceStationModel
from app.models.audit_log import AuditLogModel
from app.schemas.criminal import CaseRecordSchema, DocumentItemSchema
from app.schemas.case import (
    BulkStatusUpdateRequest,
    CaseRecordCreate,
    CaseRecordUpdate,
    CaseActivityCreate,
    CaseActivityResponse,
    CaseDetailResponse,
    LinkedPersonResponse,
    LinkPersonRequest
)
from pydantic import BaseModel

router = APIRouter()

class CaseAssignRequest(BaseModel):
    leadOfficerId: str

def case_model_to_schema(c: CaseRecordModel) -> CaseRecordSchema:
    jurisdiction_label = "Metro Central Jurisdiction"
    if c.police_station:
        jurisdiction_label = f"{c.police_station.name} ({c.police_station.district}, {c.police_station.state})"

    officer_label = "Unassigned"
    if c.lead_officer:
        officer_label = f"{c.lead_officer.full_name} ({c.lead_officer.badge_number})"

    return CaseRecordSchema(
        id=c.id,
        caseNumber=c.case_number,
        description=c.description,
        dateFiled=c.date_filed,
        status=c.status,
        jurisdiction=jurisdiction_label,
        officerInCharge=officer_label,
        category=c.category,
        courtroomNotes=c.courtroom_notes,
        penalties=c.penalties,
        courtRoom=c.court_room,
        presidingJudge=c.presiding_judge,
        penalCode=c.penal_code,
        notes=c.notes
    )

def case_model_to_detail_response(c: CaseRecordModel) -> CaseDetailResponse:
    base_s = case_model_to_schema(c)

    linked_persons = []
    for link in c.criminal_links:
        if link.criminal and not link.criminal.is_deleted:
            linked_persons.append(LinkedPersonResponse(
                id=link.criminal.id,
                name=link.criminal.name,
                role=link.role_in_case or "Primary Suspect",
                mugshotUrl=link.criminal.mugshot_url,
                status=link.criminal.status,
                identificationNumber=link.criminal.identification_number
            ))

    docs = []
    for doc_link in c.document_links:
        d = doc_link.document
        if d:
            docs.append(DocumentItemSchema(
                id=d.id,
                title=d.title,
                filename=d.filename,
                size=d.size,
                type=d.file_type,
                dateUploaded=d.date_uploaded,
                url=d.file_path
            ))

    activities = []
    for act in sorted(c.activities, key=lambda a: a.created_at, reverse=True):
        off_name = act.officer.full_name if act.officer else "Authorized Officer"
        activities.append(CaseActivityResponse(
            id=act.id,
            caseId=act.case_id,
            officerName=off_name,
            activityType=act.activity_type,
            title=act.title,
            description=act.description,
            createdAt=act.created_at.strftime("%Y-%m-%d %H:%M:%S") if act.created_at else "Just now"
        ))

    return CaseDetailResponse(
        id=base_s.id,
        caseNumber=base_s.caseNumber,
        title=c.title,
        description=base_s.description,
        dateFiled=base_s.dateFiled,
        status=base_s.status,
        category=base_s.category,
        jurisdiction=base_s.jurisdiction,
        officerInCharge=base_s.officerInCharge,
        incidentDate=c.incident_date,
        incidentLocation=c.incident_location,
        complainantName=c.complainant_name,
        complainantPhone=c.complainant_phone,
        penalCode=c.penal_code,
        courtRoom=c.court_room,
        presidingJudge=c.presiding_judge,
        courtroomNotes=c.courtroom_notes,
        notes=c.notes,
        penalties=c.penalties,
        linkedPersons=linked_persons,
        documents=docs,
        activities=activities
    )

@router.get("", response_model=List[CaseRecordSchema])
def get_cases(
    status: Optional[str] = None,
    category: Optional[str] = None,
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(require_permission("case:read"))
):
    query = db.query(CaseRecordModel).filter(CaseRecordModel.is_deleted == False)
    
    # Enforce regional case boundaries
    query = apply_case_scope(query, current_user, db)

    if status:
        query = query.filter(CaseRecordModel.status == status)
    if category:
        query = query.filter(CaseRecordModel.category == category)

    cases = query.order_by(CaseRecordModel.created_at.desc()).offset(skip).limit(limit).all()
    return [case_model_to_schema(c) for c in cases]

@router.post("", response_model=CaseRecordSchema)
def create_case_or_fir(
    req: CaseRecordCreate,
    request: Request,
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(require_permission("case:create"))
):
    """
    Registers a new FIR / Case Dossier with unique reference generation,
    jurisdiction binding, optional suspect linkages, and initial activity milestone.
    """
    jurisdiction = resolve_jurisdiction(current_user)

    # 1. Generate unique FIR reference if not provided
    year_str = datetime.now().strftime("%Y")
    if req.caseNumber and req.caseNumber.strip():
        fir_number = req.caseNumber.strip()
        # Reject duplicate explicit FIR reference
        if db.query(CaseRecordModel).filter(CaseRecordModel.case_number == fir_number).first():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Case / FIR record with reference '{fir_number}' already exists in repository."
            )
    else:
        # Generate standard FIR reference format: FIR-{YEAR}-{RANDOM}
        fir_number = f"FIR-{year_str}-{uuid.uuid4().hex[:6].upper()}"

    # 2. Determine police station binding
    assigned_station_id = req.policeStationId or jurisdiction.station_id
    if not assigned_station_id:
        default_station = db.query(PoliceStationModel).first()
        if default_station:
            assigned_station_id = default_station.id

    # 3. Determine lead officer
    lead_officer_id = req.leadOfficerId
    if not lead_officer_id and jurisdiction.role_name in ("Officer", "Investigating Officer"):
        lead_officer_id = current_user.id

    case_id = str(uuid.uuid4())
    today_str = datetime.now().strftime("%b %d, %Y")

    new_case = CaseRecordModel(
        id=case_id,
        case_number=fir_number,
        title=req.title or f"{req.category} Incident Docket",
        description=req.description.strip(),
        date_filed=req.dateFiled or today_str,
        status=req.status or "Under Investigation",
        category=req.category or "Theft",
        police_station_id=assigned_station_id,
        lead_officer_id=lead_officer_id,
        incident_date=req.incidentDate or today_str,
        incident_location=req.incidentLocation,
        complainant_name=req.complainantName,
        complainant_phone=req.complainantPhone,
        penal_code=req.penalCode,
        court_room=req.courtRoom,
        presiding_judge=req.presidingJudge,
        courtroom_notes=req.courtroomNotes,
        notes=req.notes,
        penalties=req.penalties
    )

    try:
        db.add(new_case)

        # 4. Link initial suspects if provided
        if req.suspectIds:
            for s_id in req.suspectIds:
                crim = db.query(CriminalProfileModel).filter(CriminalProfileModel.id == s_id).first()
                if crim:
                    link = CriminalCaseModel(
                        criminal_id=crim.id,
                        case_id=case_id,
                        role_in_case="Primary Suspect"
                    )
                    db.add(link)

        # 5. Add initial intake milestone activity
        init_activity = CaseActivityModel(
            id=str(uuid.uuid4()),
            case_id=case_id,
            officer_id=current_user.id,
            activity_type="FIR Intake",
            title="First Information Report Registered",
            description=f"Initial FIR {fir_number} officially recorded and docketed by {current_user.full_name} ({current_user.badge_number}). Status: {new_case.status}."
        )
        db.add(init_activity)

        log_audit_event(
            db=db,
            action="FIR Registered",
            resource_type="Case",
            resource_id=case_id,
            subject_name=fir_number,
            result="SUCCESS",
            user_id=current_user.id,
            officer_name=current_user.full_name,
            request=request,
            details={"case_number": fir_number, "category": req.category}
        )

        db.commit()
        db.refresh(new_case)
        return case_model_to_schema(new_case)
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Database transaction failed during FIR registration: {str(e)}")

@router.get("/{case_id}", response_model=CaseRecordSchema)
def get_case_by_id(
    case_id: str,
    request: Request,
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(require_permission("case:read"))
):
    case_obj = db.query(CaseRecordModel).filter(
        CaseRecordModel.id == case_id,
        CaseRecordModel.is_deleted == False
    ).first()
    if not case_obj:
        raise HTTPException(status_code=404, detail="Case record not found")

    if not can_access_case(current_user, case_obj):
        log_audit_event(
            db=db,
            action="ACCESS_DENIED",
            resource_type="Case",
            resource_id=case_obj.id,
            subject_name=case_obj.case_number,
            result="FAILED",
            user_id=current_user.id,
            officer_name=current_user.full_name,
            request=request
        )
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access Denied: Jurisdictional restriction. You do not have clearance to view this case."
        )

    return case_model_to_schema(case_obj)

@router.get("/{case_id}/detail", response_model=CaseDetailResponse)
def get_case_detail_with_activities(
    case_id: str,
    request: Request,
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(require_permission("case:read"))
):
    """
    Returns full investigative case dossier including linked suspects,
    chain-of-custody documents, and chronological timeline activities.
    """
    case_obj = db.query(CaseRecordModel).filter(
        CaseRecordModel.id == case_id,
        CaseRecordModel.is_deleted == False
    ).first()
    if not case_obj:
        raise HTTPException(status_code=404, detail="Case record not found")

    if not can_access_case(current_user, case_obj):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access Denied: Jurisdictional restriction. You do not have clearance to view this case."
        )

    return case_model_to_detail_response(case_obj)

@router.put("/{case_id}", response_model=CaseRecordSchema)
def update_case(
    case_id: str,
    req: CaseRecordUpdate,
    request: Request,
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(require_permission("case:update"))
):
    """
    Updates authorized case/FIR fields, verifies ownership and approval permissions
    for sensitive status transitions, logs activity, and records audit trail.
    """
    case_obj = db.query(CaseRecordModel).filter(
        CaseRecordModel.id == case_id,
        CaseRecordModel.is_deleted == False
    ).first()
    if not case_obj:
        raise HTTPException(status_code=404, detail="Case record not found")

    if not can_modify_case(current_user, case_obj, new_status=req.status):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access Denied: You do not have authorization or ownership to modify this case."
        )

    prev_status = case_obj.status
    if req.title is not None:
        case_obj.title = req.title.strip()
    if req.description is not None:
        case_obj.description = req.description.strip()
    if req.category is not None:
        case_obj.category = req.category.strip()
    if req.status is not None:
        case_obj.status = req.status.strip()
    if req.incidentDate is not None:
        case_obj.incident_date = req.incidentDate
    if req.incidentLocation is not None:
        case_obj.incident_location = req.incidentLocation
    if req.complainantName is not None:
        case_obj.complainant_name = req.complainantName
    if req.complainantPhone is not None:
        case_obj.complainant_phone = req.complainantPhone
    if req.penalCode is not None:
        case_obj.penal_code = req.penalCode
    if req.courtRoom is not None:
        case_obj.court_room = req.courtRoom
    if req.presidingJudge is not None:
        case_obj.presiding_judge = req.presidingJudge
    if req.courtroomNotes is not None:
        case_obj.courtroom_notes = req.courtroomNotes
    if req.notes is not None:
        case_obj.notes = req.notes
    if req.penalties is not None:
        case_obj.penalties = req.penalties

    try:
        # If status transitioned, record an activity milestone
        if req.status and req.status != prev_status:
            act = CaseActivityModel(
                id=str(uuid.uuid4()),
                case_id=case_obj.id,
                officer_id=current_user.id,
                activity_type="Status Change",
                title=f"Status Transitioned to '{req.status}'",
                description=f"Case status modified from '{prev_status}' to '{req.status}' by {current_user.full_name}."
            )
            db.add(act)

        log_audit_event(
            db=db,
            action="Status Updated",
            resource_type="Case",
            resource_id=case_obj.id,
            subject_name=case_obj.case_number,
            result="SUCCESS",
            user_id=current_user.id,
            officer_name=current_user.full_name,
            request=request,
            details={"new_status": case_obj.status}
        )

        db.commit()
        db.refresh(case_obj)
        return case_model_to_schema(case_obj)
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Database transaction failed during case update: {str(e)}")

@router.post("/{case_id}/activities", response_model=CaseActivityResponse)
def add_case_activity(
    case_id: str,
    req: CaseActivityCreate,
    request: Request,
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(require_permission("case:update"))
):
    """
    Records an investigative milestone, suspect interrogation note, or evidence note.
    """
    case_obj = db.query(CaseRecordModel).filter(
        CaseRecordModel.id == case_id,
        CaseRecordModel.is_deleted == False
    ).first()
    if not case_obj:
        raise HTTPException(status_code=404, detail="Case record not found")

    if not can_modify_case(current_user, case_obj):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access Denied: You do not have clearance to record investigation notes on this case."
        )

    act_id = str(uuid.uuid4())
    act = CaseActivityModel(
        id=act_id,
        case_id=case_id,
        officer_id=current_user.id,
        activity_type=req.activityType,
        title=req.title.strip(),
        description=req.description.strip()
    )

    try:
        db.add(act)
        db.commit()
        db.refresh(act)

        log_audit_event(
            db=db,
            action="Case Activity Logged",
            resource_type="Case",
            resource_id=case_obj.id,
            subject_name=case_obj.case_number,
            result="SUCCESS",
            user_id=current_user.id,
            officer_name=current_user.full_name,
            request=request,
            details={"activity_type": req.activityType, "title": req.title}
        )

        return CaseActivityResponse(
            id=act.id,
            caseId=act.case_id,
            officerName=current_user.full_name,
            activityType=act.activity_type,
            title=act.title,
            description=act.description,
            createdAt=act.created_at.strftime("%Y-%m-%d %H:%M:%S")
        )
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to record case activity: {str(e)}")

@router.post("/{case_id}/link-person")
def link_person_to_case(
    case_id: str,
    req: LinkPersonRequest,
    request: Request,
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(require_permission("case:update"))
):
    """
    Links a person (criminal, suspect, or witness) to a case with a designated role.
    """
    case_obj = db.query(CaseRecordModel).filter(
        CaseRecordModel.id == case_id,
        CaseRecordModel.is_deleted == False
    ).first()
    if not case_obj:
        raise HTTPException(status_code=404, detail="Case record not found")

    if not can_modify_case(current_user, case_obj):
        raise HTTPException(status_code=403, detail="Access Denied: Jurisdictional restriction.")

    crim = db.query(CriminalProfileModel).filter(
        CriminalProfileModel.id == req.criminalId,
        CriminalProfileModel.is_deleted == False
    ).first()
    if not crim:
        raise HTTPException(status_code=404, detail="Target person/criminal profile not found")

    existing_link = db.query(CriminalCaseModel).filter(
        CriminalCaseModel.case_id == case_id,
        CriminalCaseModel.criminal_id == req.criminalId
    ).first()

    try:
        if existing_link:
            existing_link.role_in_case = req.roleInCase
        else:
            new_link = CriminalCaseModel(
                criminal_id=crim.id,
                case_id=case_obj.id,
                role_in_case=req.roleInCase
            )
            db.add(new_link)

        # Record activity
        act = CaseActivityModel(
            id=str(uuid.uuid4()),
            case_id=case_id,
            officer_id=current_user.id,
            activity_type="Person Linked",
            title=f"Person Linked: {crim.name}",
            description=f"{crim.name} ({crim.id}) attached to case docket as '{req.roleInCase}'."
        )
        db.add(act)

        db.commit()
        return {"status": "success", "message": f"Linked {crim.name} as {req.roleInCase}"}
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to link person to case: {str(e)}")


@router.post("/bulk-status")
def bulk_update_case_status(
    req: BulkStatusUpdateRequest,
    request: Request,
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(require_permission("case:update"))
):
    if not req.caseIds:
        return {"updatedCount": 0}

    # Fetch cases and verify ownership & approval authorization
    cases = db.query(CaseRecordModel).filter(
        CaseRecordModel.id.in_(req.caseIds),
        CaseRecordModel.is_deleted == False
    ).all()

    if len(cases) != len(req.caseIds):
        raise HTTPException(status_code=404, detail="One or more specified cases do not exist")

    for case_obj in cases:
        if not can_modify_case(current_user, case_obj, new_status=req.newStatus):
            log_audit_event(
                db=db,
                action="CASE_UPDATE_DENIED",
                resource_type="Case",
                resource_id=case_obj.id,
                subject_name=case_obj.case_number,
                result="FAILED",
                user_id=current_user.id,
                officer_name=current_user.full_name,
                request=request
            )
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Access Denied: You do not have authorization or ownership to modify case {case_obj.case_number} to '{req.newStatus}'."
            )

    try:
        updated_count = db.query(CaseRecordModel).filter(CaseRecordModel.id.in_(req.caseIds)).update(
            {CaseRecordModel.status: req.newStatus}, synchronize_session=False
        )
        
        action_type = "Case Closed" if req.newStatus == "Closed" else ("Warrant Issued" if req.newStatus == "Warrant Issued" else "Status Updated")
        audit = AuditLogModel(
            user_id=current_user.id,
            officer_name=current_user.full_name,
            action=action_type,
            subject_id="BULK-UPDATE",
            subject_name=f"{len(req.caseIds)} Case Dossiers",
            details={"message": f"Bulk updated status of {len(req.caseIds)} cases to {req.newStatus}"}
        )
        db.add(audit)
        db.commit()
        return {"updatedCount": updated_count, "newStatus": req.newStatus}
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Database transaction failed during bulk status update: {str(e)}")

@router.post("/{case_id}/assign")
def assign_lead_officer(
    case_id: str,
    req: CaseAssignRequest,
    request: Request,
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(require_permission("case:assign"))
):
    case_obj = db.query(CaseRecordModel).filter(
        CaseRecordModel.id == case_id,
        CaseRecordModel.is_deleted == False
    ).first()
    if not case_obj:
        raise HTTPException(status_code=404, detail="Case record not found")

    if not can_access_case(current_user, case_obj):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access Denied: Case is outside your regional jurisdiction."
        )

    target_officer = db.query(UserModel).filter(UserModel.id == req.leadOfficerId, UserModel.is_active == True).first()
    if not target_officer:
        raise HTTPException(status_code=404, detail="Target investigating officer not found")

    # Prevent inconsistent case assignments: target officer must have jurisdictional clearance for the case
    if not can_access_case(target_officer, case_obj):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Inconsistent Case Assignment: Officer {target_officer.full_name} ({target_officer.badge_number}) does not have clearance or jurisdiction for this case's station/region."
        )

    try:
        case_obj.lead_officer_id = target_officer.id
        
        log_audit_event(
            db=db,
            action="ASSIGN_CASE_OFFICER",
            resource_type="Case",
            resource_id=case_obj.id,
            subject_name=case_obj.case_number,
            result="SUCCESS",
            user_id=current_user.id,
            officer_name=current_user.full_name,
            request=request,
            details={"assigned_to": target_officer.full_name, "badge": target_officer.badge_number}
        )
        db.commit()
        return {"status": "success", "caseId": case_id, "leadOfficer": target_officer.full_name}
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Database transaction failed during case assignment: {str(e)}")

@router.delete("/{case_id}")
def delete_case(
    case_id: str,
    request: Request,
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(require_permission("case:delete"))
):
    case_obj = db.query(CaseRecordModel).filter(
        CaseRecordModel.id == case_id,
        CaseRecordModel.is_deleted == False
    ).first()
    if not case_obj:
        raise HTTPException(status_code=404, detail="Case record not found")

    if not can_access_case(current_user, case_obj):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access Denied: Case is outside your regional jurisdiction."
        )

    try:
        case_obj.is_deleted = True
        log_audit_event(
            db=db,
            action="DELETE_CASE",
            resource_type="Case",
            resource_id=case_obj.id,
            subject_name=case_obj.case_number,
            result="SUCCESS",
            user_id=current_user.id,
            officer_name=current_user.full_name,
            request=request
        )
        db.commit()
        return {"status": "success", "message": f"Case {case_id} deleted successfully"}
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Database transaction failed during case deletion: {str(e)}")
