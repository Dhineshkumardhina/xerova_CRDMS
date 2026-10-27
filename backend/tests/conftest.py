import sys
import os
import pytest
from typing import Generator
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, Session
from sqlalchemy.pool import StaticPool

# Add backend directory to sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.main import app
from app.db.session import get_db, Base
from app.core.security import get_password_hash, create_access_token
from app.db.migrations import seed_rbac_data
from app.models.user import UserModel
from app.models.role_permission import RoleModel, PermissionModel
from app.models.criminal import CriminalProfileModel
from app.models.case import CaseRecordModel
from app.models.police_station import PoliceStationModel
from app.models.biometrics import FaceEmbeddingModel
from app.models.document import DocumentItemModel

# Isolated In-Memory SQLite Engine for Testing
SQLALCHEMY_TEST_DATABASE_URL = "sqlite:///:memory:"

engine = create_engine(
    SQLALCHEMY_TEST_DATABASE_URL,
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

@pytest.fixture(scope="session", autouse=True)
def setup_test_database():
    """Setup isolated test database schema & seed initial test fixtures."""
    Base.metadata.create_all(bind=engine)
    db = TestingSessionLocal()

    # Seed all 19 permissions, 7 roles, and police stations
    seed_rbac_data(db)

    # Seed Users
    admin_user = UserModel(
        id="usr-admin-01",
        username="8829-JD",
        hashed_password=get_password_hash("DeptJusticeSecure#2024"),
        full_name="Officer J. Daniels",
        badge_number="8829-JD",
        rank="Senior Inspector",
        department="Justice Department",
        clearance_level="Level 5 - Top Secret",
        is_superuser=True,
        is_active=True,
        role_id="role-admin"
    )
    db.add(admin_user)

    # Seed Police Station stn-01
    station = db.query(PoliceStationModel).filter(
        (PoliceStationModel.id == "stn-01") | (PoliceStationModel.station_code == "PS-PUDU-01")
    ).first()
    if not station:
        station = PoliceStationModel(
            id="stn-01",
            name="Puducherry Central Station",
            station_code="PS-PUDU-01",
            district="Puducherry",
            state="Puducherry",
            region="Southern Region",
            phone_number="+91 413-222-1000"
        )
        db.add(station)
        db.flush()
    stn_id = station.id

    officer_user = UserModel(
        id="usr-officer-01",
        username="7710-SO",
        hashed_password=get_password_hash("OfficerSecure#2024"),
        full_name="Officer Sam Operational",
        badge_number="7710-SO",
        rank="Patrol Officer",
        department="Metro Precinct",
        clearance_level="Level 2 - Confidential",
        is_superuser=False,
        is_active=True,
        role_id="role-officer",
        police_station_id=stn_id,
        district="Puducherry",
        state="Puducherry",
        region="Southern Region"
    )
    db.add(officer_user)

    # Seed Sample Criminal Profile
    criminal = CriminalProfileModel(
        id="CR-001245",
        name="Raj Kumar Sharma",
        normalized_name="raj kumar sharma",
        alias="Raj",
        father_name="Suresh Kumar Sharma",
        age=34,
        gender="Male",
        phone_number="+1 555-019-2831",
        identification_number="XXXX-XXXX-9900",
        primary_address="12 MG Road",
        city="Puducherry",
        district="Puducherry",
        state="Puducherry",
        police_station_id=stn_id,
        category="Theft",
        status="Active",
        is_archived=False,
        is_deleted=False
    )
    db.add(criminal)

    # Seed Face Embedding for Raj Kumar Sharma
    embedding_vec = [0.05] * 128
    face_emb = FaceEmbeddingModel(
        id="emb-test-01",
        criminal_id="CR-001245",
        embedding_vector={"vector": embedding_vec, "dim": 128},
        feature_metadata={"model_version": "DOJ-NeuralMesh-v4.2"}
    )
    db.add(face_emb)

    db.commit()
    db.close()

    yield

    Base.metadata.drop_all(bind=engine)

@pytest.fixture
def db_session() -> Generator[Session, None, None]:
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()

@pytest.fixture
def client(db_session: Session) -> Generator[TestClient, None, None]:
    def override_get_db():
        try:
            yield db_session
        finally:
            pass

    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()

@pytest.fixture
def admin_headers(db_session: Session) -> dict:
    admin_token = create_access_token(subject="usr-admin-01")
    return {"Authorization": f"Bearer {admin_token}"}

@pytest.fixture
def officer_headers(db_session: Session) -> dict:
    officer_token = create_access_token(subject="usr-officer-01")
    return {"Authorization": f"Bearer {officer_token}"}
