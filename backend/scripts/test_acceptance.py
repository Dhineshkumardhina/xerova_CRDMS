"""
End-to-end face search acceptance tests.
Tests all required scenarios without using fake data.
"""
import sys, os, requests, io, json
_SCRIPTS_DIR = os.path.dirname(os.path.abspath(__file__))
_BACKEND_DIR = os.path.abspath(os.path.join(_SCRIPTS_DIR, '..'))
_PROJECT_ROOT = os.path.abspath(os.path.join(_BACKEND_DIR, '..'))
sys.path.insert(0, _BACKEND_DIR)
os.chdir(_PROJECT_ROOT)

import urllib.request
from PIL import Image, ImageDraw
import numpy as np

API_BASE = "http://127.0.0.1:8000/api/v1"
RESULTS = []

def get_auth_token():
    """Get a real auth token from the backend."""
    resp = requests.post(
        f"{API_BASE}/auth/login",
        json={"badgeNumber": "8829-JD", "password": "DeptJusticeSecure#2024"}
    )
    if resp.status_code == 200:
        return resp.json().get("access_token")
    raise RuntimeError(f"Login failed: {resp.status_code} {resp.text}")

def search_with_bytes(image_bytes: bytes, token: str, label: str) -> dict:
    """Send image bytes as multipart/form-data to the face search endpoint."""
    files = {"image": ("test.jpg", image_bytes, "image/jpeg")}
    headers = {"Authorization": f"Bearer {token}"}
    resp = requests.post(
        f"{API_BASE}/search/photo",
        files=files,
        headers=headers,
        timeout=30
    )
    result = {
        "label": label,
        "status_code": resp.status_code,
        "body": resp.json() if resp.headers.get("content-type","").startswith("application/json") else resp.text
    }
    return result

def print_result(r: dict, expected_state: str):
    body = r["body"]
    status = r["status_code"]
    
    if isinstance(body, dict):
        success = body.get("success", False)
        error_code = body.get("error_code", "")
        total = body.get("total", 0)
        results = body.get("results", [])
        
        if expected_state == "RESULTS":
            passed = success and total > 0 and len(results) > 0
        elif expected_state == "NO_RESULTS":
            passed = success and total == 0 and len(results) == 0
        elif expected_state == "NO_FACE":
            passed = not success and error_code == "NO_FACE_DETECTED"
        elif expected_state == "MULTIPLE_FACES":
            passed = not success and error_code == "MULTIPLE_FACES"
        elif expected_state == "INVALID":
            passed = not success and "INVALID" in error_code
        else:
            passed = False
    else:
        passed = False
    
    icon = "✓ PASS" if passed else "✗ FAIL"
    print(f"\n  [{icon}] {r['label']}")
    print(f"          Expected: {expected_state}")
    print(f"          HTTP: {status}, success={body.get('success') if isinstance(body,dict) else 'N/A'}")
    if isinstance(body, dict):
        if "error_code" in body:
            print(f"          error_code: {body['error_code']}")
        if "total" in body:
            print(f"          total: {body['total']}")
        if body.get("results"):
            for m in body["results"]:
                print(f"          match: {m.get('name')} ({m.get('confidence')}%)")
    
    RESULTS.append({"label": r["label"], "expected": expected_state, "passed": passed})


def create_blank_image(width=200, height=200) -> bytes:
    """Create a solid color image with no face."""
    img = Image.new("RGB", (width, height), color=(200, 180, 160))
    buf = io.BytesIO()
    img.save(buf, format="JPEG")
    return buf.getvalue()


def create_multi_face_image() -> bytes:
    """
    Create an image with two distinct oval face-like regions that
    YuNet should detect as multiple faces.
    We'll use a real photo collage approach — download 2 face images side by side.
    """
    # Download one face image
    try:
        req = urllib.request.Request(
            "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&h=200&fit=crop",
            headers={"User-Agent": "CRMS-Test/1.0"}
        )
        with urllib.request.urlopen(req, timeout=8) as r:
            face1 = Image.open(io.BytesIO(r.read())).convert("RGB").resize((150, 200))
        
        # Second person
        req2 = urllib.request.Request(
            "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150&h=200&fit=crop",
            headers={"User-Agent": "CRMS-Test/1.0"}
        )
        with urllib.request.urlopen(req2, timeout=8) as r:
            face2 = Image.open(io.BytesIO(r.read())).convert("RGB").resize((150, 200))
        
        # Stitch side by side
        combined = Image.new("RGB", (300, 200))
        combined.paste(face1, (0, 0))
        combined.paste(face2, (150, 0))
        buf = io.BytesIO()
        combined.save(buf, format="JPEG")
        return buf.getvalue()
    except Exception:
        # Fallback: just return a simple image (multi-face test may not work perfectly)
        img = Image.new("RGB", (300, 200), color=(128, 128, 128))
        buf = io.BytesIO()
        img.save(buf, format="JPEG")
        return buf.getvalue()


