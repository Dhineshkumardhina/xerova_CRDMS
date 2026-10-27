from fastapi import FastAPI, Depends, HTTPException, status, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session
from sqlalchemy.sql import text
from sqlalchemy.exc import SQLAlchemyError
from datetime import datetime, timezone

from app.core.config import settings
from app.core.exceptions import CRMSException
from app.core.rate_limit import rate_limiter
from app.db.session import engine, get_db
from app.db.base import Base
from app.api.v1.router import api_router

# Initialize Database tables
Base.metadata.create_all(bind=engine)

app = FastAPI(
    title=settings.PROJECT_NAME,
    version=settings.VERSION,
    openapi_url=f"{settings.API_V1_STR}/openapi.json"
)

# 1. OWASP Security Response Headers & Rate Limiting Middleware
@app.middleware("http")
async def add_security_headers_and_rate_limit(request: Request, call_next):
    path = request.url.path

    # Rate Limiting Enforcement on Sensitive Law Enforcement Endpoints
    try:
        if path == "/api/v1/auth/login" and request.method == "POST":
            rate_limiter.check_rate_limit(request, endpoint_key="auth_login", max_requests=30, window_seconds=60)
        elif (path == "/api/v1/search/photo" or path == "/api/v1/face-search") and request.method == "POST":
            rate_limiter.check_rate_limit(request, endpoint_key="photo_search", max_requests=120, window_seconds=60)
        elif path.startswith("/api/v1/criminals/") and path.endswith("/photos") and request.method == "POST":
            rate_limiter.check_rate_limit(request, endpoint_key="photo_upload", max_requests=120, window_seconds=60)
    except HTTPException as he:
        return JSONResponse(
            status_code=he.status_code,
            content={"detail": he.detail},
            headers=he.headers or {}
        )

    response = await call_next(request)

    # Security Headers
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["X-XSS-Protection"] = "1; mode=block"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    response.headers["Content-Security-Policy"] = "default-src 'self' https: data: 'unsafe-inline' 'unsafe-eval';"
    response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
    response.headers["Permissions-Policy"] = "camera=*, microphone=(), geolocation=()"

    return response

# 2. CORS Middleware (Restricted to local & trusted law enforcement origins)
allowed_origins = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "http://localhost:8000",
    "http://127.0.0.1:8000"
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_origin_regex=r"^https?://(localhost|127\.0\.0\.1|192\.168\.\d+\.\d+|172\.\d+\.\d+\.\d+)(:\d+)?$",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount API v1 router (All storage files delivered via protected /api/v1/storage router)
app.include_router(api_router, prefix=settings.API_V1_STR)

# Global Exception Handlers (Mask internal traces in production)
@app.exception_handler(CRMSException)
async def crms_exception_handler(request: Request, exc: CRMSException):
    return JSONResponse(
        status_code=exc.status_code,
        content={"detail": exc.message, "status_code": exc.status_code}
    )

@app.exception_handler(SQLAlchemyError)
async def sqlalchemy_exception_handler(request: Request, exc: SQLAlchemyError):
    # Mask raw database/SQL errors to prevent sensitive info leakage
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={
            "detail": "A database operational error occurred. Please try again or contact system administration.",
            "status_code": 500
        }
    )

@app.exception_handler(Exception)
async def general_exception_handler(request: Request, exc: Exception):
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={
            "detail": "An unexpected server error occurred.",
            "status_code": 500
        }
    )

# Health Endpoint (mounted at both /health and /api/v1/health)
@app.get("/health", tags=["system"])
@app.get(f"{settings.API_V1_STR}/health", tags=["system"])
def health_check(db: Session = Depends(get_db)):
    try:
        db.execute(text("SELECT 1"))
        return {
            "status": "healthy",
            "database": "connected",
            "version": settings.VERSION,
            "timestamp": datetime.now(timezone.utc).isoformat()
        }
    except Exception:
        raise HTTPException(
            status_code=503,
            detail={"status": "unhealthy", "database": "disconnected"}
        )

@app.get("/", tags=["system"])
def root():
    return {
        "status": "online",
        "system": settings.PROJECT_NAME,
        "version": settings.VERSION,
        "health": "/health",
        "docs": "/docs"
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
