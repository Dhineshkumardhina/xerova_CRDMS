"""
Face Quality Assessment Module
==============================
Computes face resolution, Laplacian sharpness/blur metrics, illumination levels,
contrast distribution, face bounding box proportions, and head pose angles.
Generates comprehensive quality scores and actionable officer guidance.
"""

import cv2
import numpy as np
from typing import Dict, Any, List, Tuple, Optional
from app.services.face_recognition.config import config

class FaceQualityAnalyzer:
    """Evaluates facial image quality against biometric standards."""

    @staticmethod
    def compute_blur_score(face_crop: np.ndarray) -> float:
        """
        Calculates Laplacian variance of the face crop as a measure of sharpness.
        Higher is sharper, values below MIN_LAPLACIAN_BLUR_SCORE indicate blur.
        """
        if face_crop is None or face_crop.size == 0:
            return 0.0
        if len(face_crop.shape) == 3:
            gray = cv2.cvtColor(face_crop, cv2.COLOR_BGR2GRAY)
        else:
            gray = face_crop
        score = float(cv2.Laplacian(gray, cv2.CV_64F).var())
        return round(score, 2)

    @staticmethod
    def compute_illumination_metrics(face_crop: np.ndarray) -> Tuple[float, float]:
        """
        Calculates mean brightness (0-255) and contrast (std dev 0-128).
        """
        if face_crop is None or face_crop.size == 0:
            return 0.0, 0.0
        if len(face_crop.shape) == 3:
            gray = cv2.cvtColor(face_crop, cv2.COLOR_BGR2GRAY)
        else:
            gray = face_crop
        mean_brightness = float(np.mean(gray))
        contrast = float(np.std(gray))
        return round(mean_brightness, 2), round(contrast, 2)

    @staticmethod
    def estimate_pose_from_landmarks(landmarks: np.ndarray) -> Tuple[float, float, float]:
        """
        Estimates yaw, pitch, and roll angles (in degrees) from 5 standard facial landmarks:
        [left_eye, right_eye, nose, left_mouth, right_mouth].
        """
        if landmarks is None or len(landmarks) != 5:
            return 0.0, 0.0, 0.0

        pts = np.array(landmarks, dtype=np.float32)
        left_eye, right_eye, nose, left_mouth, right_mouth = pts[0], pts[1], pts[2], pts[3], pts[4]

        # Roll: eye slope angle
        d_x = right_eye[0] - left_eye[0]
        d_y = right_eye[1] - left_eye[1]
        roll = float(np.degrees(np.arctan2(d_y, d_x)))

        # Yaw: nose horizontal displacement relative to eye centers
        eye_center = (left_eye + right_eye) / 2.0
        eye_dist = np.linalg.norm(right_eye - left_eye)
        if eye_dist > 1e-4:
            yaw_ratio = (nose[0] - eye_center[0]) / (eye_dist / 2.0)
            yaw = float(np.clip(yaw_ratio * 45.0, -90.0, 90.0))
        else:
            yaw = 0.0

        # Pitch: nose vertical position relative to eye-mouth midpoint
        mouth_center = (left_mouth + right_mouth) / 2.0
        face_height = np.linalg.norm(mouth_center - eye_center)
        if face_height > 1e-4:
            mid_vertical = (eye_center[1] + mouth_center[1]) / 2.0
            pitch_ratio = (nose[1] - mid_vertical) / (face_height / 2.0)
            pitch = float(np.clip(pitch_ratio * 40.0, -90.0, 90.0))
        else:
            pitch = 0.0

        return round(yaw, 1), round(pitch, 1), round(roll, 1)

    @classmethod
    def evaluate_quality(
        cls,
        image_bgr: Any,
        bbox: Optional[List[int]] = None,
        landmarks: Optional[np.ndarray] = None,
        pose_angles: Optional[Tuple[float, float, float]] = None
    ) -> Dict[str, Any]:
        """
        Comprehensive quality assessment of a detected face.
        
        Returns:
            Dict containing metrics, quality_score (0.0 to 1.0), is_acceptable (bool),
            and actionable improvement_tips.
        """
        if not isinstance(image_bgr, np.ndarray):
            from app.services.face_recognition.preprocessing import preprocessor
            image_bgr, _, _, _ = preprocessor.load_image(image_bgr)

        img_h, img_w = image_bgr.shape[:2]
        if bbox is None:
            bbox = [0, 0, img_w, img_h]

        x1, y1, x2, y2 = bbox
        
        # Clamp bbox inside image dimensions
        x1_c = max(0, min(x1, img_w - 1))
        y1_c = max(0, min(y1, img_h - 1))
        x2_c = max(x1_c + 1, min(x2, img_w))
        y2_c = max(y1_c + 1, min(y2, img_h))

        face_w = x2_c - x1_c
        face_h = y2_c - y1_c
        face_crop = image_bgr[y1_c:y2_c, x1_c:x2_c]

        blur_score = cls.compute_blur_score(face_crop)
        brightness, contrast = cls.compute_illumination_metrics(face_crop)

        if pose_angles is not None and len(pose_angles) == 3:
            yaw, pitch, roll = pose_angles
        elif landmarks is not None:
            yaw, pitch, roll = cls.estimate_pose_from_landmarks(landmarks)
        else:
            yaw, pitch, roll = 0.0, 0.0, 0.0

        face_area_ratio = round((face_w * face_h) / (img_w * img_h), 4)

        # Quality scoring heuristics (0.0 to 1.0)
        # 1. Blur factor
        blur_factor = min(1.0, max(0.0, blur_score / 150.0))
        
        # 2. Brightness factor (ideal range: 70 - 180)
        if brightness < config.MIN_BRIGHTNESS:
            bright_factor = max(0.0, brightness / config.MIN_BRIGHTNESS)
        elif brightness > config.MAX_BRIGHTNESS:
            bright_factor = max(0.0, (255 - brightness) / (255 - config.MAX_BRIGHTNESS))
        else:
            bright_factor = 1.0

        # 3. Contrast factor
        contrast_factor = min(1.0, max(0.0, contrast / 50.0))

        # 4. Pose factor
        pose_penalty = (abs(yaw) / config.MAX_YAW_ANGLE) * 0.4 + (abs(pitch) / config.MAX_PITCH_ANGLE) * 0.3 + (abs(roll) / config.MAX_ROLL_ANGLE) * 0.3
        pose_factor = max(0.0, 1.0 - min(1.0, pose_penalty))

        # 5. Size factor
        size_factor = min(1.0, max(0.0, min(face_w, face_h) / 120.0))

        # Weighted aggregate score
        quality_score = round(
            float(0.35 * blur_factor + 0.20 * bright_factor + 0.15 * contrast_factor + 0.20 * pose_factor + 0.10 * size_factor),
            2
        )

        improvement_tips: List[str] = []
        is_acceptable = True

        if face_w < config.MIN_FACE_SIZE_PIXELS or face_h < config.MIN_FACE_SIZE_PIXELS:
            improvement_tips.append(f"Face is too small ({face_w}x{face_h}px). Move closer to the camera.")
            is_acceptable = False

        if blur_score < config.MIN_LAPLACIAN_BLUR_SCORE:
            improvement_tips.append("Image is blurry. Retake photo with steady camera and sharp focus.")
            is_acceptable = False

        if brightness < config.MIN_BRIGHTNESS:
            improvement_tips.append("Lighting is too dark. Increase ambient illumination on the subject.")
            is_acceptable = False
        elif brightness > config.MAX_BRIGHTNESS:
            improvement_tips.append("Image is overexposed / washed out. Reduce harsh glare or direct flash.")
            is_acceptable = False

        if contrast < config.MIN_CONTRAST:
            improvement_tips.append("Low contrast. Ensure good lighting separation between subject and background.")

        if abs(yaw) > config.MAX_YAW_ANGLE or abs(pitch) > config.MAX_PITCH_ANGLE:
            improvement_tips.append("Face is angled away. Please provide a direct frontal perspective.")
            is_acceptable = False

        return {
            "quality_score": quality_score,
            "is_acceptable": is_acceptable,
            "blur_score": blur_score,
            "brightness": brightness,
            "contrast": contrast,
            "face_width": face_w,
            "face_height": face_h,
            "face_area_ratio": face_area_ratio,
            "yaw": yaw,
            "pitch": pitch,
            "roll": roll,
            "is_frontal": bool(abs(yaw) <= 20.0 and abs(pitch) <= 15.0 and abs(roll) <= 15.0),
            "improvement_tips": improvement_tips,
        }

quality_analyzer = FaceQualityAnalyzer()
