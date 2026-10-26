from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import List, Optional
from app.db.session import get_db
from app.core.security import require_permission
from app.services.case_service import case_service
from app.models.case import CaseRecordModel
from app.models.user import UserModel
from app.models.audit_log import AuditLogModel
from app.schemas.criminal import CaseRecordSchema
from app.schemas.case import BulkStatusUpdateRequest
from datetime import datetime

router = APIRouter()

def case_model_to_schema(c: CaseRecordModel) -> CaseRecordSchema:
    return CaseRecordSchema(
        id=c.id,
        caseNumber=c.case_number,
        description=c.description,
        dateFiled=c.date_filed,
        status=c.status,
        jurisdiction="Metro Central Jurisdiction",
        officerInCharge="Senior Detective",
        category=c.category
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
    cases = case_service.get_cases(db, status=status, category=category, skip=skip, limit=limit)
    return [case_model_to_schema(c) for c in cases]

@router.get("/{case_id}", response_model=CaseRecordSchema)
def get_case_by_id(
    case_id: str,
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(require_permission("case:read"))
):
    case_obj = case_service.get_case_by_id(db, case_id)
    return case_model_to_schema(case_obj)

@router.post("/bulk-status")
def bulk_update_case_status(
    req: BulkStatusUpdateRequest,
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(require_permission("case:update"))
):
    if not req.caseIds:
        return {"updatedCount": 0}
    
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
