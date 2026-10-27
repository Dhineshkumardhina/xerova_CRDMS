import os
import uuid
import hashlib
from fastapi import APIRouter, Depends, UploadFile, File, Form, HTTPException, Request, Query
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
from typing import List, Optional

from app.db.session import get_db
from app.core.security import require_permission
from app.services.storage_service import storage_service
from app.services.audit_service import log_audit_event
from app.models.document import DocumentItemModel, CriminalDocumentModel, CaseDocumentModel
from app.models.criminal import CriminalProfileModel
from app.models.case import CaseRecordModel
from app.models.user import UserModel
from app.schemas.document import DocumentResponseSchema
from app.core.config import settings

router = APIRouter()

@router.get("", response_model=List[DocumentResponseSchema])
def get_documents(
    criminal_id: Optional[str] = Query(None, description="Filter by criminal ID"),
    case_id: Optional[str] = Query(None, description="Filter by case ID"),
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(require_permission("criminal:read"))
):
    query = db.query(DocumentItemModel)

    if criminal_id:
        doc_ids = db.query(CriminalDocumentModel.document_id).filter(CriminalDocumentModel.criminal_id == criminal_id)
        query = query.filter(DocumentItemModel.id.in_(doc_ids))

    if case_id:
        doc_ids = db.query(CaseDocumentModel.document_id).filter(CaseDocumentModel.case_id == case_id)
        query = query.filter(DocumentItemModel.id.in_(doc_ids))

    docs = query.order_by(DocumentItemModel.created_at.desc()).offset(skip).limit(limit).all()

    return [
        DocumentResponseSchema(
            id=d.id,
            title=d.title,
            filename=d.filename,
            size=d.size,
            type=d.file_type,
            dateUploaded=d.date_uploaded,
            url=d.file_path,
            fileHashSha256=d.file_hash_sha256
        ) for d in docs
    ]

from app.core.rbac import can_access_case, can_access_criminal

@router.post("/upload", response_model=DocumentResponseSchema)
async def upload_document(
    file: UploadFile = File(...),
    title: Optional[str] = Form(None),
    document_type: Optional[str] = Form("Evidence Attachment"),
    criminal_id: Optional[str] = Form(None),
    case_id: Optional[str] = Form(None),
    request: Request = None,
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(require_permission("criminal:update"))
):
    # Verify criminal jurisdiction if attaching to criminal profile
    if criminal_id:
        target_crim = db.query(CriminalProfileModel).filter(
            CriminalProfileModel.id == criminal_id,
            CriminalProfileModel.is_deleted == False
        ).first()
        if not target_crim:
            raise HTTPException(status_code=404, detail="Target criminal dossier not found")
        if not can_access_criminal(current_user, target_crim, db):
            raise HTTPException(
                status_code=403,
                detail="Access Denied: Target criminal dossier is outside your regional jurisdiction."
            )

    # Verify case jurisdiction if attaching to case dossier
    if case_id:
        target_case = db.query(CaseRecordModel).filter(
            CaseRecordModel.id == case_id,
            CaseRecordModel.is_deleted == False
        ).first()
        if not target_case:
            raise HTTPException(status_code=404, detail="Target case dossier not found")
        if not can_access_case(current_user, target_case):
            raise HTTPException(
                status_code=403,
                detail="Access Denied: Target case dossier is outside your regional jurisdiction."
            )

    file_bytes = await file.read()
    upload_info = storage_service.validate_and_save_document(
        file_bytes=file_bytes,
        original_filename=file.filename or "document.pdf",
        content_type=file.content_type
    )

    doc_title = title or file.filename or "Legal Attachment"
    doc_size_mb = f"{round(len(file_bytes) / (1024 * 1024), 2)} MB" if len(file_bytes) >= 1024*1024 else f"{round(len(file_bytes) / 1024, 1)} KB"

    doc = DocumentItemModel(
        id=str(uuid.uuid4()),
        title=doc_title,
        filename=file.filename or "document.pdf",
        storage_key=upload_info["storage_key"],
        file_path=upload_info["url"],
        file_type=upload_info["ext"],
        document_category=document_type or "Evidence Attachment",
        size=doc_size_mb,
        file_size_bytes=len(file_bytes),
        file_hash_sha256=upload_info["file_hash_sha256"],
        uploaded_by_id=current_user.id,
        date_uploaded="Today"
    )

    try:
        db.add(doc)

        if criminal_id:
            c_link = CriminalDocumentModel(criminal_id=criminal_id, document_id=doc.id)
            db.add(c_link)

        if case_id:
            case_link = CaseDocumentModel(case_id=case_id, document_id=doc.id)
            db.add(case_link)

        db.commit()
        db.refresh(doc)
    except Exception as e:
        db.rollback()
        storage_service.delete_document(upload_info["storage_key"])
        raise HTTPException(status_code=500, detail=f"Failed to persist document metadata: {str(e)}")

    # Audit Log Entry
    log_audit_event(
        db=db,
        action="Evidence Uploaded",
        resource_type="Document",
        resource_id=doc.id,
        subject_name=doc.title,
        result="SUCCESS",
        user_id=current_user.id,
        officer_name=current_user.full_name,
        request=request,
        details={
            "filename": doc.filename,
            "size_bytes": len(file_bytes),
            "sha256": doc.file_hash_sha256,
            "criminal_id": criminal_id,
            "case_id": case_id
        }
    )

    return DocumentResponseSchema(
        id=doc.id,
        title=doc.title,
        filename=doc.filename,
        size=doc.size,
        type=doc.file_type,
        dateUploaded=doc.date_uploaded,
        url=doc.file_path,
        fileHashSha256=doc.file_hash_sha256
    )

