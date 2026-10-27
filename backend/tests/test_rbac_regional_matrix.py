import pytest
import uuid
from datetime import datetime, timezone
from app.core.security import get_password_hash, create_access_token
from app.models.user import UserModel
from app.models.police_station import PoliceStationModel
from app.models.criminal import CriminalProfileModel
from app.models.case import CaseRecordModel
from app.models.audit_log import AuditLogModel

@pytest.fixture
def rbac_fixture_data(db_session):
    """
    Creates distinct regional stations, cases, criminals, and role-based users:
    1. NY Metro Station (State: NY, District: Metro District)
       - State Admin NY
       - District Admin Metro
       - Station Admin Metro
       - Officer 1 Metro (Lead on Case 1)
       - Officer 2 Metro (Lead on Case 2)
       - Authorized Personnel Metro
       - Criminal 1 (Metro)
       - Case 1 (Metro, Lead: Officer 1)
       - Case 2 (Metro, Lead: Officer 2)
    2. Puducherry Station (State: Puducherry, District: Puducherry District)
       - Criminal 2 (Puducherry)
       - Case 3 (Puducherry)
    """
    # 1. Stations
    stn_metro = db_session.query(PoliceStationModel).filter(PoliceStationModel.id == "stn-metro-test").first()
    if not stn_metro:
        stn_metro = PoliceStationModel(
            id="stn-metro-test",
            station_code="PS-TEST-METRO",
            name="Metro Test Precinct",
            district="Metro District",
            state="New York",
            region="Northeast",
            is_active=True
        )
        db_session.add(stn_metro)

    stn_pudu = db_session.query(PoliceStationModel).filter(PoliceStationModel.id == "stn-pudu-test").first()
    if not stn_pudu:
        stn_pudu = PoliceStationModel(
            id="stn-pudu-test",
            station_code="PS-TEST-PUDU",
            name="Puducherry Test Station",
            district="Puducherry District",
            state="Puducherry",
            region="South",
            is_active=True
        )
        db_session.add(stn_pudu)

    # 2. Users
    def make_user(uid, username, role_id, stn_id, state, district, region, is_super=False):
        u = db_session.query(UserModel).filter(UserModel.id == uid).first()
        if not u:
            u = UserModel(
                id=uid,
                username=username,
                hashed_password=get_password_hash("TestSecure#2024"),
                full_name=f"Test {username}",
                badge_number=f"BDG-{uid}",
                rank="Inspector",
                department="Investigation",
                clearance_level="Level 3 - Secret",
                is_active=True,
                is_superuser=is_super,
                role_id=role_id,
                police_station_id=stn_id,
                state=state,
                district=district,
                region=region
            )
            db_session.add(u)
        return u

    super_admin = make_user("usr-super-test", "superadmin", "role-admin", None, None, None, None, is_super=True)
    state_admin_ny = make_user("usr-state-admin-ny", "stateadmin_ny", "role-state-admin", "stn-metro-test", "New York", None, "Northeast")
    dist_admin_metro = make_user("usr-dist-admin-metro", "distadmin_metro", "role-district-admin", "stn-metro-test", "New York", "Metro District", "Northeast")
    stn_admin_metro = make_user("usr-stn-admin-metro", "stnadmin_metro", "role-station-admin", "stn-metro-test", "New York", "Metro District", "Northeast")
    officer_1_metro = make_user("usr-off1-metro", "officer1_metro", "role-officer", "stn-metro-test", "New York", "Metro District", "Northeast")
    officer_2_metro = make_user("usr-off2-metro", "officer2_metro", "role-officer", "stn-metro-test", "New York", "Metro District", "Northeast")
    auth_personnel = make_user("usr-personnel-metro", "personnel_metro", "role-authorized-personnel", "stn-metro-test", "New York", "Metro District", "Northeast")

    # 3. Records in Metro
    crim_metro = db_session.query(CriminalProfileModel).filter(CriminalProfileModel.id == "CR-METRO-001").first()
    if not crim_metro:
        crim_metro = CriminalProfileModel(
            id="CR-METRO-001",
            name="Metro Suspect",
            normalized_name="metro suspect",
            identification_number="ID-METRO-001",
            city="New York",
            district="Metro District",
            state="New York",
            police_station_id="stn-metro-test",
            status="Active",
            category="Theft",
            is_deleted=False
        )
        db_session.add(crim_metro)

    case_1_metro = db_session.query(CaseRecordModel).filter(CaseRecordModel.id == "CASE-METRO-001").first()
    if not case_1_metro:
        case_1_metro = CaseRecordModel(
            id="CASE-METRO-001",
            case_number="FIR-METRO-001",
            description="Metro Case 1 assigned to Officer 1",
            date_filed="2026-01-01",
            status="Under Investigation",
            category="Theft",
            police_station_id="stn-metro-test",
            lead_officer_id="usr-off1-metro",
            is_deleted=False
        )
        db_session.add(case_1_metro)

    case_2_metro = db_session.query(CaseRecordModel).filter(CaseRecordModel.id == "CASE-METRO-002").first()
    if not case_2_metro:
        case_2_metro = CaseRecordModel(
            id="CASE-METRO-002",
            case_number="FIR-METRO-002",
            description="Metro Case 2 assigned to Officer 2",
            date_filed="2026-01-02",
            status="Under Investigation",
            category="Assault",
            police_station_id="stn-metro-test",
            lead_officer_id="usr-off2-metro",
            is_deleted=False
        )
        db_session.add(case_2_metro)

    # 4. Records in Puducherry (Foreign to Metro users)
    crim_pudu = db_session.query(CriminalProfileModel).filter(CriminalProfileModel.id == "CR-PUDU-001").first()
    if not crim_pudu:
        crim_pudu = CriminalProfileModel(
            id="CR-PUDU-001",
            name="Puducherry Suspect",
            normalized_name="puducherry suspect",
            identification_number="ID-PUDU-001",
            city="Puducherry",
            district="Puducherry District",
            state="Puducherry",
            police_station_id="stn-pudu-test",
            status="Active",
            category="Fraud",
            is_deleted=False
        )
        db_session.add(crim_pudu)

    case_pudu = db_session.query(CaseRecordModel).filter(CaseRecordModel.id == "CASE-PUDU-001").first()
    if not case_pudu:
        case_pudu = CaseRecordModel(
            id="CASE-PUDU-001",
            case_number="FIR-PUDU-001",
            description="Puducherry Case",
            date_filed="2026-01-03",
            status="Under Investigation",
            category="Fraud",
            police_station_id="stn-pudu-test",
            is_deleted=False
        )
        db_session.add(case_pudu)

    db_session.commit()

    def get_auth_header(uid):
        token = create_access_token(subject=uid)
        return {"Authorization": f"Bearer {token}"}

    return {
        "super_headers": get_auth_header("usr-super-test"),
        "state_admin_ny_headers": get_auth_header("usr-state-admin-ny"),
        "dist_admin_metro_headers": get_auth_header("usr-dist-admin-metro"),
        "stn_admin_metro_headers": get_auth_header("usr-stn-admin-metro"),
        "officer_1_headers": get_auth_header("usr-off1-metro"),
        "officer_2_headers": get_auth_header("usr-off2-metro"),
        "personnel_headers": get_auth_header("usr-personnel-metro"),
    }

