import uuid
import pytest
from datetime import datetime, timezone
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.models.user import UserModel
from app.models.role_permission import RoleModel, PermissionModel, UserPermissionGrantModel
from app.models.police_station import PoliceStationModel
from app.models.criminal import CriminalProfileModel
from app.models.audit_log import AuditLogModel
from app.core.security import create_access_token, get_password_hash
from app.core.rbac import (
    ROLE_SUPER_ADMIN,
    ROLE_REGIONAL_ADMIN,
    ROLE_OFFICER,
    ROLE_AUTHORIZED_PERSONNEL,
    PERM_CRIMINAL_CREATE,
    PERM_CRIMINAL_CREATE_LEGACY
)

@pytest.fixture
def hierarchy_fixture(db_session: Session):
    """
    Creates an isolated set of stations, users, and roles for hierarchical testing:
    - Region North: stn-north, regadmin-north, officer-north
    - Region South: stn-south, regadmin-south, officer-south
    - Super Admin: global
    """
    # 1. Police Stations
    stn_north = PoliceStationModel(
        id="stn-test-north-01",
        name="North District Station",
        station_code="PS-TEST-NORTH-01",
        district="District North",
        state="State North",
        region="North Region",
        is_active=True
    )
    stn_south = PoliceStationModel(
        id="stn-test-south-01",
        name="South District Station",
        station_code="PS-TEST-SOUTH-01",
        district="District South",
        state="State South",
        region="South Region",
        is_active=True
    )
    db_session.merge(stn_north)
    db_session.merge(stn_south)
    db_session.flush()

    # 2. Roles
    role_admin = db_session.query(RoleModel).filter(RoleModel.name == ROLE_SUPER_ADMIN).first()
    role_regadmin = db_session.query(RoleModel).filter(RoleModel.name == ROLE_REGIONAL_ADMIN).first()
    role_officer = db_session.query(RoleModel).filter(RoleModel.name == ROLE_OFFICER).first()

    # 3. Users
    def make_usr(uid, username, role_id, stn_id, region, state, is_super=False):
        u = UserModel(
            id=uid,
            username=username,
            hashed_password=get_password_hash("TestPass#2026"),
            full_name=f"Officer {username}",
            badge_number=f"BDG-{uid}",
            rank="Inspector" if "admin" in username else "Patrol Officer",
            department="Operations",
            clearance_level="Level 4 - Top Secret" if is_super else "Level 2 - Confidential",
            is_active=True,
            is_superuser=is_super,
            role_id=role_id,
            police_station_id=stn_id,
            region=region,
            state=state,
            district="District North" if region == "North Region" else "District South"
        )
        return db_session.merge(u)

    super_user = make_usr("usr-hier-super", "super_admin_test", role_admin.id, None, None, None, is_super=True)
    reg_north = make_usr("usr-hier-reg-north", "regadmin_north_test", role_regadmin.id, stn_north.id, "North Region", "State North")
    off_north = make_usr("usr-hier-off-north", "officer_north_test", role_officer.id, stn_north.id, "North Region", "State North")
    reg_south = make_usr("usr-hier-reg-south", "regadmin_south_test", role_regadmin.id, stn_south.id, "South Region", "State South")
    off_south = make_usr("usr-hier-off-south", "officer_south_test", role_officer.id, stn_south.id, "South Region", "State South")

    # 4. Sample Criminal Record in South
    crim_south = CriminalProfileModel(
        id="CR-TEST-SOUTH-001",
        name="Southern Suspect",
        normalized_name="southern suspect",
        identification_number="ID-SOUTH-9988",
        city="South City",
        district="District South",
        state="State South",
        region="South Region",
        police_station_id=stn_south.id,
        category="Theft",
        status="Active",
        is_deleted=False
    )
    db_session.merge(crim_south)
    db_session.commit()

    return {
        "super_headers": {"Authorization": f"Bearer {create_access_token(super_user.id)}"},
        "reg_north_headers": {"Authorization": f"Bearer {create_access_token(reg_north.id)}"},
        "off_north_headers": {"Authorization": f"Bearer {create_access_token(off_north.id)}"},
        "reg_south_headers": {"Authorization": f"Bearer {create_access_token(reg_south.id)}"},
        "off_south_headers": {"Authorization": f"Bearer {create_access_token(off_south.id)}"},
        "stn_north_id": stn_north.id,
        "stn_south_id": stn_south.id,
        "crim_south_id": crim_south.id,
        "off_north_id": off_north.id,
        "reg_north_id": reg_north.id,
    }

