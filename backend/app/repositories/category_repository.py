from typing import List, Optional
from sqlalchemy.orm import Session
from app.repositories.base import CRUDBase
from app.models.case import CrimeCategoryModel

class CategoryRepository(CRUDBase[CrimeCategoryModel]):
    def __init__(self):
        super().__init__(CrimeCategoryModel)

    def get_all_categories(self, db: Session) -> List[CrimeCategoryModel]:
        return db.query(CrimeCategoryModel).order_by(CrimeCategoryModel.name).all()

category_repo = CategoryRepository()
