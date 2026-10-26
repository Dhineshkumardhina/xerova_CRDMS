from typing import List, Optional
from sqlalchemy.orm import Session
from app.repositories.user_repository import user_repo
from app.models.user import UserModel
from app.core.exceptions import EntityNotFoundException

class UserService:
    def get_users(self, db: Session, skip: int = 0, limit: int = 100) -> List[UserModel]:
        return user_repo.get_multi(db, skip=skip, limit=limit)

    def get_user_by_id(self, db: Session, user_id: str) -> UserModel:
        user = user_repo.get(db, user_id)
        if not user:
            raise EntityNotFoundException("User", user_id)
        return user

user_service = UserService()
