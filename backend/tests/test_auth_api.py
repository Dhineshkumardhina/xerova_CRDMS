import pytest
import uuid
from datetime import datetime, timezone, timedelta
from jose import jwt

from app.core.config import settings
from app.core.rate_limit import rate_limiter
from app.core.security import create_access_token, create_refresh_token
from app.models.refresh_token import RefreshTokenModel

def test_login_success(client):
    rate_limiter.reset()
    res = client.post("/api/v1/auth/login", json={"officerId": "8829-JD", "password": "DeptJusticeSecure#2024"})
    assert res.status_code == 200
    data = res.json()
    assert "access_token" in data
    assert "refresh_token" in data
    assert data["token_type"] == "bearer"
    assert data["officer"]["badgeNumber"] == "8829-JD"
    assert data["officer"]["clearanceLevel"] == "Level 5 - Top Secret"

def test_login_invalid_password(client):
    rate_limiter.reset()
    res = client.post("/api/v1/auth/login", json={"officerId": "8829-JD", "password": "WrongPassword123!"})
    assert res.status_code == 401
    assert "Incorrect officer badge number or password" in res.json()["detail"]

def test_login_nonexistent_user(client):
    rate_limiter.reset()
    res = client.post("/api/v1/auth/login", json={"officerId": "9999-NO", "password": "RandomPassword#2024"})
    assert res.status_code == 401
    # Generic error message to prevent account enumeration
    assert "Incorrect officer badge number or password" in res.json()["detail"]

def test_login_missing_fields(client):
    rate_limiter.reset()
    # Missing password
    res1 = client.post("/api/v1/auth/login", json={"officerId": "8829-JD", "password": ""})
    assert res1.status_code == 400
    assert "required" in res1.json()["detail"].lower()

    # Missing badge number
    res2 = client.post("/api/v1/auth/login", json={"officerId": "", "password": "DeptJusticeSecure#2024"})
    assert res2.status_code == 400
    assert "required" in res2.json()["detail"].lower()

def test_rate_limiting_on_login(client):
    rate_limiter.reset()
    headers = {"x-test-rate-limit": "true"}
    for _ in range(5):
        res = client.post(
            "/api/v1/auth/login",
            json={"officerId": "8829-JD", "password": "WrongPassword123!"},
            headers=headers
        )
        assert res.status_code == 401

    # 6th request triggers rate limit HTTP 429
    res_6th = client.post(
        "/api/v1/auth/login",
        json={"officerId": "8829-JD", "password": "WrongPassword123!"},
        headers=headers
    )
    assert res_6th.status_code == 429
    assert "Rate limit exceeded" in res_6th.json()["detail"]

def test_auth_me_endpoint(client, admin_headers):
    res = client.get("/api/v1/auth/me", headers=admin_headers)
    assert res.status_code == 200
    data = res.json()
    assert data["badgeNumber"] == "8829-JD"
    assert data["isSuperuser"] is True

def test_missing_token_on_protected_endpoints(client):
    # /auth/me
    res_me = client.get("/api/v1/auth/me")
    assert res_me.status_code == 401

    # /criminals
    res_crim = client.get("/api/v1/criminals")
    assert res_crim.status_code == 401

    # /cases
    res_cases = client.get("/api/v1/cases")
    assert res_cases.status_code == 401

    # /audit
    res_audit = client.get("/api/v1/audit")
    assert res_audit.status_code == 401

def test_invalid_token(client):
    headers = {"Authorization": "Bearer this-is-not-a-valid-jwt-token"}
    res = client.get("/api/v1/auth/me", headers=headers)
    assert res.status_code == 401
    assert "Could not validate credentials" in res.json()["detail"]

def test_expired_access_token(client):
    expired_token = create_access_token(
        subject="usr-admin-01",
        expires_delta=timedelta(minutes=-10)
    )
    headers = {"Authorization": f"Bearer {expired_token}"}
    res = client.get("/api/v1/auth/me", headers=headers)
    assert res.status_code == 401
    assert "token expired" in res.json()["detail"].lower() or "could not validate credentials" in res.json()["detail"].lower()

def test_wrong_token_type_rejected(client):
    # Create refresh token and attempt to use it as an access token
    refresh_tok = create_refresh_token(subject="usr-admin-01")
    headers = {"Authorization": f"Bearer {refresh_tok}"}
    res = client.get("/api/v1/auth/me", headers=headers)
    assert res.status_code == 401
    assert "could not validate credentials" in res.json()["detail"].lower()

def test_token_refresh_rotation(client, db_session):
    rate_limiter.reset()
    # 1. Login to get initial token pair
    login_res = client.post(
        "/api/v1/auth/login",
        json={"officerId": "8829-JD", "password": "DeptJusticeSecure#2024"}
    )
    assert login_res.status_code == 200
    init_tokens = login_res.json()
    first_refresh = init_tokens["refresh_token"]

    # 2. Refresh token rotation
    refresh_res = client.post(
        "/api/v1/auth/refresh",
        json={"refresh_token": first_refresh}
    )
    assert refresh_res.status_code == 200
    new_tokens = refresh_res.json()
    assert "access_token" in new_tokens
    assert "refresh_token" in new_tokens
    second_refresh = new_tokens["refresh_token"]
    assert second_refresh != first_refresh

    # 3. Verify old token is marked revoked in DB
    db_session.expire_all()
    old_record = db_session.query(RefreshTokenModel).filter(RefreshTokenModel.token == first_refresh).first()
    assert old_record is not None
    assert old_record.is_revoked is True

    # 4. Verify new token can be used again
    refresh_res_2 = client.post(
        "/api/v1/auth/refresh",
        json={"refresh_token": second_refresh}
    )
    assert refresh_res_2.status_code == 200

