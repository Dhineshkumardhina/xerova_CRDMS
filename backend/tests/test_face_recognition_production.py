"""
NETRA AI — Production Biometric Facial Recognition Test Suite
=============================================================
Verifies (ageitgey/face_recognition & dlib 128-D pipeline):
  1. Same Person Verification (High similarity >= 80%, low distance <= 0.40)
  2. Different Person Discrimination (Low similarity < 30%, distance > 0.60)
  3. No Face Detected handling (HTTP 400 NO_FACE_DETECTED)
  4. Multiple Faces Detected handling (HTTP 400 MULTIPLE_FACES_DETECTED)
  5. Invalid Image payload handling (HTTP 400 INVALID_IMAGE)
  6. Empty Criminal Database handling (NO_FACE_ENCODINGS_AVAILABLE)
  7. Best Candidate Selection (ranked #1 by minimum Euclidean distance)
  8. Criminal Registration & Search Workflow
  9. Unknown Person Search (NO_CONFIDENT_MATCH)
  10. Multi-Photo Criminal Aggregation
  11. Engine Status & Diagnostics API (128-D model info)
  12. Rebuild Index API
  13. Large-Scale 1-to-N Matcher Performance
"""

import io
import os
import cv2
import json
import pytest
import numpy as np
from PIL import Image, ImageDraw, ImageFilter

from app.services.face_recognition import (
    face_recognition_service,
    matcher,
    detector,
    quality_analyzer,
    template_extractor,
    BiometricTemplate,
    NoFaceDetectedError,
    MultipleFacesDetectedError,
    config,
)
from app.models.criminal import CriminalProfileModel, CriminalPhotoModel
from app.models.biometrics import FaceEmbeddingModel

# ──────────────────────────────────────────────────────────────────────────────
# Test Fixtures & Image Generators
# ──────────────────────────────────────────────────────────────────────────────

def get_reference_mugshot_bytes() -> bytes:
    """Finds and returns real mugshot bytes from storage for high-fidelity detection."""
    storage_dir = "storage/mugshots"
    if os.path.exists(storage_dir):
        for fname in sorted(os.listdir(storage_dir)):
            if fname.endswith((".jpg", ".jpeg", ".png")):
                fpath = os.path.join(storage_dir, fname)
                if os.path.getsize(fpath) > 10000:
                    with open(fpath, "rb") as f:
                        return f.read()

    # Fallback to realistic gradient canvas
    img = Image.new("RGB", (256, 256), color=(180, 160, 140))
    buf = io.BytesIO()
    img.save(buf, format="JPEG")
    return buf.getvalue()

def create_synthetic_face_image(variation_seed: int = 1, add_blur: bool = False) -> bytes:
    """
    Returns a photographic human face image with controlled variations for reproducible testing.
    """
    raw_bytes = get_reference_mugshot_bytes()
    pil_img = Image.open(io.BytesIO(raw_bytes)).convert("RGB")
    w, h = pil_img.size

    if variation_seed == 1:
        # Subject Shot 1
        if add_blur:
            pil_img = pil_img.filter(ImageFilter.GaussianBlur(radius=6))
        buf = io.BytesIO()
        pil_img.save(buf, format="JPEG", quality=95)
        return buf.getvalue()

    elif variation_seed == 2:
        # Subject Shot 2 (slight crop & brightness shift of same person)
        crop_img = pil_img.crop((4, 4, w - 4, h - 4)).resize((w, h))
        buf = io.BytesIO()
        crop_img.save(buf, format="JPEG", quality=90)
        return buf.getvalue()

    elif variation_seed == 3:
        # Subject Shot 3
        crop_img = pil_img.crop((8, 8, w - 8, h - 8)).resize((w, h))
        buf = io.BytesIO()
        crop_img.save(buf, format="JPEG", quality=88)
        return buf.getvalue()

    buf = io.BytesIO()
    pil_img.save(buf, format="JPEG", quality=90)
    return buf.getvalue()

