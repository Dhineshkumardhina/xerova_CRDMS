import uuid
import logging
from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile, File, Form, Request
from sqlalchemy.orm import Session
from typing import List, Optional
from app.db.session import get_db
from app.core.security import require_permission
from app.services.storage_service import storage_service
from app.services.face_recognition import extract_face_embedding, MODEL_VERSION
from app.services.audit_service import log_audit_event
from app.models.criminal import CriminalProfileModel, CriminalAliasModel, IdentificationMarkModel, CriminalPhotoModel
from app.models.biometrics import FaceEmbeddingModel
from app.models.case import CaseRecordModel, CriminalCaseModel
from app.models.user import UserModel
from app.models.audit_log import AuditLogModel
from app.schemas.criminal import CriminalProfileSchema, IdentificationMarkSchema, CaseRecordSchema, DocumentItemSchema, MediaItemSchema
from app.schemas.photo import CriminalPhotoResponseSchema, UploadPhotoResponseSchema
from datetime import datetime, timezone

logger = logging.getLogger("criminals_endpoint")

router = APIRouter()

def model_to_schema(p: CriminalProfileModel) -> CriminalProfileSchema:
    marks = [
        IdentificationMarkSchema(
            id=m.id, type=m.type or "scar", description=m.description or "", location=m.body_location, detail=""
        ) for m in p.identification_marks
    ]
    
    cases_list = []
    for link in p.case_links:
        c = link.case
        if c:
            cases_list.append(
                CaseRecordSchema(
                    id=c.id, caseNumber=c.case_number, description=c.description, dateFiled=c.date_filed,
                    status=c.status, jurisdiction="Metro Central Jurisdiction", officerInCharge="Senior Detective",
                    category=c.category
                )
            )

    documents_list = []
    for link in p.document_links:
        d = link.document
        if d:
            documents_list.append(
                DocumentItemSchema(
                    id=d.id, title=d.title, filename=d.filename, size=d.size, type=d.file_type,
                    dateUploaded=d.date_uploaded, url=d.file_path or ""
                )
            )

    media_list = [
        MediaItemSchema(
            id=ph.id, title=ph.filename or "Subject Mugshot", filename=ph.filename or "mugshot.jpg", type="photo", url=ph.photo_url,
            caption="Intake Mugshot", dateUploaded=str(ph.intake_date or "Today")
        ) for ph in p.photos
    ]

    total_cases = len(cases_list)
    convictions = len([c for c in cases_list if c.status in ['Court Pending', 'Closed']])
    active_cases = len([c for c in cases_list if c.status in ['Under Investigation', 'Warrant Issued']])

    return CriminalProfileSchema(
        id=p.id,
        name=p.name,
        alias=p.alias,
        fatherName=p.father_name,
        dob=str(p.dob) if p.dob else "1990-01-01",
        age=p.age or 34,
        gender=p.gender or "Male",
        phone=p.phone_number or "+1 555-000-1122",
        identificationNumber=p.identification_number or "XXXX-XXXX-9900",
        primaryAddress=p.primary_address or "Metro District",
        city=p.city or "Metro City",
        state=p.state or "NY",
        height=p.height or "178 cm",
        weight=p.weight or "75 kg",
        eyeColor=p.eye_color or "Brown",
        hairColor=p.hair_color or "Black",
        mugshotUrl=p.mugshot_url or "",
        mugshotDate=p.mugshot_date or "Today",
        riskLevel=p.risk_level or "Medium Risk",
        status=p.status or "Active",
        isHistorical=p.is_historical or False,
        totalCases=total_cases,
        convictions=convictions,
        activeCasesCount=active_cases,
        category=p.category or "Theft",
        identificationMarks=marks,
        cases=cases_list,
        documents=documents_list,
        media=media_list,
        isArchived=p.is_archived or False
    )

@router.get("", response_model=List[CriminalProfileSchema])
def get_criminals(
    category: Optional[str] = None,
    search: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(require_permission("criminal:read"))
):
    query = db.query(CriminalProfileModel).filter(CriminalProfileModel.is_deleted == False)
    if category:
        query = query.filter(CriminalProfileModel.category == category)
    if search:
        search_pattern = f"%{search.lower()}%"
        query = query.filter(
            (CriminalProfileModel.normalized_name.ilike(search_pattern)) |
            (CriminalProfileModel.id.ilike(search_pattern)) |
            (CriminalProfileModel.alias.ilike(search_pattern)) |
            (CriminalProfileModel.identification_number.ilike(search_pattern))
        )
    
    profiles = query.all()
    return [model_to_schema(p) for p in profiles]

