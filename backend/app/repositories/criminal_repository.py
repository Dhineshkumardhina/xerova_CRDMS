from typing import List, Optional, Tuple, Sequence
from datetime import datetime
from sqlalchemy import or_, and_, asc, desc
from sqlalchemy.orm import Session
from app.repositories.base import CRUDBase
from app.models.criminal import CriminalProfileModel
from app.models.case import CaseRecordModel, CriminalCaseModel
from app.models.police_station import PoliceStationModel

class CriminalRepository(CRUDBase[CriminalProfileModel]):
    def __init__(self):
        super().__init__(CriminalProfileModel)

    def search_criminals_advanced(
        self,
        db: Session,
        query_str: Optional[str] = None,
        categories: Optional[List[str]] = None,
        statuses: Optional[List[str]] = None,
        location: Optional[str] = None,
        police_station: Optional[str] = None,
        gender: Optional[str] = None,
        min_age: Optional[int] = None,
        max_age: Optional[int] = None,
        start_date: Optional[str] = None,
        end_date: Optional[str] = None,
        record_status: Optional[str] = None,
        page: int = 1,
        page_size: int = 20,
        sort_by: str = "name",
        sort_order: str = "asc"
    ) -> Tuple[List[CriminalProfileModel], int]:
        base_query = db.query(CriminalProfileModel).filter(CriminalProfileModel.is_deleted == False)

        # 1. Global Search Query across Name, Alias, Father Name, Phone, ID, Address, Case Number / FIR Number
        if query_str and query_str.strip():
            term = f"%{query_str.strip().lower()}%"
            
            matching_case_criminal_ids = db.query(CriminalCaseModel.criminal_id).join(
                CaseRecordModel, CriminalCaseModel.case_id == CaseRecordModel.id
            ).filter(
                or_(
                    CaseRecordModel.case_number.ilike(term),
                    CaseRecordModel.title.ilike(term),
                    CaseRecordModel.description.ilike(term)
                )
            )

            base_query = base_query.filter(
                or_(
                    CriminalProfileModel.normalized_name.ilike(term),
                    CriminalProfileModel.name.ilike(term),
                    CriminalProfileModel.alias.ilike(term),
                    CriminalProfileModel.father_name.ilike(term),
                    CriminalProfileModel.phone_number.ilike(term),
                    CriminalProfileModel.identification_number.ilike(term),
                    CriminalProfileModel.id.ilike(term),
                    CriminalProfileModel.primary_address.ilike(term),
                    CriminalProfileModel.city.ilike(term),
                    CriminalProfileModel.state.ilike(term),
                    CriminalProfileModel.id.in_(matching_case_criminal_ids)
                )
            )

        # 2. Crime Category Filter (AND condition)
        if categories and len(categories) > 0:
            base_query = base_query.filter(CriminalProfileModel.category.in_(categories))

        # 3. Case Status Filter (AND condition)
        if statuses and len(statuses) > 0:
            status_conditions = []
            if 'Active' in statuses:
                status_conditions.extend(['Active', 'Warrant Issued'])
            if 'Closed' in statuses:
                status_conditions.extend(['Closed', 'Historical Record', 'Cleared'])
            if 'Pending Trial' in statuses:
                status_conditions.extend(['Court Pending', 'Pre-Trial'])
            
            all_target_statuses = list(set(statuses + status_conditions))
            base_query = base_query.filter(CriminalProfileModel.status.in_(all_target_statuses))

        # 4. Location Filter (AND condition)
        if location and location.strip():
            loc_term = f"%{location.strip().lower()}%"
            base_query = base_query.filter(
                or_(
                    CriminalProfileModel.city.ilike(loc_term),
                    CriminalProfileModel.state.ilike(loc_term),
                    CriminalProfileModel.primary_address.ilike(loc_term)
                )
            )

        # 5. Police Station Filter (AND condition)
        if police_station and police_station.strip():
            ps_term = f"%{police_station.strip().lower()}%"
            station_ids = db.query(PoliceStationModel.id).filter(
                or_(
                    PoliceStationModel.station_code.ilike(ps_term),
                    PoliceStationModel.name.ilike(ps_term),
                    PoliceStationModel.district.ilike(ps_term)
                )
            )
            matching_ps_criminal_ids = db.query(CriminalCaseModel.criminal_id).join(
                CaseRecordModel, CriminalCaseModel.case_id == CaseRecordModel.id
            ).filter(CaseRecordModel.police_station_id.in_(station_ids))
            base_query = base_query.filter(CriminalProfileModel.id.in_(matching_ps_criminal_ids))

        # 6. Gender Filter (AND condition)
        if gender and gender.strip() and gender != "All":
            base_query = base_query.filter(CriminalProfileModel.gender.ilike(gender.strip()))

        # 7. Age Range Filter (AND condition)
        if min_age is not None:
            base_query = base_query.filter(CriminalProfileModel.age >= min_age)
        if max_age is not None:
            base_query = base_query.filter(CriminalProfileModel.age <= max_age)

        # 8. Record Status Filter (AND condition)
        if record_status and record_status.strip():
            if record_status.lower() == "archived":
                base_query = base_query.filter(CriminalProfileModel.is_archived == True)
            elif record_status.lower() == "active":
                base_query = base_query.filter(CriminalProfileModel.is_archived == False)

        # Total Matching Records Count
        total_count = base_query.count()

        # 9. Sorting
        sort_attr = getattr(CriminalProfileModel, sort_by, CriminalProfileModel.name)
        if sort_order.lower() == "desc":
            base_query = base_query.order_by(desc(sort_attr))
        else:
            base_query = base_query.order_by(asc(sort_attr))

        # 10. Server-Side Pagination
        offset = max(0, (page - 1) * page_size)
        records = base_query.offset(offset).limit(page_size).all()

        return records, total_count

criminal_repo = CriminalRepository()
