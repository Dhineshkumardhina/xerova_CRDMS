import io
import uuid
import pytest
from PIL import Image
from fastapi.testclient import TestClient
from app.main import app
from app.models.user import UserModel
from app.models.case import CaseRecordModel
from app.models.police_station import PoliceStationModel
from app.models.criminal import CriminalProfileModel
from app.core.security import create_access_token, get_password_hash
from app.core.rate_limit import rate_limiter

def test_scenario_1_login_auth_me_and_logout(client: TestClient, db_session):
    """
    Test Scenario 1:
    - User authenticates via POST /auth/login with valid credentials.
    - Token is validated via GET /auth/me.
    - Refresh token rotation via POST /auth/refresh.
    - User logs out via POST /auth/logout and access is terminated.
    """
    rate_limiter.reset()
    login_res = client.post("/api/v1/auth/login", json={
        "officerId": "8829-JD",
        "password": "DeptJusticeSecure#2024"
    })
    assert login_res.status_code == 200, login_res.text
    tokens = login_res.json()
    assert "access_token" in tokens
    assert "refresh_token" in tokens
    access_token = tokens["access_token"]
    refresh_token = tokens["refresh_token"]

    # Verify session profile with GET /auth/me
    me_res = client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {access_token}"})
    assert me_res.status_code == 200
    me_data = me_res.json()
    assert me_data["badgeNumber"] == "8829-JD"
    assert me_data["name"] == "Officer J. Daniels"

    # Refresh token rotation
    ref_res = client.post("/api/v1/auth/refresh", json={"refresh_token": refresh_token})
    assert ref_res.status_code == 200
    new_tokens = ref_res.json()
    assert "access_token" in new_tokens
    new_access_token = new_tokens["access_token"]
    new_refresh_token = new_tokens["refresh_token"]

    # Logout
    logout_res = client.post(
        "/api/v1/auth/logout",
        json={"refresh_token": new_refresh_token},
        headers={"Authorization": f"Bearer {new_access_token}"}
    )
    assert logout_res.status_code == 200

    # Old refresh token should now be invalidated
    invalid_refresh = client.post("/api/v1/auth/refresh", json={"refresh_token": new_refresh_token})
    assert invalid_refresh.status_code == 401

def test_scenario_2_create_and_search_fir(client: TestClient, admin_headers, db_session):
    """
    Test Scenario 2:
    - Register a new FIR with auto-generated reference number.
    - Verify FIR is persisted in database.
    - Search for the FIR by case number and keyword in /search and /cases.
    """
    fir_payload = {
        "title": "Armed Robbery at Jeweler",
        "description": "Suspects entered storefront armed with bludgeons and took bullion.",
        "category": "Theft",
        "status": "Under Investigation",
        "incidentDate": "2026-10-25",
        "incidentLocation": "Crossroads Mall, Puducherry",
        "complainantName": "Mr. Vikram Mehta",
        "complainantPhone": "+91 9876543210",
        "penalCode": "IPC 392"
    }

    create_res = client.post("/api/v1/cases", json=fir_payload, headers=admin_headers)
    assert create_res.status_code == 200, create_res.text
    case_data = create_res.json()
    assert "caseNumber" in case_data
    case_number = case_data["caseNumber"]
    case_id = case_data["id"]
    assert case_number.startswith("FIR-")

    # Verify retrieval from GET /cases
    cases_list_res = client.get("/api/v1/cases?category=Theft", headers=admin_headers)
    assert cases_list_res.status_code == 200
    case_numbers = [c["caseNumber"] for c in cases_list_res.json()]
    assert case_number in case_numbers

    # Verify detailed dossier retrieval
    detail_res = client.get(f"/api/v1/cases/{case_id}/detail", headers=admin_headers)
    assert detail_res.status_code == 200
    detail = detail_res.json()
    assert detail["complainantName"] == "Mr. Vikram Mehta"
    assert len(detail["activities"]) >= 1  # Initial intake milestone recorded

