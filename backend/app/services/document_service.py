from typing import List
from sqlalchemy.orm import Session
from app.repositories.document_repository import document_repo
from app.models.document import DocumentItemModel

class DocumentService:
    def get_documents(self, db: Session, skip: int = 0, limit: int = 100) -> List[DocumentItemModel]:
        return document_repo.get_multi(db, skip=skip, limit=limit)

document_service = DocumentService()
