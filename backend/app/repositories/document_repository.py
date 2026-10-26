from typing import List, Optional
from sqlalchemy.orm import Session
from app.repositories.base import CRUDBase
from app.models.document import DocumentItemModel

class DocumentRepository(CRUDBase[DocumentItemModel]):
    def __init__(self):
        super().__init__(DocumentItemModel)

    def get_by_hash(self, db: Session, file_hash: str) -> Optional[DocumentItemModel]:
        return db.query(DocumentItemModel).filter(DocumentItemModel.file_hash_sha256 == file_hash).first()

document_repo = DocumentRepository()
