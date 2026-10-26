#!/usr/bin/env python3
"""
CRMS Face Embedding Indexer
===========================
Re-generates face embeddings for all criminal photos in the database.

Usage:
    python index_existing_faces.py [--dry-run] [--batch-size N] [--force]

Options:
    --dry-run     Preview what would be indexed without making changes
    --batch-size  Number of photos per DB commit (default: 10)
    --force       Re-index photos that already have embeddings (replaces them)
    --criminal-id Only process a specific criminal's photos

Output:
    Prints a progress report and saves results to index_report.json

IMPORTANT:
    - Run this after changing the face recognition model version
    - Run this to index photos uploaded before embedding generation was implemented
    - Never run with --force in production without a database backup
"""

import sys
import os
import json
import argparse
import logging
import time
import urllib.request
import io
from datetime import datetime
from typing import Optional

# ── Path setup: add backend/ dir so that `app.*` imports work ──────────────
# This script lives in backend/scripts/; we add backend/ to sys.path
_SCRIPTS_DIR = os.path.dirname(os.path.abspath(__file__))
_BACKEND_DIR = os.path.abspath(os.path.join(_SCRIPTS_DIR, '..'))
_PROJECT_ROOT = os.path.abspath(os.path.join(_BACKEND_DIR, '..'))
sys.path.insert(0, _BACKEND_DIR)
# Also set working directory to project root so storage/ paths resolve correctly
os.chdir(_PROJECT_ROOT)

from sqlalchemy.orm import Session
from app.db.session import SessionLocal, engine
from app.db.base import Base
from app.models.criminal import CriminalProfileModel, CriminalPhotoModel
from app.models.biometrics import FaceEmbeddingModel
from app.services.face_recognition import (
    extract_face_embedding,
    detect_faces_in_image,
    MODEL_VERSION,
    get_model_info,
)
from app.core.config import settings

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
)
logger = logging.getLogger(__name__)


def load_image_bytes(photo: CriminalPhotoModel) -> Optional[bytes]:
    """
    Load raw image bytes from a CriminalPhotoModel.
    Tries storage_key (local file), then photo_url path, then HTTP download.
    Returns None if the image cannot be loaded.
    """
    # 1. Local storage key
    if photo.storage_key:
        local_path = os.path.join(settings.STORAGE_DIR, photo.storage_key)
        if os.path.exists(local_path):
            with open(local_path, "rb") as f:
                return f.read()
        logger.debug("storage_key path not found: %s", local_path)

    # 2. photo_url as local path (e.g., /storage/mugshots/...)
    if photo.photo_url:
        url = photo.photo_url
        if url.startswith("/storage/"):
            local_path = url.lstrip("/")
            if os.path.exists(local_path):
                with open(local_path, "rb") as f:
                    return f.read()
            # Try from project root
            proj_root = os.path.abspath(os.path.join(os.path.dirname(__file__), "../../.."))
            local_path2 = os.path.join(proj_root, url.lstrip("/"))
            if os.path.exists(local_path2):
                with open(local_path2, "rb") as f:
                    return f.read()

        # 3. HTTP URL
        if url.startswith("http://") or url.startswith("https://"):
            try:
                req = urllib.request.Request(
                    url,
                    headers={
                        "User-Agent": "CRMS-Indexer/1.0",
                        "Accept": "image/*",
                    },
                )
                with urllib.request.urlopen(req, timeout=10) as resp:
                    return resp.read()
            except Exception as exc:
                logger.warning("Failed to download %s: %s", url, exc)
                return None

    return None