# -------------------------------------------------------------------
# TEST 1: Super Admin creates a Regional Admin.
# Expected: PASS.
# -------------------------------------------------------------------
def test_1_super_admin_creates_regional_admin(client: TestClient, hierarchy_fixture):
    payload = {
        "username": f"new_regadmin_{uuid.uuid4().hex[:6]}",
        "password": "SecurePass#2026",
        "fullName": "Regional Admin Central",
        "badgeNumber": f"RADM-{uuid.uuid4().hex[:6]}",
        "roleName": "Regional Administrator",
        "region": "Central Region",
        "rank": "Regional Commissioner",
        "department": "Regional Command"
    }
    res = client.post("/api/v1/users", json=payload, headers=hierarchy_fixture["super_headers"])
    assert res.status_code == 200, res.text
    data = res.json()
    assert data["role"] == "Regional Administrator"
    assert data["region"] == "Central Region"
    assert data["status"] == "Active"

# -------------------------------------------------------------------
# TEST 2: Regional Admin creates a police member within their assigned region.
# Expected: PASS.
# -------------------------------------------------------------------
def test_2_regional_admin_creates_police_member_in_region(client: TestClient, hierarchy_fixture):
    payload = {
        "username": f"new_patrol_{uuid.uuid4().hex[:6]}",
        "password": "SecurePass#2026",
        "fullName": "Officer North Patrol",
        "badgeNumber": f"PATROL-{uuid.uuid4().hex[:6]}",
        "roleName": "Officer",
        "policeStationId": hierarchy_fixture["stn_north_id"],
        "region": "North Region",
        "rank": "Patrol Officer"
    }
    res = client.post("/api/v1/users", json=payload, headers=hierarchy_fixture["reg_north_headers"])
    assert res.status_code == 200, res.text
    data = res.json()
    assert data["role"] == "Officer"
    assert data["region"] == "North Region"

# -------------------------------------------------------------------
# TEST 3: Regional Admin attempts to create another Regional Admin.
# Expected: HTTP 403.
# -------------------------------------------------------------------
def test_3_regional_admin_cannot_create_regional_admin(client: TestClient, hierarchy_fixture):
    payload = {
        "username": f"forged_regadmin_{uuid.uuid4().hex[:6]}",
        "password": "SecurePass#2026",
        "fullName": "Forged Regional Admin",
        "badgeNumber": f"F-RADM-{uuid.uuid4().hex[:6]}",
        "roleName": "Regional Administrator",
        "region": "North Region"
    }
    res = client.post("/api/v1/users", json=payload, headers=hierarchy_fixture["reg_north_headers"])
    assert res.status_code == 403
    assert "privilege escalation" in res.json()["detail"].lower() or "cannot create" in res.json()["detail"].lower()

# -------------------------------------------------------------------
# TEST 4: Police member attempts to create an administrator account.
# Expected: HTTP 403.
# -------------------------------------------------------------------
def test_4_police_member_cannot_create_admin(client: TestClient, hierarchy_fixture):
    payload = {
        "username": f"escalated_admin_{uuid.uuid4().hex[:6]}",
        "password": "SecurePass#2026",
        "fullName": "Escalated Admin",
        "badgeNumber": f"E-ADM-{uuid.uuid4().hex[:6]}",
        "roleName": "Administrator"
    }
    res = client.post("/api/v1/users", json=payload, headers=hierarchy_fixture["off_north_headers"])
    assert res.status_code == 403

