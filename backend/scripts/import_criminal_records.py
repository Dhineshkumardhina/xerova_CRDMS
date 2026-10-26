"""
Production-Safe Criminal Record Migration & Import Engine for CRMS
Supports batch processing, multi-field composite duplicate detection, photo object storage,
automated biometric face vector indexing, dry-run transactional safety, and execution reporting.
"""

import sys
import os
import io
import json
import csv
import argparse
import time
import uuid
import re
from datetime import datetime, date
from typing import List, Dict, Any, Tuple, Optional

# Add backend directory to sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from sqlalchemy import or_, and_
from sqlalchemy.orm import Session
from app.db.session import engine, SessionLocal, Base
from app.db.base import (
    CriminalProfileModel,
    CriminalAliasModel,
    IdentificationMarkModel,
    CriminalPhotoModel,
    FaceEmbeddingModel,
    CaseRecordModel,
    CaseCategoryModel,
    CriminalCaseModel,
    CrimeCategoryModel,
    PoliceStationModel,
)
from app.services.storage_service import storage_service
from app.services.face_recognition import extract_face_embedding, detect_faces_in_image
from app.core.exceptions import ValidationException

def normalize_text(text: Optional[str]) -> str:
    if not text:
        return ""
    return re.sub(r'\s+', ' ', str(text).strip()).lower()

def normalize_phone(phone: Optional[str]) -> Optional[str]:
    if not phone:
        return None
    cleaned = re.sub(r'[^\d+]', '', str(phone).strip())
    return cleaned if len(cleaned) >= 7 else None

def normalize_id_number(id_num: Optional[str]) -> Optional[str]:
    if not id_num:
        return None
    cleaned = str(id_num).strip().upper()
    return cleaned if len(cleaned) >= 4 else None

def detect_duplicate(db: Session, record: Dict[str, Any]) -> Tuple[bool, str, Optional[str]]:
    """
    Multi-field composite duplicate detection.
    Matches by:
    1. Criminal ID
    2. Identification Number
    3. Phone Number
    4. Composite: Normalized Name AND Father Name
    Returns (is_duplicate, match_reason, existing_id).
    """
    record_id = record.get("id")
    id_number = normalize_id_number(record.get("identification_number") or record.get("identificationNumber"))
    phone = normalize_phone(record.get("phone_number") or record.get("phone"))
    norm_name = normalize_text(record.get("name"))
    father_name = normalize_text(record.get("father_name") or record.get("fatherName"))

    # 1. Match by ID
    if record_id:
        existing = db.query(CriminalProfileModel).filter(CriminalProfileModel.id == record_id).first()
        if existing:
            return True, f"Matched Existing Criminal ID '{record_id}'", existing.id

    # 2. Match by Identification Number
    if id_number:
        existing = db.query(CriminalProfileModel).filter(
            CriminalProfileModel.identification_number == id_number
        ).first()
        if existing:
            return True, f"Matched Identification Number '{id_number}'", existing.id

    # 3. Match by Phone Number
    if phone:
        existing = db.query(CriminalProfileModel).filter(
            CriminalProfileModel.phone_number == phone
        ).first()
        if existing:
            return True, f"Matched Phone Number '{phone}'", existing.id

    # 4. Composite Match: Normalized Name AND Father Name
    if norm_name and father_name:
        existing = db.query(CriminalProfileModel).filter(
            CriminalProfileModel.normalized_name == norm_name,
            CriminalProfileModel.father_name.ilike(father_name)
        ).first()
        if existing:
            return True, f"Matched Composite (Name: '{norm_name}' AND Father: '{father_name}')", existing.id

    return False, "", None

def validate_record(record: Dict[str, Any]) -> Tuple[bool, List[str]]:
    errors = []
    name = record.get("name")
    if not name or len(str(name).strip()) < 2:
        errors.append("Missing or invalid name (minimum 2 characters required)")
    
    age = record.get("age")
    if age is not None:
        try:
            age_int = int(age)
            if age_int < 1 or age_int > 120:
                errors.append(f"Age out of bounds (1-120): {age}")
        except ValueError:
            errors.append(f"Invalid age format: {age}")

    return len(errors) == 0, errors

def load_source_file(source_path: str) -> List[Dict[str, Any]]:
    if not os.path.exists(source_path):
        raise FileNotFoundError(f"Source file not found: {source_path}")

    ext = os.path.splitext(source_path)[1].lower()
    records = []

    if ext == ".json":
        with open(source_path, "r", encoding="utf-8") as f:
            data = json.load(f)
            if isinstance(data, list):
                records = data
            elif isinstance(data, dict) and "records" in data:
                records = data["records"]
            else:
                records = [data]
    elif ext in [".csv", ".txt"]:
        with open(source_path, "r", encoding="utf-8") as f:
            reader = csv.DictReader(f)
            records = [row for row in reader]
    else:
        raise ValueError(f"Unsupported file format '{ext}'. Supported formats: .json, .csv")

    return records

