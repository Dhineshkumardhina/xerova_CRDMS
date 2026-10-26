from datetime import datetime, date
import uuid
from typing import List, Optional
from sqlalchemy import String, Text, Integer, Boolean, DateTime, Date, ForeignKey, Index
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.sql import func
from app.db.session import Base

class CriminalProfileModel(Base):
    __tablename__ = "criminals"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    name: Mapped[str] = mapped_column(String(150), index=True, nullable=False)
    normalized_name: Mapped[str] = mapped_column(String(150), index=True, nullable=False)
    alias: Mapped[Optional[str]] = mapped_column(String(150), nullable=True)
    father_name: Mapped[Optional[str]] = mapped_column(String(150), nullable=True)
    dob: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    age: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    gender: Mapped[str] = mapped_column(String(20), default="Male")
    phone_number: Mapped[Optional[str]] = mapped_column(String(30), index=True, nullable=True)
    identification_number: Mapped[Optional[str]] = mapped_column(String(100), unique=True, index=True, nullable=True)
    raw_id_number: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    
    primary_address: Mapped[Optional[str]] = mapped_column(Text, index=True, nullable=True)
    city: Mapped[Optional[str]] = mapped_column(String(100), index=True, nullable=True)
    state: Mapped[Optional[str]] = mapped_column(String(100), index=True, nullable=True)
    
    height: Mapped[Optional[str]] = mapped_column(String(30), nullable=True)
    weight: Mapped[Optional[str]] = mapped_column(String(30), nullable=True)
    eye_color: Mapped[Optional[str]] = mapped_column(String(30), nullable=True)
    hair_color: Mapped[Optional[str]] = mapped_column(String(30), nullable=True)
    
    mugshot_url: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    mugshot_date: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    
    risk_level: Mapped[str] = mapped_column(String(30), default="Medium Risk")
    status: Mapped[str] = mapped_column(String(50), index=True, default="Active")
    category: Mapped[str] = mapped_column(String(100), index=True, default="Theft")
    
    is_historical: Mapped[bool] = mapped_column(Boolean, default=False)
    is_archived: Mapped[bool] = mapped_column(Boolean, index=True, default=False)
    is_deleted: Mapped[bool] = mapped_column(Boolean, index=True, default=False)
    deleted_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    # Relationships
    aliases: Mapped[List["CriminalAliasModel"]] = relationship("CriminalAliasModel", back_populates="criminal", cascade="all, delete-orphan")
    identification_marks: Mapped[List["IdentificationMarkModel"]] = relationship("IdentificationMarkModel", back_populates="criminal", cascade="all, delete-orphan")
    photos: Mapped[List["CriminalPhotoModel"]] = relationship("CriminalPhotoModel", back_populates="criminal", cascade="all, delete-orphan")
    face_embeddings: Mapped[List["FaceEmbeddingModel"]] = relationship("FaceEmbeddingModel", back_populates="criminal", cascade="all, delete-orphan")
    case_links: Mapped[List["CriminalCaseModel"]] = relationship("CriminalCaseModel", back_populates="criminal", cascade="all, delete-orphan")
    document_links: Mapped[List["CriminalDocumentModel"]] = relationship("CriminalDocumentModel", back_populates="criminal", cascade="all, delete-orphan")

    __table_args__ = (
        Index("idx_criminal_search", "normalized_name", "status", "city"),
    )

class CriminalAliasModel(Base):
    __tablename__ = "criminal_aliases"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    criminal_id: Mapped[str] = mapped_column(String(36), ForeignKey("criminals.id", ondelete="CASCADE"), index=True, nullable=False)
    alias_name: Mapped[str] = mapped_column(String(150), index=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    # Relationships
    criminal: Mapped[CriminalProfileModel] = relationship("CriminalProfileModel", back_populates="aliases")

class IdentificationMarkModel(Base):
    __tablename__ = "identification_marks"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    criminal_id: Mapped[str] = mapped_column(String(36), ForeignKey("criminals.id", ondelete="CASCADE"), index=True, nullable=False)
    type: Mapped[str] = mapped_column(String(50), default="mark")
    description: Mapped[str] = mapped_column(Text, nullable=False)
    body_location: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    # Relationships
    criminal: Mapped[CriminalProfileModel] = relationship("CriminalProfileModel", back_populates="identification_marks")

class CriminalPhotoModel(Base):
    __tablename__ = "criminal_photos"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    criminal_id: Mapped[str] = mapped_column(String(36), ForeignKey("criminals.id", ondelete="CASCADE"), index=True, nullable=False)
    photo_url: Mapped[str] = mapped_column(String(500), nullable=False)
    storage_key: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    filename: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    content_type: Mapped[Optional[str]] = mapped_column(String(100), default="image/jpeg")
    size_bytes: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    is_primary_mugshot: Mapped[bool] = mapped_column(Boolean, default=False)
    intake_date: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    # Relationships
    criminal: Mapped[CriminalProfileModel] = relationship("CriminalProfileModel", back_populates="photos")
    face_embeddings: Mapped[List["FaceEmbeddingModel"]] = relationship("FaceEmbeddingModel", back_populates="photo")
