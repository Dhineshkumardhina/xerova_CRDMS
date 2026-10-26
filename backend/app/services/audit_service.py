import uuid
from typing import Optional, Dict, Any
from sqlalchemy.orm import Session
from fastapi import Request
from app.models.audit_log import AuditLogModel

SENSITIVE_KEYS = {"password", "passwd", "secret", "jwt", "token", "access_token", "refresh_token", "embedding", "vector"}

def sanitize_audit_details(details: Optional[Dict[str, Any]]) -> Dict[str, Any]:
    if not details:
        return {}
    
    clean_dict = {}
    for key, val in details.items():
        key_lower = str(key).lower()
        if any(s_key in key_lower for s_key in SENSITIVE_KEYS):
            clean_dict[key] = "[REDACTED_SECURITY_DATA]"
        elif isinstance(val, dict):
            clean_dict[key] = sanitize_audit_details(val)
        else:
            clean_dict[key] = val
            
    return clean_dict

def log_audit_event(
    db: Session,
    action: str,
    resource_type: str,
    resource_id: str,
    subject_name: str,
    result: str = "SUCCESS",
    user_id: Optional[str] = None,
    officer_name: str = "Authorized Officer",
    request: Optional[Request] = None,
    details: Optional[Dict[str, Any]] = None
) -> AuditLogModel:
    ip_address = None
    user_agent = None

    if request:
        if request.client:
            ip_address = request.client.host
        user_agent = request.headers.get("user-agent")
        if user_agent and len(user_agent) > 250:
            user_agent = user_agent[:250]

    clean_details = sanitize_audit_details(details or {})
    clean_details["resource_type"] = resource_type
    clean_details["result"] = result

    audit_entry = AuditLogModel(
        id=str(uuid.uuid4()),
        user_id=user_id,
        officer_name=officer_name,
        action=action,
        resource_type=resource_type,
        result=result,
        subject_name=(subject_name or '')[:150],
        subject_id=(resource_id or '')[:100],
        ip_address=ip_address,
        user_agent=user_agent,
        details=clean_details
    )
    
    db.add(audit_entry)
    db.commit()
    db.refresh(audit_entry)
    return audit_entry
