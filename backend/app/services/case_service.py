from typing import List, Optional
from sqlalchemy.orm import Session
from app.repositories.case_repository import case_repo
from app.models.case import CaseRecordModel
from app.core.exceptions import EntityNotFoundException

class CaseService:
    def get_cases(
        self, db: Session, status: Optional[str] = None, category: Optional[str] = None, skip: int = 0, limit: int = 100
    ) -> List[CaseRecordModel]:
        return case_repo.get_cases_by_status(db, status=status, category=category, skip=skip, limit=limit)

    def get_case_by_id(self, db: Session, case_id: str) -> CaseRecordModel:
        case_obj = case_repo.get(db, case_id)
        if not case_obj or case_obj.is_deleted:
            raise EntityNotFoundException("CaseRecord", case_id)
        return case_obj

case_service = CaseService()
