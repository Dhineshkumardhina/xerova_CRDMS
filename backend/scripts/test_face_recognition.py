"""
Standalone InsightFace ArcFace Biometric Verification Script (Phase 5)
======================================================================
Tests InsightFace installation, face detection, face alignment, and
512-dimensional ArcFace embedding generation on standalone test images.
"""

import os
import sys
import io
import urllib.request
import numpy as np
from PIL import Image, ImageEnhance

# Add backend/ to path
_BACKEND_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
sys.path.insert(0, _BACKEND_DIR)

from app.services.face_recognition_service import face_service, EMBEDDING_DIM, MODEL_NAME, MODEL_VERSION

def download_image(url: str) -> bytes:
    req = urllib.request.Request(url, headers={"User-Agent": "CRMS-StandaloneTest/1.0"})
    with urllib.request.urlopen(req, timeout=10) as resp:
        return resp.read()

def main():
    print("\n" + "=" * 70)
    print("  INSIGHTFACE ARCFACE STANDALONE RECOGNITION TEST (PHASE 5)")
    print("=" * 70)
    print(f"  Model Pack:          {MODEL_NAME}")
    print(f"  Model Version:       {MODEL_VERSION}")
    print(f"  Expected Dimension:  {EMBEDDING_DIM}")
    print("=" * 70)

    # Initialize model
    face_service.initialize()

    # Image 1: Person A (Base)
    url_1 = "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&q=80&w=300"
    # Image 2: Person A (Cropped + Lighting variation of Person A)
    # Image 3: Person B (Different person)
    url_3 = "https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&q=80&w=300"

    print("\n[*] Fetching test image set...")
    img1_bytes = download_image(url_1)
    img3_bytes = download_image(url_3)

    # Generate Image 2 variation from Image 1
    pil_1 = Image.open(io.BytesIO(img1_bytes)).convert("RGB")
    w, h = pil_1.size
    pil_2 = pil_1.crop((int(w * 0.1), int(h * 0.1), int(w * 0.9), int(h * 0.9)))
    pil_2 = ImageEnhance.Brightness(pil_2).enhance(0.8)
    buf_2 = io.BytesIO()
    pil_2.save(buf_2, format="JPEG")
    img2_bytes = buf_2.getvalue()

    # ── Test Image 1 ──────────────────────────────────────────────────────────
    has_1, count_1, _ = face_service.detect_faces(img1_bytes)
    emb_1 = face_service.extract_embedding(img1_bytes)
    print("\nIMAGE 1 (Person A - Original):")
    print(f"  Faces detected:      {count_1}")
    print(f"  Embedding generated: {'YES' if emb_1 is not None else 'NO'}")
    print(f"  Embedding dimension: {len(emb_1)}")
    assert count_1 == 1 and len(emb_1) == EMBEDDING_DIM

    # ── Test Image 2 ──────────────────────────────────────────────────────────
    has_2, count_2, _ = face_service.detect_faces(img2_bytes)
    emb_2 = face_service.extract_embedding(img2_bytes)
    print("\nIMAGE 2 (Person A - Cropped & Darkened):")
    print(f"  Faces detected:      {count_2}")
    print(f"  Embedding generated: {'YES' if emb_2 is not None else 'NO'}")
    print(f"  Embedding dimension: {len(emb_2)}")
    assert count_2 == 1 and len(emb_2) == EMBEDDING_DIM

    # ── Test Image 3 ──────────────────────────────────────────────────────────
    has_3, count_3, _ = face_service.detect_faces(img3_bytes)
    emb_3 = face_service.extract_embedding(img3_bytes)
    print("\nIMAGE 3 (Person B - Different Subject):")
    print(f"  Faces detected:      {count_3}")
    print(f"  Embedding generated: {'YES' if emb_3 is not None else 'NO'}")
    print(f"  Embedding dimension: {len(emb_3)}")
    assert count_3 == 1 and len(emb_3) == EMBEDDING_DIM

    # ── Pairwise Comparisons ──────────────────────────────────────────────────
    dist_1_2 = face_service.compute_distance(emb_1, emb_2)
    sim_1_2 = face_service.compute_similarity(emb_1, emb_2)

    dist_1_3 = face_service.compute_distance(emb_1, emb_3)
    sim_1_3 = face_service.compute_similarity(emb_1, emb_3)

    print("\n" + "-" * 70)
    print("  PAIRWISE BIOMETRIC COMPARISONS")
    print("-" * 70)
    print(f"  Image 1 vs Image 2 (Same Person - Different Variation):")
    print(f"    Cosine Distance:   {dist_1_2:.4f} (Expected <= 0.20)")
    print(f"    Cosine Similarity: {sim_1_2:.2f}% (Expected >= 80.0%)")

    print(f"\n  Image 1 vs Image 3 (Different People):")
    print(f"    Cosine Distance:   {dist_1_3:.4f} (Expected >= 0.80)")
    print(f"    Cosine Similarity: {sim_1_3:.2f}% (Expected <= 20.0%)")

    assert dist_1_2 < 0.20, f"Same person distance too high: {dist_1_2}"
    assert dist_1_3 > 0.80, f"Different person distance too low: {dist_1_3}"

    print("\n" + "=" * 70)
    print("  STANDALONE INSIGHTFACE TEST PASSED (100% SUCCESS)")
    print("=" * 70 + "\n")

if __name__ == "__main__":
    main()