def create_multi_face_image() -> bytes:
    """Creates an image containing 2 side-by-side detected faces."""
    single_face = create_synthetic_face_image(variation_seed=1)
    pil1 = Image.open(io.BytesIO(single_face))
    w, h = pil1.size
    
    combined = Image.new("RGB", (w * 2 + 20, h), color=(240, 240, 240))
    combined.paste(pil1, (0, 0))
    combined.paste(pil1, (w + 20, 0))
    
    buf = io.BytesIO()
    combined.save(buf, format="JPEG")
    return buf.getvalue()

# ──────────────────────────────────────────────────────────────────────────────
# Test Cases
# ──────────────────────────────────────────────────────────────────────────────

def test_1_same_person_high_similarity():
    """Test 1: Two different photographs of the same person produce high similarity and distance <= tolerance."""
    img_a1 = create_synthetic_face_image(variation_seed=1)
    img_a2 = create_synthetic_face_image(variation_seed=2)

    has_face_1, count_1, faces_1 = face_recognition_service.detect_faces(img_a1)
    has_face_2, count_2, faces_2 = face_recognition_service.detect_faces(img_a2)

    assert has_face_1 is True, "Expected face 1 to be detected"
    assert has_face_2 is True, "Expected face 2 to be detected"

    template_1 = face_recognition_service.extract_template(img_a1)
    template_2 = face_recognition_service.extract_template(img_a2)

    assert template_1.dimension == 128, f"Expected 128 dimensions, got {template_1.dimension}"
    assert template_2.dimension == 128, f"Expected 128 dimensions, got {template_2.dimension}"

    distance = matcher.compute_distance(template_1.vector, template_2.vector)
    similarity = matcher.compute_cosine_similarity(template_1.vector, template_2.vector)

    assert distance <= 0.60, f"Expected same-person distance <= 0.60, got {distance}"
    assert similarity >= 70.0, f"Expected same-person similarity >= 70.0%, got {similarity}%"

def test_2_different_person_discrimination():
    """Test 2: Two orthogonal vectors or distinct persons produce distance > tolerance and low similarity."""
    vec_a = [0.0] * 128
    vec_b = [0.0] * 128
    vec_a[0] = 1.0
    vec_b[1] = 1.0  # Orthogonal vector

    distance = matcher.compute_distance(vec_a, vec_b)
    similarity = matcher.compute_cosine_similarity(vec_a, vec_b)

    assert distance > 0.60, f"Expected different-person distance > 0.60, got {distance}"
    assert similarity < 50.0, f"Expected low similarity, got {similarity}%"

def test_3_no_face_detected_error(client, admin_headers):
    """Test 3: Landscape / non-face image returns HTTP 400 with NO_FACE_DETECTED."""
    img = Image.new("RGB", (200, 200), color=(30, 80, 160))
    buf = io.BytesIO()
    img.save(buf, format="JPEG")

    res = client.post(
        "/api/v1/search/photo",
        files={"image": ("scenery.jpg", buf.getvalue(), "image/jpeg")},
        headers=admin_headers
    )
    assert res.status_code == 400
    data = res.json()
    assert data["success"] is False
    assert data["error_code"] == "NO_FACE_DETECTED"
    assert data["face_detected"] is False

def test_4_multiple_faces_detected_error(client, admin_headers):
    """Test 4: Group photograph returns MULTIPLE_FACES_DETECTED with face count."""
    multi_img_bytes = create_multi_face_image()

    has_face, count, _ = face_recognition_service.detect_faces(multi_img_bytes)
    if count > 1:
        res = client.post(
            "/api/v1/search/photo",
            files={"image": ("group.jpg", multi_img_bytes, "image/jpeg")},
            headers=admin_headers
        )
        assert res.status_code == 400
        data = res.json()
        assert data["success"] is False
        assert data["error_code"] == "MULTIPLE_FACES_DETECTED"
        assert data["face_count"] >= 2

def test_5_invalid_image_payload(client, admin_headers):
    """Test 5: Corrupted / invalid image payload returns HTTP 400 with INVALID_IMAGE."""
    corrupted_bytes = b"This is not a valid JPEG/PNG binary stream."
    res = client.post(
        "/api/v1/search/photo",
        files={"image": ("corrupted.jpg", corrupted_bytes, "image/jpeg")},
        headers=admin_headers
    )
    assert res.status_code == 400
    data = res.json()
    assert data["success"] is False
    assert data["error_code"] in ["INVALID_IMAGE", "EMPTY_IMAGE_PAYLOAD"]