# -------------------------------------------------------------------
# TEST 5: Regional Admin attempts to grant criminal-record creation permission.
# Expected: HTTP 403.
# -------------------------------------------------------------------
def test_5_regional_admin_cannot_grant_criminal_creation_permission(client: TestClient, hierarchy_fixture):
    res = client.post(
        f"/api/v1/users/{hierarchy_fixture['off_north_id']}/permissions/criminal-create",
        json={"granted": True, "reason": "Regional Admin Grant Attempt"},
        headers=hierarchy_fixture["reg_north_headers"]
    )
    assert res.status_code == 403
    assert "super administrator" in res.json()["detail"].lower() or "denied" in res.json()["detail"].lower()

# -------------------------------------------------------------------
# TEST 6: Police member attempts to grant themselves criminal-record creation permission.
# Expected: HTTP 403.
# -------------------------------------------------------------------
def test_6_police_member_cannot_grant_themselves_permission(client: TestClient, hierarchy_fixture):
    res = client.post(
        f"/api/v1/users/{hierarchy_fixture['off_north_id']}/permissions/criminal-create",
        json={"granted": True, "reason": "Self Grant Attempt"},
        headers=hierarchy_fixture["off_north_headers"]
    )
    assert res.status_code == 403

# -------------------------------------------------------------------
# TEST 7: Police member without creation permission attempts to create a criminal record through UI / API payload.
# Expected: User profile has canCreateCriminals = False (Creation control is unavailable in UI).
# -------------------------------------------------------------------
def test_7_police_member_creation_control_flag_unavailable(client: TestClient, hierarchy_fixture):
    me_res = client.get("/api/v1/auth/me", headers=hierarchy_fixture["off_north_headers"])
    assert me_res.status_code == 200
    me_data = me_res.json()
    assert me_data["canCreateCriminals"] is False
    assert "criminal_records.create" not in me_data["permissions"]

# -------------------------------------------------------------------
# TEST 8: The same police member sends a direct HTTP request to the criminal-record creation API.
# Expected: HTTP 403 and no database record created.
# -------------------------------------------------------------------
def test_8_unauthorized_police_member_creation_api_rejected(client: TestClient, hierarchy_fixture, db_session: Session):
    target_id = f"CR-DENY-{uuid.uuid4().hex[:6]}"
    res = client.post(
        "/api/v1/criminals",
        json={
            "id": target_id,
            "name": "Unauthorized Suspect",
            "category": "Theft",
            "status": "Active"
        },
        headers=hierarchy_fixture["off_north_headers"]
    )
    assert res.status_code == 403
    assert "criminal_records.create" in res.json()["detail"].lower() or "denied" in res.json()["detail"].lower()

    # Verify no record created in database
    db_rec = db_session.query(CriminalProfileModel).filter(CriminalProfileModel.id == target_id).first()
    assert db_rec is None

# -------------------------------------------------------------------
# TEST 9: Super Admin grants criminal-record creation permission to an eligible account.
# Expected: Permission is stored and audited.
# -------------------------------------------------------------------
def test_9_super_admin_grants_criminal_record_creation_permission(client: TestClient, hierarchy_fixture, db_session: Session):
    target_user_id = hierarchy_fixture["off_north_id"]
    res = client.post(
        f"/api/v1/users/{target_user_id}/permissions/criminal-create",
        json={"granted": True, "reason": "Authorized Special Task Force Investigator"},
        headers=hierarchy_fixture["super_headers"]
    )
    assert res.status_code == 200, res.text
    assert res.json()["isGranted"] is True

    # Verify stored in database
    grant = db_session.query(UserPermissionGrantModel).filter(
        UserPermissionGrantModel.user_id == target_user_id,
        UserPermissionGrantModel.is_granted == True
    ).first()
    assert grant is not None
    assert grant.permission_code == PERM_CRIMINAL_CREATE

    # Verify audit log
    audit_entry = db_session.query(AuditLogModel).filter(
        AuditLogModel.action == "GRANT_CRIMINAL_CREATE_PERMISSION",
        AuditLogModel.subject_id == target_user_id
    ).first()
    assert audit_entry is not None

