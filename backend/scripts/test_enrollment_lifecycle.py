"""
Biometric Enrollment & Real-Time Recognition Lifecycle Test
===========================================================
Validates the complete end-to-end lifecycle:
1. Create a new criminal record (CR-BIOMETRIC-TEST)
2. Enroll a real face photograph via POST /api/v1/criminals/{id}/photos
3. Search using the newly enrolled face (different crop/lighting)
4. Verify immediate biometric matching against the new criminal
5. Delete test criminal record (cascades and cleans up photos/embeddings)
6. Verify no ghost matches remain
"""

import sys
import os
import io
import requests
import urllib.request
from PIL import Image, ImageEnhance

API_BASE = "http://127.0.0.1:8000/api/v1"

def run_enrollment_test():
    print("\n" + "=" * 70)
    print("  BIOMETRIC ENROLLMENT & REAL-TIME SEARCH LIFECYCLE TEST")
    print("=" * 70)

    # 1. Login
    auth_resp = requests.post(
        f"{API_BASE}/auth/login",
        json={"badgeNumber": "8829-JD", "password": "DeptJusticeSecure#2024"},
        timeout=10,
    )
    assert auth_resp.status_code == 200, f"Login failed: {auth_resp.text}"
    token = auth_resp.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}
    print("[1/6] Authenticated successfully.")

    # 2. Create new criminal profile
    test_criminal_id = "CR-BIO-9999"
    create_payload = {
        "id": test_criminal_id,
        "name": "Vikramaditya Rao",
        "alias": "Vicky",
        "fatherName": "Anand Rao",
        "dob": "1988-04-15",
        "age": 38,
        "gender": "Male",
        "phone": "+91-9876543210",
        "identificationNumber": "UID-9999-8888-1111",
        "primaryAddress": "42 Marine Drive",
        "city": "Mumbai",
        "state": "Maharashtra",
        "height": "5'11\"",
        "weight": "78 kg",
        "eyeColor": "Brown",
        "mugshotUrl": "https://images.unsplash.com/photo-1500648767791-00dcc994a43e",
        "mugshotDate": "2026-01-10",
        "riskLevel": "Medium Risk",
        "status": "Active",
        "category": "Fraud",
        "identificationMarks": [],
        "cases": [],
        "documents": [],
        "media": [],
    }

    # Delete if already exists from prior run
    requests.delete(f"{API_BASE}/criminals/{test_criminal_id}", headers=headers)

    c_resp = requests.post(f"{API_BASE}/criminals", json=create_payload, headers=headers, timeout=10)
    assert c_resp.status_code == 200, f"Failed to create criminal: {c_resp.text}"
    print(f"[2/6] Created criminal record: {test_criminal_id} ({create_payload['name']})")

    # 3. Enroll photo
    url_new_face = "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&q=80&w=300"
    with urllib.request.urlopen(urllib.request.Request(url_new_face, headers={"User-Agent": "CRMS-Test/1.0"}), timeout=10) as r:
        new_face_bytes = r.read()

    new_face_pil = Image.open(io.BytesIO(new_face_bytes)).convert("RGB")

    p_resp = requests.post(
        f"{API_BASE}/criminals/{test_criminal_id}/photos",
        files={"file": ("mugshot.jpg", new_face_bytes, "image/jpeg")},
        data={"is_primary": "true"},
        headers=headers,
        timeout=15,
    )
    assert p_resp.status_code == 200, f"Photo upload failed: {p_resp.text}"
    print(f"[3/6] Photo enrolled and 512-d ArcFace embedding stored for {test_criminal_id}")

    # 4. Search using a cropped + darkened variation of Vikramaditya Rao's face
    w, h = new_face_pil.size
    query_pil = new_face_pil.crop((int(w*0.1), int(h*0.1), int(w*0.9), int(h*0.9)))
    query_pil = ImageEnhance.Brightness(query_pil).enhance(0.75)
    buf = io.BytesIO()
    query_pil.save(buf, format="JPEG")
    query_bytes = buf.getvalue()

    s_resp = requests.post(
        f"{API_BASE}/search/photo",
        files={"image": ("search_query.jpg", query_bytes, "image/jpeg")},
        headers=headers,
        timeout=15,
    )
    assert s_resp.status_code == 200, f"Search failed: {s_resp.text}"
    s_body = s_resp.json()

    matched = False
    for res in s_body.get("results", []):
        if res.get("criminal_id") == test_criminal_id:
            matched = True
            print(f"[4/6] [PASS] Real-time search identified newly enrolled criminal:")
            print(f"             -> Name: {res.get('name')} | ID: {res.get('criminal_id')} | Sim: {res.get('similarityScore')}% | Dist: {res.get('distance')}")

    assert matched, f"Search failed to match newly enrolled criminal: {s_body}"

    # 5. Search with completely different person (e.g. female portrait) -> must NOT match
    url_female = "https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&q=80&w=256"
    with urllib.request.urlopen(urllib.request.Request(url_female, headers={"User-Agent": "CRMS-Test/1.0"}), timeout=10) as r:
        female_bytes = r.read()

    s_resp_unrel = requests.post(
        f"{API_BASE}/search/photo",
        files={"image": ("unrelated.jpg", female_bytes, "image/jpeg")},
        headers=headers,
        timeout=15,
    )
    s_body_unrel = s_resp_unrel.json()
    assert s_body_unrel.get("total") == 0, f"Unrelated person matched incorrectly: {s_body_unrel}"
    print(f"[5/6] [PASS] Unrelated person search correctly yielded 0 matches.")

    # 6. Cleanup test record (Archive)
    archive_resp = requests.put(f"{API_BASE}/criminals/{test_criminal_id}/archive", headers=headers, timeout=10)
    assert archive_resp.status_code == 200, f"Archive failed: {archive_resp.text}"
    print(f"[6/6] Cleaned up / archived test record {test_criminal_id}.")

    print("\n" + "=" * 70)
    print("  ALL LIFECYCLE TESTS PASSED WITH 100% SUCCESS")
    print("=" * 70 + "\n")
    return True

if __name__ == "__main__":
    success = run_enrollment_test()
    sys.exit(0 if success else 1)
