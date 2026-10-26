import pytest
import uuid
from datetime import datetime, timezone
from app.core.rate_limit import rate_limiter
from app.models.refresh_token import RefreshTokenModel

def test_login_success(client):
    rate_limiter.reset()
    res = client.post("/api/v1/auth/login", json={"officerId": "8829-JD", "password": "DeptJusticeSecure#2024"})
    assert res.status_code == 200
    data = res.json()
    assert "access_token" in data
    assert "refresh_token" in data
    assert data["officer"]["badgeNumber"] == "8829-JD"

def test_login_invalid_credentials(client):
    rate_limiter.reset()
    res = client.post("/api/v1/auth/login", json={"officerId": "8829-JD", "password": "WrongPassword123!"})
    assert res.status_code == 401
    assert "Incorrect officer badge number or password" in res.json()["detail"]

def test_rate_limiting_on_login(client):
    rate_limiter.reset()
    headers = {"x-test-rate-limit": "true"}
    for _ in range(5):
        res = client.post("/api/v1/auth/login", json={"officerId": "8829-JD", "password": "WrongPassword123!"}, headers=headers)
        assert res.status_code == 401

    # 6th request triggers rate limit HTTP 429
    res_6th = client.post("/api/v1/auth/login", json={"officerId": "8829-JD", "password": "WrongPassword123!"}, headers=headers)
    assert res_6th.status_code == 429
    assert "Rate limit exceeded" in res_6th.json()["detail"]

def test_auth_me_endpoint(client, admin_headers):
    res = client.get("/api/v1/auth/me", headers=admin_headers)
    assert res.status_code == 200
    data = res.json()
    assert data["badgeNumber"] == "8829-JD"
    assert data["isSuperuser"] is True

def test_logout_endpoint(client, admin_headers, db_session):
    rate_limiter.reset()
    # Create test refresh token in DB
    ref_token_str = f"test-refresh-token-{uuid.uuid4().hex}"
    db_token = RefreshTokenModel(
        id=str(uuid.uuid4()),
        user_id="usr-admin-01",
        token=ref_token_str,
        expires_at=datetime.now(timezone.utc),
        is_revoked=False
    )
    db_session.add(db_token)
    db_session.commit()

    res_logout = client.post("/api/v1/auth/logout", json={"refresh_token": ref_token_str}, headers=admin_headers)
    assert res_logout.status_code == 200
    assert res_logout.json()["status"] == "success"
