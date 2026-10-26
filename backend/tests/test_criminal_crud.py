import pytest

def test_get_criminal_by_id(client, admin_headers):
    res = client.get("/api/v1/criminals/CR-001245", headers=admin_headers)
    assert res.status_code == 200
    data = res.json()
    assert data["id"] == "CR-001245"
    assert data["name"] == "Raj Kumar Sharma"

def test_get_nonexistent_criminal_profile(client, admin_headers):
    res = client.get("/api/v1/criminals/CR-999999", headers=admin_headers)
    assert res.status_code == 404

def test_create_criminal_profile(client, admin_headers):
    payload = {
        "id": "CR-009911",
        "name": "Devi Prasad",
        "alias": "Dev",
        "fatherName": "Shankar Prasad",
        "dob": "1995-04-12",
        "age": 28,
        "gender": "Male",
        "phone": "+1 555-019-8822",
        "identificationNumber": "XXXX-XXXX-9911",
        "primaryAddress": "77 Marina Street",
        "city": "Puducherry",
        "state": "Puducherry",
        "height": "5ft 10in",
        "weight": "75 kg",
        "eyeColor": "Brown",
        "mugshotUrl": "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d",
        "mugshotDate": "2024-01-15",
        "riskLevel": "Medium Risk",
        "category": "Robbery",
        "status": "Active"
    }
    res = client.post("/api/v1/criminals", json=payload, headers=admin_headers)
    assert res.status_code == 200
    data = res.json()
    assert data["id"] == "CR-009911"
    assert data["name"] == "Devi Prasad"

def test_archive_criminal_profile(client, admin_headers):
    res = client.put("/api/v1/criminals/CR-001245/archive", headers=admin_headers)
    assert res.status_code == 200
    data = res.json()
    assert data["isArchived"] is True
