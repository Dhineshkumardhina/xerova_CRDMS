import io
import pytest
from PIL import Image
from app.core.config import settings

def test_text_search_existing_name(client, admin_headers):
    res = client.get("/api/v1/search?q=Raj", headers=admin_headers)
    assert res.status_code == 200
    data = res.json()
    assert data["success"] is True
    assert data["total"] >= 1
    assert len(data["results"]) >= 1
    assert data["results"][0]["name"] == "Raj Kumar Sharma"

def test_text_search_non_existing_name(client, admin_headers):
    res = client.get("/api/v1/search?q=ZZZZZZZZ_NONEXISTENT", headers=admin_headers)
    assert res.status_code == 200
    data = res.json()
    assert data["success"] is True
    assert data["total"] == 0
    assert len(data["results"]) == 0
    assert len(data["records"]) == 0

def test_text_search_existing_phone(client, admin_headers):
    res = client.get("/api/v1/search?q=555-019-2831", headers=admin_headers)
    assert res.status_code == 200
    data = res.json()
    assert data["total"] >= 1
    assert data["results"][0]["id"] == "CR-001245"

def test_text_search_non_existing_criminal_id(client, admin_headers):
    res = client.get("/api/v1/search?q=CR-999999999", headers=admin_headers)
    assert res.status_code == 200
    data = res.json()
    assert data["total"] == 0
    assert len(data["results"]) == 0

def test_photo_search_no_face_error(client, admin_headers):
    # Blank white image with no face features
    img = Image.new("RGB", (100, 100), color="white")
    buf = io.BytesIO()
    img.save(buf, format="JPEG")
    
    res = client.post(
        "/api/v1/search/photo",
        files={"file": ("blank.jpg", buf.getvalue(), "image/jpeg")},
        headers=admin_headers
    )
    assert res.status_code == 400
    data = res.json()
    assert data["success"] is False
    assert data["error_code"] == "NO_FACE_DETECTED"
    assert "No face detected" in data["message"]

def test_photo_search_non_face_rejected(client, admin_headers):
    # Blank/solid color image without face features is correctly rejected
    img = Image.new("RGB", (150, 150), color="red")
    buf = io.BytesIO()
    img.save(buf, format="JPEG")
    
    res = client.post(
        "/api/v1/search/photo",
        files={"file": ("unmatched.jpg", buf.getvalue(), "image/jpeg")},
        headers=admin_headers
    )
    assert res.status_code == 400
    data = res.json()
    assert data["success"] is False
    assert data["error_code"] == "NO_FACE_DETECTED"