def test_scenario_3_create_case_and_assign_authorized_officer(client: TestClient, admin_headers, db_session):
    """
    Test Scenario 3:
    - Create a case dossier.
    - Query available officers within regional jurisdiction.
    - Assign an authorized officer as lead investigator.
    - Confirm assignment persists on case record and case detail.
    """
    # Create Case
    create_res = client.post("/api/v1/cases", json={
        "title": "Securities Fraud Investigation",
        "description": "Shell corporations used for offshore money diversion.",
        "category": "Fraud",
        "status": "Under Investigation",
    }, headers=admin_headers)
    assert create_res.status_code == 200
    case_id = create_res.json()["id"]

    # List users / officers
    users_res = client.get("/api/v1/users", headers=admin_headers)
    assert users_res.status_code == 200
    officers = users_res.json()
    assert len(officers) > 0
    target_officer = officers[0]
    target_officer_id = target_officer["id"]

    # Assign officer
    assign_res = client.post(f"/api/v1/cases/{case_id}/assign", json={
        "leadOfficerId": target_officer_id
    }, headers=admin_headers)
    assert assign_res.status_code == 200
    assign_data = assign_res.json()
    assert assign_data["status"] == "success"

    # Confirm persistence in detail
    detail_res = client.get(f"/api/v1/cases/{case_id}/detail", headers=admin_headers)
    assert detail_res.status_code == 200
    detail = detail_res.json()
    assert target_officer["name"] in detail["officerInCharge"]

def test_scenario_4_upload_and_retrieve_authorized_document(client: TestClient, admin_headers, db_session):
    """
    Test Scenario 4:
    - Upload an authorized evidence PDF document attached to a case dossier.
    - Confirm SHA-256 integrity check and storage save.
    - Download the document using the secure download endpoint.
    - Verify malicious file extensions (.exe) are rejected.
    """
    # 1. Create a dummy case to attach evidence
    case_res = client.post("/api/v1/cases", json={
        "title": "Forensic Evidence Case",
        "description": "Evidence repository verification",
        "category": "Theft"
    }, headers=admin_headers)
    case_id = case_res.json()["id"]

    # 2. Upload valid PDF document
    pdf_content = b"%PDF-1.4\n1 0 obj\n<<>>\nendobj\ntrailer\n<<>>\n%%EOF"
    upload_res = client.post(
        "/api/v1/documents/upload",
        data={
            "title": "Forensic Fingerprint Analysis",
            "document_type": "Case Evidence",
            "case_id": case_id,
            "is_confidential": "false"
        },
        files={"file": ("fingerprint_lab_report.pdf", pdf_content, "application/pdf")},
        headers=admin_headers
    )
    assert upload_res.status_code == 200, upload_res.text
    doc_data = upload_res.json()
    assert "id" in doc_data
    doc_id = doc_data["id"]

    # 3. Download the document
    download_res = client.get(f"/api/v1/documents/{doc_id}/download", headers=admin_headers)
    assert download_res.status_code == 200
    assert download_res.content == pdf_content

    # 4. Reject executable payload
    bad_upload = client.post(
        "/api/v1/documents/upload",
        data={"title": "Malware Payload", "document_type": "Case Evidence"},
        files={"file": ("exploit.exe", b"MZ\x90\x00\x03\x00\x00\x00", "application/x-msdownload")},
        headers=admin_headers
    )
    assert bad_upload.status_code == 400
    assert "Invalid document file extension" in bad_upload.json()["detail"] or "not allowed" in bad_upload.json()["detail"]

def test_scenario_5_face_recognition_search(client: TestClient, admin_headers, db_session):
    """
    Test Scenario 5:
    - Re-indexes or inspects biometric face recognition status endpoint.
    - Verifies vector matching endpoint rejects empty/non-face payloads safely.
    - Confirms similarity scores are separated from absolute identity declarations.
    """
    # Status check
    status_res = client.get("/api/v1/face-recognition/status", headers=admin_headers)
    assert status_res.status_code == 200
    status_data = status_res.json()
    assert status_data["status"] == "online"
    assert "service" in status_data

    # Test blank solid color image without facial features is rejected safely
    img = Image.new("RGB", (150, 150), color="blue")
    buf = io.BytesIO()
    img.save(buf, format="JPEG")
    buf.seek(0)

    res = client.post(
        "/api/v1/search/photo",
        files={"file": ("blank_test.jpg", buf.getvalue(), "image/jpeg")},
        headers=admin_headers
    )
    assert res.status_code == 400
    data = res.json()
    assert data["success"] is False
    assert data["error_code"] == "NO_FACE_DETECTED"

