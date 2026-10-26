from typing import Optional, List
from sqlalchemy.orm import Session
from app.repositories.base import CRUDBase
from app.models.user import UserModel

class UserRepository(CRUDBase[UserModel]):
    def __init__(self):
        super().__init__(UserModel)

    def get_by_username(self, db: Session, username: str) -> Optional[UserModel]:
        return db.query(UserModel).filter(UserModel.username == username).first()

    def get_by_badge(self, db: Session, badge_number: str) -> Optional[UserModel]:
        return db.query(UserModel).filter(UserModel.badge_number == badge_number).first()

user_repo = UserRepository()
