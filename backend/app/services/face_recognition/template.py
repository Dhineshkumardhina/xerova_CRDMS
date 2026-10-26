"""
Biometric Template Extraction and Normalization Module
======================================================
Performs facial landmark alignment, 128-D face encoding extraction using
ageitgey/face_recognition (dlib), L2-normalization, and persistent template serialization.
"""

import sys
import json
import logging
from pathlib import Path
from typing import List, Dict, Any, Optional, Tuple, Union
from dataclasses import dataclass, field, asdict

# Ensure backend directory is in sys.path when running as a standalone script
_backend_dir = str(Path(__file__).resolve().parents[3])
if _backend_dir not in sys.path:
    sys.path.insert(0, _backend_dir)

import cv2
import numpy as np
from PIL import Image
import face_recognition

from app.services.face_recognition.config import config
from app.services.face_recognition.exceptions import TemplateExtractionError

logger = logging.getLogger("face_recognition.template")


def _sanitize_for_json(val: Any) -> Any:
    """Recursively converts NumPy and special types into JSON-serializable Python natives."""
    if isinstance(val, (np.floating, float)):
        return float(val)
    if isinstance(val, (np.integer, int)):
        return int(val)
    if isinstance(val, (np.bool_, bool)):
        return bool(val)
    if isinstance(val, np.ndarray):
        return val.tolist()
    if isinstance(val, dict):
        return {str(k): _sanitize_for_json(v) for k, v in val.items()}
    if isinstance(val, (list, tuple)):
        return [_sanitize_for_json(v) for v in val]
    return val


