"""
NETRA AI Biometric Face Recognition Package
============================================
Exposes FaceRecognitionService, config, matcher, detector, quality, preprocessor,
exceptions, and backward-compatible function facades.
"""

from app.services.face_recognition.config import config, FaceRecognitionConfig
from app.services.face_recognition.exceptions import (
    BiometricError,
    NoFaceDetectedError,
    MultipleFacesDetectedError,
    LowFaceQualityError,
    FaceTooSmallError,
    FaceTooBlurryError,
    ExtremePoseError,
    TemplateExtractionError,
    NoRegisteredTemplatesError,
    ImageDecodingError,
    EmptyImagePayloadError,
    ImageTooLargeError,
    ImageDimensionTooSmallError,
)
from app.services.face_recognition.preprocessing import preprocessor, ImagePreprocessor
from app.services.face_recognition.detector import detector, FaceDetector, DetectedFace
from app.services.face_recognition.quality import quality_analyzer, FaceQualityAnalyzer
from app.services.face_recognition.liveness import liveness_analyzer, FaceLivenessAnalyzer
from app.services.face_recognition.template import template_extractor, TemplateExtractor, BiometricTemplate
from app.services.face_recognition.matcher import matcher, BiometricMatcher, MatchCandidate
from app.services.face_recognition.service import face_recognition_service, FaceRecognitionService

# Compatibility aliases and constants
MODEL_NAME = config.MODEL_NAME
MODEL_VERSION = config.MODEL_VERSION
EMBEDDING_DIM = config.EMBEDDING_DIM
DEFAULT_SIMILARITY_THRESHOLD = config.DEFAULT_SIMILARITY_THRESHOLD
MAX_COSINE_DISTANCE = config.MAX_COSINE_DISTANCE

face_service = face_recognition_service

def detect_faces_in_image(image_bytes: bytes):
    return face_recognition_service.detect_faces(image_bytes)

def extract_face_embedding(image_bytes: bytes, require_single_face: bool = False):
    template = face_recognition_service.extract_template(image_bytes, require_single_face=require_single_face)
    return template.vector

def compute_cosine_similarity(vec1, vec2):
    return matcher.compute_cosine_similarity(vec1, vec2)

def compute_cosine_distance(vec1, vec2):
    return matcher.compute_cosine_distance(vec1, vec2)

def parse_base64_or_bytes(photo_input: str):
    return preprocessor.parse_input_bytes(photo_input)

def get_model_info():
    return face_recognition_service.get_status()

__all__ = [
    "config",
    "FaceRecognitionConfig",
    "face_recognition_service",
    "FaceRecognitionService",
    "face_service",
    "matcher",
    "BiometricMatcher",
    "MatchCandidate",
    "detector",
    "FaceDetector",
    "DetectedFace",
    "quality_analyzer",
    "FaceQualityAnalyzer",
    "liveness_analyzer",
    "FaceLivenessAnalyzer",
    "template_extractor",
    "TemplateExtractor",
    "BiometricTemplate",
    "preprocessor",
    "ImagePreprocessor",
    "BiometricError",
    "NoFaceDetectedError",
    "MultipleFacesDetectedError",
    "LowFaceQualityError",
    "FaceTooSmallError",
    "FaceTooBlurryError",
    "ExtremePoseError",
    "TemplateExtractionError",
    "NoRegisteredTemplatesError",
    "ImageDecodingError",
    "EmptyImagePayloadError",
    "MODEL_NAME",
    "MODEL_VERSION",
    "EMBEDDING_DIM",
    "DEFAULT_SIMILARITY_THRESHOLD",
    "MAX_COSINE_DISTANCE",
    "detect_faces_in_image",
    "extract_face_embedding",
    "compute_cosine_similarity",
    "compute_cosine_distance",
    "parse_base64_or_bytes",
    "get_model_info",
]
