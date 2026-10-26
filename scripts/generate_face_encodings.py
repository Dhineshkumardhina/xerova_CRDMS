"""
Criminal Face Encoding Regeneration & Migration Utility
=======================================================
Usage:
    python scripts/generate_face_encodings.py
"""

import sys
from pathlib import Path

# Add project root and backend directory to sys.path
project_root = Path(__file__).resolve().parent.parent
backend_dir = project_root / "backend"

for p in [str(project_root), str(backend_dir)]:
    if p not in sys.path:
        sys.path.insert(0, p)

from backend.scripts.generate_face_encodings import run_migration

if __name__ == "__main__":
    run_migration()
