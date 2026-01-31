from sqlalchemy import Column, String, DateTime, Boolean
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.core.database import Base


class Partner(Base):
    __tablename__ = "partners"

    id = Column(String(36), primary_key=True, index=True)
    name = Column(String(255), nullable=False)
    external_id = Column(String(255), unique=True, index=True, nullable=True)
    email = Column(String(255), unique=True, index=True, nullable=False)
    logo_url = Column(String(512), nullable=True)
    hashed_password = Column(String(255), nullable=False)
    is_active = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    # relationships
    boarding_events = relationship("BoardingEvent", back_populates="partner")
    invites = relationship("Invite", back_populates="partner")