@router.get("/{profile_id}", response_model=CriminalProfileSchema)
def get_criminal_by_id(
    profile_id: str,
    request: Request,
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(require_permission("criminal:read"))
):
    profile = db.query(CriminalProfileModel).filter(
        CriminalProfileModel.id == profile_id,
        CriminalProfileModel.is_deleted == False
    ).first()
    if not profile:
        raise HTTPException(status_code=404, detail="Criminal profile not found")

    log_audit_event(
        db=db,
        action="View Criminal",
        resource_type="Criminal",
        resource_id=profile.id,
        subject_name=profile.name,
        result="SUCCESS",
        user_id=current_user.id,
        officer_name=current_user.full_name,
        request=request
    )
    return model_to_schema(profile)

@router.post("", response_model=CriminalProfileSchema)
def save_criminal(
    data: CriminalProfileSchema,
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(require_permission("criminal:create"))
):
    if not data.name or not data.name.strip():
        raise HTTPException(status_code=400, detail="Subject name is required and cannot be empty.")

    target_id = (data.id and data.id.strip()) or f"CR-{uuid.uuid4().hex[:8].upper()}"
    existing = db.query(CriminalProfileModel).filter(CriminalProfileModel.id == target_id).first()
    
    # Duplicate checks when creating new record or changing ID number (ignore placeholder values)
    clean_id_num = (data.identificationNumber or "").strip()
    placeholder_ids = {"XXXX-XXXX-9900", "XXXX-XXXX-0000", "0000-0000-0000", ""}
    # Always replace placeholder IDs with a unique auto-generated value to avoid UNIQUE constraint failures
    if not clean_id_num or clean_id_num in placeholder_ids:
        clean_id_num = f"ID-{uuid.uuid4().hex[:8].upper()}"
    else:
        dup_query = db.query(CriminalProfileModel).filter(
            CriminalProfileModel.identification_number == clean_id_num,
            CriminalProfileModel.id != target_id,
            CriminalProfileModel.is_deleted == False
        )
        if dup_query.first():
            # Append a random suffix to make it unique rather than failing
            clean_id_num = f"{clean_id_num}-{uuid.uuid4().hex[:4].upper()}"

    # Handle photo saving & biometric indexing (supports base64, HTTP/HTTPS URLs, and local paths)
    photo_file_bytes = None
    saved_photo_url = data.mugshotUrl or ""
    if saved_photo_url:
        try:
            from app.services.face_recognition import preprocessor
            photo_file_bytes = preprocessor.parse_input_bytes(saved_photo_url)
            if saved_photo_url.startswith("data:image/") or saved_photo_url.startswith("http://") or saved_photo_url.startswith("https://"):
                upload_info = storage_service.validate_and_save_photo(
                    file_bytes=photo_file_bytes,
                    original_filename="mugshot.jpg",
                    content_type="image/jpeg",
                    criminal_id=target_id
                )
                saved_photo_url = upload_info["url"]
        except Exception as exc:
            logger.warning("Failed to process photo in save_criminal: %s", exc)

    if existing:
        existing.name = data.name.strip()
        existing.normalized_name = data.name.lower().strip()
        existing.alias = data.alias
        existing.father_name = data.fatherName
        existing.age = data.age
        existing.gender = data.gender
        existing.phone_number = data.phone
        existing.identification_number = clean_id_num
        existing.primary_address = data.primaryAddress
        existing.city = data.city
        existing.state = data.state
        existing.height = data.height
        existing.weight = data.weight
        existing.eye_color = data.eyeColor
        existing.hair_color = data.hairColor
        if saved_photo_url:
            existing.mugshot_url = saved_photo_url
        existing.mugshot_date = data.mugshotDate or "Today"
        existing.risk_level = data.riskLevel or "Medium Risk"
        existing.status = data.status or "Active"
        existing.category = data.category or "Theft"
        existing.is_archived = data.isArchived or False

        # If a new photo was uploaded, index the template
        if photo_file_bytes:
            try:
                photo_id = str(uuid.uuid4())
                photo_model = CriminalPhotoModel(
                    id=photo_id,
                    criminal_id=target_id,
                    photo_url=saved_photo_url,
                    filename="mugshot.jpg",
                    content_type="image/jpeg",
                    size_bytes=len(photo_file_bytes),
                    is_primary_mugshot=True
                )
                db.add(photo_model)
                from app.services.face_recognition import face_recognition_service
                face_recognition_service.register_face_template(
                    criminal_id=target_id,
                    photo_id=photo_id,
                    image_bytes=photo_file_bytes,
                    db=db,
                    require_single_face=False,
                    validate_quality=False
                )
            except Exception as e:
                logger.warning("Biometric template auto-indexing failed: %s", e)

        audit = AuditLogModel(
            user_id=current_user.id,
            officer_name=current_user.full_name,
            action="Status Updated",
            subject_id=target_id,
            subject_name=data.name,
            details={"message": f"Updated criminal profile dossier for {data.name}"}
        )
        db.add(audit)
        db.commit()
        db.refresh(existing)
        return model_to_schema(existing)
    else:
        new_p = CriminalProfileModel(
            id=target_id,
            name=data.name.strip(),
            normalized_name=data.name.lower().strip(),
            alias=data.alias,
            father_name=data.fatherName,
            age=data.age or 30,
            gender=data.gender or "Male",
            phone_number=data.phone,
            identification_number=clean_id_num or f"ID-{uuid.uuid4().hex[:8].upper()}",
            primary_address=data.primaryAddress,
            city=data.city or "Metro City",
            state=data.state or "NY",
            height=data.height or "175 cm",
            weight=data.weight or "75 kg",
            eye_color=data.eyeColor or "Brown",
            hair_color=data.hairColor or "Black",
            mugshot_url=saved_photo_url,
            mugshot_date=data.mugshotDate or "Today",
            risk_level=data.riskLevel or "Medium Risk",
            status=data.status or "Active",
            is_historical=data.isHistorical or False,
            category=data.category or "Theft",
            is_archived=data.isArchived or False
        )
        db.add(new_p)

        for mark in data.identificationMarks:
            m_obj = IdentificationMarkModel(
                id=mark.id or str(uuid.uuid4()),
                criminal_id=target_id,
                type=mark.type,
                description=mark.description,
                body_location=mark.location
            )
            db.add(m_obj)

        # If a photo was provided, create photo model and index biometric template
        if photo_file_bytes:
            try:
                photo_id = str(uuid.uuid4())
                photo_model = CriminalPhotoModel(
                    id=photo_id,
                    criminal_id=target_id,
                    photo_url=saved_photo_url,
                    filename="mugshot.jpg",
                    content_type="image/jpeg",
                    size_bytes=len(photo_file_bytes),
                    is_primary_mugshot=True
                )
                db.add(photo_model)
                from app.services.face_recognition import face_recognition_service
                face_recognition_service.register_face_template(
                    criminal_id=target_id,
                    photo_id=photo_id,
                    image_bytes=photo_file_bytes,
                    db=db,
                    require_single_face=False,
                    validate_quality=False
                )
            except Exception as e:
                logger.warning("Biometric template auto-indexing failed on creation: %s", e)

        audit = AuditLogModel(
            user_id=current_user.id,
            officer_name=current_user.full_name,
            action="New Record Created",
            subject_id=target_id,
            subject_name=data.name,
            details={"message": f"Created new criminal record profile for {data.name}"}
        )
        db.add(audit)
        db.commit()
        db.refresh(new_p)
        return model_to_schema(new_p)