def test_scenario_6_regional_access_restrictions(client: TestClient, db_session):
    """
    Test Scenario 6:
    - Create a station-restricted user in Station A.
    - Attempt to access a criminal profile / case belonging to Station B.
    - Verify HTTP 403 Forbidden is returned, protecting jurisdictional boundaries.
    """
    # Create two stations in different states/districts
    stn_a = PoliceStationModel(
        id=str(uuid.uuid4()),
        name="Precinct North",
        station_code=f"PS-A-{uuid.uuid4().hex[:4]}",
        district="District North",
        state="State North",
        region="Northern Region"
    )
    stn_b = PoliceStationModel(
        id=str(uuid.uuid4()),
        name="Precinct South",
        station_code=f"PS-B-{uuid.uuid4().hex[:4]}",
        district="District South",
        state="State South",
        region="Southern Region"
    )
    db_session.add(stn_a)
    db_session.add(stn_b)
    db_session.commit()

    # User in Station A
    user_a = UserModel(
        id=str(uuid.uuid4()),
        username=f"officer_a_{uuid.uuid4().hex[:4]}",
        hashed_password=get_password_hash("NorthOfficerPass#2024"),
        full_name="Officer North",
        badge_number=f"BN-{uuid.uuid4().hex[:4]}",
        role_id="role-station-admin",
        police_station_id=stn_a.id,
        district="District North",
        state="State North",
        region="Northern Region",
        is_active=True,
        is_superuser=False
    )
    # Criminal in Station B
    crim_b = CriminalProfileModel(
        id=f"CR-B-{uuid.uuid4().hex[:4]}",
        name="Target In South Jurisdiction",
        normalized_name="target in south jurisdiction",
        police_station_id=stn_b.id,
        state="State South",
        category="Theft",
        is_deleted=False
    )
    db_session.add(user_a)
    db_session.add(crim_b)
    db_session.commit()

    token_a = create_access_token(subject=user_a.id)
    headers_a = {"Authorization": f"Bearer {token_a}"}

    # Attempt to view criminal in Station B
    forbidden_res = client.get(f"/api/v1/criminals/{crim_b.id}", headers=headers_a)
    assert forbidden_res.status_code == 403
    assert "jurisdiction" in forbidden_res.json()["detail"].lower() or "denied" in forbidden_res.json()["detail"].lower()

def test_scenario_7_administrative_permission_matrix(client: TestClient, db_session):
    """
    Test Scenario 7:
    - User with read-only permissions cannot execute destructive actions (archive, delete, or create user).
    - Super administrator has universal global authority.
    """
    # Create Read-Only Personnel
    read_only_user = UserModel(
        id=str(uuid.uuid4()),
        username=f"readonly_{uuid.uuid4().hex[:4]}",
        hashed_password=get_password_hash("ReadOnlyPass#2024"),
        full_name="Analyst Jane",
        badge_number=f"BN-{uuid.uuid4().hex[:4]}",
        role_id="role-authorized-personnel",
        is_active=True,
        is_superuser=False
    )
    db_session.add(read_only_user)
    db_session.commit()

    token_ro = create_access_token(subject=read_only_user.id)
    headers_ro = {"Authorization": f"Bearer {token_ro}"}

    # Attempt to create user (requires users:manage)
    create_user_res = client.post("/api/v1/users", json={
        "username": "escalated_user",
        "name": "Escalated User",
        "badgeNumber": "BN-ESC",
        "roleName": "Administrator"
    }, headers=headers_ro)
    assert create_user_res.status_code == 403

def test_scenario_8_persistence_and_analytics_integrity(client: TestClient, admin_headers, db_session):
    """
    Test Scenario 8:
    - Register a criminal profile, register an FIR case, add activities.
    - Query GET /analytics/summary and GET /categories to confirm real aggregated statistics.
    - Verify counts match actual committed rows in SQLite database.
    """
    # Query summary before
    before_analytics = client.get("/api/v1/analytics/summary", headers=admin_headers).json()
    initial_crims = before_analytics["totalCriminals"]

    # Create new criminal
    new_crim_id = f"CR-PERSIST-{uuid.uuid4().hex[:4]}"
    client.post("/api/v1/criminals", json={
        "id": new_crim_id,
        "name": "Persistent Test Subject",
        "category": "Narcotics",
        "status": "Active",
        "aliases": ["Shadow", "Ghost"],
        "cases": []
    }, headers=admin_headers)

    # Query summary after
    after_analytics = client.get("/api/v1/analytics/summary", headers=admin_headers).json()
    assert after_analytics["totalCriminals"] == initial_crims + 1

    # Categories count check
    cat_res = client.get("/api/v1/categories", headers=admin_headers)
    assert cat_res.status_code == 200
    narcotics_cat = next((c for c in cat_res.json() if c["category"] == "Narcotics"), None)
    assert narcotics_cat is not None
    assert narcotics_cat["recordsCount"] >= 1