@router.get("/{document_id}/download")
def download_document(
    document_id: str,
    request: Request = None,
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(require_permission("criminal:read"))
):
    doc = db.query(DocumentItemModel).filter(DocumentItemModel.id == document_id).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Document record not found")

    # Jurisdictional Authorization Check across linked cases
    for case_link in doc.case_links:
        if case_link.case and not can_access_case(current_user, case_link.case):
            log_audit_event(
                db=db,
                action="DOCUMENT_DOWNLOAD_DENIED",
                resource_type="Document",
                resource_id=doc.id,
                subject_name=doc.title,
                result="FAILED",
                user_id=current_user.id,
                officer_name=current_user.full_name,
                request=request
            )
            raise HTTPException(
                status_code=403,
                detail="Access Denied: You do not have jurisdictional clearance to download documents associated with this case."
            )

    # Jurisdictional Authorization Check across linked criminals
    for crim_link in doc.criminal_links:
        if crim_link.criminal and not can_access_criminal(current_user, crim_link.criminal, db):
            log_audit_event(
                db=db,
                action="DOCUMENT_DOWNLOAD_DENIED",
                resource_type="Document",
                resource_id=doc.id,
                subject_name=doc.title,
                result="FAILED",
                user_id=current_user.id,
                officer_name=current_user.full_name,
                request=request
            )
            raise HTTPException(
                status_code=403,
                detail="Access Denied: You do not have jurisdictional clearance to download documents associated with this criminal dossier."
            )

    # Path traversal protection
    if not doc.storage_key or ".." in doc.storage_key:
        raise HTTPException(status_code=400, detail="Invalid storage path identifier.")

    base_storage = os.path.abspath(settings.STORAGE_DIR)
    full_path = os.path.abspath(os.path.join(base_storage, doc.storage_key))
    if not full_path.startswith(base_storage):
        raise HTTPException(status_code=400, detail="Path traversal attempt blocked.")

    if not os.path.exists(full_path):
        raise HTTPException(status_code=404, detail="Physical document object missing from storage.")

    log_audit_event(
        db=db,
        action="Document Download",
        resource_type="Document",
        resource_id=doc.id,
        subject_name=doc.title,
        result="SUCCESS",
        user_id=current_user.id,
        officer_name=current_user.full_name,
        request=request,
        details={"sha256": doc.file_hash_sha256, "filename": doc.filename}
    )

    return FileResponse(
        path=full_path,
        filename=doc.filename,
        media_type="application/octet-stream",
        headers={"X-Content-SHA256": doc.file_hash_sha256 or ""}
    )

@router.delete("/{document_id}")
def delete_document(
    document_id: str,
    request: Request = None,
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(require_permission("criminal:update"))
):
    doc = db.query(DocumentItemModel).filter(DocumentItemModel.id == document_id).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Document record not found")

    # Verify authorization before deletion
    for case_link in doc.case_links:
        if case_link.case and not can_access_case(current_user, case_link.case):
            raise HTTPException(status_code=403, detail="Access Denied: Case is outside your regional jurisdiction.")

    for crim_link in doc.criminal_links:
        if crim_link.criminal and not can_access_criminal(current_user, crim_link.criminal, db):
            raise HTTPException(status_code=403, detail="Access Denied: Criminal record is outside your regional jurisdiction.")

    if doc.storage_key:
        storage_service.delete_document(doc.storage_key)

    log_audit_event(
        db=db,
        action="Document Delete",
        resource_type="Document",
        resource_id=doc.id,
        subject_name=doc.title,
        result="SUCCESS",
        user_id=current_user.id,
        officer_name=current_user.full_name,
        request=request
    )

    try:
        db.delete(doc)
        db.commit()
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to delete document: {str(e)}")

    return {"status": "success", "message": "Document deleted from storage and database"}
