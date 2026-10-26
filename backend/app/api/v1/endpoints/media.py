import os
import uuid
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, UploadFile, File, Form, HTTPException, Request, status
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.core.config import settings
from app.core.security import require_permission
from app.models.user import UserModel
from app.models.document import DocumentItemModel, CriminalDocumentModel
from app.models.criminal import CriminalProfileModel, CriminalPhotoModel
from app.models.audit_log import AuditLogModel
from app.services.storage_service import storage_service

router = APIRouter()

@router.post("/upload-mugshot")
async def upload_mugshot(
    file: UploadFile = File(...),
    current_user: UserModel = Depends(require_permission("criminal:update"))
):
    file_bytes = await file.read()
    upload_info = storage_service.validate_and_save_photo(
        file_bytes=file_bytes,
        original_filename=file.filename or "mugshot.jpg",
        content_type=file.content_type or "image/jpeg",
        criminal_id="temp_mugshot"
    )
    return {"url": upload_info["url"], "filename": upload_info["filename"], "storage_key": upload_info["storage_key"]}

@router.post("/upload-media")
async def upload_media(
    profileId: str = Form(...),
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(require_permission("criminal:update"))
):
    profile = db.query(CriminalProfileModel).filter(CriminalProfileModel.id == profileId).first()
    if not profile:
        raise HTTPException(status_code=404, detail="Criminal profile not found")
        
    file_bytes = await file.read()
    upload_info = storage_service.validate_and_save_photo(
        file_bytes=file_bytes,
        original_filename=file.filename or "evidence.jpg",
        content_type=file.content_type or "image/jpeg",
        criminal_id=profileId
    )
    
    photo_obj = CriminalPhotoModel(
        id=f"m-{int(datetime.now(timezone.utc).timestamp() * 1000)}",
        criminal_id=profileId,
        filename=file.filename or "evidence.jpg",
        photo_url=upload_info["url"],
        storage_key=upload_info["storage_key"],
        size_bytes=len(file_bytes),
        is_primary_mugshot=False
    )
    db.add(photo_obj)
    
    audit = AuditLogModel(
        user_id=current_user.id,
        officer_name=current_user.full_name,
        action="Evidence Uploaded",
        subject_id=profileId,
        subject_name=profile.name,
        details={"message": f"Uploaded photo evidence {file.filename} to profile dossier"}
    )
    db.add(audit)
    db.commit()
    
    return {
        "id": photo_obj.id,
        "title": file.filename or "Evidence Photo",
        "filename": photo_obj.filename,
        "type": "photo",
        "url": photo_obj.photo_url,
        "dateUploaded": "Today"
    }

@router.post("/upload-doc")
async def upload_doc(
    profileId: str = Form(...),
    title: str = Form(...),
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(require_permission("criminal:update"))
):
    profile = db.query(CriminalProfileModel).filter(CriminalProfileModel.id == profileId).first()
    if not profile:
        raise HTTPException(status_code=404, detail="Criminal profile not found")
        
    doc_filename = title if title.endswith('.pdf') else f"{title}.pdf"
    doc_obj = DocumentItemModel(
        id=f"doc-{int(datetime.now(timezone.utc).timestamp() * 1000)}",
        title=title,
        filename=doc_filename,
        size="1.2 MB",
        file_type="pdf",
        date_uploaded="Today",
        file_path=f"/storage/documents/{doc_filename}",
        uploaded_by_id=current_user.id
    )
    db.add(doc_obj)
    db.flush()
    
    link = CriminalDocumentModel(criminal_id=profileId, document_id=doc_obj.id)
    db.add(link)

    audit = AuditLogModel(
        user_id=current_user.id,
        officer_name=current_user.full_name,
        action="Document Uploaded",
        subject_id=profileId,
        subject_name=profile.name,
        details={"message": f"Uploaded legal document '{title}' to profile dossier"}
    )
    db.add(audit)
    db.commit()
    
    return {
        "id": doc_obj.id,
        "title": doc_obj.title,
        "filename": doc_obj.filename,
        "size": doc_obj.size,
        "type": doc_obj.file_type,
        "dateUploaded": doc_obj.date_uploaded
    }