# -------------------------------------------------------------------
# TEST 10: The authorized account creates a criminal record within its permitted scope.
# Expected: Success, with the correct audit entry.
# -------------------------------------------------------------------
def test_10_authorized_police_member_creates_record(client: TestClient, hierarchy_fixture, db_session: Session):
    target_user_id = hierarchy_fixture["off_north_id"]

    # Ensure granted
    client.post(
        f"/api/v1/users/{target_user_id}/permissions/criminal-create",
        json={"granted": True, "reason": "Task Force"},
        headers=hierarchy_fixture["super_headers"]
    )

    crim_id = f"CR-NORTH-{uuid.uuid4().hex[:6]}"
    create_res = client.post(
        "/api/v1/criminals",
        json={
            "id": crim_id,
            "name": "Permitted Suspect North",
            "category": "Theft",
            "status": "Active",
            "state": "State North"
        },
        headers=hierarchy_fixture["off_north_headers"]
    )
    assert create_res.status_code == 200, create_res.text
    data = create_res.json()
    assert data["id"] == crim_id
    assert data["name"] == "Permitted Suspect North"

    # Verify created_by_id and audit
    rec = db_session.query(CriminalProfileModel).filter(CriminalProfileModel.id == crim_id).first()
    assert rec is not None
    assert rec.created_by_id == target_user_id

    audit = db_session.query(AuditLogModel).filter(
        AuditLogModel.subject_id == crim_id,
        AuditLogModel.action == "CREATE_CRIMINAL"
    ).first()
    assert audit is not None
    assert audit.result == "SUCCESS"

# -------------------------------------------------------------------
# TEST 11: Super Admin revokes the creation permission.
# Expected: The next creation attempt is denied.
# -------------------------------------------------------------------
def test_11_super_admin_revokes_permission_and_blocks_subsequent_attempts(client: TestClient, hierarchy_fixture, db_session: Session):
    target_user_id = hierarchy_fixture["off_north_id"]

    # Revoke permission
    revoke_res = client.post(
        f"/api/v1/users/{target_user_id}/permissions/criminal-create",
        json={"granted": False, "reason": "Rotation out of Task Force"},
        headers=hierarchy_fixture["super_headers"]
    )
    assert revoke_res.status_code == 200
    assert revoke_res.json()["isGranted"] is False

    # Attempt creation immediately on next request
    target_id = f"CR-POST-REVOKE-{uuid.uuid4().hex[:6]}"
    attempt_res = client.post(
        "/api/v1/criminals",
        json={
            "id": target_id,
            "name": "Post Revoke Suspect",
            "category": "Theft",
            "status": "Active"
        },
        headers=hierarchy_fixture["off_north_headers"]
    )
    assert attempt_res.status_code == 403
    assert "criminal_records.create" in attempt_res.json()["detail"].lower() or "denied" in attempt_res.json()["detail"].lower()

# -------------------------------------------------------------------
# TEST 12: Regional Admin attempts to grant permission by modifying request fields or role names.
# Expected: HTTP 403 and no permission changes.
# -------------------------------------------------------------------
def test_12_regional_admin_cannot_grant_permission_via_field_tampering(client: TestClient, hierarchy_fixture, db_session: Session):
    target_user_id = hierarchy_fixture["off_north_id"]

    # Attempt via PUT /users/{id}
    tamper_res = client.put(
        f"/api/v1/users/{target_user_id}",
        json={
            "roleName": "Administrator",
            "canCreateCriminals": True,
            "permissions": ["criminal_records.create"]
        },
        headers=hierarchy_fixture["reg_north_headers"]
    )
    assert tamper_res.status_code == 403

    # Attempt via grant route
    grant_attempt = client.post(
        "/api/v1/permissions/grant",
        json={"userId": target_user_id, "permission": "criminal_records.create"},
        headers=hierarchy_fixture["reg_north_headers"]
    )
    assert grant_attempt.status_code == 403

# -------------------------------------------------------------------
# TEST 13: A user attempts to access a criminal record belonging to another unauthorized region.
# Expected: Access denied.
# -------------------------------------------------------------------
def test_13_cross_region_criminal_record_access_denied(client: TestClient, hierarchy_fixture):
    # North Regional Admin attempts to access South criminal record
    res_reg = client.get(
        f"/api/v1/criminals/{hierarchy_fixture['crim_south_id']}",
        headers=hierarchy_fixture["reg_north_headers"]
    )
    assert res_reg.status_code == 403
    assert "jurisdiction" in res_reg.json()["detail"].lower() or "clearance" in res_reg.json()["detail"].lower()

    # North Police Officer attempts to access South criminal record
    res_off = client.get(
        f"/api/v1/criminals/{hierarchy_fixture['crim_south_id']}",
        headers=hierarchy_fixture["off_north_headers"]
    )
    assert res_off.status_code == 403

