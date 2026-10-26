from typing import List
from sqlalchemy.orm import Session
from app.repositories.category_repository import category_repo
from app.models.case import CrimeCategoryModel

class CategoryService:
    def get_categories(self, db: Session) -> List[CrimeCategoryModel]:
        return category_repo.get_all_categories(db)

category_service = CategoryService()
