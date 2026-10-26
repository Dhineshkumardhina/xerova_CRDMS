"""
Central Face Recognition Service
=================================
High-level singleton interface orchestrating pre-processing, face detection,
quality validation, biometric template extraction, database vector search,
criminal photo registration, and index re-building using ageitgey/face_recognition.
"""

import sys
from pathlib import Path

# Ensure backend directory is in sys.path when running standalone
_backend_dir = str(Path(__file__).resolve().parents[3])
if _backend_dir not in sys.path:
    sys.path.insert(0, _backend_dir)

import time
import json
import logging
import uuid
import cv2
import numpy as np
from typing import List, Dict, Any, Optional, Tuple, Union
from sqlalchemy.orm import Session
from datetime import datetime, timezone

import face_recognition

from app.services.face_recognition.config import config
from app.services.face_recognition.exceptions import (
    BiometricError,
    NoFaceDetectedError,
    MultipleFacesDetectedError,
    LowFaceQualityError,
    TemplateExtractionError,
)
from app.services.face_recognition.preprocessing import preprocessor
from app.services.face_recognition.detector import detector, DetectedFace
from app.services.face_recognition.quality import quality_analyzer
from app.services.face_recognition.liveness import liveness_analyzer
from app.services.face_recognition.template import template_extractor, BiometricTemplate
from app.services.face_recognition.matcher import matcher, MatchCandidate

logger = logging.getLogger("face_recognition.service")

