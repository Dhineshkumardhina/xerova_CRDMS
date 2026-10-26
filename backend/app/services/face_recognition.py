"""
CRMS Face Recognition Interface (Compatibility Facade)
======================================================
Points directly to the modular face_recognition service package.
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
    BiometricError,
    NoFaceDetectedError,
    MultipleFacesDetectedError,
    LowFaceQualityError,
)

MODEL_NAME = config.MODEL_NAME
MODEL_VERSION = config.MODEL_VERSION
EMBEDDING_DIM = config.EMBEDDING_DIM
DEFAULT_SIMILARITY_THRESHOLD = config.DEFAULT_SIMILARITY_THRESHOLD
MAX_COSINE_DISTANCE = config.MAX_COSINE_DISTANCE

def detect_faces_in_image(image_bytes: bytes):
    return face_service.detect_faces(image_bytes)

def extract_face_embedding(image_bytes: bytes, require_single_face: bool = False):
    template = face_service.extract_template(image_bytes, require_single_face=require_single_face)
    return template.vector

def compute_cosine_similarity(vec1, vec2):
    return matcher.compute_cosine_similarity(vec1, vec2)

def compute_cosine_distance(vec1, vec2):
    return matcher.compute_cosine_distance(vec1, vec2)

def parse_base64_or_bytes(photo_input: str):
    return preprocessor.parse_input_bytes(photo_input)

def get_model_info():
    return face_service.get_status()
