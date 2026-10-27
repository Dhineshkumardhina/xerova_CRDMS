from datetime import datetime, date
import uuid
from typing import List, Optional
from sqlalchemy import String, Text, Integer, Boolean, DateTime, Date, ForeignKey, Index
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.sql import func
from app.db.session import Base

class CrimeCategoryModel(Base):
    __tablename__ = "crime_categories"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    name: Mapped[str] = mapped_column(String(100), unique=True, index=True, nullable=False)
    code: Mapped[str] = mapped_column(String(50), unique=True, index=True, nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    severity_level: Mapped[str] = mapped_column(String(30), default="Medium")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    # Relationships
    case_links: Mapped[List["CaseCategoryModel"]] = relationship("CaseCategoryModel", back_populates="crime_category")

class CaseCategoryModel(Base):
    __tablename__ = "case_categories"

    case_id: Mapped[str] = mapped_column(String(36), ForeignKey("cases.id", ondelete="CASCADE"), primary_key=True, index=True)
    crime_category_id: Mapped[str] = mapped_column(String(36), ForeignKey("crime_categories.id", ondelete="CASCADE"), primary_key=True, index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    # Relationships
    case: Mapped["CaseRecordModel"] = relationship("CaseRecordModel", back_populates="category_links")
    crime_category: Mapped[CrimeCategoryModel] = relationship("CrimeCategoryModel", back_populates="case_links")

class CriminalCaseModel(Base):
    __tablename__ = "criminal_cases"

    criminal_id: Mapped[str] = mapped_column(String(36), ForeignKey("criminals.id", ondelete="CASCADE"), primary_key=True, index=True)
    case_id: Mapped[str] = mapped_column(String(36), ForeignKey("cases.id", ondelete="CASCADE"), primary_key=True, index=True)
    role_in_case: Mapped[str] = mapped_column(String(100), default="Primary Suspect")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    # Relationships
    criminal: Mapped["CriminalProfileModel"] = relationship("CriminalProfileModel", back_populates="case_links")
    case: Mapped["CaseRecordModel"] = relationship("CaseRecordModel", back_populates="criminal_links")

class CaseActivityModel(Base):
    __tablename__ = "case_activities"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    case_id: Mapped[str] = mapped_column(String(36), ForeignKey("cases.id", ondelete="CASCADE"), index=True, nullable=False)
    officer_id: Mapped[Optional[str]] = mapped_column(String(36), ForeignKey("users.id", ondelete="SET NULL"), index=True, nullable=True)
    activity_type: Mapped[str] = mapped_column(String(50), default="Investigation Note")
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    # Relationships
    case: Mapped["CaseRecordModel"] = relationship("CaseRecordModel", back_populates="activities")
    officer: Mapped[Optional["UserModel"]] = relationship("UserModel")

class CaseRecordModel(Base):
    __tablename__ = "cases"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    case_number: Mapped[str] = mapped_column(String(100), unique=True, index=True, nullable=False)
    title: Mapped[Optional[str]] = mapped_column(String(200), nullable=True)
    description: Mapped[str] = mapped_column(Text, nullable=False)
    date_filed: Mapped[str] = mapped_column(String(50), index=True, nullable=False)
    status: Mapped[str] = mapped_column(String(50), index=True, default="Under Investigation")
    category: Mapped[str] = mapped_column(String(100), index=True, default="Theft")
    
    police_station_id: Mapped[Optional[str]] = mapped_column(String(36), ForeignKey("police_stations.id", ondelete="SET NULL"), index=True, nullable=True)
    lead_officer_id: Mapped[Optional[str]] = mapped_column(String(36), ForeignKey("users.id", ondelete="SET NULL"), index=True, nullable=True)

    incident_date: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    incident_location: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    complainant_name: Mapped[Optional[str]] = mapped_column(String(150), nullable=True)
    complainant_phone: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    penal_code: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    court_room: Mapped[Optional[str]] = mapped_column(String(150), nullable=True)
    presiding_judge: Mapped[Optional[str]] = mapped_column(String(150), nullable=True)
    courtroom_notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    penalties: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    
    is_archived: Mapped[bool] = mapped_column(Boolean, index=True, default=False)
    is_deleted: Mapped[bool] = mapped_column(Boolean, index=True, default=False)
    deleted_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    # Relationships
    police_station: Mapped[Optional["PoliceStationModel"]] = relationship("PoliceStationModel", back_populates="cases")
    lead_officer: Mapped[Optional["UserModel"]] = relationship("UserModel", back_populates="investigated_cases")
    category_links: Mapped[List[CaseCategoryModel]] = relationship("CaseCategoryModel", back_populates="case", cascade="all, delete-orphan")
    criminal_links: Mapped[List[CriminalCaseModel]] = relationship("CriminalCaseModel", back_populates="case", cascade="all, delete-orphan")
    document_links: Mapped[List["CaseDocumentModel"]] = relationship("CaseDocumentModel", back_populates="case", cascade="all, delete-orphan")
    activities: Mapped[List[CaseActivityModel]] = relationship("CaseActivityModel", back_populates="case", cascade="all, delete-orphan")

