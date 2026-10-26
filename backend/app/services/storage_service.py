import os
import io
import uuid
import hashlib
from typing import Dict, Any, Optional
from PIL import Image
from fastapi import HTTPException, status
from app.core.config import settings

ALLOWED_MIME_TYPES = {"image/jpeg", "image/jpg", "image/png", "image/webp"}
MAX_PHOTO_SIZE_BYTES = 10 * 1024 * 1024  # 10 MB

ALLOWED_DOC_EXTENSIONS = {".pdf", ".doc", ".docx", ".jpg", ".jpeg", ".png", ".txt"}
MAX_DOC_SIZE_BYTES = 25 * 1024 * 1024  # 25 MB

class LocalStorageBackend:
    def __init__(self, base_dir: str = settings.STORAGE_DIR):
        self.base_dir = os.path.abspath(base_dir)

    def _verify_safe_path(self, storage_key: str) -> str:
        if not storage_key or ".." in storage_key:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Illegal path traversal attempt detected."
            )
        target_path = os.path.abspath(os.path.join(self.base_dir, storage_key))
        if not target_path.startswith(self.base_dir):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Access denied: Path traversal outside of storage directory."
            )
        return target_path

    def save(self, file_bytes: bytes, storage_key: str) -> str:
        full_path = self._verify_safe_path(storage_key)
        os.makedirs(os.path.dirname(full_path), exist_ok=True)
        with open(full_path, "wb") as f:
            f.write(file_bytes)
        return full_path

    def delete(self, storage_key: str) -> bool:
        full_path = self._verify_safe_path(storage_key)
        if os.path.exists(full_path):
            try:
                os.remove(full_path)
                return True
            except OSError:
                return False
        return False

class CloudflareR2Backend:
    """
    Cloudflare R2 Object Storage Backend (S3-Compatible API).
    Provides 100% free cloud object storage (10GB/month with $0 egress fees).
    """

    def __init__(self):
        self.account_id = settings.R2_ACCOUNT_ID
        self.access_key_id = settings.R2_ACCESS_KEY_ID
        self.secret_access_key = settings.R2_SECRET_ACCESS_KEY
        self.bucket_name = settings.R2_BUCKET_NAME or "netra-crms-storage"
        self.public_url = settings.R2_PUBLIC_URL.rstrip("/") if settings.R2_PUBLIC_URL else ""
        
        endpoint_url = f"https://{self.account_id}.r2.cloudflarestorage.com"
        
        try:
            import boto3
            from botocore.config import Config
            self.s3_client = boto3.client(
                "s3",
                endpoint_url=endpoint_url,
                aws_access_key_id=self.access_key_id,
                aws_secret_access_key=self.secret_access_key,
                config=Config(signature_version="s3v4"),
                region_name="auto"
            )
        except Exception as exc:
            raise RuntimeError(f"Cloudflare R2 boto3 initialization failed: {exc}")

    def save(self, file_bytes: bytes, storage_key: str, content_type: str = "application/octet-stream") -> str:
        self.s3_client.put_object(
            Bucket=self.bucket_name,
            Key=storage_key,
            Body=file_bytes,
            ContentType=content_type
        )
        if self.public_url:
            return f"{self.public_url}/{storage_key}"
        return f"/api/v1/storage/{storage_key}"

    def get_bytes(self, storage_key: str) -> bytes:
        resp = self.s3_client.get_object(Bucket=self.bucket_name, Key=storage_key)
        return resp["Body"].read()

    def delete(self, storage_key: str) -> bool:
        try:
            self.s3_client.delete_object(Bucket=self.bucket_name, Key=storage_key)
            return True
        except Exception:
            return False

class StorageService:
    def __init__(self):
        # Auto-detect Cloudflare R2 Cloud Storage credentials
        if settings.R2_ACCOUNT_ID and settings.R2_ACCESS_KEY_ID and settings.R2_SECRET_ACCESS_KEY:
            try:
                self.backend = CloudflareR2Backend()
                self.backend_name = "Cloudflare R2"
            except Exception:
                self.backend = LocalStorageBackend()
                self.backend_name = "Local Disk Storage (Fallback)"
        else:
            self.backend = LocalStorageBackend()
            self.backend_name = "Local Disk Storage"

    def validate_and_save_photo(
        self,
        file_bytes: bytes,
        original_filename: str,
        content_type: str,
        criminal_id: str
    ) -> Dict[str, Any]:
        if len(file_bytes) > MAX_PHOTO_SIZE_BYTES:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"File size ({round(len(file_bytes)/(1024*1024), 2)}MB) exceeds maximum limit of 10MB."
            )
            
        if len(file_bytes) == 0:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Empty image file provided."
            )

        normalized_ct = (content_type or "").lower().strip()
        if normalized_ct not in ALLOWED_MIME_TYPES:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid file type '{content_type}'. Allowed image types: JPEG, PNG, WEBP."
            )

        try:
            image = Image.open(io.BytesIO(file_bytes))
            image.verify()
            ext = image.format.lower() if image.format else "jpg"
            if ext == "jpeg":
                ext = "jpg"
        except Exception:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Corrupted image file or unreadable header signature."
            )

        unique_id = uuid.uuid4().hex
        safe_criminal_id = str(criminal_id).replace("/", "").replace("\\", "").replace("..", "")
        storage_key = f"mugshots/crim_{safe_criminal_id[:8]}_{unique_id}.{ext}"
        self.backend.save(file_bytes, storage_key)

        return {
            "storage_key": storage_key,
            "url": f"/storage/{storage_key}",
            "size_bytes": len(file_bytes),
            "content_type": normalized_ct,
            "filename": f"mugshot_{unique_id[:8]}.{ext}"
        }

    def validate_and_save_document(
        self,
        file_bytes: bytes,
        original_filename: str,
        content_type: Optional[str] = None
    ) -> Dict[str, Any]:
        if len(file_bytes) > MAX_DOC_SIZE_BYTES:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Document size ({round(len(file_bytes)/(1024*1024), 2)}MB) exceeds maximum limit of 25MB."
            )
            
        if len(file_bytes) == 0:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Empty document file provided."
            )

        ext = os.path.splitext(original_filename)[1].lower()
        if not ext or ext not in ALLOWED_DOC_EXTENSIONS:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid document file extension '{ext}'. Allowed extensions: {', '.join(ALLOWED_DOC_EXTENSIONS)}"
            )

        file_hash = hashlib.sha256(file_bytes).hexdigest()
        unique_id = uuid.uuid4().hex
        safe_ext = ext.lstrip(".")
        storage_key = f"documents/doc_{unique_id}.{safe_ext}"
        
        self.backend.save(file_bytes, storage_key)

        return {
            "storage_key": storage_key,
            "url": f"/storage/{storage_key}",
            "size_bytes": len(file_bytes),
            "file_hash_sha256": file_hash,
            "filename": original_filename,
            "ext": safe_ext
        }

    def delete_photo(self, storage_key: str) -> bool:
        if not storage_key:
            return False
        return self.backend.delete(storage_key)

    def delete_document(self, storage_key: str) -> bool:
        if not storage_key:
            return False
        return self.backend.delete(storage_key)

storage_service = StorageService()
