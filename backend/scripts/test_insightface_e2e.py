"""
CRMS Comprehensive Biometric Acceptance Test Suite (InsightFace ArcFace)
========================================================================
Tests all critical cases defined in Steps 10, 11, and 20:
1. Exact same photo of known criminal
2. Same person, cropped
3. Same person, darkened
4. Same person, contrast adjusted
5. Completely different person A
6. Completely different person B
7. Blank / No face image
8. Multi-face image
9. Invalid / corrupted image file
"""

import sys
import os
import io
import json
import requests
import urllib.request
import numpy as np
from PIL import Image, ImageEnhance

API_BASE = "http://127.0.0.1:8000/api/v1"
TEST_RESULTS = []

def get_auth_token():
    resp = requests.post(
        f"{API_BASE}/auth/login",
        json={"badgeNumber": "8829-JD", "password": "DeptJusticeSecure#2024"},
        timeout=10,
    )
    if resp.status_code == 200:
        return resp.json().get("access_token")
    raise RuntimeError(f"Login failed: {resp.status_code} {resp.text}")

def search_photo(image_bytes: bytes, token: str, filename="search.jpg"):
    files = {"image": (filename, image_bytes, "image/jpeg")}
    headers = {"Authorization": f"Bearer {token}"}
    resp = requests.post(f"{API_BASE}/search/photo", files=files, headers=headers, timeout=30)
    return resp

def record_test(name, expected_outcome, actual_status, actual_body, passed, notes=""):
    TEST_RESULTS.append({
        "name": name,
        "expected": expected_outcome,
        "status_code": actual_status,
        "passed": passed,
        "notes": notes,
    })
    mark = "PASS" if passed else "FAIL"
    print(f"\n  [{mark}] {name}")
    print(f"         Expected: {expected_outcome}")
    print(f"         HTTP:     {actual_status}")
    if isinstance(actual_body, dict):
        if "results" in actual_body:
            print(f"         Total Matches: {actual_body.get('total')}")
            for m in actual_body.get("results", []):
                print(f"         -> Matched: {m.get('name')} (ID: {m.get('criminal_id')}) | Sim: {m.get('similarityScore')}% | Dist: {m.get('distance')}")
        if "error_code" in actual_body:
            print(f"         Error Code: {actual_body.get('error_code')} - {actual_body.get('message')}")
    if notes:
        print(f"         Notes:    {notes}")


