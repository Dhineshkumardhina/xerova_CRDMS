"""
Face Recognition Domain Exceptions
==================================
Structured biometric errors for detection, validation, template extraction,
and matching operations.
"""

from typing import Optional, Dict, Any, List

class BiometricError(Exception):
    """Base exception for all biometric face recognition failures."""
    def __init__(self, code: str, message: str, details: Optional[Dict[str, Any]] = None):
        super().__init__(message)
        self.code = code
        self.message = message
        self.details = details or {}

class EmptyImagePayloadError(BiometricError):
    def __init__(self, message: str = "Empty image payload provided."):
        super().__init__(code="EMPTY_IMAGE_PAYLOAD", message=message)

class ImageDecodingError(BiometricError):
    def __init__(self, message: str = "Uploaded file is not a decodable image."):
        super().__init__(code="INVALID_IMAGE", message=message)

class ImageTooLargeError(BiometricError):
    def __init__(self, size_bytes: int, max_bytes: int):
        super().__init__(
            code="IMAGE_TOO_LARGE",
            message=f"Image size {size_bytes / (1024*1024):.1f}MB exceeds limit of {max_bytes / (1024*1024):.1f}MB.",
            details={"size_bytes": size_bytes, "max_bytes": max_bytes}
        )

class ImageDimensionTooSmallError(BiometricError):
    def __init__(self, width: int, height: int, min_dim: int):
        super().__init__(
            code="IMAGE_TOO_SMALL",
            message=f"Image resolution {width}x{height} is below minimum allowed {min_dim}x{min_dim} pixels.",
            details={"width": width, "height": height, "min_dim": min_dim}
        )

class NoFaceDetectedError(BiometricError):
    def __init__(self, message: str = "No face detected in the uploaded image. Please upload a clear frontal photograph."):
        super().__init__(code="NO_FACE_DETECTED", message=message)

class MultipleFacesDetectedError(BiometricError):
    def __init__(self, face_count: int, faces_info: Optional[List[Dict[str, Any]]] = None):
        super().__init__(
            code="MULTIPLE_FACES_DETECTED",
            message=f"{face_count} faces detected. Please provide an image containing exactly one face or specify target face bounding box.",
            details={"face_count": face_count, "faces": faces_info or []}
        )

class LowFaceQualityError(BiometricError):
    def __init__(self, message: str, quality_metrics: Dict[str, Any], improvement_tips: List[str]):
        super().__init__(
            code="LOW_FACE_QUALITY",
            message=message,
            details={"quality_metrics": quality_metrics, "improvement_tips": improvement_tips}
        )

class FaceTooSmallError(LowFaceQualityError):
    def __init__(self, face_w: int, face_h: int, min_size: int, quality_metrics: Dict[str, Any]):
        super().__init__(
            message=f"Detected face area ({face_w}x{face_h}px) is too small (minimum {min_size}x{min_size}px) for biometric feature extraction.",
            quality_metrics=quality_metrics,
            improvement_tips=["Move closer to the camera", "Upload a higher-resolution photograph"]
        )

class FaceTooBlurryError(LowFaceQualityError):
    def __init__(self, blur_score: float, min_blur: float, quality_metrics: Dict[str, Any]):
        super().__init__(
            message=f"Detected face is too blurry (sharpness score {blur_score:.1f} is below minimum {min_blur:.1f}).",
            quality_metrics=quality_metrics,
            improvement_tips=["Ensure camera is properly focused", "Avoid subject motion", "Provide a clearer photograph"]
        )

class ExtremePoseError(LowFaceQualityError):
    def __init__(self, yaw: float, pitch: float, roll: float, quality_metrics: Dict[str, Any]):
        super().__init__(
            message=f"Face angle is turned away from camera (yaw={yaw:.1f}°, pitch={pitch:.1f}°, roll={roll:.1f}°).",
            quality_metrics=quality_metrics,
            improvement_tips=["Ensure subject is looking directly into the camera", "Provide a straight frontal mugshot"]
        )

class TemplateExtractionError(BiometricError):
    def __init__(self, message: str = "Biometric template extraction failed."):
        super().__init__(code="TEMPLATE_GENERATION_FAILED", message=message)

class NoRegisteredTemplatesError(BiometricError):
    def __init__(self, message: str = "No criminal biometric templates are registered in the database."):
        super().__init__(code="NO_REGISTERED_TEMPLATES", message=message)
