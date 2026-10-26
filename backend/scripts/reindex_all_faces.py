"""
NETRA AI Biometric Face Index Rebuild Utility
=============================================
Usage:
    python backend/scripts/reindex_all_faces.py

Re-indexes facial biometric templates across all criminal records.
Generates reindex_report.json with itemized successes, warnings, and failures.
"""

import sys
import os
import json
import time

# Ensure backend directory is in path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

import app.db.base
from app.db.session import SessionLocal
from app.services.face_recognition import face_recognition_service

def main():
    print("=" * 60)
    print("  NETRA AI BIOMETRIC FACE RE-INDEXING UTILITY")
    print("=" * 60)
    
    t0 = time.time()
    db = SessionLocal()
    
    try:
        print("\n[1/3] Initializing Face Recognition Engine...")
        face_recognition_service.initialize()
        status = face_recognition_service.get_status(db=db)
        print(f"      Model: {status['model_version']}")
        print(f"      Execution Provider: {status['execution_providers']}")
        print(f"      Current Indexed Templates: {status['indexed_templates_count']}")

        print("\n[2/3] Processing Criminal Reference Photos...")
        report = face_recognition_service.rebuild_all_templates(db=db)
        
        print("\n[3/3] Re-indexing Summary:")
        print(f"      Total Photo Records: {report['total_records']}")
        print(f"      Processed:           {report['processed']}")
        print(f"      Successful:          {report['successful']}")
        print(f"      Failed:              {report['failed']}")
        
        if report["failures"]:
            print("\n      Failures Breakdown:")
            for f in report["failures"]:
                print(f"        - Criminal: {f.get('criminal_id')}, Photo: {f.get('photo_id')}, Reason: {f.get('reason')}")

        elapsed = time.time() - t0
        report["elapsed_seconds"] = round(elapsed, 2)

        # Save to reindex_report.json
        report_path = "reindex_report.json"
        with open(report_path, "w") as f:
            json.dump(report, f, indent=2)
        print(f"\nReport written to {report_path} (elapsed {elapsed:.2f}s)")
        print("\nDone.")
    finally:
        db.close()

if __name__ == "__main__":
    main()