def run_indexer(
    dry_run: bool = False,
    batch_size: int = 10,
    force: bool = False,
    criminal_id: Optional[str] = None,
) -> dict:
    """Main indexing function. Returns a report dictionary."""

    report = {
        "timestamp": datetime.utcnow().isoformat(),
        "dry_run": dry_run,
        "force_reindex": force,
        "model_version": MODEL_VERSION,
        "total_photos": 0,
        "already_indexed": 0,
        "successfully_indexed": 0,
        "no_face": 0,
        "multiple_faces": 0,
        "invalid_image": 0,
        "image_load_failed": 0,
        "failed": 0,
        "skipped": 0,
        "details": [],
    }

    print("\n" + "=" * 60)
    print("  CRMS Face Embedding Indexer")
    print("=" * 60)
    print(f"  Mode:       {'DRY RUN (no changes)' if dry_run else 'LIVE (will write to DB)'}")
    print(f"  Force:      {force}")
    print(f"  Batch size: {batch_size}")
    print(f"  Model:      {MODEL_VERSION}")
    print("=" * 60)

    model_info = get_model_info()
    if not model_info["yunet_model_present"]:
        print("\n❌ ERROR: YuNet model not found. Face detection unavailable.")
        print(f"   Expected: {model_info}")
        sys.exit(1)
    if not model_info["sface_model_present"]:
        print("\n⚠  WARNING: SFace model not found. Embeddings will use pixel fallback (unreliable).")

    db: Session = SessionLocal()

    try:
        # Fetch photos
        query = db.query(CriminalPhotoModel)
        if criminal_id:
            query = query.filter(CriminalPhotoModel.criminal_id == criminal_id)
        all_photos = query.all()

        report["total_photos"] = len(all_photos)
        print(f"\n  Total photos in database: {len(all_photos)}")

        batch_count = 0

        for idx, photo in enumerate(all_photos, 1):
            print(f"\n[{idx}/{len(all_photos)}] Photo ID: {photo.id}")
            print(f"           Criminal: {photo.criminal_id}")
            print(f"           URL: {photo.photo_url}")

            detail = {
                "photo_id": photo.id,
                "criminal_id": photo.criminal_id,
                "url": photo.photo_url,
                "status": None,
                "reason": None,
            }

            # ── Check existing embedding ──────────────────────────────────
            existing_emb = (
                db.query(FaceEmbeddingModel)
                .filter(FaceEmbeddingModel.photo_id == photo.id)
                .first()
            )

            if existing_emb and not force:
                stored_meta = existing_emb.feature_metadata or {}
                stored_ver = stored_meta.get("model_version", "unknown")
                if stored_ver == MODEL_VERSION:
                    print(f"  → SKIP: Already indexed with model {MODEL_VERSION}")
                    report["already_indexed"] += 1
                    detail["status"] = "already_indexed"
                    detail["reason"] = f"Existing embedding with model {MODEL_VERSION}"
                    report["details"].append(detail)
                    continue
                else:
                    print(f"  → Re-indexing: stored model={stored_ver}, current={MODEL_VERSION}")

            # ── Load image bytes ──────────────────────────────────────────
            image_bytes = load_image_bytes(photo)
            if not image_bytes:
                print("  → FAIL: Could not load image bytes")
                report["image_load_failed"] += 1
                detail["status"] = "image_load_failed"
                detail["reason"] = "Could not load image from storage or URL"
                report["details"].append(detail)
                continue

            print(f"  → Loaded {len(image_bytes)} bytes")

            # ── Validate image ────────────────────────────────────────────
            try:
                from PIL import Image as PILImage
                pil_img = PILImage.open(io.BytesIO(image_bytes))
                w, h = pil_img.size
                if w < 32 or h < 32:
                    print(f"  → SKIP: Image too small ({w}×{h})")
                    report["invalid_image"] += 1
                    detail["status"] = "invalid_image"
                    detail["reason"] = f"Too small: {w}×{h}"
                    report["details"].append(detail)
                    continue
                print(f"  → Image: {w}×{h} {pil_img.format}")
            except Exception as exc:
                print(f"  → FAIL: Cannot decode image — {exc}")
                report["invalid_image"] += 1
                detail["status"] = "invalid_image"
                detail["reason"] = str(exc)
                report["details"].append(detail)
                continue

            # ── Face detection ────────────────────────────────────────────
            try:
                has_face, face_count, _ = detect_faces_in_image(image_bytes)
            except Exception as exc:
                print(f"  → FAIL: Face detection error — {exc}")
                report["failed"] += 1
                detail["status"] = "failed"
                detail["reason"] = f"Face detection error: {exc}"
                report["details"].append(detail)
                continue

            if not has_face or face_count == 0:
                print("  → SKIP: No face detected")
                report["no_face"] += 1
                detail["status"] = "no_face"
                detail["reason"] = "No face detected"
                report["details"].append(detail)
                continue

            if face_count > 1:
                print(f"  → SKIP: Multiple faces ({face_count}) detected")
                report["multiple_faces"] += 1
                detail["status"] = "multiple_faces"
                detail["reason"] = f"{face_count} faces detected"
                report["details"].append(detail)
                continue

            # ── Embedding extraction ──────────────────────────────────────
            try:
                embedding_vec = extract_face_embedding(image_bytes)
                print(f"  → Embedding: dim={len(embedding_vec)}")
            except Exception as exc:
                print(f"  → FAIL: Embedding extraction — {exc}")
                report["failed"] += 1
                detail["status"] = "failed"
                detail["reason"] = f"Embedding extraction: {exc}"
                report["details"].append(detail)
                continue

            if dry_run:
                print("  → DRY RUN: Would store embedding (skipping DB write)")
                report["successfully_indexed"] += 1
                detail["status"] = "would_index"
                detail["embedding_dim"] = len(embedding_vec)
                report["details"].append(detail)
                continue

            # ── Write to database ─────────────────────────────────────────
            try:
                if existing_emb and force:
                    # Update existing
                    existing_emb.embedding_vector = {
                        "vector": embedding_vec,
                        "dim": len(embedding_vec),
                    }
                    existing_emb.feature_metadata = {
                        "model_version": MODEL_VERSION,
                        "indexed_at": datetime.utcnow().isoformat(),
                        "face_count_at_index": face_count,
                    }
                    print("  → Updated existing embedding")
                else:
                    # Delete old embedding if re-indexing
                    if existing_emb:
                        db.delete(existing_emb)

                    import uuid
                    new_emb = FaceEmbeddingModel(
                        id=str(uuid.uuid4()),
                        criminal_id=photo.criminal_id,
                        photo_id=photo.id,
                        embedding_vector={
                            "vector": embedding_vec,
                            "dim": len(embedding_vec),
                        },
                        feature_metadata={
                            "model_version": MODEL_VERSION,
                            "indexed_at": datetime.utcnow().isoformat(),
                            "face_count_at_index": face_count,
                        },
                    )
                    db.add(new_emb)
                    print("  → Created new embedding")

                batch_count += 1
                if batch_count >= batch_size:
                    db.commit()
                    batch_count = 0
                    print(f"  [Committed batch]")

                report["successfully_indexed"] += 1
                detail["status"] = "indexed"
                detail["embedding_dim"] = len(embedding_vec)
                detail["model_version"] = MODEL_VERSION

            except Exception as exc:
                db.rollback()
                print(f"  → FAIL: DB write error — {exc}")
                report["failed"] += 1
                detail["status"] = "failed"
                detail["reason"] = f"DB write: {exc}"

            report["details"].append(detail)

        # Final commit
        if not dry_run and batch_count > 0:
            db.commit()
            print(f"\n[Final commit]")

    finally:
        db.close()

    # ── Print summary ─────────────────────────────────────────────────────
    print("\n" + "=" * 60)
    print("  INDEXING REPORT")
    print("=" * 60)
    print(f"  Total photos:         {report['total_photos']}")
    print(f"  Already indexed:      {report['already_indexed']}")
    print(f"  Successfully indexed: {report['successfully_indexed']}")
    print(f"  No face detected:     {report['no_face']}")
    print(f"  Multiple faces:       {report['multiple_faces']}")
    print(f"  Invalid image:        {report['invalid_image']}")
    print(f"  Image load failed:    {report['image_load_failed']}")
    print(f"  Failed (other):       {report['failed']}")
    if dry_run:
        print("\n  ⚠  DRY RUN — no changes were made to the database.")
    print("=" * 60 + "\n")

    return report


def main():
    parser = argparse.ArgumentParser(description="CRMS Face Embedding Indexer")
    parser.add_argument(
        "--dry-run", action="store_true",
        help="Preview actions without making database changes"
    )
    parser.add_argument(
        "--batch-size", type=int, default=10,
        help="Number of photos per database commit (default: 10)"
    )
    parser.add_argument(
        "--force", action="store_true",
        help="Re-index photos that already have embeddings"
    )
    parser.add_argument(
        "--criminal-id", type=str, default=None,
        help="Only process photos for a specific criminal ID"
    )
    args = parser.parse_args()

    report = run_indexer(
        dry_run=args.dry_run,
        batch_size=args.batch_size,
        force=args.force,
        criminal_id=args.criminal_id,
    )

    # Save report
    report_path = "index_report.json"
    with open(report_path, "w") as f:
        json.dump(report, f, indent=2)
    print(f"  Report saved to: {report_path}")


if __name__ == "__main__":
    main()
