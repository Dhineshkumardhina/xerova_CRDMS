from pydantic import BaseModel, ConfigDict
from typing import Optional

class CrimeCategorySchema(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    category: str
    recordsCount: int
    description: str
    icon: str
    severity: str
    trendText: str
