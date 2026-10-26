import io
import pytest
from PIL import Image

def test_invalid_photo_file_type(client, admin_headers):
    file_tuple = ("malware.exe", b"Exec payload", "application/octet-stream")
    res = client.post(
        "/api/v1/criminals/CR-001245/photos",
        files={"file": file_tuple},
        headers=admin_headers
    )
    assert res.status_code == 400
    assert "Invalid file type" in res.json()["detail"]

def test_corrupted_image_header(client, admin_headers):
    file_tuple = ("fake_photo.jpg", b"Invalid corrupted image header payload", "image/jpeg")
    res = client.post(
        "/api/v1/criminals/CR-001245/photos",
        files={"file": file_tuple},
        headers=admin_headers
    )
    assert res.status_code == 400
    assert "Corrupted image file" in res.json()["detail"]

def test_valid_photo_upload_and_embedding_extraction(client, admin_headers):
    # Generate valid test image
    img = Image.new("RGB", (100, 100), color="blue")
    buf = io.BytesIO()
    img.save(buf, format="JPEG")
    file_bytes = buf.getvalue()

    file_tuple = ("mugshot.jpg", file_bytes, "image/jpeg")
    res = client.post(
        "/api/v1/criminals/CR-001245/photos",
        files={"file": file_tuple},
        headers=admin_headers
    )
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "success"
    assert "storage_key" in data["photo"]