class FaceRecognitionService:
    """Production Biometric Facial Recognition Service Singleton (dlib / face_recognition)."""

    _instance: Optional["FaceRecognitionService"] = None

    def __new__(cls):
        if cls._instance is None:
            cls._instance = super(FaceRecognitionService, cls).__new__(cls)
        return cls._instance

    def initialize(self):
        """Warm up the underlying detector and models."""
        detector.initialize()

    def preprocess(self, photo_input: Union[bytes, str, np.ndarray]):
        """Parses and validates raw input bytes into BGR array, PIL image, and dimensions."""
        return preprocessor.load_image(photo_input)

    def detect_faces(self, photo_input: Union[bytes, str]) -> Tuple[bool, int, List[DetectedFace]]:
        """
        Detects all human faces in image input.
        Returns:
            (has_face: bool, face_count: int, detected_faces: List[DetectedFace])
        """
        bgr_arr, _, _, _ = self.preprocess(photo_input)
        faces = detector.detect_faces(bgr_arr)
        has_face = len(faces) > 0
        return has_face, len(faces), faces

    def extract_template(
        self,
        photo_input: Union[bytes, str],
        require_single_face: bool = False,
        validate_quality: bool = False
    ) -> BiometricTemplate:
        """
        Extracts a normalized 128-d biometric template from the primary face in the image.
        
        Args:
            photo_input: Image bytes or base64 string
            require_single_face: Raises MultipleFacesDetectedError if face count > 1
            validate_quality: Raises LowFaceQualityError if face quality is insufficient
            
        Returns:
            BiometricTemplate instance with L2-normalized 128-D vector and quality metadata.
        """
        bgr_arr, _, w, h = self.preprocess(photo_input)
        faces = detector.detect_faces(bgr_arr)

        if not faces:
            raise NoFaceDetectedError()

        if require_single_face and len(faces) > 1:
            faces_info = [
                {"bbox": f.bbox, "det_score": round(f.det_score, 3), "quality_score": f.quality["quality_score"]}
                for f in faces
            ]
            raise MultipleFacesDetectedError(face_count=len(faces), faces_info=faces_info)

        primary_face = faces[0]

        if validate_quality and not primary_face.quality.get("is_acceptable", True):
            tips = primary_face.quality.get("improvement_tips", [])
            msg = "Face detected, but image quality is insufficient for reliable recognition."
            if tips:
                msg = f"{msg} {tips[0]}"
            raise LowFaceQualityError(
                message=msg,
                quality_metrics=primary_face.quality,
                improvement_tips=tips
            )

        template = template_extractor.extract_from_face_object(
            face_object=primary_face.raw_face_object,
            quality_info=primary_face.quality
        )

        return template

    def align_face(self, photo_input: Union[bytes, str, np.ndarray]) -> np.ndarray:
        """
        Extracts and aligns the primary detected face to canonical 112x112 coordinate frame.
        """
        if isinstance(photo_input, np.ndarray):
            bgr_arr = photo_input
        else:
            bgr_arr, _, _, _ = self.preprocess(photo_input)
        faces = detector.detect_faces(bgr_arr)
        if not faces:
            raise NoFaceDetectedError()
        primary_face = faces[0]
        return template_extractor.align_face(
            image=bgr_arr,
            landmarks=primary_face.landmarks,
            bbox=primary_face.bbox,
            output_size=(112, 112)
        )

    def search_database(
        self,
        photo_input: Union[bytes, str],
        db: Session,
        threshold: Optional[float] = None,
        max_results: int = 5
    ) -> Dict[str, Any]:
        """
        End-to-end face search against all registered criminal templates using face distance.
        """
        from app.models.biometrics import FaceEmbeddingModel
        from app.models.criminal import CriminalProfileModel
        from app.api.v1.endpoints.criminals import model_to_schema

        t_start = time.time()
        applied_tolerance = threshold if threshold is not None else config.DEFAULT_TOLERANCE
        # Guard against legacy percentage values (> 2.0)
        if applied_tolerance > 2.0:
            applied_tolerance = config.DEFAULT_TOLERANCE

        # Step 1: Preprocess image
        bgr_arr, pil_img, img_w, img_h = self.preprocess(photo_input)

        # Step 2: Detect faces
        faces = detector.detect_faces(bgr_arr)
        if not faces:
            raise NoFaceDetectedError()

        if len(faces) > 1:
            faces_info = [
                {"bbox": f.bbox, "det_score": round(f.det_score, 3), "quality_score": f.quality["quality_score"]}
                for f in faces
            ]
            raise MultipleFacesDetectedError(face_count=len(faces), faces_info=faces_info)

        primary_face = faces[0]
        quality_metrics = primary_face.quality

        # Step 3: Extract query template
        query_template = template_extractor.extract_from_face_object(
            face_object=primary_face.raw_face_object,
            quality_info=quality_metrics
        )
        query_vector = query_template.vector

        # Step 4: Retrieve stored templates from database
        stored_rows = db.query(FaceEmbeddingModel).all()

        # Requirement 19: Gracefully handle empty database
        if not stored_rows:
            elapsed_ms = round((time.time() - t_start) * 1000, 2)
            logger.info("[BIOMETRIC_SEARCH] Zero face encodings found in database.")
            return {
                "status": "no_face_encodings_available",
                "success": True,
                "matched": False,
                "match_found": False,
                "face_detected": True,
                "reason": "NO_FACE_ENCODINGS_AVAILABLE",
                "message": "No registered criminal face encodings found in database.",
                "results": [],
                "matches": [],
                "total": 0,
                "threshold_applied": applied_tolerance,
                "model_name": config.MODEL_NAME,
                "model_version": config.MODEL_VERSION,
                "embedding_dimension": config.EMBEDDING_DIM,
                "embeddings_searched": 0,
                "processing_time_ms": elapsed_ms
            }

        # Requirement 20: Skip corrupted/invalid records without breaking search
        stored_records: List[Dict[str, Any]] = []
        for row in stored_rows:
            try:
                ev = row.embedding_vector
                if isinstance(ev, str):
                    ev = json.loads(ev)
                vec = ev.get("vector", []) if isinstance(ev, dict) else (ev if isinstance(ev, list) else [])
                if vec and len(vec) == len(query_vector):
                    stored_records.append({
                        "id": row.id,
                        "criminal_id": row.criminal_id,
                        "photo_id": row.photo_id,
                        "vector": vec,
                    })
                else:
                    logger.debug(
                        "Skipping embedding for criminal_id=%s photo_id=%s (dimension mismatch: %d != %d)",
                        row.criminal_id, row.photo_id, len(vec) if vec else 0, len(query_vector)
                    )
            except Exception as e:
                logger.warning("Skipping corrupted embedding row id=%s: %s", row.id, e)
                continue

        # Step 5: Compare vectors using BiometricMatcher (Euclidean face distance)
        top_candidates, nearest_info, skipped_count = matcher.search_against_templates(
            query_vector=query_vector,
            stored_records=stored_records,
            threshold=applied_tolerance,
            max_results=max_results
        )

        # Step 6: Enrich candidate matches with Criminal Profiles
        results: List[Dict[str, Any]] = []
        for cand in top_candidates:
            criminal = db.query(CriminalProfileModel).filter(
                CriminalProfileModel.id == cand.criminal_id,
                CriminalProfileModel.is_deleted == False,
                CriminalProfileModel.is_archived == False
            ).first()

            if not criminal:
                continue

            try:
                schema_p = model_to_schema(criminal)
                profile_dict = schema_p.model_dump() if hasattr(schema_p, "model_dump") else schema_p.dict()
            except Exception:
                profile_dict = {}

            results.append({
                "criminal_id": criminal.id,
                "photo_id": cand.photo_id,
                "name": criminal.name,
                "photo": criminal.mugshot_url,
                "profile": profile_dict,
                "similarity": cand.similarity,
                "similarityScore": cand.similarity,
                "confidence": cand.similarity,
                "distance": cand.distance,
                "threshold": cand.tolerance,
                "confidenceLevel": cand.confidence,
                "matchStatus": cand.match_status,
                "match_type": "potential_match",
                "disclaimer": "Potential match screening only. Requires human verification."
            })

        elapsed_ms = round((time.time() - t_start) * 1000, 2)
        match_found = len(results) > 0

        # Requirement 18: Server-side diagnostic logging (no passwords, tokens, or raw vectors)
        best_distance_str = f"{results[0]['distance']:.4f}" if results else (
            f"{nearest_info['distance']:.4f}" if nearest_info else "N/A"
        )
        logger.info(
            "[BIOMETRIC_SEARCH] Dims=%dx%d | Faces=%d | Stored=%d | BestDist=%s | Thresh=%.2f | Match=%s | MatchedID=%s | Time=%.1fms",
            img_w, img_h, len(faces), len(stored_records), best_distance_str, applied_tolerance,
            match_found, results[0]["criminal_id"] if results else None, elapsed_ms
        )

        first_match = results[0] if results else None

        return {
            "status": "success" if match_found else "no_confident_match",
            "success": True,
            "matched": match_found,
            "match_found": match_found,
            "face_detected": True,
            "face_count": 1,
            "criminal_id": first_match["criminal_id"] if first_match else None,
            "name": first_match["name"] if first_match else None,
            "distance": first_match["distance"] if first_match else (nearest_info["distance"] if nearest_info else None),
            "threshold": applied_tolerance,
            "query_face_quality": quality_metrics.get("quality_score", 0.90),
            "quality_metrics": quality_metrics,
            "results": results,
            "matches": results,
            "total": len(results),
            "nearest_candidate": nearest_info if not match_found else None,
            "threshold_applied": applied_tolerance,
            "model_name": config.MODEL_NAME,
            "model_version": config.MODEL_VERSION,
            "embedding_dimension": config.EMBEDDING_DIM,
            "embeddings_searched": len(stored_records),
            "embeddings_skipped": skipped_count,
            "processing_time_ms": elapsed_ms,
            "scan_status": "FACE_SCANNED_SUCCESSFULLY",
            "scanned_database_records": len(stored_records),
            "disclaimer": "Potential match screening only — not confirmed identity. Requires human verification.",
            "message": f"Face scanned against {len(stored_records)} criminal template records in {elapsed_ms:.1f}ms. {len(results)} candidate match(es) identified." if match_found else f"Face scanned against {len(stored_records)} criminal template records in {elapsed_ms:.1f}ms. No criminal record passed threshold (distance <= {applied_tolerance:.2f})."
        }

    def register_face_template(
        self,
        criminal_id: str,
        photo_id: Optional[str],
        image_bytes: bytes,
        db: Session,
        require_single_face: bool = True,
        validate_quality: bool = False
    ):
        """
        Generates and securely stores a 128-D biometric template for a criminal record.
        """
        from app.models.biometrics import FaceEmbeddingModel

        template = self.extract_template(
            photo_input=image_bytes,
            require_single_face=require_single_face,
            validate_quality=validate_quality
        )

        face_emb = FaceEmbeddingModel(
            id=str(uuid.uuid4()),
            criminal_id=criminal_id,
            photo_id=photo_id,
            embedding_vector={
                "vector": template.vector,
                "dim": template.dimension
            },
            feature_metadata={
                "model_name": template.model_name,
                "model_version": template.model_version,
                "embedding_dimension": template.dimension,
                "quality_score": template.quality_score,
                "quality_metrics": template.quality_metrics,
                "indexed_at": datetime.now(timezone.utc).isoformat(),
                "face_count": 1,
                "is_active": True
            }
        )

        db.add(face_emb)
        db.commit()
        db.refresh(face_emb)

        logger.info(
            "Biometric template registered for criminal_id=%s photo_id=%s (dim=%d)",
            criminal_id, photo_id, template.dimension
        )
        return face_emb

    def rebuild_all_templates(self, db: Session) -> Dict[str, Any]:
        """
        Re-indexes facial biometric templates across all criminal records.
        """
        import os
        import urllib.request
        from app.models.criminal import CriminalProfileModel, CriminalPhotoModel
        from app.models.biometrics import FaceEmbeddingModel
        from app.core.config import settings

        criminals = db.query(CriminalProfileModel).filter(CriminalProfileModel.is_deleted == False).all()
        total_photos = 0
        processed = 0
        successful = 0
        failed = 0
        failures: List[Dict[str, Any]] = []

        for crim in criminals:
            photos = db.query(CriminalPhotoModel).filter(CriminalPhotoModel.criminal_id == crim.id).all()
            
            # If no photo model records, fall back to mugshot_url if present
            if not photos and crim.mugshot_url:
                target_photos = [{"id": None, "url": crim.mugshot_url, "storage_key": None}]
            else:
                target_photos = [{"id": p.id, "url": p.photo_url, "storage_key": p.storage_key} for p in photos]

            for ph in target_photos:
                total_photos += 1
                processed += 1
                img_bytes: Optional[bytes] = None

                # Try local storage
                if ph["storage_key"]:
                    local_path = os.path.join(settings.STORAGE_DIR, ph["storage_key"])
                    if os.path.exists(local_path):
                        try:
                            with open(local_path, "rb") as f:
                                img_bytes = f.read()
                        except Exception as e:
                            failures.append({"criminal_id": crim.id, "photo_id": ph["id"], "reason": f"Local read error: {e}"})
                            failed += 1
                            continue

                if not img_bytes and ph["url"]:
                    url = ph["url"]
                    if url.startswith("/storage/"):
                        local_path = os.path.join(settings.STORAGE_DIR, url.replace("/storage/", "", 1))
                        if os.path.exists(local_path):
                            try:
                                with open(local_path, "rb") as f:
                                    img_bytes = f.read()
                            except Exception as e:
                                failures.append({"criminal_id": crim.id, "photo_id": ph["id"], "reason": f"Local read error: {e}"})
                                failed += 1
                                continue
                    elif url.startswith("http://") or url.startswith("https://"):
                        try:
                            req = urllib.request.Request(url, headers={"User-Agent": "NETRA-CRMS/2.0"})
                            with urllib.request.urlopen(req, timeout=8) as resp:
                                img_bytes = resp.read()
                        except Exception as e:
                            failures.append({"criminal_id": crim.id, "photo_id": ph["id"], "reason": f"Download failed: {e}"})
                            failed += 1
                            continue

                if not img_bytes:
                    failures.append({"criminal_id": crim.id, "photo_id": ph["id"], "reason": "No photo bytes available"})
                    failed += 1
                    continue

                try:
                    # Clean out existing embeddings for this photo/criminal
                    if ph["id"]:
                        db.query(FaceEmbeddingModel).filter(
                            FaceEmbeddingModel.criminal_id == crim.id,
                            FaceEmbeddingModel.photo_id == ph["id"]
                        ).delete()
                    else:
                        db.query(FaceEmbeddingModel).filter(
                            FaceEmbeddingModel.criminal_id == crim.id
                        ).delete()

                    self.register_face_template(
                        criminal_id=crim.id,
                        photo_id=ph["id"],
                        image_bytes=img_bytes,
                        db=db,
                        require_single_face=False,
                        validate_quality=False
                    )
                    successful += 1
                except Exception as exc:
                    failed += 1
                    failures.append({"criminal_id": crim.id, "photo_id": ph["id"], "reason": str(exc)})

        return {
            "status": "success",
            "total_records": total_photos,
            "processed": processed,
            "successful": successful,
            "failed": failed,
            "failures": failures[:25],
            "timestamp": datetime.now(timezone.utc).isoformat()
        }

    def get_status(self, db: Optional[Session] = None) -> Dict[str, Any]:
        """Returns engine diagnostics, model parameters, and indexed template statistics."""
        indexed_count = 0
        if db is not None:
            from app.models.biometrics import FaceEmbeddingModel
            try:
                indexed_count = db.query(FaceEmbeddingModel).count()
            except Exception:
                indexed_count = 0

        return {
            "service": "NETRA Biometric Face Recognition Engine",
            "status": "online",
            "model_name": config.MODEL_NAME,
            "model_version": config.MODEL_VERSION,
            "framework": "ageitgey/face_recognition + dlib (128-D Euclidean)",
            "embedding_dimension": config.EMBEDDING_DIM,
            "default_tolerance": config.DEFAULT_TOLERANCE,
            "detection_model": config.DETECTION_MODEL,
            "indexed_templates_count": indexed_count,
            "timestamp": datetime.now(timezone.utc).isoformat()
        }

# Global singleton instance
face_recognition_service = FaceRecognitionService()
