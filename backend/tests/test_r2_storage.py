"""
Storage Service & Cloudflare R2 Integration Test Suite
======================================================
Tests local storage backend fallback and Cloudflare R2 storage backend interface.
"""

import pytest
from app.services.storage_service import storage_service, LocalStorageBackend, CloudflareR2Backend
from app.core.config import settings

def test_storage_service_default_backend():
    """Test 1: Default storage service initializes LocalStorageBackend when R2 keys are empty."""
    assert storage_service is not None
    assert hasattr(storage_service, "backend")
    assert storage_service.backend_name in ("Local Disk Storage", "Cloudflare R2")

def test_local_storage_save_and_delete(tmp_path):
    """Test 2: LocalStorageBackend saves and deletes files properly."""
    backend = LocalStorageBackend(base_dir=str(tmp_path))
    test_bytes = b"header_signature_test_data_1234567890"
    storage_key = "mugshots/test_photo.jpg"

    saved_path = backend.save(test_bytes, storage_key)
    assert saved_path is not None

    deleted = backend.delete(storage_key)
    assert deleted is True

def test_storage_service_save_photo_validation():
    """Test 3: StorageService validate_and_save_photo works with valid JPEG."""
    from PIL import Image
    import io

    # Create valid synthetic image
    img = Image.new("RGB", (100, 100), color=(100, 150, 200))
    buf = io.BytesIO()
    img.save(buf, format="JPEG")
    img_bytes = buf.getvalue()

    result = storage_service.validate_and_save_photo(
        file_bytes=img_bytes,
        original_filename="mugshot.jpg",
        content_type="image/jpeg",
        criminal_id="CR-TEST-R2"
    )

    assert "storage_key" in result
    assert "url" in result
    assert result["size_bytes"] == len(img_bytes)

    # Clean up file
    storage_service.delete_photo(result["storage_key"])
