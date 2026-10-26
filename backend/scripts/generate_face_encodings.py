"""
Criminal Face Encoding Regeneration & Migration Utility
=======================================================
Batch processes existing criminal photos in storage, detects faces using
ageitgey/face_recognition, extracts 128-D biometric embeddings, and securely
populates/updates the face_embeddings database table.

Usage:
    python backend/scripts/generate_face_encodings.py
    python scripts/generate_face_encodings.py
"""

import os
import sys
import uuid
import logging
from pathlib import Path
from datetime import datetime, timezone
from typing import Optional

# Setup sys.path to find backend app modules
backend_dir = Path(__file__).resolve().parents[1] if Path(__file__).resolve().parent.name == "scripts" and Path(__file__).resolve().parents[1].name == "backend" else Path(__file__).resolve().parent / "backend"
if str(backend_dir) not in sys.path:
    sys.path.insert(0, str(backend_dir))

# Also ensure workspace root is accessible
workspace_root = backend_dir.parent if backend_dir.name == "backend" else backend_dir
if str(workspace_root) not in sys.path:
    sys.path.insert(0, str(workspace_root))

import cv2
import numpy as np
import face_recognition

from app.core.config import settings
from app.db.session import SessionLocal
import app.db.base  # Registers all models including CriminalCaseModel and DocumentItemModel
from app.models.criminal import CriminalProfileModel, CriminalPhotoModel
from app.models.biometrics import FaceEmbeddingModel
from app.services.face_recognition.config import config
from app.services.face_recognition.template import TemplateExtractor

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("generate_face_encodings")

def load_photo_bytes(photo_record: CriminalPhotoModel, criminal: CriminalProfileModel) -> Optional[bytes]:
    """Resolves and reads image bytes from local disk or URL."""
    # 1. Try storage_key
    if photo_record.storage_key:
        candidate_path = os.path.join(settings.STORAGE_DIR, photo_record.storage_key)
        if os.path.exists(candidate_path):
            with open(candidate_path, "rb") as f:
                return f.read()

    # 2. Try photo_url relative path
    url = photo_record.photo_url or ""
    if url.startswith("/storage/"):
        rel_path = url.replace("/storage/", "", 1)
        candidate_path = os.path.join(settings.STORAGE_DIR, rel_path)
        if os.path.exists(candidate_path):
            with open(candidate_path, "rb") as f:
                return f.read()

    if os.path.exists(url):
        with open(url, "rb") as f:
            return f.read()

    # 3. Fallback to criminal.mugshot_url if same
    if criminal.mugshot_url:
        murl = criminal.mugshot_url
        if murl.startswith("/storage/"):
            candidate_path = os.path.join(settings.STORAGE_DIR, murl.replace("/storage/", "", 1))
            if os.path.exists(candidate_path):
                with open(candidate_path, "rb") as f:
                    return f.read()

    return None

def run_migration():
    db = SessionLocal()
    print("=" * 70)
    print("  NETRA AI -- Criminal Face Encoding Regeneration Utility")
    print(f"  Engine: {config.MODEL_NAME} ({config.EMBEDDING_DIM}-D) | Detection: {config.DETECTION_MODEL}")
    print("=" * 70)

    try:
        criminals = db.query(CriminalProfileModel).filter(CriminalProfileModel.is_deleted == False).all()
        total_criminals = len(criminals)
        images_processed = 0
        encodings_generated = 0
        no_face_detected = 0
        multiple_faces = 0
        invalid_images = 0

        print(f"\nScanning {total_criminals} registered criminal dossiers...")

        for crim in criminals:
            photos = db.query(CriminalPhotoModel).filter(CriminalPhotoModel.criminal_id == crim.id).all()
            
            # If no explicit photo models exist but mugshot_url is present, create synthetic target
            if not photos and crim.mugshot_url:
                synthetic_photo = CriminalPhotoModel(
                    id=str(uuid.uuid4()),
                    criminal_id=crim.id,
                    photo_url=crim.mugshot_url,
                    filename="mugshot.jpg",
                    is_primary_mugshot=True
                )
                photos = [synthetic_photo]

            for ph in photos:
                images_processed += 1
                img_bytes = load_photo_bytes(ph, crim)

                if not img_bytes:
                    invalid_images += 1
                    continue

                # Decode image
                np_arr = np.frombuffer(img_bytes, np.uint8)
                bgr_img = cv2.imdecode(np_arr, cv2.IMREAD_COLOR)
                if bgr_img is None:
                    invalid_images += 1
                    continue

                # Convert to RGB for face_recognition
                rgb_img = cv2.cvtColor(bgr_img, cv2.COLOR_BGR2RGB)

                # Detect faces
                locations = face_recognition.face_locations(
                    rgb_img,
                    number_of_times_to_upsample=config.DETECTION_UPSAMPLE,
                    model=config.DETECTION_MODEL
                )

                if len(locations) == 0:
                    no_face_detected += 1
                    continue

                if len(locations) > 1:
                    multiple_faces += 1
                    # For bulk re-indexing, pick largest face if primary mugshot
                    locations = sorted(locations, key=lambda loc: (loc[2] - loc[0]) * (loc[1] - loc[3]), reverse=True)[:1]

                # Generate 128-D encoding
                encodings = face_recognition.face_encodings(rgb_img, known_face_locations=locations, num_jitters=1)
                if not encodings:
                    invalid_images += 1
                    continue

                norm_vector = TemplateExtractor.normalize_l2(encodings[0]).tolist()

                # Clean existing embeddings for this criminal/photo
                if ph.id:
                    db.query(FaceEmbeddingModel).filter(
                        FaceEmbeddingModel.criminal_id == crim.id,
                        FaceEmbeddingModel.photo_id == ph.id
                    ).delete()
                else:
                    db.query(FaceEmbeddingModel).filter(
                        FaceEmbeddingModel.criminal_id == crim.id
                    ).delete()

                # Store new 128-D encoding
                face_emb = FaceEmbeddingModel(
                    id=str(uuid.uuid4()),
                    criminal_id=crim.id,
                    photo_id=ph.id,
                    embedding_vector={
                        "vector": norm_vector,
                        "dim": 128
                    },
                    feature_metadata={
                        "model_name": config.MODEL_NAME,
                        "model_version": config.MODEL_VERSION,
                        "embedding_dimension": 128,
                        "indexed_at": datetime.now(timezone.utc).isoformat(),
                        "face_count": 1,
                        "is_active": True
                    }
                )
                db.add(face_emb)
                encodings_generated += 1

        db.commit()

        print("\n" + "=" * 70)
        print("  MIGRATION & REGENERATION SUMMARY")
        print("=" * 70)
        print(f"  Total criminals:       {total_criminals:,}")
        print(f"  Images processed:      {images_processed:,}")
        print(f"  Encodings generated:   {encodings_generated:,}")
        print(f"  No face detected:      {no_face_detected:,}")
        print(f"  Multiple faces:        {multiple_faces:,}")
        print(f"  Invalid images:        {invalid_images:,}")
        print("=" * 70)

    finally:
        db.close()

if __name__ == "__main__":
    run_migration()