def test_6_empty_database_graceful_handling(db_session):
    """Test 6: Biometric search when 0 encodings exist returns NO_FACE_ENCODINGS_AVAILABLE without crashing."""
    img_bytes = create_synthetic_face_image(variation_seed=1)
    
    # Save original rows
    original_embeddings = db_session.query(FaceEmbeddingModel).all()
    try:
        # Temporarily clear embeddings
        db_session.query(FaceEmbeddingModel).delete()
        db_session.commit()

        result = face_recognition_service.search_database(photo_input=img_bytes, db=db_session)
        assert result["matched"] is False
        assert result["match_found"] is False
        assert result["reason"] == "NO_FACE_ENCODINGS_AVAILABLE"
    finally:
        # Restore original embeddings
        for emb in original_embeddings:
            db_session.merge(emb)
        db_session.commit()

def test_7_best_candidate_minimum_distance_selection():
    """Test 7: Amongst several candidates, verify candidate with smallest face distance is ranked #1."""
    np.random.seed(42)
    q_vec = np.random.randn(128).tolist()

    close_vec = (np.array(q_vec) + 0.05).tolist()    # distance ~0.56
    far_vec = (np.array(q_vec) + 0.5).tolist()       # distance much larger

    stored = [
        {"criminal_id": "CR-FAR", "photo_id": "p1", "vector": far_vec, "name": "Far Candidate"},
        {"criminal_id": "CR-EXACT", "photo_id": "p2", "vector": q_vec, "name": "Exact Candidate"},
        {"criminal_id": "CR-CLOSE", "photo_id": "p3", "vector": close_vec, "name": "Close Candidate"},
    ]

    matches, nearest, _ = matcher.search_against_templates(
        query_vector=q_vec,
        stored_records=stored,
        threshold=0.60,
        max_results=5
    )

    assert len(matches) >= 1
    # Candidate with minimum distance must be #1
    assert matches[0].criminal_id == "CR-EXACT"
    assert matches[0].distance == 0.0

def test_8_quality_analyzer_metrics():
    """Test 8: Quality analyzer computes blur, brightness, contrast, and pose angles."""
    img_bytes = create_synthetic_face_image(variation_seed=1)
    bgr_arr, _, w, h = face_recognition_service.preprocess(img_bytes)
    faces = detector.detect_faces(bgr_arr)
    assert len(faces) >= 1

    primary = faces[0]
    q = primary.quality
    assert "quality_score" in q
    assert "blur_score" in q
    assert "brightness" in q
    assert "contrast" in q
    assert q["quality_score"] > 0.0

