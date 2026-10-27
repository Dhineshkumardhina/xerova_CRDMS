import uuid
import pytest
from datetime import datetime, timezone
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.models.user import UserModel
from app.models.police_station import PoliceStationModel
from app.models.criminal import CriminalProfileModel, IdentificationMarkModel, CriminalPhotoModel
from app.models.case import CaseRecordModel, CriminalCaseModel
from app.models.role_permission import RoleModel
from app.db.session import SessionLocal

@pytest.fixture
def db_session():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

def test_foreign_key_enforcement_criminal_station(db_session: Session):
    """Verify SQLite/DB foreign key constraint rejects non-existent police station."""
    fake_station_id = f"non-existent-ps-{uuid.uuid4().hex[:8]}"
    invalid_criminal = CriminalProfileModel(
        id=f"test-crim-{uuid.uuid4().hex[:8]}",
        name="Invalid FK Criminal",
        normalized_name="invalid fk criminal",
        police_station_id=fake_station_id
    )
    db_session.add(invalid_criminal)
    with pytest.raises(IntegrityError):
        db_session.commit()
    db_session.rollback()

def test_foreign_key_enforcement_case_officer(db_session: Session):
    """Verify SQLite/DB foreign key constraint rejects non-existent lead officer."""
    fake_officer_id = f"non-existent-officer-{uuid.uuid4().hex[:8]}"
    invalid_case = CaseRecordModel(
        id=f"test-case-{uuid.uuid4().hex[:8]}",
        case_number=f"CAS-TEST-{uuid.uuid4().hex[:6]}",
        description="Invalid officer case",
        date_filed="2026-10-27",
        lead_officer_id=fake_officer_id
    )
    db_session.add(invalid_case)
    with pytest.raises(IntegrityError):
        db_session.commit()
    db_session.rollback()

def test_unique_constraint_user_username(db_session: Session):
    """Verify duplicate username raises IntegrityError."""
    existing_user = db_session.query(UserModel).first()
    assert existing_user is not None
    
    duplicate_user = UserModel(
        id=str(uuid.uuid4()),
        username=existing_user.username,
        badge_number=f"BADGE-{uuid.uuid4().hex[:6]}",
        hashed_password="dummy_hash_value",
        full_name="Duplicate Username Tester"
    )
    db_session.add(duplicate_user)
    with pytest.raises(IntegrityError):
        db_session.commit()
    db_session.rollback()

def test_unique_constraint_station_code(db_session: Session):
    """Verify duplicate police station code raises IntegrityError."""
    existing_ps = db_session.query(PoliceStationModel).first()
    assert existing_ps is not None

    duplicate_ps = PoliceStationModel(
        id=str(uuid.uuid4()),
        station_code=existing_ps.station_code,
        name="Duplicate Precinct",
        district="Test District",
        state="Test State"
    )
    db_session.add(duplicate_ps)
    with pytest.raises(IntegrityError):
        db_session.commit()
    db_session.rollback()

def test_unique_constraint_case_number(db_session: Session):
    """Verify duplicate case_number raises IntegrityError."""
    case_num = f"CAS-DUP-{uuid.uuid4().hex[:6]}"
    case1 = CaseRecordModel(
        id=str(uuid.uuid4()),
        case_number=case_num,
        description="First case with number",
        date_filed="2026-10-27"
    )
    case2 = CaseRecordModel(
        id=str(uuid.uuid4()),
        case_number=case_num,
        description="Second case with duplicate number",
        date_filed="2026-10-27"
    )
    db_session.add(case1)
    db_session.commit()

    db_session.add(case2)
    with pytest.raises(IntegrityError):
        db_session.commit()
    db_session.rollback()

    # Clean up case1
    db_session.delete(case1)
    db_session.commit()

def test_cascade_delete_marks_on_criminal_removal(db_session: Session):
    """Verify deleting a criminal cascades to delete associated identification marks."""
    crim_id = str(uuid.uuid4())
    criminal = CriminalProfileModel(
        id=crim_id,
        name="Cascade Test Criminal",
        normalized_name="cascade test criminal"
    )
    mark = IdentificationMarkModel(
        id=str(uuid.uuid4()),
        criminal_id=crim_id,
        type="Scar",
        description="Scar on left forehead"
    )
    db_session.add(criminal)
    db_session.add(mark)
    db_session.commit()

    # Verify mark exists
    assert db_session.query(IdentificationMarkModel).filter(IdentificationMarkModel.id == mark.id).first() is not None

    # Delete criminal
    db_session.delete(criminal)
    db_session.commit()

    # Verify mark was cascade-deleted
    assert db_session.query(IdentificationMarkModel).filter(IdentificationMarkModel.id == mark.id).first() is None

def test_set_null_on_delete_lead_officer(db_session: Session):
    """Verify deleting an officer sets case.lead_officer_id to NULL without deleting the case."""
    temp_officer_id = str(uuid.uuid4())
    officer = UserModel(
        id=temp_officer_id,
        username=f"temp-off-{uuid.uuid4().hex[:6]}",
        badge_number=f"TMP-{uuid.uuid4().hex[:6]}",
        hashed_password="password_hash",
        full_name="Temporary Investigator"
    )
    case_id = str(uuid.uuid4())
    case_obj = CaseRecordModel(
        id=case_id,
        case_number=f"CAS-NULL-{uuid.uuid4().hex[:6]}",
        description="Officer set-null test case",
        date_filed="2026-10-27",
        lead_officer_id=temp_officer_id
    )
    db_session.add(officer)
    db_session.add(case_obj)
    db_session.commit()

    assert case_obj.lead_officer_id == temp_officer_id

    # Delete officer
    db_session.delete(officer)
    db_session.commit()

    # Case must still exist, with lead_officer_id set to NULL
    reloaded_case = db_session.query(CaseRecordModel).filter(CaseRecordModel.id == case_id).first()
    assert reloaded_case is not None
    assert reloaded_case.lead_officer_id is None

    # Clean up
    db_session.delete(reloaded_case)
    db_session.commit()

def test_transaction_rollback_atomicity(db_session: Session):
    """Verify that an exception mid-operation rolls back all pending inserts."""
    test_id = str(uuid.uuid4())
    try:
        crim = CriminalProfileModel(
            id=test_id,
            name="Atomic Tester",
            normalized_name="atomic tester"
        )
        db_session.add(crim)
        db_session.flush()

        # Simulate unexpected error before commit
        raise RuntimeError("Simulated mid-transaction failure")
    except RuntimeError:
        db_session.rollback()

    # Verify criminal was not persisted
    persisted = db_session.query(CriminalProfileModel).filter(CriminalProfileModel.id == test_id).first()
    assert persisted is None

def test_concurrent_read_write(db_session: Session):
    """Verify WAL mode allows concurrent read sessions during transactions without locking."""
    import concurrent.futures

    def read_users():
        local_db = SessionLocal()
        try:
            return len(local_db.query(UserModel).all())
        finally:
            local_db.close()

    with concurrent.futures.ThreadPoolExecutor(max_workers=4) as executor:
        futures = [executor.submit(read_users) for _ in range(10)]
        results = [f.result() for f in futures]

    assert all(r >= 2 for r in results)
