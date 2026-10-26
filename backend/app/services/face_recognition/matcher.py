"""
Biometric Matching Engine Module
================================
Implements Euclidean face distance comparison, tolerance thresholding,
and candidate ranking using the ageitgey/face_recognition pipeline.
"""

import sys
from pathlib import Path

# Ensure backend directory is in sys.path when running standalone
_backend_dir = str(Path(__file__).resolve().parents[3])
if _backend_dir not in sys.path:
    sys.path.insert(0, _backend_dir)

import logging
import numpy as np
from typing import List, Dict, Any, Optional, Tuple
from dataclasses import dataclass

import face_recognition

from app.services.face_recognition.config import config

logger = logging.getLogger("face_recognition.matcher")

@dataclass
class MatchCandidate:
    criminal_id: str
    photo_id: Optional[str]
    similarity: float       # Calibrated percentage (0.0 to 100.0%)
    distance: float         # Euclidean face distance (0.0 to ~1.4, where <= 0.6 is a match)
    confidence: str         # "HIGH", "MEDIUM", "LOW"
    match_status: str       # "Potential Match" or "No Match"
    is_above_threshold: bool
    photo_url: Optional[str] = None
    criminal_name: Optional[str] = None
    tolerance: float = 0.6

class BiometricMatcher:
    """Performs 1-to-N distance calculation and candidate selection using dlib / face_recognition."""

    @staticmethod
    def compute_distance(vec1: List[float], vec2: List[float]) -> float:
        """
        Calculates the Euclidean distance between two 128-D face encodings.
        Lower values indicate higher similarity. Matches are typically <= 0.6.
        """
        if not vec1 or not vec2 or len(vec1) != len(vec2):
            return 1.414
        v1 = np.array(vec1, dtype=np.float64)
        v2 = np.array(vec2, dtype=np.float64)
        dist = float(np.linalg.norm(v1 - v2))
        return round(dist, 4)

    @staticmethod
    def distance_to_similarity_percentage(distance: float, tolerance: float = 0.6) -> float:
        """
        Translates Euclidean face distance into an intuitive 0–100% confidence scale
        without fabricating unscientific numbers:
          - distance == 0.00 -> 100.0%
          - distance == 0.40 -> 80.0%
          - distance == 0.60 -> 70.0% (threshold boundary)
          - distance >= 1.00 -> 0.0%
        """
        d = float(max(0.0, distance))
        if d <= 0.60:
            pct = 100.0 - (d / 0.60) * 30.0
        elif d <= 1.00:
            pct = 70.0 - ((d - 0.60) / 0.40) * 70.0
        else:
            pct = 0.0
        return round(float(max(0.0, min(100.0, pct))), 2)

    @classmethod
    def compute_cosine_similarity(cls, vec1: List[float], vec2: List[float]) -> float:
        """Compatibility wrapper: converts Euclidean distance to percentage score."""
        dist = cls.compute_distance(vec1, vec2)
        return cls.distance_to_similarity_percentage(dist, tolerance=config.DEFAULT_TOLERANCE)

    @classmethod
    def compute_cosine_distance(cls, vec1: List[float], vec2: List[float]) -> float:
        """Compatibility wrapper: returns Euclidean face distance."""
        return cls.compute_distance(vec1, vec2)

    @classmethod
    def classify_confidence(cls, distance: float, tolerance: float) -> str:
        """Categorizes Euclidean distance into confidence tier."""
        if distance <= config.HIGH_CONFIDENCE_TOLERANCE:
            return "HIGH"
        elif distance <= tolerance:
            return "MEDIUM"
        else:
            return "LOW"

    @classmethod
    def search_against_templates(
        cls,
        query_vector: List[float],
        stored_records: List[Dict[str, Any]],
        threshold: Optional[float] = None,
        max_results: int = 5
    ) -> Tuple[List[MatchCandidate], Optional[Dict[str, Any]], int]:
        """
        Vectorized 1-to-N face distance comparison across all stored criminal encodings.
        Uses face_recognition.face_distance to rank candidates by smallest distance.
        Aggregates multiple photos per criminal by choosing the minimum distance photo.
        """
        # Tolerance: lower is stricter, default 0.60
        applied_tolerance = threshold if threshold is not None else config.DEFAULT_TOLERANCE
        # Guard against legacy callers passing percentage thresholds (e.g. 75.0%)
        if applied_tolerance > 2.0:
            # Map legacy percentage to tolerance (e.g. 75% -> 0.60)
            applied_tolerance = 0.60

        if not stored_records or not query_vector:
            return [], None, 0

        q_vec = np.array(query_vector, dtype=np.float64)

        valid_records: List[Dict[str, Any]] = []
        valid_vectors: List[List[float]] = []
        skipped_count = 0

        for rec in stored_records:
            vec = rec.get("vector")
            if vec and len(vec) == len(query_vector):
                valid_records.append(rec)
                valid_vectors.append(vec)
            else:
                skipped_count += 1

        if not valid_vectors:
            return [], None, skipped_count

        # Compute Euclidean face distances for all stored encodings in a single vectorized operation
        known_encodings_array = np.array(valid_vectors, dtype=np.float64)
        distances = face_recognition.face_distance(known_encodings_array, q_vec)

        # Global best candidate tracking (smallest distance)
        best_overall_idx = int(np.argmin(distances))
        best_overall_dist = float(distances[best_overall_idx])
        best_rec = valid_records[best_overall_idx]

        nearest_candidate_info: Optional[Dict[str, Any]] = {
            "criminal_id": best_rec.get("criminal_id"),
            "name": best_rec.get("name"),
            "distance": round(best_overall_dist, 4),
            "similarity": cls.distance_to_similarity_percentage(best_overall_dist, applied_tolerance),
            "photo_id": best_rec.get("photo_id"),
            "tolerance": applied_tolerance,
            "is_match": bool(best_overall_dist <= applied_tolerance)
        }

        # Multi-photo aggregation per criminal: select smallest distance photo per criminal
        criminal_best_match: Dict[str, MatchCandidate] = {}

        for idx, rec in enumerate(valid_records):
            dist = float(distances[idx])
            cid = rec["criminal_id"]
            is_match = bool(dist <= applied_tolerance)
            confidence = cls.classify_confidence(dist, applied_tolerance)
            similarity = cls.distance_to_similarity_percentage(dist, applied_tolerance)

            candidate = MatchCandidate(
                criminal_id=cid,
                photo_id=rec.get("photo_id"),
                similarity=similarity,
                distance=round(dist, 4),
                confidence=confidence,
                match_status="Potential Match" if is_match else "No Match",
                is_above_threshold=is_match,
                photo_url=rec.get("photo_url"),
                criminal_name=rec.get("name"),
                tolerance=applied_tolerance
            )

            if cid not in criminal_best_match or dist < criminal_best_match[cid].distance:
                criminal_best_match[cid] = candidate

        # Collect only candidates passing the tolerance threshold
        passed_matches = [
            cand for cand in criminal_best_match.values()
            if cand.is_above_threshold
        ]

        # Sort by smallest face distance first (best match at index 0)
        passed_matches.sort(key=lambda c: c.distance)
        top_matches = passed_matches[:max_results]

        return top_matches, nearest_candidate_info, skipped_count

