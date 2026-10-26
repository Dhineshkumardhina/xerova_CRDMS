from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from typing import List
from app.db.session import get_db
from app.core.security import require_permission
from app.models.user import UserModel
from app.services.category_service import category_service
from app.models.criminal import CriminalProfileModel
from app.schemas.category import CrimeCategorySchema

router = APIRouter()

@router.get("", response_model=List[CrimeCategorySchema])
def get_categories(
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(require_permission("criminal:read"))
):
    categories = category_service.get_categories(db)
    
    icons_map = {
        "Theft": "shopping_bag",
        "Assault": "back_hand",
        "Fraud": "gavel",
        "Narcotics": "vaccines",
        "Fugitive": "directions_run",
        "Vehicle": "directions_car",
        "Cybercrime": "terminal",
        "Financial": "account_balance",
        "Homicide": "warning",
        "House Breaking": "home_work",
    }
    
    res = []
    for cat in categories:
        records_count = db.query(CriminalProfileModel).filter(
            CriminalProfileModel.category == cat.name,
            CriminalProfileModel.is_deleted == False
        ).count()
        
        res.append(CrimeCategorySchema(
            id=cat.id,
            category=cat.name,
            recordsCount=records_count,
            description=cat.description or f"Registered criminal dossiers and open cases under {cat.name}.",
            icon=icons_map.get(cat.name, "folder_shared"),
            severity=cat.severity_level,
            trendText="+2.4% vs last period"
        ))
    return res
