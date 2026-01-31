from sqlalchemy import Column, String, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.core.database import Base


class Invite(Base):
    __tablename__ = "invites"

    id = Column(String(36), primary_key=True, index=True)
    partner_id = Column(String(36), ForeignKey("partners.id"), nullable=False, index=True)
    boarding_event_id = Column(
        String(36), ForeignKey("boarding_events.id"), nullable=False, index=True
    )
    token = Column(String(64), unique=True, index=True, nullable=False)
    email = Column(String(255), nullable=True)
    merchant_name = Column(String(255), nullable=True)
    expires_at = Column(DateTime(timezone=True), nullable=False)
    used_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    # relationships
    partner = relationship("Partner", back_populates="invites")
    boarding_event = relationship("BoardingEvent", back_populates="invites")
