"""
Face Recognition System Diagnostic and Index Management Endpoints
==================================================================
Routes:
  - POST /api/v1/face-recognition/rebuild-index
  - GET  /api/v1/face-recognition/status
"""

import logging
from fastapi import APIRouter, Depends, Request
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.core.security import require_permission
from app.models.user import UserModel
from app.services.face_recognition import face_recognition_service
from app.services.audit_service import log_audit_event

logger = logging.getLogger("face_recognition_endpoint")

router = APIRouter()

@router.get("/status")
def get_biometric_engine_status(
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(require_permission("photo_search:use")),
):
    """Returns biometric engine health, model metadata, and template counts."""
    return face_recognition_service.get_status(db=db)

@router.post("/rebuild-index")
def rebuild_face_index(
    request: Request,
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(require_permission("criminal:update")),
):
    """
    Re-indexes facial biometric templates across all criminal records and photos.
    Generates a full audit trail and itemized migration report.
    """
    logger.info("Face index rebuild initiated by officer %s (%s)", current_user.full_name, current_user.badge_number)
    
    report = face_recognition_service.rebuild_all_templates(db=db)

    log_audit_event(
        db=db,
        action="Rebuild Biometric Index",
        resource_type="BiometricSystem",
        resource_id="face_embeddings",
        subject_name="Biometric Face Index",
        result="SUCCESS" if report["failed"] == 0 else "PARTIAL_SUCCESS",
        user_id=current_user.id,
        officer_name=current_user.full_name,
        request=request,
    )

    return report
