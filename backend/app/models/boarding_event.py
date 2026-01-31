from sqlalchemy import Column, String, Integer, DateTime, ForeignKey, Enum
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
import enum

from app.core.database import Base


class BoardingStatus(str, enum.Enum):
    draft = "draft"
    in_progress = "in_progress"
    pending_kyc = "pending_kyc"
    pending_review = "pending_review"
    completed = "completed"
    rejected = "rejected"


class BoardingEvent(Base):
    __tablename__ = "boarding_events"

    id = Column(String(36), primary_key=True, index=True)
    partner_id = Column(String(36), ForeignKey("partners.id"), nullable=False, index=True)
    merchant_id = Column(String(36), ForeignKey("merchants.id"), nullable=True, index=True)
    status = Column(
        Enum(BoardingStatus),
        default=BoardingStatus.draft,
        nullable=False,
        index=True,
    )
    current_step = Column(Integer, default=1, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    completed_at = Column(DateTime(timezone=True), nullable=True)

    # relationships
    partner = relationship("Partner", back_populates="boarding_events")
    merchant = relationship("Merchant", back_populates="boarding_events")
    invites = relationship("Invite", back_populates="boarding_event")
    contact = relationship("BoardingContact", back_populates="boarding_event", uselist=False)