def test_token_reuse_detection(client, db_session):
    rate_limiter.reset()
    # 1. Login to get initial token pair
    login_res = client.post(
        "/api/v1/auth/login",
        json={"officerId": "8829-JD", "password": "DeptJusticeSecure#2024"}
    )
    first_refresh = login_res.json()["refresh_token"]

    # 2. Legitimate refresh
    refresh_res = client.post(
        "/api/v1/auth/refresh",
        json={"refresh_token": first_refresh}
    )
    assert refresh_res.status_code == 200

    # 3. Malicious / duplicate reuse of old rotated refresh token
    reuse_res = client.post(
        "/api/v1/auth/refresh",
        json={"refresh_token": first_refresh}
    )
    assert reuse_res.status_code == 401
    assert "reuse detected" in reuse_res.json()["detail"].lower()

    # 4. Confirm all user active refresh tokens have been revoked
    db_session.expire_all()
    user_active_tokens = db_session.query(RefreshTokenModel).filter(
        RefreshTokenModel.user_id == "usr-admin-01",
        RefreshTokenModel.is_revoked == False
    ).count()
    assert user_active_tokens == 0

def test_expired_refresh_token(client, db_session):
    # Create expired refresh token in DB
    ref_token_str = f"test-expired-ref-{uuid.uuid4().hex}"
    db_token = RefreshTokenModel(
        id=str(uuid.uuid4()),
        user_id="usr-admin-01",
        token=ref_token_str,
        expires_at=datetime.now(timezone.utc) - timedelta(days=1),
        is_revoked=False
    )
    db_session.add(db_token)
    db_session.commit()

    res = client.post("/api/v1/auth/refresh", json={"refresh_token": ref_token_str})
    assert res.status_code == 401
    assert "expired" in res.json()["detail"].lower()

def test_logout_endpoint(client, admin_headers, db_session):
    rate_limiter.reset()
    ref_token_str = f"test-logout-token-{uuid.uuid4().hex}"
    db_token = RefreshTokenModel(
        id=str(uuid.uuid4()),
        user_id="usr-admin-01",
        token=ref_token_str,
        expires_at=datetime.now(timezone.utc) + timedelta(days=30),
        is_revoked=False
    )
    db_session.add(db_token)
    db_session.commit()

    res_logout = client.post(
        "/api/v1/auth/logout",
        json={"refresh_token": ref_token_str},
        headers=admin_headers
    )
    assert res_logout.status_code == 200
    assert res_logout.json()["status"] == "success"

    db_session.expire_all()
    revoked_token = db_session.query(RefreshTokenModel).filter(RefreshTokenModel.token == ref_token_str).first()
    assert revoked_token.is_revoked is True

def test_access_token_blacklisted_on_logout_regression(client, db_session):
    """
    Regression test for persistent access-token revocation:
    Ensures that logging out blacklists the access token JTI immediately,
    rejecting subsequent authenticated requests with HTTP 401 Token Revoked.
    """
    from app.models.token_blacklist import RevokedTokenModel
    rate_limiter.reset()

    # 1. Login and get valid tokens
    login_res = client.post(
        "/api/v1/auth/login",
        json={"officerId": "8829-JD", "password": "DeptJusticeSecure#2024"}
    )
    assert login_res.status_code == 200
    token_data = login_res.json()
    acc_token = token_data["access_token"]
    ref_token = token_data["refresh_token"]

    auth_headers = {"Authorization": f"Bearer {acc_token}"}

    # 2. Access protected endpoint before logout - must succeed
    me_res_before = client.get("/api/v1/auth/me", headers=auth_headers)
    assert me_res_before.status_code == 200
    assert me_res_before.json()["badgeNumber"] == "8829-JD"

    # 3. Call logout with access token and refresh token
    logout_res = client.post(
        "/api/v1/auth/logout",
        json={"refresh_token": ref_token},
        headers=auth_headers
    )
    assert logout_res.status_code == 200

    # 4. Immediate attempt to use blacklisted access token - must be rejected
    me_res_after = client.get("/api/v1/auth/me", headers=auth_headers)
    assert me_res_after.status_code == 401
    assert "revoked" in me_res_after.json()["detail"].lower()

    # 5. Verify database persistence of the revoked JTI
    db_session.expire_all()
    from app.core.security import decode_jwt
    payload = decode_jwt(acc_token)
    assert payload.get("jti") is not None
    blacklisted = db_session.query(RevokedTokenModel).filter(RevokedTokenModel.jti == payload["jti"]).first()
    assert blacklisted is not None
    assert blacklisted.jti == payload["jti"]