# -------------------------------------------------------------------
# TEST 14: A user attempts to modify or delete a criminal record without the corresponding permission.
# Expected: HTTP 403 and no data changes.
# -------------------------------------------------------------------
def test_14_modify_or_delete_without_permission_denied(client: TestClient, hierarchy_fixture, db_session: Session):
    # Create an authorized user who has criminal:read only (no update or delete)
    ro_user = UserModel(
        id=f"usr-ro-{uuid.uuid4().hex[:6]}",
        username=f"read_only_{uuid.uuid4().hex[:6]}",
        hashed_password=get_password_hash("Test#2026"),
        full_name="Read Only Officer",
        badge_number=f"RO-{uuid.uuid4().hex[:6]}",
        role_id="role-authorized-personnel",
        is_active=True,
        is_superuser=False,
        region="South Region"
    )
    db_session.add(ro_user)
    db_session.commit()

    ro_headers = {"Authorization": f"Bearer {create_access_token(ro_user.id)}"}

    # Attempt delete
    del_res = client.delete(f"/api/v1/criminals/{hierarchy_fixture['crim_south_id']}", headers=ro_headers)
    assert del_res.status_code == 403

    # Attempt modify
    mod_res = client.post(
        "/api/v1/criminals",
        json={"id": hierarchy_fixture["crim_south_id"], "name": "Modified Name Tamper"},
        headers=ro_headers
    )
    assert mod_res.status_code == 403

    # Verify criminal was not modified
    crim = db_session.query(CriminalProfileModel).filter(CriminalProfileModel.id == hierarchy_fixture["crim_south_id"]).first()
    assert crim.name == "Southern Suspect"
    assert crim.is_deleted is False

# -------------------------------------------------------------------
# TEST 15: Verify that the same authorization rules apply to web, Windows, and Android clients through their shared backend APIs.
# Expected: All clients calling the unified REST API have permissions strictly enforced on the server.
# -------------------------------------------------------------------
def test_15_shared_backend_enforces_rules_across_all_client_user_agents(client: TestClient, hierarchy_fixture):
    user_agents = [
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) CRMS-Web/1.0",
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Electron/30.0.0 CRMS-Desktop/1.0",
        "Mozilla/5.0 (Linux; Android 14; Pixel 8) Capacitor/6.0.0 CRMS-Android/1.0"
    ]
    for ua in user_agents:
        # Cross-region check should be blocked regardless of User-Agent
        res = client.get(
            f"/api/v1/criminals/{hierarchy_fixture['crim_south_id']}",
            headers={**hierarchy_fixture["reg_north_headers"], "User-Agent": ua}
        )
        assert res.status_code == 403, f"Failed for User-Agent: {ua}"

        # Unauthorized creation check should be blocked regardless of User-Agent
        res_create = client.post(
            "/api/v1/criminals",
            json={"name": "UA Test", "category": "Theft"},
            headers={**hierarchy_fixture["off_north_headers"], "User-Agent": ua}
        )
        assert res_create.status_code == 403, f"Failed creation for User-Agent: {ua}"

# -------------------------------------------------------------------
# TEST 16: Verify that changing frontend state, local storage, request payloads, or URL parameters cannot bypass backend authorization.
# Expected: Manipulated client parameters are strictly rejected.
# -------------------------------------------------------------------
def test_16_tampered_payloads_and_url_parameters_fail(client: TestClient, hierarchy_fixture):
    # Officer attempts to spoof role / clearance in payload
    spoofed_payload = {
        "id": f"CR-SPOOF-{uuid.uuid4().hex[:6]}",
        "name": "Spoofed Record",
        "role": "Super Administrator",
        "isSuperuser": True,
        "clearanceLevel": "Level 5 - Top Secret",
        "canCreateCriminals": True
    }
    res = client.post(
        "/api/v1/criminals",
        json=spoofed_payload,
        headers=hierarchy_fixture["off_north_headers"]
    )
    assert res.status_code == 403

    # Officer attempts URL IDOR manipulation to access user details outside jurisdiction
    res_idor = client.get(
        f"/api/v1/users/{hierarchy_fixture['reg_north_id']}",
        headers=hierarchy_fixture["off_north_headers"]
    )
    # Officer lacks users:manage -> 403
    assert res_idor.status_code == 403

