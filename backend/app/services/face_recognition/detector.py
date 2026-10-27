"""
Face Detection and Landmark Localization Module
===============================================
Encapsulates face detection, facial landmark extraction, and bounding box computation
using the ageitgey/face_recognition (dlib) detection pipeline.
"""

import sys
from pathlib import Path

# Ensure backend directory is in sys.path when running standalone
_backend_dir = str(Path(__file__).resolve().parents[3])
if _backend_dir not in sys.path:
    sys.path.insert(0, _backend_dir)

import cv2
import logging
import numpy as np
from types import SimpleNamespace
from typing import List, Dict, Any, Optional, Tuple
from dataclasses import dataclass

import face_recognition

from app.services.face_recognition.config import config
from app.services.face_recognition.quality import quality_analyzer
from app.services.face_recognition.exceptions import NoFaceDetectedError, MultipleFacesDetectedError

logger = logging.getLogger("face_recognition.detector")

@dataclass
class DetectedFace:
    """Encapsulates a single detected face instance with bounding box and landmarks."""
    bbox: List[int]                     # [x1, y1, x2, y2]
    det_score: float                    # Detection confidence (0.0 to 1.0)
    landmarks: Optional[np.ndarray]     # 5x2 landmarks: [[x,y],...]
    raw_face_object: Any                # Object containing embedding and raw metadata
    quality: Dict[str, Any]             # Full quality assessment dictionary
    pose: Tuple[float, float, float]    # (yaw, pitch, roll)

    @property
    def confidence(self) -> float:
        return self.det_score

    @property
    def embedding(self) -> Optional[np.ndarray]:
        if self.raw_face_object and hasattr(self.raw_face_object, "embedding"):
            return self.raw_face_object.embedding
        return None