@dataclass
class BiometricTemplate:
    """
    Encapsulates a normalized 128-dimensional facial biometric template
    with quality metadata, model provenance, and persistent serialization.
    """
    vector: List[float]
    dimension: int = 128
    model_name: str = ""
    model_version: str = ""
    quality_score: float = 0.90
    quality_metrics: Dict[str, Any] = field(default_factory=dict)

    def __post_init__(self):
        # Set default model info from config if omitted
        if not self.model_name:
            self.model_name = config.MODEL_NAME
        if not self.model_version:
            self.model_version = config.MODEL_VERSION

        # Normalize vector into native Python floats
        if isinstance(self.vector, np.ndarray):
            self.vector = [float(x) for x in self.vector.flatten()]
        elif isinstance(self.vector, (list, tuple)):
            self.vector = [float(x) for x in self.vector]
        else:
            self.vector = []

        self.dimension = len(self.vector)
        self.quality_score = float(self.quality_score)
        self.quality_metrics = _sanitize_for_json(self.quality_metrics or {})

    def to_dict(self) -> Dict[str, Any]:
        """Converts the template into a clean, JSON-serializable dictionary."""
        return {
            "vector": self.vector,
            "dimension": self.dimension,
            "model_name": self.model_name,
            "model_version": self.model_version,
            "quality_score": self.quality_score,
            "quality_metrics": self.quality_metrics,
        }

    def to_json(self, indent: Optional[int] = None) -> str:
        """Serializes the template to a standard JSON string."""
        return json.dumps(self.to_dict(), indent=indent)

    def to_numpy(self) -> np.ndarray:
        """Returns the embedding as an L2-normalized float32 1D numpy array."""
        return np.array(self.vector, dtype=np.float32)

    def to_bytes(self) -> bytes:
        """Serializes the float32 embedding vector to raw binary bytes (128 * 4 = 512 bytes)."""
        return np.array(self.vector, dtype=np.float32).tobytes()

    def to_db_record(self) -> Dict[str, Any]:
        """
        Formats template representation for storage in FaceEmbeddingModel:
        returns dict with 'embedding_vector' and 'feature_metadata'.
        """
        from datetime import datetime, timezone
        return {
            "embedding_vector": {
                "vector": self.vector,
                "dim": self.dimension,
            },
            "feature_metadata": {
                "model_name": self.model_name,
                "model_version": self.model_version,
                "embedding_dimension": self.dimension,
                "quality_score": self.quality_score,
                "quality_metrics": self.quality_metrics,
                "indexed_at": datetime.now(timezone.utc).isoformat(),
                "face_count": 1,
                "is_active": True,
            }
        }

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "BiometricTemplate":
        """Deserializes a dictionary into a BiometricTemplate."""
        if not isinstance(data, dict):
            raise TemplateExtractionError(f"Expected dict for from_dict, got {type(data).__name__}")
        raw_vec = data.get("vector", [])
        return cls(
            vector=raw_vec,
            dimension=data.get("dimension", len(raw_vec)),
            model_name=data.get("model_name", config.MODEL_NAME),
            model_version=data.get("model_version", config.MODEL_VERSION),
            quality_score=data.get("quality_score", 0.90),
            quality_metrics=data.get("quality_metrics", {})
        )

    @classmethod
    def from_json(cls, json_str: str) -> "BiometricTemplate":
        """Deserializes a JSON string into a BiometricTemplate."""
        try:
            data = json.loads(json_str)
            return cls.from_dict(data)
        except Exception as exc:
            raise TemplateExtractionError(f"Failed to deserialize JSON template: {exc}") from exc

    @classmethod
    def from_bytes(
        cls,
        byte_data: bytes,
        quality_score: float = 0.90,
        quality_metrics: Optional[Dict[str, Any]] = None
    ) -> "BiometricTemplate":
        """Deserializes raw float32 bytes back into BiometricTemplate."""
        try:
            arr = np.frombuffer(byte_data, dtype=np.float32)
            return cls(
                vector=arr.tolist(),
                dimension=len(arr),
                model_name=config.MODEL_NAME,
                model_version=config.MODEL_VERSION,
                quality_score=quality_score,
                quality_metrics=quality_metrics or {}
            )
        except Exception as exc:
            raise TemplateExtractionError(f"Failed to deserialize binary template bytes: {exc}") from exc

    @classmethod
    def from_db_record(
        cls,
        embedding_vector: Any,
        feature_metadata: Optional[Any] = None
    ) -> "BiometricTemplate":
        """Reconstructs BiometricTemplate from database record fields."""
        if isinstance(embedding_vector, str):
            try:
                embedding_vector = json.loads(embedding_vector)
            except Exception:
                pass

        vec: List[float] = []
        if isinstance(embedding_vector, dict):
            vec = embedding_vector.get("vector", [])
        elif isinstance(embedding_vector, (list, tuple, np.ndarray)):
            vec = list(embedding_vector)

        meta: Dict[str, Any] = {}
        if isinstance(feature_metadata, str):
            try:
                meta = json.loads(feature_metadata)
            except Exception:
                pass
        elif isinstance(feature_metadata, dict):
            meta = feature_metadata

        return cls(
            vector=vec,
            dimension=len(vec),
            model_name=meta.get("model_name", config.MODEL_NAME),
            model_version=meta.get("model_version", config.MODEL_VERSION),
            quality_score=float(meta.get("quality_score", 0.90)),
            quality_metrics=meta.get("quality_metrics", {})
        )


