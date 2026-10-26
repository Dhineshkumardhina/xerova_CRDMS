from fastapi import APIRouter, Depends, Query
from sqlalchemy import or_, desc
from sqlalchemy.orm import Session
from typing import List, Optional
from app.db.session import get_db
from app.core.security import require_permission
from app.models.user import UserModel
from app.models.audit_log import AuditLogModel
from app.schemas.audit import AuditLogSchema

router = APIRouter()

@router.get("", response_model=List[AuditLogSchema])
def get_audit_logs(
    action: Optional[str] = Query(None, description="Filter by audit action name"),
    resource_type: Optional[str] = Query(None, description="Filter by resource type"),
    user_id: Optional[str] = Query(None, description="Filter by user ID"),
    page: int = Query(1, ge=1, description="Page number"),
    pageSize: int = Query(50, ge=1, le=200, description="Items per page"),
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(require_permission("audit_logs:read"))
):
    query = db.query(AuditLogModel)

    if action:
        query = query.filter(AuditLogModel.action.ilike(f"%{action}%"))
    if resource_type:
        query = query.filter(AuditLogModel.resource_type.ilike(f"%{resource_type}%"))
    if user_id:
        query = query.filter(AuditLogModel.user_id == user_id)

    offset = max(0, (page - 1) * pageSize)
    logs = query.order_by(desc(AuditLogModel.timestamp)).offset(offset).limit(pageSize).all()

    res = []
    for log in logs:
        action_name = log.action
        badge_type = 'error' if log.result == 'FAILED' or 'Warrant' in action_name else ('success' if 'Closed' in action_name or log.result == 'SUCCESS' else 'neutral')

        res.append(AuditLogSchema(
            id=log.id,
            subjectName=log.subject_name or "System",
            subjectId=log.subject_id or "N/A",
            profileId=log.subject_id or "",
            action=action_name,
            time=log.time or "Recently",
            timestamp=log.timestamp.isoformat() if log.timestamp else None,
            badgeType=badge_type
        ))
    return res