class FaceDetector:
    """Thread-safe detector wrapper using ageitgey/face_recognition (dlib)."""
    
    _instance: Optional["FaceDetector"] = None
    _is_initialized: bool = False

    def __new__(cls):
        if cls._instance is None:
            cls._instance = super(FaceDetector, cls).__new__(cls)
        return cls._instance

    def initialize(self):
        """Validates underlying face_recognition / dlib models."""
        if self._is_initialized:
            return
        logger.info("Initializing FaceDetector with model '%s' (dlib 128-D)", config.DETECTION_MODEL)
        self._is_initialized = True
        logger.info("FaceDetector successfully initialized.")

    @staticmethod
    def _extract_5_point_landmarks(dlib_landmarks: Dict[str, List[Tuple[int, int]]]) -> Optional[np.ndarray]:
        """
        Extracts canonical 5 facial points [left_eye, right_eye, nose_tip, left_mouth, right_mouth]
        from 68-point dlib facial landmarks.
        """
        if not dlib_landmarks:
            return None
        try:
            left_eye_center = np.mean(dlib_landmarks.get("left_eye", [(0, 0)]), axis=0)
            right_eye_center = np.mean(dlib_landmarks.get("right_eye", [(0, 0)]), axis=0)
            nose_tip = np.mean(dlib_landmarks.get("nose_tip", [(0, 0)]), axis=0)
            top_lip = dlib_landmarks.get("top_lip", [(0, 0)] * 12)
            left_mouth = np.array(top_lip[0], dtype=np.float32)
            right_mouth = np.array(top_lip[6] if len(top_lip) > 6 else top_lip[-1], dtype=np.float32)
            return np.array([left_eye_center, right_eye_center, nose_tip, left_mouth, right_mouth], dtype=np.float32)
        except Exception:
            return None

    def detect_faces(self, image_bgr: Any) -> List[DetectedFace]:
        """
        Detects all human faces in an image (numpy BGR array, bytes, or base64 str).
        Returns a list of DetectedFace objects sorted by bounding box area (largest first).
        """
        if not isinstance(image_bgr, np.ndarray):
            from app.services.face_recognition.preprocessing import preprocessor
            image_bgr, _, _, _ = preprocessor.load_image(image_bgr)

        # Ensure correct color space: OpenCV uses BGR, face_recognition requires RGB
        if len(image_bgr.shape) == 3 and image_bgr.shape[2] == 3:
            rgb_image = cv2.cvtColor(image_bgr, cv2.COLOR_BGR2RGB)
        else:
            rgb_image = image_bgr

        orig_h, orig_w = rgb_image.shape[:2]
        max_edge = max(orig_h, orig_w)

        # Adaptive Downscaling: For large images, scale down for HOG detection and map bboxes back
        if max_edge > config.MAX_DETECTION_DIMENSION:
            scale = config.MAX_DETECTION_DIMENSION / float(max_edge)
            scaled_w = int(round(orig_w * scale))
            scaled_h = int(round(orig_h * scale))
            detection_rgb = cv2.resize(rgb_image, (scaled_w, scaled_h), interpolation=cv2.INTER_AREA)
            
            face_locations_scaled = face_recognition.face_locations(
                detection_rgb,
                number_of_times_to_upsample=config.DETECTION_UPSAMPLE,
                model=config.DETECTION_MODEL
            )

            if face_locations_scaled:
                face_locations = [
                    (
                        max(0, min(orig_h, int(round(t / scale)))),
                        max(0, min(orig_w, int(round(r / scale)))),
                        max(0, min(orig_h, int(round(b / scale)))),
                        max(0, min(orig_w, int(round(l / scale))))
                    )
                    for (t, r, b, l) in face_locations_scaled
                ]
            else:
                # Fallback to original image if downscale did not detect a face
                face_locations = face_recognition.face_locations(
                    rgb_image,
                    number_of_times_to_upsample=config.DETECTION_UPSAMPLE,
                    model=config.DETECTION_MODEL
                )
        else:
            face_locations = face_recognition.face_locations(
                rgb_image,
                number_of_times_to_upsample=config.DETECTION_UPSAMPLE,
                model=config.DETECTION_MODEL
            )

        if not face_locations:
            return []

        # Face Landmarks (68-point)
        try:
            face_landmarks_list = face_recognition.face_landmarks(rgb_image, face_locations=face_locations)
        except Exception as exc:
            logger.debug("Failed to extract face landmarks: %s", exc)
            face_landmarks_list = [{} for _ in face_locations]

        # Face Encodings (128-D)
        try:
            face_encodings = face_recognition.face_encodings(rgb_image, known_face_locations=face_locations)
        except Exception as exc:
            logger.warning("Failed to extract face encodings during detection: %s", exc)
            face_encodings = [None for _ in face_locations]

        detected_faces: List[DetectedFace] = []

        for idx, (top, right, bottom, left) in enumerate(face_locations):
            # Convert (top, right, bottom, left) to [x1, y1, x2, y2]
            bbox = [int(left), int(top), int(right), int(bottom)]
            det_score = 0.99  # dlib HOG detector default confidence

            dlib_landmarks = face_landmarks_list[idx] if idx < len(face_landmarks_list) else {}
            landmarks_5pt = self._extract_5_point_landmarks(dlib_landmarks)

            # Calculate pose & quality metrics
            pose = quality_analyzer.estimate_pose_from_landmarks(landmarks_5pt) if landmarks_5pt is not None else (0.0, 0.0, 0.0)
            quality_info = quality_analyzer.evaluate_quality(
                image_bgr=image_bgr,
                bbox=bbox,
                landmarks=landmarks_5pt,
                pose_angles=pose
            )

            encoding = face_encodings[idx] if idx < len(face_encodings) else None
            raw_face_obj = SimpleNamespace(
                embedding=encoding,
                bbox=bbox,
                location=(top, right, bottom, left),
                det_score=det_score
            )

            detected_faces.append(DetectedFace(
                bbox=bbox,
                det_score=det_score,
                landmarks=landmarks_5pt,
                raw_face_object=raw_face_obj,
                quality=quality_info,
                pose=pose
            ))

        # Sort largest face first (area = width * height)
        detected_faces.sort(
            key=lambda f: (f.bbox[2] - f.bbox[0]) * (f.bbox[3] - f.bbox[1]),
            reverse=True
        )

        return detected_faces

    def detect_single_face(self, image_bgr: np.ndarray, require_single_face: bool = False) -> DetectedFace:
        """
        Detects faces in the image and returns the primary (largest) face.
        If require_single_face is True, raises MultipleFacesDetectedError if face count > 1.
        """
        faces = self.detect_faces(image_bgr)
        if not faces:
            raise NoFaceDetectedError()

        if require_single_face and len(faces) > 1:
            faces_info = [
                {"bbox": f.bbox, "det_score": round(f.det_score, 3), "quality_score": f.quality["quality_score"]}
                for f in faces
            ]
            raise MultipleFacesDetectedError(face_count=len(faces), faces_info=faces_info)

        return faces[0]

detector = FaceDetector()
