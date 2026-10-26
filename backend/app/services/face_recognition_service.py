"""
CRMS InsightFace ArcFace Biometric Service (Compatibility Facade)
================================================================
Exposes FaceRecognitionService and face_service singleton pointing
to the modular face_recognition package.
"""

from app.services.face_recognition import (
    face_recognition_service as face_service,
    FaceRecognitionService,
    config,
    matcher,
    detector,
    quality_analyzer,
    template_extractor,
    preprocessor,
)

MODEL_NAME = config.MODEL_NAME
MODEL_VERSION = config.MODEL_VERSION
EMBEDDING_DIM = config.EMBEDDING_DIM
DEFAULT_SIMILARITY_THRESHOLD = config.DEFAULT_SIMILARITY_THRESHOLD
MAX_COSINE_DISTANCE = config.MAX_COSINE_DISTANCE

__all__ = [
    "face_service",
    "FaceRecognitionService",
    "MODEL_NAME",
    "MODEL_VERSION",
    "EMBEDDING_DIM",
    "DEFAULT_SIMILARITY_THRESHOLD",
    "MAX_COSINE_DISTANCE",
]