# -------------------------------------------------------------
# 1. SUPER ADMINISTRATOR (GLOBAL ACCESS)
# -------------------------------------------------------------

def test_super_admin_global_access(client, rbac_fixture_data):
    headers = rbac_fixture_data["super_headers"]

    # Can access Metro criminal and Puducherry criminal
    res_metro = client.get("/api/v1/criminals/CR-METRO-001", headers=headers)
    assert res_metro.status_code == 200
    assert res_metro.json()["id"] == "CR-METRO-001"

    res_pudu = client.get("/api/v1/criminals/CR-PUDU-001", headers=headers)
    assert res_pudu.status_code == 200
    assert res_pudu.json()["id"] == "CR-PUDU-001"

    # Can access cases across all regions
    res_case_metro = client.get("/api/v1/cases/CASE-METRO-001", headers=headers)
    assert res_case_metro.status_code == 200

    res_case_pudu = client.get("/api/v1/cases/CASE-PUDU-001", headers=headers)
    assert res_case_pudu.status_code == 200

# -------------------------------------------------------------
# 2. STATE-LEVEL ADMINISTRATOR (REGIONAL STATE BOUNDARY)
# -------------------------------------------------------------

def test_state_admin_boundary(client, rbac_fixture_data):
    headers = rbac_fixture_data["state_admin_ny_headers"]

    # Can view record within New York state
    res_metro = client.get("/api/v1/criminals/CR-METRO-001", headers=headers)
    assert res_metro.status_code == 200

    # Cross-Region Access Attempt: Cannot view record from Puducherry state -> 403 Forbidden
    res_pudu = client.get("/api/v1/criminals/CR-PUDU-001", headers=headers)
    assert res_pudu.status_code == 403
    assert "Jurisdictional restriction" in res_pudu.json()["detail"]

    # Cross-Region Case Access Attempt -> 403 Forbidden
    res_case_pudu = client.get("/api/v1/cases/CASE-PUDU-001", headers=headers)
    assert res_case_pudu.status_code == 403

