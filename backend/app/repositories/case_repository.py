from typing import List, Optional
from sqlalchemy.orm import Session
from app.repositories.base import CRUDBase
from app.models.case import CaseRecordModel

class CaseRepository(CRUDBase[CaseRecordModel]):
    def __init__(self):
        super().__init__(CaseRecordModel)

    def get_cases_by_status(
        self, db: Session, status: Optional[str] = None, category: Optional[str] = None, skip: int = 0, limit: int = 100
    ) -> List[CaseRecordModel]:
        query = db.query(CaseRecordModel).filter(CaseRecordModel.is_deleted == False)
        if status:
            query = query.filter(CaseRecordModel.status == status)
        if category:
            query = query.filter(CaseRecordModel.category == category)
        return query.offset(skip).limit(limit).all()

case_repo = CaseRepository()
