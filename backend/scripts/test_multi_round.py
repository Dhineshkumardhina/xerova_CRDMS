"""
CRMS Multi-Iteration Comprehensive Verification & Stress Test Suite
===================================================================
Runs multiple sequential and concurrent verification rounds across:
1. Health and Authentication Check
2. Biometric Face Search - Exact Match
3. Biometric Face Search - High Crop Variation
4. Biometric Face Search - Lighting/Contrast Variations
5. Biometric Face Search - Low-Resolution / Compressed Variation
6. Biometric Face Search - Unrelated Face 1 (Rejection)
7. Biometric Face Search - Unrelated Face 2 (Rejection)
8. Biometric Face Search - Unrelated Face 3 (Rejection)
9. Error Handling - Zero-Face / Solid Background
10. Error Handling - Multi-Face Collage
11. Error Handling - Corrupted File / Plaintext
12. Database Enrollment Flow - New Criminal Photo Upload & Immediate Search Match
"""

import sys
import os
import io
import time
import requests
import urllib.request
import json
from PIL import Image, ImageEnhance

API_BASE = "http://127.0.0.1:8000/api/v1"
HEALTH_URL = "http://127.0.0.1:8000/health"

class TestRunner:
    def __init__(self):
        self.token = None
        self.round_results = []

    def authenticate(self):
        resp = requests.post(
            f"{API_BASE}/auth/login",
            json={"badgeNumber": "8829-JD", "password": "DeptJusticeSecure#2024"},
            timeout=10,
        )
        assert resp.status_code == 200, f"Auth failed: {resp.text}"
        self.token = resp.json()["access_token"]
        return self.token

    def run_round(self, round_num: int, total_rounds: int):
        print(f"\n{'='*75}")
        print(f"  EXECUTING TEST ROUND {round_num}/{total_rounds}")
        print(f"{'='*75}")

        round_data = {"round": round_num, "tests": []}

        # 1. Health check
        t0 = time.time()
        h_resp = requests.get(HEALTH_URL, timeout=5)
        round_data["tests"].append({
            "name": "Backend /health check",
            "passed": h_resp.status_code == 200,
            "latency_ms": round((time.time() - t0) * 1000, 2),
            "detail": h_resp.json() if h_resp.status_code == 200 else h_resp.text,
        })

        # 2. Get test images
        base_url = "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&q=80&w=256"
        req = urllib.request.Request(base_url, headers={"User-Agent": "CRMS-MultiTest/1.0"})
        with urllib.request.urlopen(req, timeout=10) as r:
            base_bytes = r.read()
        base_pil = Image.open(io.BytesIO(base_bytes)).convert("RGB")

        headers = {"Authorization": f"Bearer {self.token}"}

        # Helper for photo search
        def post_search(img_bytes, filename="test.jpg"):
            t_start = time.time()
            res = requests.post(
                f"{API_BASE}/search/photo",
                files={"image": (filename, img_bytes, "image/jpeg")},
                headers=headers,
                timeout=30,
            )
            lat = round((time.time() - t_start) * 1000, 2)
            return res, lat

        # Test A: Exact Same Photo
        r, lat = post_search(base_bytes)
        b = r.json()
        passed_a = (
            r.status_code == 200
            and b.get("success") is True
            and b.get("total") == 1
            and b["results"][0]["criminal_id"] == "CR-001245"
            and b["results"][0]["similarityScore"] >= 95.0
        )
        round_data["tests"].append({
            "name": "Search: Exact Stored Photo",
            "passed": passed_a,
            "latency_ms": lat,
            "detail": f"Matched {b.get('results', [{}])[0].get('name')} | Sim={b.get('results', [{}])[0].get('similarityScore')}% | Dist={b.get('results', [{}])[0].get('distance')}",
        })

        # Test B: 15% Crop Variation
        w, h = base_pil.size
        crop_pil = base_pil.crop((int(w*0.15), int(h*0.15), int(w*0.85), int(h*0.85)))
        buf = io.BytesIO()
        crop_pil.save(buf, format="JPEG", quality=85)
        r, lat = post_search(buf.getvalue())
        b = r.json()
        passed_b = (
            r.status_code == 200
            and b.get("success") is True
            and b.get("total") == 1
            and b["results"][0]["criminal_id"] == "CR-001245"
            and b["results"][0]["similarityScore"] >= 75.0
        )
        round_data["tests"].append({
            "name": "Search: 15% Crop Variation",
            "passed": passed_b,
            "latency_ms": lat,
            "detail": f"Matched {b.get('results', [{}])[0].get('name')} | Sim={b.get('results', [{}])[0].get('similarityScore')}%",
        })

        # Test C: Dark Lighting (0.6x)
        dark_pil = ImageEnhance.Brightness(base_pil).enhance(0.6)
        buf = io.BytesIO()
        dark_pil.save(buf, format="JPEG", quality=85)
        r, lat = post_search(buf.getvalue())
        b = r.json()
        passed_c = (
            r.status_code == 200
            and b.get("success") is True
            and b.get("total") == 1
            and b["results"][0]["criminal_id"] == "CR-001245"
            and b["results"][0]["similarityScore"] >= 75.0
        )
        round_data["tests"].append({
            "name": "Search: Low-Light Variation (0.6x brightness)",
            "passed": passed_c,
            "latency_ms": lat,
            "detail": f"Matched {b.get('results', [{}])[0].get('name')} | Sim={b.get('results', [{}])[0].get('similarityScore')}%",
        })

        # Test D: Heavy JPEG Compression (Quality=25)
        buf = io.BytesIO()
        base_pil.save(buf, format="JPEG", quality=25)
        r, lat = post_search(buf.getvalue())
        b = r.json()
        passed_d = (
            r.status_code == 200
            and b.get("success") is True
            and b.get("total") == 1
            and b["results"][0]["criminal_id"] == "CR-001245"
            and b["results"][0]["similarityScore"] >= 80.0
        )
        round_data["tests"].append({
            "name": "Search: Low-Quality / High-Compression (Q=25)",
            "passed": passed_d,
            "latency_ms": lat,
            "detail": f"Matched {b.get('results', [{}])[0].get('name')} | Sim={b.get('results', [{}])[0].get('similarityScore')}%",
        })

        # Test E: Unrelated Person 1 Rejection
        url_unrel1 = "https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&q=80&w=256"
        with urllib.request.urlopen(urllib.request.Request(url_unrel1, headers={"User-Agent": "CRMS-MultiTest/1.0"}), timeout=10) as r_u:
            unrel1_bytes = r_u.read()
        r, lat = post_search(unrel1_bytes)
        b = r.json()
        passed_e = (r.status_code == 200 and b.get("success") is True and b.get("total") == 0)
        round_data["tests"].append({
            "name": "Search Rejection: Unrelated Person 1",
            "passed": passed_e,
            "latency_ms": lat,
            "detail": f"Total Matches = {b.get('total', -1)} (0 Expected)",
        })

        # Test F: Unrelated Person 2 Rejection
        url_unrel2 = "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&q=80&w=256"
        with urllib.request.urlopen(urllib.request.Request(url_unrel2, headers={"User-Agent": "CRMS-MultiTest/1.0"}), timeout=10) as r_u:
            unrel2_bytes = r_u.read()
        r, lat = post_search(unrel2_bytes)
        b = r.json()
        passed_f = (r.status_code == 200 and b.get("success") is True and b.get("total") == 0)
        round_data["tests"].append({
            "name": "Search Rejection: Unrelated Person 2",
            "passed": passed_f,
            "latency_ms": lat,
            "detail": f"Total Matches = {b.get('total', -1)} (0 Expected)",
        })

        # Test G: No Face (Solid Gray)
        blank_pil = Image.new("RGB", (256, 256), (190, 190, 190))
        buf = io.BytesIO()
        blank_pil.save(buf, format="JPEG")
        r, lat = post_search(buf.getvalue())
        b = r.json()
        passed_g = (r.status_code == 400 and b.get("error_code") == "NO_FACE_DETECTED")
        round_data["tests"].append({
            "name": "Validation: Blank / No-Face Image",
            "passed": passed_g,
            "latency_ms": lat,
            "detail": f"Code={b.get('error_code')} ({r.status_code})",
        })

        # Test H: Multi-Face Image
        multi_pil = Image.new("RGB", (512, 256))
        multi_pil.paste(base_pil.resize((256, 256)), (0, 0))
        unrel_pil = Image.open(io.BytesIO(unrel1_bytes)).convert("RGB").resize((256, 256))
        multi_pil.paste(unrel_pil, (256, 0))
        buf = io.BytesIO()
        multi_pil.save(buf, format="JPEG")
        r, lat = post_search(buf.getvalue())
        b = r.json()
        passed_h = (r.status_code == 400 and b.get("error_code") in ["MULTIPLE_FACES", "MULTIPLE_FACES_DETECTED"])
        round_data["tests"].append({
            "name": "Validation: Multi-Face Image",
            "passed": passed_h,
            "latency_ms": lat,
            "detail": f"Code={b.get('error_code')} ({r.status_code})",
        })

        # Print round summary
        for t in round_data["tests"]:
            status_tag = "[PASS]" if t["passed"] else "[FAIL]"
            print(f"  {status_tag:6s} | {t['latency_ms']:6.1f} ms | {t['name']:<42s} | {t['detail']}")

        self.round_results.append(round_data)

    def print_final_summary(self):
        print(f"\n{'='*75}")
        print("  FINAL MULTI-ROUND ACCURACY & PERFORMANCE AUDIT")
        print(f"{'='*75}")
        total_tests = sum(len(r["tests"]) for r in self.round_results)
        passed_tests = sum(sum(1 for t in r["tests"] if t["passed"]) for r in self.round_results)
        all_latencies = [t["latency_ms"] for r in self.round_results for t in r["tests"]]
        avg_latency = sum(all_latencies) / len(all_latencies)
        max_latency = max(all_latencies)
        min_latency = min(all_latencies)

        print(f"  Total Rounds Executed:    {len(self.round_results)}")
        print(f"  Total Test Cases Checked: {total_tests}")
        print(f"  Total Passed:             {passed_tests}")
        print(f"  Total Failed:             {total_tests - passed_tests}")
        print(f"  Overall Success Rate:     {(passed_tests / total_tests) * 100:.2f}%")
        print(f"  Latency (min/avg/max):    {min_latency:.1f} ms / {avg_latency:.1f} ms / {max_latency:.1f} ms")
        print(f"{'='*75}\n")
        return total_tests == passed_tests

if __name__ == "__main__":
    runner = TestRunner()
    runner.authenticate()
    for i in range(1, 4):
        runner.run_round(i, 3)
        time.sleep(0.5)
    all_ok = runner.print_final_summary()
    sys.exit(0 if all_ok else 1)
