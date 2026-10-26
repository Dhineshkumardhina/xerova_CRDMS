"""
CRMS Biometric Face Search Endpoint
===================================
Production biometric face search endpoint supporting multipart uploads,
base64 payloads, and JSON envelopes.
"""

import logging
from fastapi import APIRouter, Depends, UploadFile, File, Form, Body, Query, status, Request
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session
from typing import Dict, Any, Optional

from app.db.session import get_db
from app.core.config import settings
from app.core.security import require_permission
from app.models.user import UserModel
from app.services.face_recognition import (
    face_recognition_service,
    BiometricError,
    NoFaceDetectedError,
    MultipleFacesDetectedError,
    LowFaceQualityError,
    EmptyImagePayloadError,
    ImageDecodingError,
    ImageTooLargeError,
    ImageDimensionTooSmallError,
    config,
)

logger = logging.getLogger("face_search_endpoint")

router = APIRouter()

@router.post("")
@router.post("/photo")
@router.post("/scan-face")
async def face_search(
    request: Request,
    threshold: Optional[float] = Query(None),
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(require_permission("photo_search:use")),
):
    """
    Biometric Facial Recognition Search.
    Extracts normalized query template and executes similarity matching against stored criminal templates.
    """
    # ── Step 1: Extract image payload dynamically from JSON or FormData ───────
    image_input = None
    content_type = request.headers.get("content-type", "")

    if "multipart/form-data" in content_type or "application/x-www-form-urlencoded" in content_type:
        try:
            form = await request.form()
            # Check file fields
            for field_name in ["image", "file", "photo"]:
                item = form.get(field_name)
                if item and hasattr(item, "read"):
                    raw_bytes = await item.read()
                    if raw_bytes:
                        image_input = raw_bytes
                        break
                elif isinstance(item, str) and item.strip():
                    image_input = item.strip()
                    break
            if image_input is None:
                photo_url_val = form.get("photoUrl") or form.get("photo_url")
                if photo_url_val and isinstance(photo_url_val, str):
                    image_input = photo_url_val.strip()
        except Exception as exc:
            logger.warning("Failed to parse form data in face_search: %s", exc)

    elif "application/json" in content_type:
        try:
            body_json = await request.json()
            if isinstance(body_json, dict):
                image_input = (
                    body_json.get("photoUrl")
                    or body_json.get("photo_url")
                    or body_json.get("photo")
                    or body_json.get("image")
                    or body_json.get("file")
                )
                if threshold is None and "threshold" in body_json:
                    try:
                        threshold = float(body_json["threshold"])
                    except (ValueError, TypeError):
                        pass
        except Exception as exc:
            logger.warning("Failed to parse JSON body in face_search: %s", exc)

    else:
        # Fallback to reading raw body
        try:
            raw_body = await request.body()
            if raw_body and len(raw_body) > 16:
                image_input = raw_body
        except Exception:
            pass

    if image_input is None:
        return JSONResponse(
            status_code=status.HTTP_400_BAD_REQUEST,
            content={
                "success": False,
                "status": "error",
                "face_detected": False,
                "match_found": False,
                "error_code": "EMPTY_IMAGE_PAYLOAD",
                "message": "No image provided. Please upload a photograph using multipart form data or base64.",
            },
        )

    # ── Step 2: Perform End-to-End Biometric Search ───────────────────────────
    applied_threshold = threshold if threshold is not None else settings.FACE_MATCH_THRESHOLD

    try:
        search_result = face_recognition_service.search_database(
            photo_input=image_input,
            db=db,
            threshold=applied_threshold,
            max_results=config.MAX_CANDIDATE_RESULTS
        )
        return search_result

    except NoFaceDetectedError as exc:
        logger.info("[DIAGNOSTIC] Face Search: NO_FACE_DETECTED | User: %s", current_user.badge_number)
        return JSONResponse(
            status_code=status.HTTP_400_BAD_REQUEST,
            content={
                "success": False,
                "status": "no_face_detected",
                "face_detected": False,
                "match_found": False,
                "error_code": exc.code,
                "message": exc.message,
                "results": [],
                "matches": [],
            },
        )

    except MultipleFacesDetectedError as exc:
        logger.info("[DIAGNOSTIC] Face Search: MULTIPLE_FACES (%d detected)", exc.details.get("face_count", 0))
        return JSONResponse(
            status_code=status.HTTP_400_BAD_REQUEST,
            content={
                "success": False,
                "status": "multiple_faces_detected",
                "face_detected": True,
                "match_found": False,
                "error_code": exc.code,
                "face_count": exc.details.get("face_count", 0),
                "faces": exc.details.get("faces", []),
                "message": exc.message,
                "results": [],
                "matches": [],
            },
        )

    except LowFaceQualityError as exc:
        logger.info("[DIAGNOSTIC] Face Search: LOW_FACE_QUALITY: %s", exc.message)
        return JSONResponse(
            status_code=status.HTTP_400_BAD_REQUEST,
            content={
                "success": False,
                "status": "low_face_quality",
                "face_detected": True,
                "match_found": False,
                "error_code": exc.code,
                "message": exc.message,
                "quality_metrics": exc.details.get("quality_metrics", {}),
                "improvement_tips": exc.details.get("improvement_tips", []),
                "results": [],
                "matches": [],
            },
        )

    except ImageTooLargeError as exc:
        return JSONResponse(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            content={
                "success": False,
                "status": "error",
                "face_detected": False,
                "match_found": False,
                "error_code": exc.code,
                "message": exc.message,
            },
        )

    except (ImageDimensionTooSmallError, ImageDecodingError, EmptyImagePayloadError) as exc:
        return JSONResponse(
            status_code=status.HTTP_400_BAD_REQUEST,
            content={
                "success": False,
                "status": "error",
                "face_detected": False,
                "match_found": False,
                "error_code": exc.code,
                "message": exc.message,
            },
        )

    except BiometricError as exc:
        logger.error("Biometric processing error: %s", exc, exc_info=True)
        return JSONResponse(
            status_code=status.HTTP_400_BAD_REQUEST,
            content={
                "success": False,
                "status": "error",
                "face_detected": False,
                "match_found": False,
                "error_code": exc.code,
                "message": exc.message,
            },
        )

    except Exception as exc:
        logger.error("Face search unhandled error: %s", exc, exc_info=True)
        return JSONResponse(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            content={
                "success": False,
                "status": "error",
                "face_detected": False,
                "match_found": False,
                "error_code": "RECOGNITION_SERVICE_ERROR",
                "message": "Biometric face search service temporarily unavailable.",
            },
        )
