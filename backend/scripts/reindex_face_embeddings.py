#!/usr/bin/env python3
"""
CRMS Face Embedding Re-Indexer (InsightFace ArcFace 512-d)
==========================================================
Processes all criminal photographs in the database, extracts 512-dimensional
ArcFace embeddings using InsightFace + ONNX Runtime, and updates database records.

Usage:
    python scripts/reindex_face_embeddings.py [--dry-run] [--force] [--batch-size N]

Features:
    - Safe EXIF orientation and RGB/BGR preprocessing
    - Detects faces with RetinaFace
    - Validates exactly one face for enrollment
    - Generates 512-d L2-normalized ArcFace embedding
    - Associates embeddings with criminal_id and photo_id
    - Records model metadata (model_name, model_version, dimension, timestamp)
    - Generates a full summary report without crashing on bad images
"""

import sys
import os
import io
import json
import argparse
import logging
import urllib.request
from datetime import datetime, timezone
from typing import Optional, Dict, Any, List

# Path setup: add backend/ to sys.path and set CWD to project root
_SCRIPTS_DIR = os.path.dirname(os.path.abspath(__file__))
_BACKEND_DIR = os.path.abspath(os.path.join(_SCRIPTS_DIR, ".."))
_PROJECT_ROOT = os.path.abspath(os.path.join(_BACKEND_DIR, ".."))
sys.path.insert(0, _BACKEND_DIR)
os.chdir(_PROJECT_ROOT)

from app.db.base import Base # noqa: F401 - registers all models for SQLAlchemy
from app.db.session import SessionLocal
from app.models.criminal import CriminalProfileModel, CriminalPhotoModel
from app.models.biometrics import FaceEmbeddingModel
from app.services.face_recognition import (
    extract_face_embedding,
    detect_faces_in_image,
    MODEL_NAME,
    MODEL_VERSION,
    EMBEDDING_DIM,
    get_model_info,
)
from app.core.config import settings

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
)
logger = logging.getLogger("reindex_face_embeddings")


def load_image_bytes(photo: CriminalPhotoModel) -> Optional[bytes]:
    """
    Load raw image bytes from storage_key, photo_url, or remote URL.
    """
    # 1. Check storage_key
    if photo.storage_key:
        local_path = os.path.join(settings.STORAGE_DIR, photo.storage_key)
        if os.path.exists(local_path):
            with open(local_path, "rb") as f:
                return f.read()

    # 2. Check local /storage path in photo_url
    if photo.photo_url:
        url = photo.photo_url
        if url.startswith("/storage/"):
            local_path = os.path.join(_PROJECT_ROOT, url.lstrip("/"))
            if os.path.exists(local_path):
                with open(local_path, "rb") as f:
                    return f.read()

        # 3. Check remote HTTP/HTTPS URL
        if url.startswith("http://") or url.startswith("https://"):
            try:
                req = urllib.request.Request(
                    url,
                    headers={"User-Agent": "CRMS-Reindexer/2.0", "Accept": "image/*"},
                )
                with urllib.request.urlopen(req, timeout=12) as resp:
                    return resp.read()
            except Exception as exc:
                logger.warning("Failed to fetch image from %s: %s", url, exc)
                return None

    return None