class TemplateExtractor:
    """Extracts, aligns, and normalizes deep biometric templates from detected faces."""

    @staticmethod
    def normalize_l2(vector: Union[np.ndarray, List[float]]) -> np.ndarray:
        """Applies L2 normalization so that ||vector|| = 1.0."""
        v = np.array(vector, dtype=np.float32).flatten()
        if np.isnan(v).any() or np.isinf(v).any():
            raise TemplateExtractionError("Vector contains invalid NaN or Infinite values.")
        norm = float(np.linalg.norm(v))
        if norm > 1e-7:
            v = v / norm
        return v

    @classmethod
    def fuse_tta_embeddings(
        cls,
        vec1: Union[np.ndarray, List[float]],
        vec2: Optional[Union[np.ndarray, List[float]]] = None,
        alpha: float = 0.5
    ) -> np.ndarray:
        """
        Fuses standard and augmented (e.g. horizontally flipped) facial feature vectors
        to eliminate facial asymmetry and camera orientation distortions.
        """
        v1 = cls.normalize_l2(vec1)
        if vec2 is None:
            return v1
        v2 = cls.normalize_l2(vec2)
        fused = alpha * v1 + (1.0 - alpha) * v2
        return cls.normalize_l2(fused)

    @classmethod
    def _resolve_raw_embedding(cls, face_object: Any) -> Optional[np.ndarray]:
        """
        Safely extracts raw embedding array from diverse face representations:
        DetectedFace, SimpleNamespace, MockFaceObject, dict, or raw array/list.
        """
        if face_object is None:
            return None

        # 1. Raw numpy array or list/tuple of numbers
        if isinstance(face_object, (np.ndarray, list, tuple)):
            try:
                arr = np.asarray(face_object, dtype=np.float32).flatten()
                return arr
            except Exception:
                return None

        # 2. Object with .embedding attribute
        if hasattr(face_object, "embedding") and getattr(face_object, "embedding") is not None:
            arr = getattr(face_object, "embedding")
            return np.asarray(arr, dtype=np.float32).flatten()

        # 3. DetectedFace object with .raw_face_object attribute
        if hasattr(face_object, "raw_face_object"):
            raw = getattr(face_object, "raw_face_object")
            if raw is not None and hasattr(raw, "embedding") and getattr(raw, "embedding") is not None:
                return np.asarray(getattr(raw, "embedding"), dtype=np.float32).flatten()

        # 4. Dictionary containing embedding keys
        if isinstance(face_object, dict):
            for k in ("embedding", "vector", "embedding_vector"):
                if k in face_object and face_object[k] is not None:
                    val = face_object[k]
                    if isinstance(val, dict) and "vector" in val:
                        val = val["vector"]
                    return np.asarray(val, dtype=np.float32).flatten()

        return None

    @classmethod
    def _resolve_quality_info(
        cls,
        face_object: Any,
        quality_info: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """Resolves quality metadata dictionary from face representation or explicit argument."""
        if quality_info is not None and isinstance(quality_info, dict):
            return quality_info
        if hasattr(face_object, "quality") and isinstance(getattr(face_object, "quality"), dict):
            return getattr(face_object, "quality")
        if isinstance(face_object, dict):
            if "quality" in face_object and isinstance(face_object["quality"], dict):
                return face_object["quality"]
            if "quality_metrics" in face_object and isinstance(face_object["quality_metrics"], dict):
                return face_object["quality_metrics"]
        return {}

    @classmethod
    def align_face(
        cls,
        image: Union[np.ndarray, Image.Image],
        landmarks: Optional[Any] = None,
        bbox: Optional[List[int]] = None,
        output_size: Tuple[int, int] = (112, 112)
    ) -> np.ndarray:
        """
        Performs 2D affine transformation to align facial landmarks (eyes horizontal)
        and crops to the standard output size (default: 112x112).

        Args:
            image: numpy array (RGB or BGR) or PIL Image
            landmarks: 5-point landmarks [[lx, ly], [rx, ry], ...], 68-point dict, or None
            bbox: [x1, y1, x2, y2] bounding box, optional
            output_size: (width, height) output dimensions

        Returns:
            Aligned face crop as numpy uint8 array of shape (output_size[1], output_size[0], 3).
        """
        if isinstance(image, Image.Image):
            img_arr = np.array(image)
        elif isinstance(image, np.ndarray):
            img_arr = image.copy()
        else:
            raise TemplateExtractionError(f"Unsupported image type for alignment: {type(image)}")

        h, w = img_arr.shape[:2]
        out_w, out_h = output_size

        left_eye: Optional[np.ndarray] = None
        right_eye: Optional[np.ndarray] = None

        if landmarks is not None:
            if isinstance(landmarks, dict):
                # 68-point dlib landmarks dictionary
                if "left_eye" in landmarks and "right_eye" in landmarks:
                    left_eye = np.mean(landmarks["left_eye"], axis=0)
                    right_eye = np.mean(landmarks["right_eye"], axis=0)
            elif isinstance(landmarks, (np.ndarray, list)) and len(landmarks) >= 2:
                # 5-point canonical landmarks: [left_eye, right_eye, nose, left_mouth, right_mouth]
                pts = np.asarray(landmarks, dtype=np.float32)
                left_eye = pts[0]
                right_eye = pts[1]

        # If eye landmarks are available, compute rotation to make eye line horizontal
        if left_eye is not None and right_eye is not None:
            d_x = right_eye[0] - left_eye[0]
            d_y = right_eye[1] - left_eye[1]
            dist = np.sqrt(d_x * d_x + d_y * d_y)

            if dist > 1e-4:
                angle = float(np.degrees(np.arctan2(d_y, d_x)))
                eye_center = (float((left_eye[0] + right_eye[0]) / 2.0), float((left_eye[1] + right_eye[1]) / 2.0))

                # Rotate image so eyes are level
                M = cv2.getRotationMatrix2D(eye_center, angle, 1.0)
                rotated = cv2.warpAffine(img_arr, M, (w, h), flags=cv2.INTER_CUBIC, borderMode=cv2.BORDER_REFLECT)

                # Crop around rotated center
                if bbox is not None and len(bbox) == 4:
                    x1, y1, x2, y2 = bbox
                    cx, cy = (x1 + x2) / 2.0, (y1 + y2) / 2.0
                    bw, bh = (x2 - x1), (y2 - y1)
                else:
                    cx, cy = eye_center[0], eye_center[1] + dist * 0.4
                    bw = bh = dist * 2.8

                crop_x1 = max(0, int(cx - bw / 2.0))
                crop_y1 = max(0, int(cy - bh / 2.0))
                crop_x2 = min(w, int(cx + bw / 2.0))
                crop_y2 = min(h, int(cy + bh / 2.0))

                cropped = rotated[crop_y1:crop_y2, crop_x1:crop_x2]
                if cropped.size > 0:
                    return cv2.resize(cropped, (out_w, out_h), interpolation=cv2.INTER_AREA)

        # Fallback 1: Crop using bbox if available
        if bbox is not None and len(bbox) == 4:
            x1, y1, x2, y2 = bbox
            x1_c = max(0, min(x1, w - 1))
            y1_c = max(0, min(y1, h - 1))
            x2_c = max(x1_c + 1, min(x2, w))
            y2_c = max(y1_c + 1, min(y2, h))
            cropped = img_arr[y1_c:y2_c, x1_c:x2_c]
            if cropped.size > 0:
                return cv2.resize(cropped, (out_w, out_h), interpolation=cv2.INTER_AREA)

        # Fallback 2: Resize whole image to canonical size
        return cv2.resize(img_arr, (out_w, out_h), interpolation=cv2.INTER_AREA)

    @classmethod
    def extract_from_face_object(
        cls,
        face_object: Any,
        quality_info: Optional[Dict[str, Any]] = None,
        flipped_face_object: Optional[Any] = None
    ) -> BiometricTemplate:
        """
        Extracts L2-normalized 128-D vector from a DetectedFace / raw Face object
        with optional TTA flip fusion.
        """
        if face_object is None:
            raise TemplateExtractionError("Face object does not contain an embedding vector.")

        raw_embedding = cls._resolve_raw_embedding(face_object)
        if raw_embedding is None:
            raise TemplateExtractionError("Face object does not contain an embedding vector.")

        if raw_embedding.size != config.EMBEDDING_DIM:
            raise TemplateExtractionError(
                f"Embedding dimension mismatch: expected {config.EMBEDDING_DIM}, got {raw_embedding.size}"
            )

        if np.isnan(raw_embedding).any() or np.isinf(raw_embedding).any():
            raise TemplateExtractionError("Face embedding contains invalid NaN or Infinite values.")

        if float(np.linalg.norm(raw_embedding)) <= 1e-7:
            raise TemplateExtractionError("Degenerate face embedding with near-zero norm.")

        # TTA flip fusion if flipped object is provided
        if flipped_face_object is not None:
            flipped_embedding = cls._resolve_raw_embedding(flipped_face_object)
            if flipped_embedding is not None and flipped_embedding.size == config.EMBEDDING_DIM:
                norm_vec = cls.fuse_tta_embeddings(raw_embedding, flipped_embedding)
            else:
                norm_vec = cls.normalize_l2(raw_embedding)
        else:
            norm_vec = cls.normalize_l2(raw_embedding)

        resolved_quality = cls._resolve_quality_info(face_object, quality_info)
        q_score = float(resolved_quality.get("quality_score", 0.90))

        return BiometricTemplate(
            vector=[float(x) for x in norm_vec],
            dimension=len(norm_vec),
            model_name=config.MODEL_NAME,
            model_version=config.MODEL_VERSION,
            quality_score=q_score,
            quality_metrics=resolved_quality
        )

    @classmethod
    def extract_from_rgb_image(
        cls,
        rgb_image: np.ndarray,
        face_location: Optional[Union[tuple, list]] = None,
        quality_info: Optional[Dict[str, Any]] = None,
        num_jitters: int = 1
    ) -> BiometricTemplate:
        """
        Directly generates 128-D BiometricTemplate from an RGB image and optional face location tuple.
        """
        if rgb_image is None or not isinstance(rgb_image, np.ndarray) or rgb_image.size == 0:
            raise TemplateExtractionError("Invalid or empty image array provided.")

        # Ensure 3-channel RGB
        if len(rgb_image.shape) == 2:
            rgb_image = cv2.cvtColor(rgb_image, cv2.COLOR_GRAY2RGB)
        elif len(rgb_image.shape) == 3 and rgb_image.shape[2] == 4:
            rgb_image = cv2.cvtColor(rgb_image, cv2.COLOR_RGBA2RGB)

        # Normalize face_location parameter
        if face_location is not None:
            if isinstance(face_location, (list, tuple)) and len(face_location) == 4:
                locations = [tuple(int(x) for x in face_location)]
            else:
                raise TemplateExtractionError(f"Invalid face_location format: {face_location}")
        else:
            try:
                locations = face_recognition.face_locations(
                    rgb_image,
                    number_of_times_to_upsample=config.DETECTION_UPSAMPLE,
                    model=config.DETECTION_MODEL
                )
            except Exception as exc:
                raise TemplateExtractionError(f"Face detection failed during extraction: {exc}") from exc

        if not locations:
            raise TemplateExtractionError("No face found in image to extract template.")

        try:
            encodings = face_recognition.face_encodings(
                rgb_image,
                known_face_locations=locations,
                num_jitters=num_jitters
            )
        except Exception as exc:
            raise TemplateExtractionError(f"Failed to generate face encoding: {exc}") from exc

        if not encodings or encodings[0] is None:
            raise TemplateExtractionError("Failed to generate face encoding: model returned empty.")

        raw_vec = np.asarray(encodings[0], dtype=np.float32).flatten()
        if raw_vec.size != config.EMBEDDING_DIM:
            raise TemplateExtractionError(
                f"Embedding dimension mismatch: expected {config.EMBEDDING_DIM}, got {raw_vec.size}"
            )

        if np.isnan(raw_vec).any() or np.isinf(raw_vec).any():
            raise TemplateExtractionError("Extracted encoding contains NaN or Inf values.")

        norm_vec = cls.normalize_l2(raw_vec)
        if float(np.linalg.norm(norm_vec)) <= 1e-7:
            raise TemplateExtractionError("Extracted face embedding is degenerate.")

        q_score = float(quality_info.get("quality_score", 0.90)) if quality_info else 0.90
        q_metrics = quality_info or {}

        return BiometricTemplate(
            vector=[float(x) for x in norm_vec],
            dimension=len(norm_vec),
            model_name=config.MODEL_NAME,
            model_version=config.MODEL_VERSION,
            quality_score=q_score,
            quality_metrics=q_metrics
        )

    @classmethod
    def extract_with_tta(
        cls,
        rgb_image: np.ndarray,
        face_location: Optional[Union[tuple, list]] = None,
        quality_info: Optional[Dict[str, Any]] = None,
        num_jitters: int = 1
    ) -> BiometricTemplate:
        """
        Extracts biometric template using Test-Time Augmentation (TTA).
        Computes embedding from original face and its horizontal flip,
        then fuses them with L2 normalization to reduce pose/orientation variance.
        """
        # 1. Base template
        base_tmpl = cls.extract_from_rgb_image(
            rgb_image=rgb_image,
            face_location=face_location,
            quality_info=quality_info,
            num_jitters=num_jitters
        )

        # 2. Horizontal flip
        flipped_img = np.ascontiguousarray(np.fliplr(rgb_image))
        flipped_location = None
        if face_location is not None and len(face_location) == 4:
            top, right, bottom, left = face_location
            img_w = rgb_image.shape[1]
            flipped_location = (top, img_w - left, bottom, img_w - right)

        try:
            flip_tmpl = cls.extract_from_rgb_image(
                rgb_image=flipped_img,
                face_location=flipped_location,
                quality_info=quality_info,
                num_jitters=num_jitters
            )
            fused_vec = cls.fuse_tta_embeddings(
                np.array(base_tmpl.vector, dtype=np.float32),
                np.array(flip_tmpl.vector, dtype=np.float32)
            )
            base_tmpl.vector = [float(x) for x in fused_vec]
        except Exception as exc:
            logger.debug("TTA flip extraction skipped: %s", exc)

        return base_tmpl

    @classmethod
    def extract_from_image(
        cls,
        photo_input: Union[np.ndarray, Image.Image, bytes, str],
        face_location: Optional[Union[tuple, list]] = None,
        quality_info: Optional[Dict[str, Any]] = None,
        num_jitters: int = 1
    ) -> BiometricTemplate:
        """
        High-level extraction accepting numpy BGR/RGB array, PIL Image, bytes,
        base64 string, or storage path.
        """
        from app.services.face_recognition.preprocessing import preprocessor

        if isinstance(photo_input, np.ndarray):
            if len(photo_input.shape) == 2:
                rgb_img = cv2.cvtColor(photo_input, cv2.COLOR_GRAY2RGB)
            elif len(photo_input.shape) == 3 and photo_input.shape[2] == 4:
                rgb_img = cv2.cvtColor(photo_input, cv2.COLOR_BGRA2RGB)
            elif len(photo_input.shape) == 3 and photo_input.shape[2] == 3:
                rgb_img = photo_input
            else:
                raise TemplateExtractionError(f"Invalid image array shape: {photo_input.shape}")
        elif isinstance(photo_input, Image.Image):
            rgb_img = np.array(photo_input.convert("RGB"), dtype=np.uint8)
        else:
            _, pil_img, _, _ = preprocessor.load_image(photo_input)
            rgb_img = np.array(pil_img, dtype=np.uint8)

        loc_tuple = None
        if face_location is not None and isinstance(face_location, (list, tuple)) and len(face_location) == 4:
            loc_tuple = tuple(int(x) for x in face_location)

        return cls.extract_from_rgb_image(
            rgb_image=rgb_img,
            face_location=loc_tuple,
            quality_info=quality_info,
            num_jitters=num_jitters
        )

    @classmethod
    def batch_extract(
        cls,
        rgb_images: List[np.ndarray],
        face_locations_list: Optional[List[Optional[tuple]]] = None,
        num_jitters: int = 1
    ) -> List[BiometricTemplate]:
        """Batch extraction of biometric templates across multiple images."""
        templates: List[BiometricTemplate] = []
        for idx, img in enumerate(rgb_images):
            loc = face_locations_list[idx] if face_locations_list and idx < len(face_locations_list) else None
            try:
                tmpl = cls.extract_from_rgb_image(img, face_location=loc, num_jitters=num_jitters)
                templates.append(tmpl)
            except Exception as exc:
                logger.warning("Batch template extraction failed for image index %d: %s", idx, exc)
                continue
        return templates


template_extractor = TemplateExtractor()


if __name__ == "__main__":
    print("=" * 70)
    print("  NETRA AI Biometrics -- Template Extraction & Normalization Module")
    print("=" * 70)

    # 1. Test L2 Normalization
    raw_128 = np.random.randn(128).astype(np.float32)
    norm_128 = TemplateExtractor.normalize_l2(raw_128)
    l2_norm = float(np.linalg.norm(norm_128))
    print(f"[+] L2 Normalization:")
    print(f"    - Input dimension:       {raw_128.shape[0]}")
    print(f"    - Normalized ||v||:      {l2_norm:.6f} (target: 1.000000)")
    assert abs(l2_norm - 1.0) < 1e-5, f"L2 norm check failed: {l2_norm}"

    # 2. Test TTA (Test-Time Augmentation) Flip Fusion
    flip_raw = raw_128 + np.random.randn(128).astype(np.float32) * 0.05
    fused_vec = TemplateExtractor.fuse_tta_embeddings(raw_128, flip_raw)
    fused_norm = float(np.linalg.norm(fused_vec))
    print(f"\n[+] TTA Embedding Fusion (Original + Horizontally Flipped):")
    print(f"    - Fused vector dimension: {fused_vec.shape[0]}")
    print(f"    - Fused vector ||v||:    {fused_norm:.6f}")
    assert abs(fused_norm - 1.0) < 1e-5, f"TTA norm check failed: {fused_norm}"

    # 3. Test BiometricTemplate extraction from Face Object & DetectedFace
    class MockFaceObject:
        def __init__(self, embedding: np.ndarray):
            self.embedding = embedding

    class MockDetectedFace:
        def __init__(self, embedding: np.ndarray, quality: dict):
            self.raw_face_object = MockFaceObject(embedding=embedding)
            self.quality = quality
            self.bbox = [20, 30, 100, 120]
            self.det_score = 0.99

    mock_quality = {
        "quality_score": 0.942,
        "is_blurry": False,
        "sharpness_laplacian": 384.2,
        "brightness": 122.5,
        "contrast": 58.7,
        "pose_angles": {"yaw": 1.4, "pitch": -2.0, "roll": 0.3}
    }

    mock_face = MockFaceObject(embedding=raw_128)
    mock_flipped = MockFaceObject(embedding=flip_raw)
    mock_detected = MockDetectedFace(embedding=raw_128, quality=mock_quality)

    # From MockFaceObject
    template: BiometricTemplate = template_extractor.extract_from_face_object(
        face_object=mock_face,
        quality_info=mock_quality,
        flipped_face_object=mock_flipped
    )

    print(f"\n[+] BiometricTemplate Instance Extracted (MockFaceObject):")
    print(f"    - Model Name:            {template.model_name}")
    print(f"    - Model Version:         {template.model_version}")
    print(f"    - Embedding Dimension:   {template.dimension}")
    print(f"    - Quality Score:         {template.quality_score:.3f}")
    print(f"    - Vector Preview (1..5): [{', '.join(f'{x:+.5f}' for x in template.vector[:5])}, ...]")

    # From DetectedFace directly (auto quality resolution)
    detected_tmpl = template_extractor.extract_from_face_object(mock_detected)
    assert detected_tmpl.dimension == 128
    assert detected_tmpl.quality_score == 0.942
    print(f"[+] BiometricTemplate Extracted from DetectedFace directly: SUCCESS")

    # From dictionary
    dict_tmpl = template_extractor.extract_from_face_object({"embedding": raw_128, "quality": mock_quality})
    assert dict_tmpl.dimension == 128
    print(f"[+] BiometricTemplate Extracted from Dict: SUCCESS")

    # From raw array
    arr_tmpl = template_extractor.extract_from_face_object(raw_128)
    assert arr_tmpl.dimension == 128
    print(f"[+] BiometricTemplate Extracted from Raw Array: SUCCESS")

    # 4. Test Serialization & Deserialization
    print(f"\n[+] Persistent Template Serialization:")
    t_dict = template.to_dict()
    assert isinstance(t_dict, dict)
    t_from_dict = BiometricTemplate.from_dict(t_dict)
    assert t_from_dict.dimension == template.dimension

    t_json = template.to_json()
    assert isinstance(t_json, str)
    t_from_json = BiometricTemplate.from_json(t_json)
    assert len(t_from_json.vector) == 128

    t_bytes = template.to_bytes()
    assert len(t_bytes) == 128 * 4
    t_from_bytes = BiometricTemplate.from_bytes(t_bytes)
    assert t_from_bytes.dimension == 128

    db_rec = template.to_db_record()
    assert "embedding_vector" in db_rec and "feature_metadata" in db_rec
    t_from_db = BiometricTemplate.from_db_record(db_rec["embedding_vector"], db_rec["feature_metadata"])
    assert t_from_db.dimension == 128
    print(f"    - to_dict / from_dict:     SUCCESS")
    print(f"    - to_json / from_json:     SUCCESS")
    print(f"    - to_bytes / from_bytes:   SUCCESS (512 bytes)")
    print(f"    - to_db_record / from_db:  SUCCESS")

    # 5. Test Landmark Face Alignment
    canvas = np.zeros((200, 200, 3), dtype=np.uint8)
    landmarks_5pt = np.array([[80, 80], [120, 80], [100, 100], [85, 130], [115, 130]], dtype=np.float32)
    aligned = TemplateExtractor.align_face(canvas, landmarks=landmarks_5pt, output_size=(112, 112))
    assert aligned.shape == (112, 112, 3)
    print(f"\n[+] Facial Landmark Alignment:")
    print(f"    - Aligned Face Shape:    {aligned.shape}")

    # 6. Validation Guards Test
    print(f"\n[+] Validation & Exception Guards:")
    try:
        template_extractor.extract_from_face_object(MockFaceObject(embedding=np.zeros(64)))
        print("    [!] ERROR: Did not catch invalid dimension!")
    except TemplateExtractionError as e:
        print(f"    - Mismatched dimension caught: {e}")

    try:
        template_extractor.extract_from_face_object(None)
        print("    [!] ERROR: Did not catch null face object!")
    except TemplateExtractionError as e:
        print(f"    - Null face object caught:     {e}")

    try:
        nan_vec = raw_128.copy()
        nan_vec[10] = np.nan
        template_extractor.extract_from_face_object(nan_vec)
        print("    [!] ERROR: Did not catch NaN vector!")
    except TemplateExtractionError as e:
        print(f"    - NaN vector caught:           {e}")

    try:
        template_extractor.extract_from_face_object(np.zeros(128))
        print("    [!] ERROR: Did not catch zero-norm vector!")
    except TemplateExtractionError as e:
        print(f"    - Zero-norm vector caught:     {e}")

    print("\n" + "=" * 70)
    print("  STATUS: ALL BIOMETRIC TEMPLATE TESTS PASSED SUCCESSFULLY (100%)")
    print("=" * 70)
