from typing import List, Optional
from sqlalchemy.orm import Session
from app.repositories.base import CRUDBase
from app.models.audit_log import AuditLogModel

class AuditRepository(CRUDBase[AuditLogModel]):
    def __init__(self):
        super().__init__(AuditLogModel)

    def get_recent_logs(self, db: Session, limit: int = 100) -> List[AuditLogModel]:
        return db.query(AuditLogModel).order_by(AuditLogModel.timestamp.desc()).limit(limit).all()

audit_repo = AuditRepository()