def main():
    print("\n" + "=" * 60)
    print("  CRMS PHOTO SEARCH — END-TO-END ACCEPTANCE TESTS")
    print("=" * 60)

    try:
        print("\n[*] Getting auth token...")
        token = get_auth_token()
        print(f"    Token obtained: {token[:20]}...")
    except Exception as e:
        print(f"    FATAL: Cannot get auth token: {e}")
        sys.exit(1)

    # ── TEST 1: Upload the stored criminal's own photo → expect RESULTS ──────────
    print("\n[TEST 1] Uploading stored criminal's own photo...")
    try:
        req = urllib.request.Request(
            "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&q=80&w=256",
            headers={"User-Agent": "CRMS-Test/1.0"}
        )
        with urllib.request.urlopen(req, timeout=10) as r:
            criminal_photo_bytes = r.read()
        print(f"    Downloaded criminal photo: {len(criminal_photo_bytes)} bytes")
        r = search_with_bytes(criminal_photo_bytes, token, "Stored criminal's own photo")
        print_result(r, "RESULTS")
    except Exception as e:
        print(f"    ERROR: {e}")
        RESULTS.append({"label": "Stored criminal's own photo", "expected": "RESULTS", "passed": False})

    # ── TEST 2: No-face image → expect NO_FACE_DETECTED ─────────────────────────
    print("\n[TEST 2] Uploading blank image (no face)...")
    blank_bytes = create_blank_image()
    r = search_with_bytes(blank_bytes, token, "Blank image (no face)")
    print_result(r, "NO_FACE")

    # ── TEST 3: Completely different person → expect NO_RESULTS ─────────────────
    print("\n[TEST 3] Uploading different person's photo...")
    try:
        req = urllib.request.Request(
            "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=256&h=256&fit=crop",
            headers={"User-Agent": "CRMS-Test/1.0"}
        )
        with urllib.request.urlopen(req, timeout=10) as r2:
            diff_bytes = r2.read()
        print(f"    Downloaded different person photo: {len(diff_bytes)} bytes")
        r = search_with_bytes(diff_bytes, token, "Different person (no match expected)")
        print_result(r, "NO_RESULTS")
    except Exception as e:
        print(f"    WARNING: Could not download different person photo: {e}")
        RESULTS.append({"label": "Different person (no match expected)", "expected": "NO_RESULTS", "passed": None})

    # ── TEST 4: Multi-face image → expect MULTIPLE_FACES ────────────────────────
    print("\n[TEST 4] Uploading multi-face image...")
    multi_bytes = create_multi_face_image()
    r = search_with_bytes(multi_bytes, token, "Multi-face image")
    print_result(r, "MULTIPLE_FACES")

    # ── TEST 5: Invalid file (text file as image) → expect INVALID ──────────────
    print("\n[TEST 5] Uploading invalid file (text content)...")
    fake_image_bytes = b"This is not an image file. Just plain text."
    headers = {"Authorization": f"Bearer {token}"}
    files = {"image": ("test.txt", fake_image_bytes, "text/plain")}
    resp = requests.post(f"{API_BASE}/search/photo", files=files, headers=headers, timeout=10)
    result = {"label": "Invalid file (text)", "status_code": resp.status_code, "body": resp.json()}
    print_result(result, "INVALID")

    # ── Summary ──────────────────────────────────────────────────────────────────
    print("\n" + "=" * 60)
    print("  TEST RESULTS SUMMARY")
    print("=" * 60)
    passed = sum(1 for r in RESULTS if r.get("passed") is True)
    failed = sum(1 for r in RESULTS if r.get("passed") is False)
    skipped = sum(1 for r in RESULTS if r.get("passed") is None)
    total = len(RESULTS)

    for r in RESULTS:
        p = r.get("passed")
        icon = "PASS" if p is True else ("SKIP" if p is None else "FAIL")
        print(f"  [{icon}] {r['label']} (expected: {r['expected']})")

    print(f"\n  Total: {total} | Passed: {passed} | Failed: {failed} | Skipped: {skipped}")
    print("=" * 60)

if __name__ == "__main__":
    main()

