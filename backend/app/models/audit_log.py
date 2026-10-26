from datetime import datetime
import uuid
from typing import Optional
from sqlalchemy import String, Text, Float, Integer, DateTime, ForeignKey, JSON
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.sql import func
from app.db.session import Base

class AuditLogModel(Base):
    __tablename__ = "audit_logs"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    timestamp: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), index=True)
    user_id: Mapped[Optional[str]] = mapped_column(String(36), ForeignKey("users.id", ondelete="SET NULL"), index=True, nullable=True)
    officer_name: Mapped[str] = mapped_column(String(150), default="Authorized Officer")
    action: Mapped[str] = mapped_column(String(100), index=True, nullable=False)
    resource_type: Mapped[str] = mapped_column(String(50), index=True, default="System")
    result: Mapped[str] = mapped_column(String(20), default="SUCCESS")
    subject_name: Mapped[str] = mapped_column(String(150), nullable=False)
    subject_id: Mapped[str] = mapped_column(String(100), index=True, nullable=False)
    profile_id: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    time: Mapped[Optional[str]] = mapped_column(String(50), default="Just now")
    mugshot_url: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    
    ip_address: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    user_agent: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    details: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)

class SearchMetadataModel(Base):
    __tablename__ = "search_metadata"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id: Mapped[Optional[str]] = mapped_column(String(36), ForeignKey("users.id", ondelete="SET NULL"), index=True, nullable=True)
    query: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    filters: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)
    results_count: Mapped[int] = mapped_column(Integer, default=0)
    execution_time_ms: Mapped[float] = mapped_column(Float, default=0.0)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), index=True)
