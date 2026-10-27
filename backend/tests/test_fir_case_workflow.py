import pytest
import io
from app.models.case import CaseRecordModel, CaseActivityModel
from app.models.user import UserModel
from app.models.police_station import PoliceStationModel
from app.core.security import get_password_hash, create_access_token

def test_register_fir_auto_reference(client, officer_headers):
    payload = {
        "title": "Commercial Burglary at Electronics Hub",
        "description": "Complainant reports forced entry into warehouse unit, theft of 50 laptops and surveillance equipment.",
        "category": "Theft",
        "status": "Under Investigation",
        "incidentDate": "2026-10-25T22:30:00",
        "incidentLocation": "Sector 14 Industrial Area, Puducherry",
        "complainantName": "Anand Prakash",
        "complainantPhone": "+91 98451 22334",
        "penalCode": "IPC 457, 380",
    }
    res = client.post("/api/v1/cases", json=payload, headers=officer_headers)
    assert res.status_code == 200
    data = res.json()
    assert data["caseNumber"].startswith("FIR-")
    assert len(data["caseNumber"]) >= 14
    assert data["status"] == "Under Investigation"
    assert data["category"] == "Theft"
    case_id = data["id"]

    # Verify detail and auto-created intake milestone
    res_detail = client.get(f"/api/v1/cases/{case_id}/detail", headers=officer_headers)
    assert res_detail.status_code == 200
    detail = res_detail.json()
    assert detail["caseNumber"] == data["caseNumber"]
    assert detail["complainantName"] == "Anand Prakash"
    assert detail["incidentLocation"] == "Sector 14 Industrial Area, Puducherry"
    assert len(detail["activities"]) >= 1
    assert detail["activities"][0]["activityType"] in ("FIR Intake", "FIR Registration")

def test_register_fir_custom_and_duplicate_reference(client, admin_headers):
    custom_ref = "FIR-2026-SPECIAL-771"
    payload = {
        "caseNumber": custom_ref,
        "title": "Inter-State Cyber Banking Fraud",
        "description": "Phishing network targeting senior citizens across multiple jurisdictions.",
        "category": "Cybercrime",
        "status": "Under Investigation",
        "penalCode": "IT Act 66D, IPC 420"
    }
    res = client.post("/api/v1/cases", json=payload, headers=admin_headers)
    assert res.status_code == 200
    assert res.json()["caseNumber"] == custom_ref

    # Attempt duplicate
    res_dup = client.post("/api/v1/cases", json=payload, headers=admin_headers)
    assert res_dup.status_code == 400
    assert "already exists" in res_dup.json()["detail"]

def test_add_case_activity_log(client, officer_headers):
    # Register a case first
    res_c = client.post("/api/v1/cases", json={
        "title": "Vehicle Theft Investigation",
        "description": "Motorcycle stolen from public parking lot.",
        "category": "Vehicle",
        "status": "Under Investigation"
    }, headers=officer_headers)
    assert res_c.status_code == 200
    case_id = res_c.json()["id"]

    # Add investigative note
    activity_payload = {
        "activityType": "Forensic Evidence Intake",
        "title": "CCTV Retrieval from Street Intersection",
        "description": "Retrieved 1080p footage from municipal traffic cameras showing two masked individuals at 02:14 AM."
    }
    res_act = client.post(f"/api/v1/cases/{case_id}/activities", json=activity_payload, headers=officer_headers)
    assert res_act.status_code == 200
    act_data = res_act.json()
    assert act_data["activityType"] == "Forensic Evidence Intake"
    assert act_data["title"] == "CCTV Retrieval from Street Intersection"

    # Verify detail contains activity
    res_det = client.get(f"/api/v1/cases/{case_id}/detail", headers=officer_headers)
    assert res_det.status_code == 200
    activities = res_det.json()["activities"]
    assert any(a["title"] == "CCTV Retrieval from Street Intersection" for a in activities)

def test_link_person_to_case(client, admin_headers):
    # Register case
    res_c = client.post("/api/v1/cases", json={
        "title": "Financial Embezzlement Syndicate",
        "description": "Systematic diversion of corporate funds to offshore shell companies.",
        "category": "Financial",
        "status": "Under Investigation"
    }, headers=admin_headers)
    assert res_c.status_code == 200
    case_id = res_c.json()["id"]

    # Link criminal profile CR-001245
    link_res = client.post(f"/api/v1/cases/{case_id}/link-person", json={
        "criminalId": "CR-001245",
        "roleInCase": "Primary Suspect"
    }, headers=admin_headers)
    assert link_res.status_code == 200
    assert link_res.json()["status"] == "success"

    # Verify linked suspect in detail
    res_det = client.get(f"/api/v1/cases/{case_id}/detail", headers=admin_headers)
    assert res_det.status_code == 200
    linked_persons = res_det.json()["linkedPersons"]
    assert any(p["id"] == "CR-001245" for p in linked_persons)

def test_update_case_status_and_judicial_fields(client, admin_headers):
    res_c = client.post("/api/v1/cases", json={
        "title": "Robbery Inquiry",
        "description": "Commercial robbery at convenience store.",
        "category": "Theft",
        "status": "Under Investigation"
    }, headers=admin_headers)
    assert res_c.status_code == 200
    case_id = res_c.json()["id"]

    # Update status to Court Pending and courtroom details
    update_res = client.put(f"/api/v1/cases/{case_id}", json={
        "status": "Court Pending",
        "courtRoom": "Judicial Magistrate Court 2",
        "presidingJudge": "Hon. Justice V. Natarajan",
        "courtroomNotes": "Charges framed under IPC 392, trial scheduled for preliminary hearing."
    }, headers=admin_headers)
    assert update_res.status_code == 200
    data = update_res.json()
    assert data["status"] == "Court Pending"
    assert data["courtRoom"] == "Judicial Magistrate Court 2"

    # Status change milestone should be automatically logged in activities
    res_det = client.get(f"/api/v1/cases/{case_id}/detail", headers=admin_headers)
    activities = res_det.json()["activities"]
    assert any("Court Pending" in a["title"] for a in activities)

