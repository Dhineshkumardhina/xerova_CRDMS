from typing import List, Optional
from sqlalchemy.orm import Session
from app.repositories.criminal_repository import criminal_repo
from app.models.criminal import CriminalProfileModel
from app.core.exceptions import EntityNotFoundException

class CriminalService:
    def get_criminals(
        self, db: Session, category: Optional[str] = None, search: Optional[str] = None, skip: int = 0, limit: int = 100
    ) -> List[CriminalProfileModel]:
        return criminal_repo.get_active_criminals(db, category=category, search=search, skip=skip, limit=limit)

    def get_criminal_by_id(self, db: Session, criminal_id: str) -> CriminalProfileModel:
        criminal = criminal_repo.get(db, criminal_id)
        if not criminal or criminal.is_deleted:
            raise EntityNotFoundException("CriminalProfile", criminal_id)
        return criminal

criminal_service = CriminalService()
