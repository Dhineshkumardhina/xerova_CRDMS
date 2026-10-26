from datetime import datetime
import uuid
from typing import List, Optional
from sqlalchemy import String, Integer, DateTime, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.sql import func
from app.db.session import Base

class DocumentItemModel(Base):
    __tablename__ = "documents"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    filename: Mapped[str] = mapped_column(String(255), nullable=False)
    storage_key: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    file_path: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    file_type: Mapped[str] = mapped_column(String(50), default="pdf")
    document_category: Mapped[str] = mapped_column(String(100), default="Evidence Attachment")
    size: Mapped[str] = mapped_column(String(50), default="1.0 MB")
    file_size_bytes: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    file_hash_sha256: Mapped[Optional[str]] = mapped_column(String(64), index=True, nullable=True)
    date_uploaded: Mapped[str] = mapped_column(String(50), default="Today")
    
    uploaded_by_id: Mapped[Optional[str]] = mapped_column(String(36), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    # Relationships
    uploaded_by: Mapped[Optional["UserModel"]] = relationship("UserModel", back_populates="uploaded_documents")
    criminal_links: Mapped[List["CriminalDocumentModel"]] = relationship("CriminalDocumentModel", back_populates="document", cascade="all, delete-orphan")
    case_links: Mapped[List["CaseDocumentModel"]] = relationship("CaseDocumentModel", back_populates="document", cascade="all, delete-orphan")

class CriminalDocumentModel(Base):
    __tablename__ = "criminal_documents"

    criminal_id: Mapped[str] = mapped_column(String(36), ForeignKey("criminals.id", ondelete="CASCADE"), primary_key=True, index=True)
    document_id: Mapped[str] = mapped_column(String(36), ForeignKey("documents.id", ondelete="CASCADE"), primary_key=True, index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    # Relationships
    criminal: Mapped["CriminalProfileModel"] = relationship("CriminalProfileModel", back_populates="document_links")
    document: Mapped[DocumentItemModel] = relationship("DocumentItemModel", back_populates="criminal_links")

class CaseDocumentModel(Base):
    __tablename__ = "case_documents"

    case_id: Mapped[str] = mapped_column(String(36), ForeignKey("cases.id", ondelete="CASCADE"), primary_key=True, index=True)
    document_id: Mapped[str] = mapped_column(String(36), ForeignKey("documents.id", ondelete="CASCADE"), primary_key=True, index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    # Relationships
    case: Mapped["CaseRecordModel"] = relationship("CaseRecordModel", back_populates="document_links")
    document: Mapped[DocumentItemModel] = relationship("DocumentItemModel", back_populates="case_links")
