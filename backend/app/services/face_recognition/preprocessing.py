"""
Face Recognition Preprocessing Module
=====================================
Handles image decodings, EXIF orientation transpositions, payload extraction,
color conversions, and geometric boundary checks.
"""

import io
import base64
import numpy as np
from PIL import Image, ImageOps
from typing import Tuple, Union

from app.services.face_recognition.config import config
from app.services.face_recognition.exceptions import (
    EmptyImagePayloadError,
    ImageDecodingError,
    ImageTooLargeError,
    ImageDimensionTooSmallError,
)

class ImagePreprocessor:
    """Preprocesses raw image inputs for face detection and feature extraction."""

    @staticmethod
    def parse_input_bytes(photo_input: Union[bytes, str]) -> bytes:
        """
        Safely extract raw image bytes from:
          1. Raw bytes
          2. Base64 data URI (data:image/...)
          3. Standard base64 string
          4. Remote HTTP/HTTPS URL
          5. Local file/storage path
        """
        if photo_input is None:
            raise EmptyImagePayloadError("Image payload is None.")

        if isinstance(photo_input, bytes):
            if len(photo_input) < 16:
                raise EmptyImagePayloadError("Image bytes payload is too small.")
            return photo_input

        if isinstance(photo_input, str):
            clean_str = photo_input.strip()
            if not clean_str:
                raise EmptyImagePayloadError("Image string payload is empty.")
            
            # 1. Base64 Data URI
            if clean_str.startswith("data:"):
                if "," not in clean_str:
                    raise ImageDecodingError("Malformed data URI: missing comma separator.")
                b64_part = clean_str.split(",", 1)[1]
                try:
                    decoded = base64.b64decode(b64_part)
                    if len(decoded) < 16:
                        raise EmptyImagePayloadError("Decoded base64 payload is too small.")
                    return decoded
                except Exception as exc:
                    raise ImageDecodingError(f"Invalid base64 encoding: {exc}") from exc

            # 2. Remote HTTP/HTTPS URL
            if clean_str.startswith("http://") or clean_str.startswith("https://"):
                try:
                    import urllib.request
                    req = urllib.request.Request(
                        clean_str,
                        headers={"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) CRMS-Netra/1.0"}
                    )
                    with urllib.request.urlopen(req, timeout=12) as response:
                        downloaded_bytes = response.read()
                        if len(downloaded_bytes) < 16:
                            raise EmptyImagePayloadError("Downloaded image payload is too small.")
                        return downloaded_bytes
                except Exception as exc:
                    raise ImageDecodingError(f"Failed to fetch image from URL '{clean_str}': {exc}") from exc

            # 3. Local disk storage paths (e.g. /storage/mugshots/..., storage/mugshots/..., backend/storage/...)
            import os
            from app.core.config import settings as _settings
            _storage_dir = _settings.STORAGE_DIR
            # Strip the leading /storage/ prefix used in URLs to get the relative file path
            _rel = clean_str.lstrip("/\\").replace("storage/", "", 1).replace("storage\\", "", 1) if clean_str.lstrip("/\\").startswith("storage") else clean_str.lstrip("/\\")
            candidate_paths = [
                # Absolute paths using configured STORAGE_DIR (highest priority)
                os.path.join(_storage_dir, _rel),
                os.path.join(_storage_dir, "mugshots", os.path.basename(clean_str)),
                # Relative paths as fallback
                clean_str,
                clean_str.lstrip("/\\"),
                os.path.join("storage", "mugshots", os.path.basename(clean_str)),
                os.path.join("backend", "storage", "mugshots", os.path.basename(clean_str)),
                os.path.join("storage", clean_str.lstrip("/\\")),
            ]
            for p in candidate_paths:
                if os.path.isfile(p):
                    try:
                        with open(p, "rb") as f:
                            return f.read()
                    except Exception:
                        pass

            # 4. Standard base64 string
            try:
                decoded = base64.b64decode(clean_str)
                if len(decoded) >= 16:
                    return decoded
            except Exception:
                pass

            raise ImageDecodingError(f"Unable to resolve or decode image input: '{clean_str[:80]}...'")

        raise ImageDecodingError(f"Unsupported payload type: {type(photo_input).__name__}")

    @staticmethod
    def load_and_validate(image_bytes: bytes) -> Tuple[np.ndarray, Image.Image, int, int]:
        """
        Validates size limits, decodes image, applies EXIF orientation transpose,
        and returns:
            (bgr_numpy_array, rgb_pil_image, width, height)
        """
        if len(image_bytes) > config.MAX_UPLOAD_SIZE_BYTES:
            raise ImageTooLargeError(len(image_bytes), config.MAX_UPLOAD_SIZE_BYTES)

        try:
            pil_img = Image.open(io.BytesIO(image_bytes))
        except Exception as exc:
            raise ImageDecodingError(f"Cannot decode image file: {exc}") from exc

        # Fix EXIF orientation (crucial for smartphone mugshots / portrait uploads)
        try:
            pil_img = ImageOps.exif_transpose(pil_img)
        except Exception:
            pass

        pil_img = pil_img.convert("RGB")
        w, h = pil_img.size

        if w < config.MIN_IMAGE_DIMENSION or h < config.MIN_IMAGE_DIMENSION:
            raise ImageDimensionTooSmallError(w, h, config.MIN_IMAGE_DIMENSION)

        rgb_arr = np.array(pil_img, dtype=np.uint8)
        bgr_arr = rgb_arr[:, :, ::-1].copy()  # RGB -> BGR for OpenCV & InsightFace

        return bgr_arr, pil_img, w, h

    @classmethod
    def load_image(cls, photo_input: Union[bytes, str, np.ndarray]) -> Tuple[np.ndarray, Image.Image, int, int]:
        """
        Accepts raw bytes, base64 str, or numpy array, and returns:
            (bgr_numpy_array, rgb_pil_image, width, height)
        """
        if isinstance(photo_input, np.ndarray):
            if len(photo_input.shape) == 3 and photo_input.shape[2] == 3:
                pil_img = Image.fromarray(photo_input[:, :, ::-1])
            else:
                pil_img = Image.fromarray(photo_input)
            w, h = pil_img.size
            return photo_input, pil_img, w, h

        raw_bytes = cls.parse_input_bytes(photo_input)
        return cls.load_and_validate(raw_bytes)

preprocessor = ImagePreprocessor()