# -------------------------------------------------------------
# 3. STATION ADMINISTRATOR (STATION BOUNDARY & PRIVILEGES)
# -------------------------------------------------------------

def test_station_admin_boundary_and_assignment(client, rbac_fixture_data):
    headers = rbac_fixture_data["stn_admin_metro_headers"]

    # Can view record in own station
    res_metro = client.get("/api/v1/criminals/CR-METRO-001", headers=headers)
    assert res_metro.status_code == 200

    # Cannot view foreign station record -> 403 Forbidden
    res_pudu = client.get("/api/v1/criminals/CR-PUDU-001", headers=headers)
    assert res_pudu.status_code == 403

    # Can assign lead officer to a case within their station
    res_assign = client.post(
        "/api/v1/cases/CASE-METRO-001/assign",
        json={"leadOfficerId": "usr-off2-metro"},
        headers=headers
    )
    assert res_assign.status_code == 200
    assert res_assign.json()["status"] == "success"

    # Can approve case status closure (has case:approve)
    res_close = client.post(
        "/api/v1/cases/bulk-status",
        json={"caseIds": ["CASE-METRO-001"], "newStatus": "Closed"},
        headers=headers
    )
    assert res_close.status_code == 200
    assert res_close.json()["newStatus"] == "Closed"

# -------------------------------------------------------------
# 4. INVESTIGATING OFFICER (CASE OWNERSHIP & APPROVAL RULES)
# -------------------------------------------------------------

def test_investigating_officer_case_ownership(client, rbac_fixture_data):
    off1_headers = rbac_fixture_data["officer_1_headers"]
    off2_headers = rbac_fixture_data["officer_2_headers"]

    # Reset Case 1 lead to Officer 1
    client.post(
        "/api/v1/cases/CASE-METRO-001/assign",
        json={"leadOfficerId": "usr-off1-metro"},
        headers=rbac_fixture_data["super_headers"]
    )

    # Officer 1 can update Case 1 progress (routine investigation update)
    res_off1_update = client.post(
        "/api/v1/cases/bulk-status",
        json={"caseIds": ["CASE-METRO-001"], "newStatus": "Pre-Trial"},
        headers=off1_headers
    )
    assert res_off1_update.status_code == 200

    # Officer 2 CANNOT update Case 1 (Officer 1 is lead officer) -> 403 Forbidden
    res_off2_tamper = client.post(
        "/api/v1/cases/bulk-status",
        json={"caseIds": ["CASE-METRO-001"], "newStatus": "Pre-Trial"},
        headers=off2_headers
    )
    assert res_off2_tamper.status_code == 403
    assert "ownership" in res_off2_tamper.json()["detail"].lower()

    # Officer 1 CANNOT approve case closure or warrant (requires case:approve) -> 403 Forbidden
    res_off1_close = client.post(
        "/api/v1/cases/bulk-status",
        json={"caseIds": ["CASE-METRO-001"], "newStatus": "Closed"},
        headers=off1_headers
    )
    assert res_off1_close.status_code == 403

    # Officer cannot delete criminal dossiers -> 403 Forbidden
    res_del_crim = client.delete("/api/v1/criminals/CR-METRO-001", headers=off1_headers)
    assert res_del_crim.status_code == 403

