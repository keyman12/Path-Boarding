from sqlalchemy import Column, String, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.core.database import Base


class BoardingContact(Base):
    __tablename__ = "boarding_contact"

    id = Column(String(36), primary_key=True, index=True)
    boarding_event_id = Column(
        String(36), ForeignKey("boarding_events.id"), nullable=False, index=True, unique=True
    )
    email = Column(String(255), nullable=False)
    hashed_password = Column(String(255), nullable=False)
    email_verified_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    boarding_event = relationship("BoardingEvent", back_populates="contact")
