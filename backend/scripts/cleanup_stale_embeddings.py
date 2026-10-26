"""
Remove stale face embeddings for photos that have no detectable face.
These are placeholder noise images — keeping their embeddings would cause false matches.
"""
import sys, os, json
_SCRIPTS_DIR = os.path.dirname(os.path.abspath(__file__))
_BACKEND_DIR = os.path.abspath(os.path.join(_SCRIPTS_DIR, '..'))
_PROJECT_ROOT = os.path.abspath(os.path.join(_BACKEND_DIR, '..'))
sys.path.insert(0, _BACKEND_DIR)
os.chdir(_PROJECT_ROOT)

# Import all models first so SQLAlchemy relationship resolution works
from app.db.base import Base  # noqa: F401 — registers all models
from app.db.session import SessionLocal
from app.models.biometrics import FaceEmbeddingModel
from app.models.criminal import CriminalPhotoModel
from app.services.face_recognition import detect_faces_in_image, MODEL_VERSION
import urllib.request, io
from PIL import Image

db = SessionLocal()

# Find embeddings whose model_version is NOT the current model
# (these are leftover from the old fake implementation)
old_embeddings = db.query(FaceEmbeddingModel).filter(
    FaceEmbeddingModel.feature_metadata.isnot(None)
).all()

cleaned = 0
kept = 0

for emb in old_embeddings:
    meta = emb.feature_metadata
    if isinstance(meta, str):
        meta = json.loads(meta)
    stored_ver = meta.get('model_version', 'unknown') if isinstance(meta, dict) else 'unknown'
    
    if stored_ver != MODEL_VERSION:
        print(f"Removing stale embedding: criminal={emb.criminal_id}, photo={emb.photo_id}, model={stored_ver}")
        db.delete(emb)
        cleaned += 1
    else:
        kept += 1

db.commit()
db.close()

print(f"\nCleaned {cleaned} stale embeddings")
print(f"Kept {kept} valid embeddings (model={MODEL_VERSION})")