# -------------------------------------------------------------
# 5. AUTHORIZED PERSONNEL (READ-ONLY OPERATIONAL ACCESS)
# -------------------------------------------------------------

def test_authorized_personnel_read_only(client, rbac_fixture_data):
    headers = rbac_fixture_data["personnel_headers"]

    # Can read cases and criminals in station
    res_read_crim = client.get("/api/v1/criminals/CR-METRO-001", headers=headers)
    assert res_read_crim.status_code == 200

    res_read_case = client.get("/api/v1/cases/CASE-METRO-001", headers=headers)
    assert res_read_case.status_code == 200

    # Cannot create criminal dossiers -> 403 Forbidden
    res_create_crim = client.post(
        "/api/v1/criminals",
        json={"name": "Tampered Dossier"},
        headers=headers
    )
    assert res_create_crim.status_code == 403

    # Cannot update cases -> 403 Forbidden
    res_update_case = client.post(
        "/api/v1/cases/bulk-status",
        json={"caseIds": ["CASE-METRO-001"], "newStatus": "Pre-Trial"},
        headers=headers
    )
    assert res_update_case.status_code == 403

# -------------------------------------------------------------
# 6. PRIVILEGE ESCALATION & SELF-ESCALATION PREVENTION
# -------------------------------------------------------------

def test_prevent_privilege_escalation(client, rbac_fixture_data):
    stn_admin_headers = rbac_fixture_data["stn_admin_metro_headers"]

    # Station Admin attempting to create a Super Admin user -> 403 Forbidden
    res_esc = client.post(
        "/api/v1/users",
        json={
            "username": "forged_super_admin",
            "password": "Password123!",
            "fullName": "Forged Super Admin",
            "badgeNumber": "FORGE-01",
            "roleName": "Administrator",
            "policeStationId": "stn-metro-test"
        },
        headers=stn_admin_headers
    )
    assert res_esc.status_code == 403
    assert "Privilege Escalation" in res_esc.json()["detail"]

    # Self-Escalation: User attempting to modify their own role -> 403 Forbidden
    res_self_esc = client.put(
        "/api/v1/users/usr-stn-admin-metro",
        json={"roleName": "Administrator"},
        headers=stn_admin_headers
    )
    assert res_self_esc.status_code == 403
    assert "cannot modify your own administrative role" in res_self_esc.json()["detail"].lower()

# -------------------------------------------------------------
# 7. SEARCH PARAMETER TAMPERING PREVENTION & AUDIT LOGGING
# -------------------------------------------------------------

def test_search_regional_containment_and_audit(client, rbac_fixture_data, db_session):
    off1_headers = rbac_fixture_data["officer_1_headers"]

    # Officer 1 in Metro station searches globally
    search_res = client.get("/api/v1/search?q=suspect", headers=off1_headers)
    assert search_res.status_code == 200
    returned_ids = [r["id"] for r in search_res.json()["records"]]

    # Must contain Metro record, MUST NOT contain Puducherry record
    assert "CR-METRO-001" in returned_ids
    assert "CR-PUDU-001" not in returned_ids

    # Officer 1 attempts to tamper with location parameter to access Puducherry
    tampered_search = client.get("/api/v1/search?location=Puducherry", headers=off1_headers)
    assert tampered_search.status_code == 200
    tampered_ids = [r["id"] for r in tampered_search.json()["records"]]
    assert "CR-PUDU-001" not in tampered_ids

    # Verify that an ACCESS_DENIED audit log exists in DB for cross-region attempt
    client.get("/api/v1/criminals/CR-PUDU-001", headers=off1_headers)
    denied_log = db_session.query(AuditLogModel).filter(
        AuditLogModel.action == "ACCESS_DENIED",
        AuditLogModel.user_id == "usr-off1-metro"
    ).first()
    assert denied_log is not None
    assert denied_log.result == "FAILED"