def process_import(
    source_path: str,
    batch_size: int = 100,
    dry_run: bool = True,
    report_out: str = "storage/import_report.json"
):
    print("==========================================================")
    print(" CRMS Production-Safe Migration & Import Pipeline ")
    print("==========================================================")
    print(f" Source File : {source_path}")
    print(f" Batch Size  : {batch_size}")
    print(f" Execution   : {'[DRY RUN - SAFE MODE]' if dry_run else '[LIVE DATABASE COMMIT]'}")
    print("==========================================================\n")

    start_time = time.time()
    source_records = load_source_file(source_path)
    total_records = len(source_records)
    print(f"Loaded {total_records} source records for processing.")

    db: Session = SessionLocal()

    report = {
        "timestamp": datetime.now().isoformat(),
        "dry_run": dry_run,
        "total_source_records": total_records,
        "successful_records": 0,
        "duplicate_records": 0,
        "invalid_records": 0,
        "failed_image_processing": 0,
        "details": {
            "duplicates": [],
            "invalid": [],
            "failed_images": [],
            "imported_ids": []
        }
    }

    try:
        # Default police station for imported cases
        station = db.query(PoliceStationModel).first()
        station_id = station.id if station else None

        for idx in range(0, total_records, batch_size):
            batch = source_records[idx:idx + batch_size]
            print(f"Processing Batch {idx // batch_size + 1} (Records {idx + 1} to {min(idx + batch_size, total_records)})...")

            for rec in batch:
                # 1. Validation
                is_valid, val_errors = validate_record(rec)
                if not is_valid:
                    report["invalid_records"] += 1
                    report["details"]["invalid"].append({
                        "record": rec,
                        "reasons": val_errors
                    })
                    continue

                # 2. Duplicate Detection
                is_dup, dup_reason, existing_id = detect_duplicate(db, rec)
                if is_dup:
                    report["duplicate_records"] += 1
                    report["details"]["duplicates"].append({
                        "name": rec.get("name"),
                        "existing_id": existing_id,
                        "reason": dup_reason
                    })
                    continue

                # 3. Create Criminal Profile Record
                c_id = rec.get("id") or f"CR-{uuid.uuid4().hex[:6].upper()}"
                norm_name = normalize_text(rec.get("name"))
                phone = normalize_phone(rec.get("phone_number") or rec.get("phone"))
                id_num = normalize_id_number(rec.get("identification_number") or rec.get("identificationNumber"))

                profile = CriminalProfileModel(
                    id=c_id,
                    name=rec.get("name").strip(),
                    normalized_name=norm_name,
                    alias=rec.get("alias"),
                    father_name=rec.get("father_name") or rec.get("fatherName"),
                    age=int(rec.get("age")) if rec.get("age") else None,
                    gender=rec.get("gender") or "Male",
                    phone_number=phone,
                    identification_number=id_num,
                    primary_address=rec.get("primary_address") or rec.get("primaryAddress") or rec.get("address"),
                    city=rec.get("city") or "Metro City",
                    state=rec.get("state") or "NY",
                    height=rec.get("height"),
                    weight=rec.get("weight"),
                    risk_level=rec.get("risk_level") or rec.get("riskLevel") or "Medium Risk",
                    status=rec.get("status") or "Active",
                    category=rec.get("category") or "Theft",
                    is_archived=bool(rec.get("is_archived") or rec.get("isArchived"))
                )
                db.add(profile)
                db.flush()

                # 4. Handle Criminal Photos & Biometric Embeddings
                photo_input = rec.get("mugshot_url") or rec.get("mugshotUrl") or rec.get("photo")
                if photo_input:
                    try:
                        # If base64 or file path
                        photo_bytes = None
                        if photo_input.startswith("data:image"):
                            header, b64 = photo_input.split(",")
                            import base64
                            photo_bytes = base64.b64decode(b64)
                        elif os.path.exists(photo_input):
                            with open(photo_input, "rb") as pf:
                                photo_bytes = pf.read()
                        
                        if photo_bytes:
                            upload_info = storage_service.validate_and_save_photo(
                                file_bytes=photo_bytes,
                                original_filename="imported_mugshot.jpg",
                                content_type="image/jpeg",
                                criminal_id=profile.id
                            )
                            photo_obj = CriminalPhotoModel(
                                id=str(uuid.uuid4()),
                                criminal_id=profile.id,
                                photo_url=upload_info["url"],
                                storage_key=upload_info["storage_key"],
                                filename=upload_info["filename"],
                                content_type=upload_info["content_type"],
                                size_bytes=upload_info["size_bytes"],
                                is_primary_mugshot=True
                            )
                            db.add(photo_obj)
                            profile.mugshot_url = upload_info["url"]

                            # Compute Face Embedding
                            try:
                                emb_vec = extract_face_embedding(photo_bytes)
                                face_emb = FaceEmbeddingModel(
                                    id=str(uuid.uuid4()),
                                    criminal_id=profile.id,
                                    photo_id=photo_obj.id,
                                    embedding_vector={"vector": emb_vec, "dim": len(emb_vec)},
                                    feature_metadata={"model_version": "DOJ-NeuralMesh-v4.2"}
                                )
                                db.add(face_emb)
                            except Exception as fe:
                                report["failed_image_processing"] += 1
                                report["details"]["failed_images"].append({
                                    "criminal_id": profile.id,
                                    "reason": f"Face vector extraction failed: {fe}"
                                })
                        else:
                            profile.mugshot_url = photo_input
                    except Exception as pe:
                        report["failed_image_processing"] += 1
                        report["details"]["failed_images"].append({
                            "criminal_id": profile.id,
                            "reason": f"Photo import failed: {pe}"
                        })

                # 5. Handle Cases & Crime Category Linking
                cases_data = rec.get("cases") or []
                for cdata in cases_data:
                    case_num = cdata.get("case_number") or cdata.get("caseNumber") or f"FIR-{uuid.uuid4().hex[:6].upper()}"
                    c_obj = db.query(CaseRecordModel).filter(CaseRecordModel.case_number == case_num).first()
                    if not c_obj:
                        c_obj = CaseRecordModel(
                            id=str(uuid.uuid4()),
                            case_number=case_num,
                            title=cdata.get("title") or cdata.get("description") or "Filing Docket",
                            description=cdata.get("description") or "",
                            date_filed=cdata.get("date_filed") or cdata.get("dateFiled") or str(date.today()),
                            status=cdata.get("status") or "Active",
                            category=cdata.get("category") or profile.category,
                            police_station_id=station_id
                        )
                        db.add(c_obj)
                        db.flush()

                    cr_case_link = CriminalCaseModel(
                        criminal_id=profile.id,
                        case_id=c_obj.id,
                        role_in_case=cdata.get("role") or "Primary Suspect"
                    )
                    db.add(cr_case_link)

                report["successful_records"] += 1
                report["details"]["imported_ids"].append(profile.id)

            if dry_run:
                # Rollback transaction batch in dry-run mode to preserve DB state
                db.rollback()
            else:
                db.commit()

        elapsed_time = round(time.time() - start_time, 2)
        report["execution_time_seconds"] = elapsed_time

        # Save JSON Report
        os.makedirs(os.path.dirname(report_out), exist_ok=True)
        with open(report_out, "w", encoding="utf-8") as rf:
            json.dump(report, rf, indent=2)

        print("\n==========================================================")
        print(" IMPORT MIGRATION SUMMARY REPORT ")
        print("==========================================================")
        print(f" Execution Mode        : {'[DRY RUN]' if dry_run else '[LIVE COMMITTED]'}")
        print(f" Total Source Records  : {report['total_source_records']}")
        print(f" Successful Imports    : {report['successful_records']}")
        print(f" Duplicate Skipped     : {report['duplicate_records']}")
        print(f" Invalid Records       : {report['invalid_records']}")
        print(f" Image Failures        : {report['failed_image_processing']}")
        print(f" Time Elapsed          : {elapsed_time} seconds")
        print(f" Full Report JSON      : {report_out}")
        print("==========================================================\n")

    except Exception as e:
        db.rollback()
        print(f"\n[ERROR] Migration pipeline terminated with exception: {e}")
        raise
    finally:
        db.close()

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="CRMS 15,000 Criminal Record Migration Pipeline")
    parser.add_argument("--source", type=str, required=True, help="Path to source CSV or JSON import file")
    parser.add_argument("--batch-size", type=int, default=100, help="Batch commit size (default: 100)")
    parser.add_argument("--commit", action="store_true", help="Execute live database commits (default is dry-run mode)")
    parser.add_argument("--report-out", type=str, default="storage/import_report.json", help="Report JSON output path")
    args = parser.parse_args()

    process_import(
        source_path=args.source,
        batch_size=args.batch_size,
        dry_run=not args.commit,
        report_out=args.report_out
    )