def run_all_tests():
    print("\n" + "=" * 70)
    print("  CRMS BIOMETRIC RECOGNITION ACCEPTANCE TEST SUITE (InsightFace ArcFace)")
    print("=" * 70)

    token = get_auth_token()
    print("[*] Authenticated as Senior Inspector (Badge 8829-JD)")

    # 1. Download base criminal photo (CR-001245 - Raj Kumar Sharma)
    url_base = "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&q=80&w=256"
    req = urllib.request.Request(url_base, headers={"User-Agent": "CRMS-Test/2.0"})
    with urllib.request.urlopen(req, timeout=10) as r:
        base_img_bytes = r.read()

    base_pil = Image.open(io.BytesIO(base_img_bytes)).convert("RGB")

    # --- TEST 1: Exact Same Photo ---
    resp = search_photo(base_img_bytes, token)
    body = resp.json()
    passed = (
        resp.status_code == 200
        and body.get("success") is True
        and body.get("total") == 1
        and body["results"][0]["criminal_id"] == "CR-001245"
        and body["results"][0]["similarityScore"] >= 95.0
    )
    record_test("1. Exact Stored Photo (CR-001245)", "Match CR-001245 with Sim >= 95%", resp.status_code, body, passed)

    # --- TEST 2: Same Person (Cropped) ---
    w, h = base_pil.size
    crop_pil = base_pil.crop((int(w*0.08), int(h*0.08), int(w*0.92), int(h*0.92)))
    buf = io.BytesIO()
    crop_pil.save(buf, format="JPEG")
    crop_bytes = buf.getvalue()

    resp = search_photo(crop_bytes, token)
    body = resp.json()
    passed = (
        resp.status_code == 200
        and body.get("success") is True
        and body.get("total") == 1
        and body["results"][0]["criminal_id"] == "CR-001245"
        and body["results"][0]["similarityScore"] >= 80.0
    )
    record_test("2. Same Person (Cropped)", "Match CR-001245 with Sim >= 80%", resp.status_code, body, passed)

    # --- TEST 3: Same Person (Darkened Lighting) ---
    dark_pil = ImageEnhance.Brightness(base_pil).enhance(0.65)
    buf = io.BytesIO()
    dark_pil.save(buf, format="JPEG")
    dark_bytes = buf.getvalue()

    resp = search_photo(dark_bytes, token)
    body = resp.json()
    passed = (
        resp.status_code == 200
        and body.get("success") is True
        and body.get("total") == 1
        and body["results"][0]["criminal_id"] == "CR-001245"
        and body["results"][0]["similarityScore"] >= 80.0
    )
    record_test("3. Same Person (Darkened Lighting)", "Match CR-001245 with Sim >= 80%", resp.status_code, body, passed)

    # --- TEST 4: Same Person (High Contrast) ---
    contrast_pil = ImageEnhance.Contrast(base_pil).enhance(1.4)
    buf = io.BytesIO()
    contrast_pil.save(buf, format="JPEG")
    contrast_bytes = buf.getvalue()

    resp = search_photo(contrast_bytes, token)
    body = resp.json()
    passed = (
        resp.status_code == 200
        and body.get("success") is True
        and body.get("total") == 1
        and body["results"][0]["criminal_id"] == "CR-001245"
        and body["results"][0]["similarityScore"] >= 80.0
    )
    record_test("4. Same Person (Contrast Adjusted)", "Match CR-001245 with Sim >= 80%", resp.status_code, body, passed)

    # --- TEST 5: Different Person A ---
    url_diff1 = "https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&q=80&w=256"
    req_d1 = urllib.request.Request(url_diff1, headers={"User-Agent": "CRMS-Test/2.0"})
    with urllib.request.urlopen(req_d1, timeout=10) as r:
        diff1_bytes = r.read()

    resp = search_photo(diff1_bytes, token)
    body = resp.json()
    passed = (
        resp.status_code == 200
        and body.get("success") is True
        and body.get("total") == 0
        and len(body.get("results", [])) == 0
    )
    record_test("5. Different Person A (Unrelated)", "0 Matches (No Results Found)", resp.status_code, body, passed)

    # --- TEST 6: Different Person B ---
    url_diff2 = "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&q=80&w=256"
    req_d2 = urllib.request.Request(url_diff2, headers={"User-Agent": "CRMS-Test/2.0"})
    with urllib.request.urlopen(req_d2, timeout=10) as r:
        diff2_bytes = r.read()

    resp = search_photo(diff2_bytes, token)
    body = resp.json()
    passed = (
        resp.status_code == 200
        and body.get("success") is True
        and body.get("total") == 0
        and len(body.get("results", [])) == 0
    )
    record_test("6. Different Person B (Unrelated)", "0 Matches (No Results Found)", resp.status_code, body, passed)

    # --- TEST 7: Blank / No Face Image ---
    blank_pil = Image.new("RGB", (256, 256), color=(210, 210, 210))
    buf = io.BytesIO()
    blank_pil.save(buf, format="JPEG")
    blank_bytes = buf.getvalue()

    resp = search_photo(blank_bytes, token)
    body = resp.json()
    passed = (
        resp.status_code == 400
        and body.get("success") is False
        and body.get("error_code") == "NO_FACE_DETECTED"
    )
    record_test("7. Blank Image (No Face)", "400 Bad Request + NO_FACE_DETECTED", resp.status_code, body, passed)

    # --- TEST 8: Multi-Face Image ---
    multi_pil = Image.new("RGB", (512, 256))
    multi_pil.paste(base_pil.resize((256, 256)), (0, 0))
    diff_pil = Image.open(io.BytesIO(diff1_bytes)).convert("RGB").resize((256, 256))
    multi_pil.paste(diff_pil, (256, 0))
    buf = io.BytesIO()
    multi_pil.save(buf, format="JPEG")
    multi_bytes = buf.getvalue()

    resp = search_photo(multi_bytes, token)
    body = resp.json()
    passed = (
        resp.status_code == 400
        and body.get("success") is False
        and body.get("error_code") == "MULTIPLE_FACES"
    )
    record_test("8. Multi-Face Collage (2 Faces)", "400 Bad Request + MULTIPLE_FACES", resp.status_code, body, passed)

    # --- TEST 9: Invalid / Text file ---
    invalid_bytes = b"This is plain text and not a JPEG or PNG image."
    files = {"image": ("document.txt", invalid_bytes, "text/plain")}
    headers = {"Authorization": f"Bearer {token}"}
    resp = requests.post(f"{API_BASE}/search/photo", files=files, headers=headers, timeout=10)
    body = resp.json()
    passed = (
        resp.status_code == 400
        and body.get("success") is False
        and ("INVALID" in body.get("error_code", "") or "IMAGE" in body.get("error_code", ""))
    )
    record_test("9. Invalid File (Plain Text)", "400 Bad Request + INVALID_IMAGE", resp.status_code, body, passed)

    # --- SUMMARY REPORT ---
    print("\n" + "=" * 70)
    print("  FINAL ACCEPTANCE SUMMARY REPORT")
    print("=" * 70)
    total = len(TEST_RESULTS)
    passed_count = sum(1 for t in TEST_RESULTS if t["passed"])
    failed_count = total - passed_count

    for idx, t in enumerate(TEST_RESULTS, 1):
        status_str = "PASS" if t["passed"] else "FAIL"
        print(f"  [{status_str}] Test {idx}: {t['name']}")

    print("-" * 70)
    print(f"  Total: {total} | Passed: {passed_count} | Failed: {failed_count} | Success Rate: {passed_count/total*100:.1f}%")
    print("=" * 70 + "\n")
    return passed_count == total


if __name__ == "__main__":
    success = run_all_tests()
    sys.exit(0 if success else 1)