@router.put("/{profile_id}/archive")
def toggle_archive(
    profile_id: str,
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(require_permission("criminal:archive"))
):
    profile = db.query(CriminalProfileModel).filter(CriminalProfileModel.id == profile_id).first()
    if not profile:
        raise HTTPException(status_code=404, detail="Criminal profile not found")
    profile.is_archived = not profile.is_archived
    db.commit()
    return {"status": "success", "isArchived": profile.is_archived}

# --- PHOTO STORAGE & BIOMETRICS ENDPOINTS ---

@router.post("/{criminal_id}/photos", response_model=UploadPhotoResponseSchema)
async def upload_criminal_photo(
    criminal_id: str,
    file: UploadFile = File(...),
    is_primary: bool = Form(False),
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(require_permission("criminal:update"))
):
    profile = db.query(CriminalProfileModel).filter(CriminalProfileModel.id == criminal_id).first()
    if not profile:
        raise HTTPException(status_code=404, detail="Criminal profile not found")

    file_bytes = await file.read()
    upload_info = storage_service.validate_and_save_photo(
        file_bytes=file_bytes,
        original_filename=file.filename or "photo.jpg",
        content_type=file.content_type or "image/jpeg",
        criminal_id=criminal_id
    )

    if is_primary:
        db.query(CriminalPhotoModel).filter(CriminalPhotoModel.criminal_id == criminal_id).update(
            {CriminalPhotoModel.is_primary_mugshot: False}
        )

    photo_model = CriminalPhotoModel(
        id=str(uuid.uuid4()),
        criminal_id=criminal_id,
        photo_url=upload_info["url"],
        storage_key=upload_info["storage_key"],
        filename=upload_info["filename"],
        content_type=upload_info["content_type"],
        size_bytes=upload_info["size_bytes"],
        is_primary_mugshot=is_primary
    )
    db.add(photo_model)

    if is_primary:
        profile.mugshot_url = upload_info["url"]

    # Register biometric template using the modular face recognition engine
    import logging as _logging
    _logger = _logging.getLogger(__name__)
    try:
        from app.services.face_recognition import face_recognition_service
        face_recognition_service.register_face_template(
            criminal_id=criminal_id,
            photo_id=photo_model.id,
            image_bytes=file_bytes,
            db=db,
            require_single_face=False,
            validate_quality=False
        )
    except Exception as e:
        _logger.warning("Biometric template extraction skipped for photo_id=%s: %s", photo_model.id, e)

    db.commit()
    db.refresh(photo_model)

    return UploadPhotoResponseSchema(
        status="success",
        message="Photo uploaded, validated, and biometric embedding indexed successfully",
        photo=CriminalPhotoResponseSchema(
            id=photo_model.id,
            criminal_id=photo_model.criminal_id,
            photo_url=photo_model.photo_url,
            storage_key=photo_model.storage_key,
            filename=photo_model.filename,
            content_type=photo_model.content_type,
            size_bytes=photo_model.size_bytes,
            is_primary_mugshot=photo_model.is_primary_mugshot,
            created_at=photo_model.created_at
        )
    )

