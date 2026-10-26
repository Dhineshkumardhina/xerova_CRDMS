"""
NETRA CRMS -- Face Recognition CLI Debug & Verification Tool
============================================================
Compares two face images using the ageitgey/face_recognition (dlib) pipeline
and prints step-by-step diagnostic information and match decision.

Usage:
    python test_face_recognition.py <known_image_path> <query_image_path> [tolerance]

Example:
    python test_face_recognition.py storage/mugshots/crim_CR-72980_1158c12cde2d45f7a60725966599782f.jpg storage/mugshots/crim_CR-72980_1158c12cde2d45f7a60725966599782f.jpg 0.60
"""

import os
import sys
from pathlib import Path

# Add backend directory to sys.path
project_root = Path(__file__).resolve().parent
backend_dir = project_root / "backend"
for p in [str(project_root), str(backend_dir)]:
    if p not in sys.path:
        sys.path.insert(0, p)

import cv2
import numpy as np
import face_recognition

from app.core.config import settings

def compare_images(known_path: str, query_path: str, tolerance: float = 0.6):
    print("=" * 60)
    print("  NETRA AI -- Facial Recognition CLI Verification Utility")
    print("=" * 60)
    print(f"Known Image: {known_path}")
    print(f"Query Image: {query_path}")
    print(f"Tolerance:   {tolerance:.2f}")
    print("-" * 60)

    if not os.path.exists(known_path):
        print(f"ERROR: Known image not found: {known_path}")
        sys.exit(1)
    if not os.path.exists(query_path):
        print(f"ERROR: Query image not found: {query_path}")
        sys.exit(1)

    # 1. Load images ensuring RGB
    known_bgr = cv2.imread(known_path)
    if known_bgr is None:
        print("ERROR: Failed to decode known image (INVALID_IMAGE)")
        sys.exit(1)
    known_rgb = cv2.cvtColor(known_bgr, cv2.COLOR_BGR2RGB)

    query_bgr = cv2.imread(query_path)
    if query_bgr is None:
        print("ERROR: Failed to decode query image (INVALID_IMAGE)")
        sys.exit(1)
    query_rgb = cv2.cvtColor(query_bgr, cv2.COLOR_BGR2RGB)

    # 2. Detect face locations
    known_locations = face_recognition.face_locations(known_rgb)
    query_locations = face_recognition.face_locations(query_rgb)

    known_detected = len(known_locations) > 0
    query_detected = len(query_locations) > 0

    print(f"Known face detected: {'YES' if known_detected else 'NO'}")
    print(f"Query face detected: {'YES' if query_detected else 'NO'}")

    if not known_detected:
        print("RESULT: ERROR (NO_FACE_DETECTED in known image)")
        return

    if not query_detected:
        print("RESULT: ERROR (NO_FACE_DETECTED in query image)")
        return

    # 3. Generate encodings
    known_encodings = face_recognition.face_encodings(known_rgb, known_face_locations=known_locations)
    query_encodings = face_recognition.face_encodings(query_rgb, known_face_locations=query_locations)

    if not known_encodings or not query_encodings:
        print("RESULT: ERROR (FACE_ENCODING_FAILED)")
        return

    known_enc = known_encodings[0]
    query_enc = query_encodings[0]

    print(f"Known encoding dimensions: {len(known_enc)}")
    print(f"Query encoding dimensions: {len(query_enc)}")

    # 4. Calculate face distance
    face_distances = face_recognition.face_distance([known_enc], query_enc)
    distance = float(face_distances[0])

    print(f"\nFace distance: {distance:.4f}")
    print(f"Threshold:     {tolerance:.2f}")

    is_match = distance <= tolerance
    print(f"\nRESULT: {'MATCH' if is_match else 'NO MATCH'}")
    print("=" * 60)

if __name__ == "__main__":
    if len(sys.argv) < 3:
        print("Usage: python test_face_recognition.py <known.jpg> <query.jpg> [tolerance]")
        # Run demonstration on existing storage mugshot
        sample_img = "storage/mugshots/crim_CR-72980_1158c12cde2d45f7a60725966599782f.jpg"
        if os.path.exists(sample_img):
            print(f"\nNo arguments provided. Running self-test with sample mugshot: {sample_img}")
            compare_images(sample_img, sample_img, 0.60)
        else:
            sys.exit(1)
    else:
        tol = float(sys.argv[3]) if len(sys.argv) > 3 else 0.60
        compare_images(sys.argv[1], sys.argv[2], tol)
