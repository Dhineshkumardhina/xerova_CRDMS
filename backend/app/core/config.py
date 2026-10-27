import os
from typing import Optional
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    PROJECT_NAME: str = "CRMS - Crime Record Management System API"
    VERSION: str = "1.0.0"
    API_V1_STR: str = "/api/v1"
    
    ENVIRONMENT: str = os.getenv("ENVIRONMENT", "development")
    SECRET_KEY: str = os.getenv("JWT_SECRET_KEY") or os.getenv("SECRET_KEY", "crms-doj-super-secret-key-change-in-production-2026")
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = int(os.getenv("JWT_ACCESS_TOKEN_EXPIRE_MINUTES") or os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "60"))
    REFRESH_TOKEN_EXPIRE_DAYS: int = int(os.getenv("JWT_REFRESH_TOKEN_EXPIRE_DAYS", "30"))
    
    # Biometric Face Recognition Configurable Tolerance & Model
    # ageitgey/face_recognition: Euclidean distance threshold (default 0.60, lower is stricter)
    FACE_RECOGNITION_TOLERANCE: float = float(os.getenv("FACE_RECOGNITION_TOLERANCE", "0.6"))
    FACE_DETECTION_MODEL: str = os.getenv("FACE_DETECTION_MODEL", "hog") # "hog" (CPU compatible) or "cnn" (GPU)
    FACE_MATCH_THRESHOLD: float = float(os.getenv("FACE_MATCH_THRESHOLD", "0.6"))
    FACE_SDK_LICENSE: str = os.getenv("FACE_SDK_LICENSE", "")
    
    # PostgreSQL Settings
    POSTGRES_SERVER: str = os.getenv("POSTGRES_SERVER", "localhost")
    POSTGRES_USER: str = os.getenv("POSTGRES_USER", "postgres")
    POSTGRES_PASSWORD: str = os.getenv("POSTGRES_PASSWORD", "postgres")
    POSTGRES_DB: str = os.getenv("POSTGRES_DB", "crms_db")
    POSTGRES_PORT: str = os.getenv("POSTGRES_PORT", "5432")

    # Cloudflare R2 Cloud Storage Settings (100% Free - 10GB Monthly)
    R2_ACCOUNT_ID: str = os.getenv("R2_ACCOUNT_ID", "")
    R2_ACCESS_KEY_ID: str = os.getenv("R2_ACCESS_KEY_ID", "")
    R2_SECRET_ACCESS_KEY: str = os.getenv("R2_SECRET_ACCESS_KEY", "")
    R2_BUCKET_NAME: str = os.getenv("R2_BUCKET_NAME", "netra-crms-storage")
    R2_PUBLIC_URL: str = os.getenv("R2_PUBLIC_URL", "")
    
    # Fallback/Default Database URL
    DATABASE_URL: str = os.getenv(
        "DATABASE_URL",
        f"sqlite:///{os.path.abspath(os.path.join(os.path.dirname(__file__), '../../..', 'crms_dev.db'))}"
    )
    
    # Local storage paths
    STORAGE_DIR: str = os.path.abspath(os.path.join(os.path.dirname(__file__), "../../..", "storage"))
    MUGSHOTS_DIR: str = os.path.join(STORAGE_DIR, "mugshots")
    DOCUMENTS_DIR: str = os.path.join(STORAGE_DIR, "documents")
    MEDIA_DIR: str = os.path.join(STORAGE_DIR, "media")

    model_config = {"case_sensitive": True}

settings = Settings()

# Ensure directories exist
os.makedirs(settings.MUGSHOTS_DIR, exist_ok=True)
os.makedirs(settings.DOCUMENTS_DIR, exist_ok=True)
os.makedirs(settings.MEDIA_DIR, exist_ok=True)
