import time
import math
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from typing import Optional, List

from app.db.session import get_db
from app.core.security import require_permission
from app.repositories.criminal_repository import criminal_repo
from app.models.user import UserModel
from app.models.audit_log import SearchMetadataModel
from app.api.v1.endpoints.criminals import model_to_schema
from app.schemas.search import SearchResponseSchema

router = APIRouter()

@router.get("", response_model=SearchResponseSchema)
def search_records(
    q: Optional[str] = Query(None, description="Global search query across name, alias, phone, ID, address, case #"),
    category: Optional[str] = Query(None, description="Comma-separated crime categories"),
    status: Optional[str] = Query(None, description="Comma-separated status values"),
    location: Optional[str] = Query(None, description="Filter by city/region/state"),
    policeStation: Optional[str] = Query(None, description="Filter by police station code/name"),
    gender: Optional[str] = Query(None, description="Filter by gender (Male/Female/Other)"),
    minAge: Optional[int] = Query(None, ge=0, description="Minimum age bound"),
    maxAge: Optional[int] = Query(None, ge=0, description="Maximum age bound"),
    startDate: Optional[str] = Query(None, description="Start date filter"),
    endDate: Optional[str] = Query(None, description="End date filter"),
    recordStatus: Optional[str] = Query(None, description="Record status (Active/Archived)"),
    page: int = Query(1, ge=1, description="Page index"),
    pageSize: int = Query(20, ge=1, le=100, description="Records per page"),
    sortBy: str = Query("name", description="Sorting field"),
    sortOrder: str = Query("asc", description="Sorting order (asc/desc)"),
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(require_permission("criminal:read"))
):
    start_time = time.time()

    categories_list = [c.strip() for c in category.split(",")] if category else None
    statuses_list = [s.strip() for s in status.split(",")] if status else None

    records, total_count = criminal_repo.search_criminals_advanced(
        db,
        query_str=q,
        categories=categories_list,
        statuses=statuses_list,
        location=location,
        police_station=policeStation,
        gender=gender,
        min_age=minAge,
        max_age=maxAge,
        start_date=startDate,
        end_date=endDate,
        record_status=recordStatus,
        page=page,
        page_size=pageSize,
        sort_by=sortBy,
        sort_order=sortOrder
    )

    execution_time = round((time.time() - start_time) * 1000, 2)
    total_pages = math.ceil(total_count / pageSize) if total_count > 0 else 1

    # Log search performance metadata
    search_meta = SearchMetadataModel(
        user_id=current_user.id,
        query=q or "",
        filters={
            "category": category,
            "status": status,
            "location": location,
            "policeStation": policeStation,
            "gender": gender,
            "minAge": minAge,
            "maxAge": maxAge,
            "page": page,
            "pageSize": pageSize
        },
        results_count=total_count,
        execution_time_ms=execution_time
    )
    db.add(search_meta)
    db.commit()

    mapped_records = [model_to_schema(c) for c in records]
    return SearchResponseSchema(
        success=True,
        query=q or "",
        records=mapped_records,
        results=mapped_records,
        total=total_count,
        totalCount=total_count,
        page=page,
        pageSize=pageSize,
        totalPages=total_pages,
        executionTimeMs=execution_time
    )