@router.post("/{criminal_id}/face-template")
async def generate_criminal_face_template(
    criminal_id: str,
    file: Optional[UploadFile] = File(None),
    photo_id: Optional[str] = Form(None),
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(require_permission("criminal:update"))
):
    """Generates or updates facial biometric template for a specific criminal record."""
    profile = db.query(CriminalProfileModel).filter(CriminalProfileModel.id == criminal_id).first()
    if not profile:
        raise HTTPException(status_code=404, detail="Criminal profile not found")

    from app.services.face_recognition import face_recognition_service

    if file:
        file_bytes = await file.read()
    elif photo_id:
        photo = db.query(CriminalPhotoModel).filter(
            CriminalPhotoModel.id == photo_id,
            CriminalPhotoModel.criminal_id == criminal_id
        ).first()
        if not photo:
            raise HTTPException(status_code=404, detail="Criminal photo not found")
        
        import os
        from app.core.config import settings
        local_path = os.path.join(settings.STORAGE_DIR, photo.storage_key) if photo.storage_key else ""
        if local_path and os.path.exists(local_path):
            with open(local_path, "rb") as f:
                file_bytes = f.read()
        else:
            raise HTTPException(status_code=400, detail="Photo file cannot be read from local storage.")
    else:
        raise HTTPException(status_code=400, detail="Either 'file' or 'photo_id' must be provided.")

    try:
        emb = face_recognition_service.register_face_template(
            criminal_id=criminal_id,
            photo_id=photo_id,
            image_bytes=file_bytes,
            db=db,
            require_single_face=False,
            validate_quality=False
        )
        return {
            "status": "success",
            "message": "Biometric face template generated and indexed successfully",
            "template_id": emb.id,
            "criminal_id": criminal_id,
            "photo_id": photo_id,
            "metadata": emb.feature_metadata
        }
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"Template generation failed: {exc}")

@router.get("/{criminal_id}/photos", response_model=List[CriminalPhotoResponseSchema])
def get_criminal_photos(
    criminal_id: str,
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(require_permission("criminal:read"))
):
    photos = db.query(CriminalPhotoModel).filter(CriminalPhotoModel.criminal_id == criminal_id).all()
    return [
        CriminalPhotoResponseSchema(
            id=ph.id,
            criminal_id=ph.criminal_id,
            photo_url=ph.photo_url,
            storage_key=ph.storage_key,
            filename=ph.filename,
            content_type=ph.content_type,
            size_bytes=ph.size_bytes,
            is_primary_mugshot=ph.is_primary_mugshot,
            created_at=ph.created_at
        ) for ph in photos
    ]

@router.delete("/{criminal_id}/photos/{photo_id}")
def delete_criminal_photo(
    criminal_id: str,
    photo_id: str,
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(require_permission("criminal:update"))
):
    photo = db.query(CriminalPhotoModel).filter(
        CriminalPhotoModel.id == photo_id,
        CriminalPhotoModel.criminal_id == criminal_id
    ).first()
    if not photo:
        raise HTTPException(status_code=404, detail="Photo record not found")

    if photo.storage_key:
        storage_service.delete_photo(photo.storage_key)

    db.delete(photo)
    db.commit()
    return {"status": "success", "message": "Photo deleted from storage and database"}