def run_reindexer(dry_run: bool = False, force: bool = True, batch_size: int = 10) -> Dict[str, Any]:
    print("\n" + "=" * 65)
    print("  CRMS FACE EMBEDDING RE-INDEXER (InsightFace ArcFace 512-d)")
    print("=" * 65)
    print(f"  Mode:            {'DRY RUN (no changes)' if dry_run else 'LIVE (will update DB)'}")
    print(f"  Model Name:      {MODEL_NAME}")
    print(f"  Model Version:   {MODEL_VERSION}")
    print(f"  Embedding Dim:   {EMBEDDING_DIM}")
    print(f"  Force Reindex:   {force}")
    print("=" * 65 + "\n")

    report: Dict[str, Any] = {
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "model_name": MODEL_NAME,
        "model_version": MODEL_VERSION,
        "embedding_dimension": EMBEDDING_DIM,
        "dry_run": dry_run,
        "total_photos": 0,
        "successfully_indexed": 0,
        "already_indexed": 0,
        "no_face": 0,
        "multiple_faces": 0,
        "invalid_image": 0,
        "image_load_failed": 0,
        "failed_other": 0,
        "details": [],
    }

    db = SessionLocal()
    try:
        photos: List[CriminalPhotoModel] = db.query(CriminalPhotoModel).all()
        report["total_photos"] = len(photos)
        print(f"[*] Found {len(photos)} criminal photo record(s) to process.\n")

        for idx, photo in enumerate(photos, 1):
            detail = {
                "photo_id": photo.id,
                "criminal_id": photo.criminal_id,
                "url": photo.photo_url,
                "status": None,
                "reason": None,
            }

            print(f"[{idx}/{len(photos)}] Photo {photo.id} (Criminal: {photo.criminal_id})")

            # Check existing embedding
            existing_emb = (
                db.query(FaceEmbeddingModel)
                .filter(FaceEmbeddingModel.photo_id == photo.id)
                .first()
            )

            if existing_emb and not force:
                meta = existing_emb.feature_metadata or {}
                if meta.get("model_version") == MODEL_VERSION:
                    print(f"  -> Already indexed with current model ({MODEL_VERSION}). Skipping.")
                    report["already_indexed"] += 1
                    detail["status"] = "already_indexed"
                    report["details"].append(detail)
                    continue

            # Load image bytes
            image_bytes = load_image_bytes(photo)
            if not image_bytes:
                print("  -> ERROR: Could not load image file/URL.")
                report["image_load_failed"] += 1
                detail["status"] = "image_load_failed"
                detail["reason"] = "Could not load image bytes from disk or URL"
                report["details"].append(detail)
                continue

            # Detect faces
            try:
                has_face, face_count, _ = detect_faces_in_image(image_bytes)
            except Exception as exc:
                print(f"  -> INVALID IMAGE: {exc}")
                report["invalid_image"] += 1
                detail["status"] = "invalid_image"
                detail["reason"] = str(exc)
                report["details"].append(detail)
                continue

            if not has_face or face_count == 0:
                print("  -> NO FACE DETECTED.")
                report["no_face"] += 1
                detail["status"] = "no_face"
                detail["reason"] = "No face detected by RetinaFace"
                # If an invalid old embedding exists for a no-face photo, remove it
                if existing_emb and not dry_run:
                    db.delete(existing_emb)
                    db.commit()
                report["details"].append(detail)
                continue

            if face_count > 1:
                print(f"  -> MULTIPLE FACES DETECTED ({face_count} faces).")
                report["multiple_faces"] += 1
                detail["status"] = "multiple_faces"
                detail["reason"] = f"{face_count} faces detected; enrollment requires exactly 1 face."
                report["details"].append(detail)
                continue

            # Extract 512-d ArcFace embedding
            try:
                embedding_vec = extract_face_embedding(image_bytes, require_single_face=True)
            except Exception as exc:
                print(f"  -> EMBEDDING FAILED: {exc}")
                report["failed_other"] += 1
                detail["status"] = "failed"
                detail["reason"] = str(exc)
                report["details"].append(detail)
                continue

            if len(embedding_vec) != EMBEDDING_DIM:
                print(f"  -> DIMENSION MISMATCH: {len(embedding_vec)} != {EMBEDDING_DIM}")
                report["failed_other"] += 1
                detail["status"] = "failed"
                detail["reason"] = f"Dimension mismatch: {len(embedding_vec)} != {EMBEDDING_DIM}"
                report["details"].append(detail)
                continue

            print(f"  -> ArcFace embedding generated: dim={len(embedding_vec)} (norm=1.0)")

            if dry_run:
                report["successfully_indexed"] += 1
                detail["status"] = "would_index"
                report["details"].append(detail)
                continue

            # Persist to database
            import uuid
            if existing_emb:
                existing_emb.embedding_vector = {
                    "vector": embedding_vec,
                    "dim": len(embedding_vec),
                }
                existing_emb.feature_metadata = {
                    "model_name": MODEL_NAME,
                    "model_version": MODEL_VERSION,
                    "embedding_dimension": len(embedding_vec),
                    "indexed_at": datetime.now(timezone.utc).isoformat(),
                    "face_count": 1,
                    "is_active": True,
                }
            else:
                new_emb = FaceEmbeddingModel(
                    id=str(uuid.uuid4()),
                    criminal_id=photo.criminal_id,
                    photo_id=photo.id,
                    embedding_vector={
                        "vector": embedding_vec,
                        "dim": len(embedding_vec),
                    },
                    feature_metadata={
                        "model_name": MODEL_NAME,
                        "model_version": MODEL_VERSION,
                        "embedding_dimension": len(embedding_vec),
                        "indexed_at": datetime.now(timezone.utc).isoformat(),
                        "face_count": 1,
                        "is_active": True,
                    },
                )
                db.add(new_emb)

            db.commit()
            print("  -> Saved to database.")
            report["successfully_indexed"] += 1
            detail["status"] = "indexed"
            report["details"].append(detail)

    finally:
        db.close()

    # Save summary report
    report_path = "reindex_report.json"
    with open(report_path, "w", encoding="utf-8") as f:
        json.dump(report, f, indent=2)

    print("\n" + "=" * 65)
    print("  RE-INDEXING COMPLETED")
    print("=" * 65)
    print(f"  Total Photos:          {report['total_photos']}")
    print(f"  Successfully Indexed:  {report['successfully_indexed']}")
    print(f"  Already Indexed:       {report['already_indexed']}")
    print(f"  No Face Detected:      {report['no_face']}")
    print(f"  Multiple Faces:        {report['multiple_faces']}")
    print(f"  Invalid Images:        {report['invalid_image']}")
    print(f"  Image Load Failed:     {report['image_load_failed']}")
    print(f"  Other Failures:        {report['failed_other']}")
    print(f"  Report saved to:       {report_path}")
    print("=" * 65 + "\n")
    return report


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="CRMS Face Embedding Re-Indexer")
    parser.add_argument("--dry-run", action="store_true", help="Preview without database changes")
    parser.add_argument("--force", action="store_true", default=True, help="Force re-indexing of all photos")
    parser.add_argument("--batch-size", type=int, default=10, help="Batch size for commits")
    args = parser.parse_args()

    run_reindexer(dry_run=args.dry_run, force=args.force, batch_size=args.batch_size)