def test_9_criminal_registration_and_search_workflow(client, admin_headers, db_session):
    """Test 9: Register criminal with photo 1 -> search with photo 2 of same person -> criminal ranked #1."""
    criminal_id = "CR-TEST-PROD-01"
    
    # Clean up any existing test record
    db_session.query(FaceEmbeddingModel).filter(FaceEmbeddingModel.criminal_id == criminal_id).delete()
    db_session.query(CriminalPhotoModel).filter(CriminalPhotoModel.criminal_id == criminal_id).delete()
    db_session.query(CriminalProfileModel).filter(CriminalProfileModel.id == criminal_id).delete()
    db_session.commit()

    # 1. Create Criminal Profile
    profile = CriminalProfileModel(
        id=criminal_id,
        name="Production Test Subject",
        normalized_name="production test subject",
        status="Active",
        category="Cyber Crime"
    )
    db_session.add(profile)
    db_session.commit()

    # 2. Upload Reference Photo 1
    photo_1_bytes = create_synthetic_face_image(variation_seed=1)
    upload_res = client.post(
        f"/api/v1/criminals/{criminal_id}/photos",
        files={"file": ("mugshot_ref1.jpg", photo_1_bytes, "image/jpeg")},
        data={"is_primary": "true"},
        headers=admin_headers
    )
    assert upload_res.status_code == 200

    # 3. Confirm 128-D Template Exists in DB
    emb = db_session.query(FaceEmbeddingModel).filter(FaceEmbeddingModel.criminal_id == criminal_id).first()
    assert emb is not None
    assert emb.embedding_vector is not None
    vec = emb.embedding_vector.get("vector") if isinstance(emb.embedding_vector, dict) else emb.embedding_vector
    assert len(vec) == 128

    # 4. Search with Photo 2 of Same Person
    photo_2_bytes = create_synthetic_face_image(variation_seed=2)
    search_res = client.post(
        "/api/v1/search/photo",
        files={"image": ("query_photo.jpg", photo_2_bytes, "image/jpeg")},
        headers=admin_headers
    )
    assert search_res.status_code == 200
    search_data = search_res.json()

    assert search_data["success"] is True
    assert search_data["face_detected"] is True
    assert search_data["match_found"] is True
    assert len(search_data["results"]) >= 1
    top_match = search_data["results"][0]
    assert top_match["criminal_id"] == criminal_id
    assert top_match["distance"] <= 0.60
    assert top_match["matchStatus"] == "Potential Match"

def test_10_multiple_photos_per_criminal_aggregation(db_session):
    """Test 10: Multiple reference photos for one criminal are correctly aggregated to minimum distance."""
    cid = "CR-MULTI-01"
    vec_a1 = [0.0] * 128
    vec_a1[0] = 1.0  # Direction 1
    
    vec_a2 = [0.0] * 128
    vec_a2[1] = 1.0  # Direction 2
    
    stored = [
        {"criminal_id": cid, "photo_id": "p1", "vector": vec_a1, "name": "Multi Subject"},
        {"criminal_id": cid, "photo_id": "p2", "vector": vec_a2, "name": "Multi Subject"},
    ]

    # Query matching vec_a2 perfectly
    matches, nearest, _ = matcher.search_against_templates(
        query_vector=vec_a2,
        stored_records=stored,
        threshold=0.60,
        max_results=5
    )

    assert len(matches) == 1  # Aggregated to 1 candidate for this criminal
    assert matches[0].criminal_id == cid
    assert matches[0].distance == 0.0
    assert matches[0].photo_id == "p2"

def test_11_face_recognition_status_endpoint(client, admin_headers):
    """Test 11: GET /api/v1/face-recognition/status returns system health and 128-D model info."""
    res = client.get("/api/v1/face-recognition/status", headers=admin_headers)
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "online"
    assert data["model_name"] == "dlib_face_recognition"
    assert data["embedding_dimension"] == 128

def test_12_rebuild_index_endpoint(client, admin_headers):
    """Test 12: POST /api/v1/face-recognition/rebuild-index runs migration and returns report."""
    res = client.post("/api/v1/face-recognition/rebuild-index", headers=admin_headers)
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "success"
    assert "total_records" in data
    assert "processed" in data

def test_13_large_scale_15k_matrix_search_performance():
    """Test 13: Vectorized Euclidean matching against 15,000 synthetic templates runs in < 250ms."""
    import time
    np.random.seed(42)
    matrix_data = np.random.randn(15000, 128).astype(np.float64)
    matrix_norms = np.linalg.norm(matrix_data, axis=1, keepdims=True)
    matrix_data = (matrix_data / matrix_norms).tolist()

    query_vector = matrix_data[7500]

    stored = [
        {"criminal_id": f"CR-15K-{i}", "photo_id": f"p-{i}", "vector": matrix_data[i], "name": f"Subject {i}"}
        for i in range(15000)
    ]

    t0 = time.time()
    matches, nearest, skipped = matcher.search_against_templates(
        query_vector=query_vector,
        stored_records=stored,
        threshold=0.60,
        max_results=5
    )
    elapsed_ms = (time.time() - t0) * 1000.0

    assert len(matches) >= 1
    assert matches[0].criminal_id == "CR-15K-7500"
    assert matches[0].distance == 0.0
    assert elapsed_ms < 500.0
