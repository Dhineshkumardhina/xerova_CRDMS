from datetime import datetime
import uuid
from typing import List, Optional
from sqlalchemy import String, Boolean, DateTime, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.sql import func
from app.db.session import Base

class UserModel(Base):
    __tablename__ = "users"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    username: Mapped[str] = mapped_column(String(50), unique=True, index=True, nullable=False)
    email: Mapped[Optional[str]] = mapped_column(String(100), unique=True, index=True, nullable=True)
    hashed_password: Mapped[str] = mapped_column(String(255), nullable=False)
    full_name: Mapped[str] = mapped_column(String(150), nullable=False)
    badge_number: Mapped[str] = mapped_column(String(50), unique=True, index=True, nullable=False)
    rank: Mapped[str] = mapped_column(String(50), default="Detective")
    department: Mapped[str] = mapped_column(String(100), default="Homicide & Major Crimes Division")
    clearance_level: Mapped[str] = mapped_column(String(50), default="Level 4 - Top Secret")
    avatar_url: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    is_superuser: Mapped[bool] = mapped_column(Boolean, default=False)
    
    role_id: Mapped[Optional[str]] = mapped_column(String(36), ForeignKey("roles.id", ondelete="SET NULL"), nullable=True)
    police_station_id: Mapped[Optional[str]] = mapped_column(String(36), ForeignKey("police_stations.id", ondelete="SET NULL"), nullable=True)
    
    state: Mapped[Optional[str]] = mapped_column(String(100), index=True, nullable=True)
    district: Mapped[Optional[str]] = mapped_column(String(100), index=True, nullable=True)
    region: Mapped[Optional[str]] = mapped_column(String(100), index=True, nullable=True)
    
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    # Compatibility properties
    @property
    def name(self) -> str:
        return self.full_name

    @property
    def status(self) -> str:
        return "On Duty" if self.is_active else "Inactive"

    # Relationships
    role: Mapped[Optional["RoleModel"]] = relationship("RoleModel", back_populates="users")
    police_station: Mapped[Optional["PoliceStationModel"]] = relationship("PoliceStationModel", back_populates="officers")
    refresh_tokens: Mapped[List["RefreshTokenModel"]] = relationship("RefreshTokenModel", back_populates="user", cascade="all, delete-orphan")
    investigated_cases: Mapped[List["CaseRecordModel"]] = relationship("CaseRecordModel", back_populates="lead_officer")
    uploaded_documents: Mapped[List["DocumentItemModel"]] = relationship("DocumentItemModel", back_populates="uploaded_by")
    permission_grants: Mapped[List["UserPermissionGrantModel"]] = relationship(
        "UserPermissionGrantModel",
        foreign_keys="UserPermissionGrantModel.user_id",
        back_populates="user",
        cascade="all, delete-orphan"
    )

User = UserModel

