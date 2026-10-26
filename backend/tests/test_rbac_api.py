import pytest

def test_unauthenticated_access_denied(client):
    res = client.get("/api/v1/criminals")
    assert res.status_code == 401
    assert "Authentication token missing" in res.json()["detail"]

def test_authorized_admin_access(client, admin_headers):
    res = client.get("/api/v1/criminals", headers=admin_headers)
    assert res.status_code == 200
    assert isinstance(res.json(), list)

def test_missing_permission_forbidden(client, officer_headers):
    # Officer user doesn't have audit_logs:read permission
    res = client.get("/api/v1/audit", headers=officer_headers)
    assert res.status_code == 403
    assert "Access Denied" in res.json()["detail"]