# -------------------------------------------------------------------
# TEST 17: Verify that revoking a role or permission invalidates the user's ability to perform the corresponding operation on subsequent requests.
# Expected: Immediate enforcement without caching old privileges.
# -------------------------------------------------------------------
def test_17_permission_revocation_takes_immediate_effect(client: TestClient, hierarchy_fixture, db_session: Session):
    target_user_id = hierarchy_fixture["off_north_id"]

    # 1. Grant permission
    client.post(
        f"/api/v1/users/{target_user_id}/permissions/criminal-create",
        json={"granted": True},
        headers=hierarchy_fixture["super_headers"]
    )

    # 2. Verify creation works
    id1 = f"CR-IMM-1-{uuid.uuid4().hex[:4]}"
    res1 = client.post(
        "/api/v1/criminals",
        json={"id": id1, "name": "Immediate Test 1"},
        headers=hierarchy_fixture["off_north_headers"]
    )
    assert res1.status_code == 200

    # 3. Revoke permission
    client.post(
        f"/api/v1/users/{target_user_id}/permissions/criminal-create",
        json={"granted": False},
        headers=hierarchy_fixture["super_headers"]
    )

    # 4. Immediate subsequent request fails
    id2 = f"CR-IMM-2-{uuid.uuid4().hex[:4]}"
    res2 = client.post(
        "/api/v1/criminals",
        json={"id": id2, "name": "Immediate Test 2"},
        headers=hierarchy_fixture["off_north_headers"]
    )
    assert res2.status_code == 403

# -------------------------------------------------------------------
# TEST 18: Verify that audit logs record successful grants, revocations, criminal-record creation, and denied unauthorized actions.
# Expected: Audit trail contains all corresponding security events.
# -------------------------------------------------------------------
def test_18_audit_logs_record_grants_revocations_creations_and_denials(client: TestClient, hierarchy_fixture, db_session: Session):
    target_user_id = hierarchy_fixture["off_north_id"]

    # Trigger grant
    client.post(
        f"/api/v1/users/{target_user_id}/permissions/criminal-create",
        json={"granted": True, "reason": "Audit Test Grant"},
        headers=hierarchy_fixture["super_headers"]
    )
    # Trigger creation
    test_id = f"CR-AUD-{uuid.uuid4().hex[:4]}"
    client.post(
        "/api/v1/criminals",
        json={"id": test_id, "name": "Audit Subject"},
        headers=hierarchy_fixture["off_north_headers"]
    )
    # Trigger revocation
    client.post(
        f"/api/v1/users/{target_user_id}/permissions/criminal-create",
        json={"granted": False, "reason": "Audit Test Revoke"},
        headers=hierarchy_fixture["super_headers"]
    )
    # Trigger unauthorized denial
    client.post(
        "/api/v1/criminals",
        json={"name": "Denied Subject"},
        headers=hierarchy_fixture["off_north_headers"]
    )

    # Inspect audit log actions in DB
    actions_recorded = {
        row[0] for row in db_session.query(AuditLogModel.action).filter(
            AuditLogModel.action.in_([
                "GRANT_CRIMINAL_CREATE_PERMISSION",
                "CREATE_CRIMINAL",
                "REVOKE_CRIMINAL_CREATE_PERMISSION",
                "UNAUTHORIZED_CREATION_ATTEMPT"
            ])
        ).all()
    }

    assert "GRANT_CRIMINAL_CREATE_PERMISSION" in actions_recorded
    assert "CREATE_CRIMINAL" in actions_recorded
    assert "REVOKE_CRIMINAL_CREATE_PERMISSION" in actions_recorded
    assert "UNAUTHORIZED_CREATION_ATTEMPT" in actions_recorded
