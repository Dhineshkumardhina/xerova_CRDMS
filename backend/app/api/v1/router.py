from fastapi import APIRouter
from app.api.v1.endpoints import (
    auth,
    criminals,
    cases,
    categories,
    documents,
    search,
    users,
    audit,
    media,
    face_search,
    face_recognition_endpoint,
    analytics,
    storage_endpoint
)

api_router = APIRouter()

api_router.include_router(auth.router, prefix="/auth", tags=["auth"])
api_router.include_router(criminals.router, prefix="/criminals", tags=["criminals"])
api_router.include_router(cases.router, prefix="/cases", tags=["cases"])
api_router.include_router(categories.router, prefix="/categories", tags=["categories"])
api_router.include_router(documents.router, prefix="/documents", tags=["documents"])
api_router.include_router(search.router, prefix="/search", tags=["search"])
api_router.include_router(users.router, prefix="/users", tags=["users"])
api_router.include_router(audit.router, prefix="/audit", tags=["audit"])
api_router.include_router(audit.router, prefix="/audit-logs", tags=["audit"])
api_router.include_router(media.router, prefix="/media", tags=["media"])
api_router.include_router(face_search.router, prefix="/face-search", tags=["face-search"])
api_router.include_router(face_search.router, prefix="/search/photo", tags=["face-search"])
api_router.include_router(face_search.router, prefix="/scan-face", tags=["face-search"])
api_router.include_router(face_recognition_endpoint.router, prefix="/face-recognition", tags=["face-recognition"])
api_router.include_router(analytics.router, prefix="/analytics", tags=["analytics"])
api_router.include_router(analytics.router, prefix="/reports/analytics", tags=["analytics"])
api_router.include_router(storage_endpoint.router, prefix="/storage", tags=["storage"])
api_router.include_router(storage_endpoint.router, prefix="/files", tags=["storage"])