matcher = BiometricMatcher()


if __name__ == "__main__":
    print("=" * 70)
    print("  NETRA AI Biometrics -- Biometric Matcher (face_recognition / dlib)")
    print("=" * 70)

    # 1. Test identical vectors
    v1 = np.random.randn(128).tolist()
    d_same = matcher.compute_distance(v1, v1)
    sim_same = matcher.compute_cosine_similarity(v1, v1)
    print(f"[+] Identical vectors: distance = {d_same:.4f} (expected: 0.0), similarity = {sim_same:.1f}%")
    assert d_same == 0.0, "Identical vectors distance check failed"
    assert sim_same == 100.0, "Identical vectors similarity check failed"

    # 2. Test orthogonal / distant vectors
    v2 = (-np.array(v1)).tolist()
    d_diff = matcher.compute_distance(v1, v2)
    print(f"[+] Opposite vectors:  distance = {d_diff:.4f} (expected > 1.0)")
    assert d_diff > 1.0, "Opposite vectors distance check failed"

    # 3. Test 1-to-N search candidate ranking
    mock_db = [
        {"criminal_id": "CR-001", "photo_id": "P1", "vector": v1},
        {"criminal_id": "CR-002", "photo_id": "P2", "vector": (np.array(v1) + 0.1).tolist()},
        {"criminal_id": "CR-003", "photo_id": "P3", "vector": v2},
    ]

    top_matches, nearest, skipped = matcher.search_against_templates(
        query_vector=v1,
        stored_records=mock_db,
        threshold=0.6,
        max_results=5
    )

    print(f"[+] Search executed: {len(top_matches)} match(es) returned, nearest = {nearest['criminal_id']}")
    assert len(top_matches) >= 1, "Expected at least 1 match"
    assert top_matches[0].criminal_id == "CR-001", "Rank #1 should be exact match CR-001"
    assert top_matches[0].distance == 0.0, "Distance should be 0.0"

    print("=" * 70)
    print("  STATUS: ALL MATCHER TESTS PASSED SUCCESSFULLY (100%)")
    print("=" * 70)
