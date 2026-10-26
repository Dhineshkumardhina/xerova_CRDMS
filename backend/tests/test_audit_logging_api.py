import pytest
from app.models.audit_log import AuditLogModel

def test_audit_logs_generated_and_sanitized(client, admin_headers, db_session):
    # 1. Perform login and view criminal action
    client.get("/api/v1/criminals/CR-001245", headers=admin_headers)

    # 2. Check audit logs in DB
    logs = db_session.query(AuditLogModel).all()
    assert len(logs) >= 1

    for log in logs:
        details_str = str(log.details or {}).lower()
        # Verify zero passwords or secret tokens stored in audit details
        assert "deptjusticesecure" not in details_str
        assert "access_token" not in details_str or "[REDACTED_SECURITY_DATA]" in details_str

def test_admin_get_audit_logs_endpoint(client, admin_headers):
    res = client.get("/api/v1/audit?page=1&pageSize=10", headers=admin_headers)
    assert res.status_code == 200
    data = res.json()
    assert isinstance(data, list)
