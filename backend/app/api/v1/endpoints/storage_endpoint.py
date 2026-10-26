"""
Protected File Storage Delivery Endpoint
=========================================
Delivers mugshots, criminal documents, and media evidence exclusively to authenticated
law enforcement officers holding valid JWT bearer tokens.
Guards against illegal path traversal attempts.
"""

import os
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import FileResponse

from app.core.config import settings
from app.core.security import get_current_user
from app.models.user import UserModel

router = APIRouter()

@router.get("/{folder}/{filename}")
def serve_protected_file(
    folder: str,
    filename: str,
    current_user: UserModel = Depends(get_current_user)
):
    """
    Serves stored evidence, mugshots, or documents only to authenticated officers.
    """
    # Strict Path Traversal Prevention
    if ".." in folder or ".." in filename or "/" in filename or "\\" in filename or "/" in folder or "\\" in folder:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Illegal directory traversal attempt."
        )

    safe_folder = os.path.basename(folder)
    safe_filename = os.path.basename(filename)

    allowed_folders = {"mugshots", "documents", "media"}
    if safe_folder not in allowed_folders:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access to specified storage location is restricted."
        )

    target_path = os.path.abspath(os.path.join(settings.STORAGE_DIR, safe_folder, safe_filename))

    if not target_path.startswith(os.path.abspath(settings.STORAGE_DIR)):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Path traversal outside storage root denied."
        )

    if not os.path.isfile(target_path):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Requested file object not found in storage."
        )

    # Infer content type safely
    ext = os.path.splitext(safe_filename)[1].lower()
    media_types = {
        ".jpg": "image/jpeg",
        ".jpeg": "image/jpeg",
        ".png": "image/png",
        ".webp": "image/webp",
        ".pdf": "application/pdf",
        ".txt": "text/plain",
    }
    media_type = media_types.get(ext, "application/octet-stream")

    return FileResponse(path=target_path, media_type=media_type)
