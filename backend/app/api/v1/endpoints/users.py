from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from typing import List
from app.db.session import get_db
from app.core.security import require_permission
from app.services.user_service import user_service
from app.models.user import UserModel
from app.schemas.user import UserOfficerSchema

router = APIRouter()

@router.get("", response_model=List[UserOfficerSchema])
def get_users(
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(require_permission("users:manage"))
):
    users = user_service.get_users(db)
    return [
        UserOfficerSchema(
            id=u.id,
            username=u.username,
            name=u.full_name,
            badgeNumber=u.badge_number,
            rank=u.rank,
            department=u.department,
            clearanceLevel=u.clearance_level,
            avatarUrl=u.avatar_url or "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=256",
            isSuperuser=u.is_superuser
        ) for u in users
    ]

@router.get("/{user_id}", response_model=UserOfficerSchema)
def get_user_by_id(
    user_id: str,
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(require_permission("users:manage"))
):
    u = user_service.get_user_by_id(db, user_id)
    return UserOfficerSchema(
        id=u.id,
        username=u.username,
        name=u.full_name,
        badgeNumber=u.badge_number,
        rank=u.rank,
        department=u.department,
        clearanceLevel=u.clearance_level,
        avatarUrl=u.avatar_url or "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=256",
        isSuperuser=u.is_superuser
    )