def test_document_magic_byte_executable_rejection(client, admin_headers):
    # Attempt to upload Windows PE executable disguised as PDF
    disguised_exe = b"MZ\x90\x00\x03\x00\x00\x00" + b"\x00" * 100
    res = client.post(
        "/api/v1/documents/upload",
        files={"file": ("malicious.pdf", disguised_exe, "application/pdf")},
        data={"title": "Faked PDF Document"},
        headers=admin_headers
    )
    assert res.status_code == 400
    assert "Disallowed file content" in res.json()["detail"] or "executable" in res.json()["detail"].lower()

    # Attempt to upload Linux ELF binary disguised as document
    disguised_elf = b"\x7fELF\x02\x01\x01\x00" + b"\x00" * 100
    res_elf = client.post(
        "/api/v1/documents/upload",
        files={"file": ("backdoor.pdf", disguised_elf, "application/pdf")},
        data={"title": "Faked ELF Document"},
        headers=admin_headers
    )
    assert res_elf.status_code == 400
    assert "Disallowed file content" in res_elf.json()["detail"] or "executable" in res_elf.json()["detail"].lower()

def test_case_evidence_upload_and_download(client, admin_headers):
    # Register case
    res_c = client.post("/api/v1/cases", json={
        "title": "Evidence Handling Test Case",
        "description": "Testing chain-of-custody document attachment.",
        "category": "Theft",
        "status": "Under Investigation"
    }, headers=admin_headers)
    case_id = res_c.json()["id"]

    # Upload authentic PDF evidence
    pdf_content = b"%PDF-1.7\n%Digital Evidence Forensic Report\n1 0 obj\n<< /Type /Catalog >>\nendobj\n%%EOF"
    upload_res = client.post(
        "/api/v1/documents/upload",
        files={"file": ("Forensic_Ballistics_Cert.pdf", pdf_content, "application/pdf")},
        data={
            "title": "Forensic Ballistics Certification",
            "document_type": "Case Evidence",
            "case_id": case_id
        },
        headers=admin_headers
    )
    assert upload_res.status_code == 200
    doc_data = upload_res.json()
    doc_id = doc_data["id"]
    assert doc_data["fileHashSha256"] is not None

    # Verify document appears in case details
    det_res = client.get(f"/api/v1/cases/{case_id}/detail", headers=admin_headers)
    assert det_res.status_code == 200
    docs = det_res.json()["documents"]
    assert any(d["id"] == doc_id for d in docs)

    # Download document
    dl_res = client.get(f"/api/v1/documents/{doc_id}/download", headers=admin_headers)
    assert dl_res.status_code == 200
    assert dl_res.content == pdf_content
    assert dl_res.headers.get("X-Content-SHA256") == doc_data["fileHashSha256"]

def test_cross_station_document_clearance_restriction(client, db_session, admin_headers):
    # 1. Create a station in a different jurisdiction (Madurai Central Station)
    other_stn = PoliceStationModel(
        id="stn-other-99",
        name="Madurai South Precinct",
        station_code="PS-MAD-99",
        district="Madurai",
        state="Tamil Nadu",
        region="Southern Region",
        phone_number="+91 452-234-5678"
    )
    db_session.add(other_stn)

    # 2. Create an officer restricted to this other station
    other_officer = UserModel(
        id="usr-other-station",
        username="9999-OS",
        hashed_password=get_password_hash("OtherStationSecure#2024"),
        full_name="Officer Outside Jurisdiction",
        badge_number="9999-OS",
        rank="Patrol Officer",
        department="Madurai Precinct",
        clearance_level="Level 2",
        is_superuser=False,
        is_active=True,
        role_id="role-officer",
        police_station_id="stn-other-99",
        district="Madurai",
        state="Tamil Nadu",
        region="Southern Region"
    )
    db_session.add(other_officer)
    db_session.commit()

    other_token = create_access_token(subject="usr-other-station")
    other_headers = {"Authorization": f"Bearer {other_token}"}

    # 3. Create case assigned to Puducherry station
    pudu_stn = db_session.query(PoliceStationModel).filter(PoliceStationModel.district == "Puducherry").first()
    puducherry_case = CaseRecordModel(
        id="case-puducherry-01",
        case_number="FIR-2026-PUDU-001",
        title="Local Puducherry Case",
        description="Puducherry jurisdictional investigation.",
        date_filed="Oct 27, 2026",
        status="Under Investigation",
        category="Theft",
        police_station_id=pudu_stn.id if pudu_stn else None
    )
    db_session.add(puducherry_case)
    db_session.commit()

    # 4. Upload document to this case as Admin
    pdf_content = b"%PDF-1.4\nConfidential Puducherry Case Report\n%%EOF"
    upload_res = client.post(
        "/api/v1/documents/upload",
        files={"file": ("Confidential_Pudu.pdf", pdf_content, "application/pdf")},
        data={"title": "Confidential Puducherry Report", "case_id": "case-puducherry-01"},
        headers=admin_headers
    )
    assert upload_res.status_code == 200
    doc_id = upload_res.json()["id"]

    # 5. Outside officer attempts to download -> should be 403 Forbidden
    denied_res = client.get(f"/api/v1/documents/{doc_id}/download", headers=other_headers)
    assert denied_res.status_code == 403
    assert "jurisdictional clearance" in denied_res.json()["detail"].lower() or "access denied" in denied_res.json()["detail"].lower()
