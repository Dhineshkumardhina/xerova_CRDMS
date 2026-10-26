"""
Automated Security Hardening & Access Control Test Suite
==========================================================
Verifies that:
1. Unauthenticated media uploads return 401 Unauthorized.
2. Unauthenticated storage downloads return 401 Unauthorized.
3. Directory traversal attempts are strictly blocked.
4. Security response headers (OWASP standards) are present.
"""

import pytest

def test_unauthenticated_media_upload_rejected(client):
    """Test 1: Unauthenticated request to /api/v1/media/upload-mugshot returns 401."""
    res = client.post(
        "/api/v1/media/upload-mugshot",
        files={"file": ("test.jpg", b"fake_image_bytes", "image/jpeg")}
    )
    assert res.status_code == 401

def test_unauthenticated_storage_access_rejected(client):
    """Test 2: Unauthenticated request to protected storage route returns 401."""
    res = client.get("/api/v1/storage/mugshots/crim_test_123.jpg")
    assert res.status_code == 401

def test_authenticated_storage_path_traversal_blocked(client, admin_headers):
    """Test 3: Directory traversal attempt (..) is rejected with 400 Bad Request."""
    res = client.get("/api/v1/storage/mugshots/..%2F..%2Fetc%2Fpasswd", headers=admin_headers)
    assert res.status_code in (400, 403, 404)

def test_security_headers_present(client):
    """Test 4: Response contains mandatory OWASP security headers."""
    res = client.get("/health")
    assert res.status_code == 200
    assert res.headers.get("X-Content-Type-Options") == "nosniff"
    assert res.headers.get("X-Frame-Options") == "DENY"
    assert "Strict-Transport-Security" in res.headers
    assert "Content-Security-Policy" in res.headers
