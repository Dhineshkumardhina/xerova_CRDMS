"""
Face Recognition Engine Configuration
=====================================
Centralized configuration parameters for face detection, quality analysis,
liveness checking, template extraction, and matching.
"""

import os
from dataclasses import dataclass, field
from typing import List, Tuple

@dataclass
class FaceRecognitionConfig:
    # Model Metadata
    MODEL_NAME: str = "dlib_face_recognition"
    MODEL_VERSION: str = "ageitgey-face-recognition-128d"
    EMBEDDING_DIM: int = 128
    DETECTION_MODEL: str = os.getenv("FACE_DETECTION_MODEL", "hog")
    DETECTION_UPSAMPLE: int = int(os.getenv("FACE_DETECTION_UPSAMPLE", "1"))
    
    # Matching Thresholds (Euclidean distance tolerance: <= 0.6 is typical match)
    DEFAULT_TOLERANCE: float = float(os.getenv("FACE_RECOGNITION_TOLERANCE", "0.6"))
    DEFAULT_SIMILARITY_THRESHOLD: float = float(os.getenv("FACE_RECOGNITION_TOLERANCE", "0.6"))
    HIGH_CONFIDENCE_TOLERANCE: float = 0.45
    MEDIUM_CONFIDENCE_TOLERANCE: float = 0.55
    STRICT_TOLERANCE: float = 0.50
    MAX_COSINE_DISTANCE: float = 0.60
    HIGH_CONFIDENCE_THRESHOLD: float = 0.45
    MEDIUM_CONFIDENCE_THRESHOLD: float = 0.55
    
    # Quality Analysis Thresholds
    MIN_IMAGE_DIMENSION: int = 64
    MAX_IMAGE_PIXELS: int = 32_000_000      # 32 Megapixels (supports high-res DSLR portraits while preventing bombs)
    MAX_DETECTION_DIMENSION: int = 1280     # Max image edge for fast HOG detection
    MIN_FACE_SIZE_PIXELS: int = 40
    MIN_LAPLACIAN_BLUR_SCORE: float = 35.0  # < 35 indicates severe blur
    MIN_BRIGHTNESS: float = 30.0            # < 30 indicates underexposure / too dark
    MAX_BRIGHTNESS: float = 235.0           # > 235 indicates overexposure / washed out
    MIN_CONTRAST: float = 18.0              # < 18 indicates low dynamic range
    
    # Tolerance Bounds
    MIN_TOLERANCE: float = 0.20
    MAX_TOLERANCE: float = 0.80

    # Human-in-the-Loop & Legal Governance
    RECOGNITION_DISCLAIMER: str = (
        "Biometric matching provides ranked candidate leads for authorized investigative triage only. "
        "Similarity scores do not constitute legal proof of identity or probable cause. "
        "Automatic criminal identification without independent human review is strictly prohibited."
    )
    
    # Pose Angle Bounds (degrees)
    MAX_YAW_ANGLE: float = 38.0             # Horizontal head turn
    MAX_PITCH_ANGLE: float = 32.0           # Vertical head tilt (up/down)
    MAX_ROLL_ANGLE: float = 35.0            # Lateral head tilt
    
    # License & SDK Configuration
    FACE_SDK_LICENSE: str = os.getenv("FACE_SDK_LICENSE", "")
    
    # Upload limits
    MAX_UPLOAD_SIZE_BYTES: int = 15 * 1024 * 1024  # 15 MB
    MAX_CANDIDATE_RESULTS: int = 10

config = FaceRecognitionConfig()

