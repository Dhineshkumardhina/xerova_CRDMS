from datetime import datetime
import uuid
from typing import Optional
from sqlalchemy import String, DateTime, ForeignKey, JSON
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.sql import func
from app.db.session import Base

class FaceEmbeddingModel(Base):
    __tablename__ = "face_embeddings"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    criminal_id: Mapped[str] = mapped_column(String(36), ForeignKey("criminals.id", ondelete="CASCADE"), index=True, nullable=False)
    photo_id: Mapped[Optional[str]] = mapped_column(String(36), ForeignKey("criminal_photos.id", ondelete="SET NULL"), nullable=True)
    
    # Store feature landmark array/vector as JSON for maximum portability across databases
    embedding_vector: Mapped[dict] = mapped_column(JSON, nullable=False)
    feature_metadata: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)
    
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    # Relationships
    criminal: Mapped["CriminalProfileModel"] = relationship("CriminalProfileModel", back_populates="face_embeddings")
    photo: Mapped[Optional["CriminalPhotoModel"]] = relationship("CriminalPhotoModel", back_populates="face_embeddings")
