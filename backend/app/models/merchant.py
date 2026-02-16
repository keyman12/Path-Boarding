from sqlalchemy import Column, String, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.core.database import Base


class Merchant(Base):
    __tablename__ = "merchants"

    id = Column(String(36), primary_key=True, index=True)
    partner_id = Column(String(36), ForeignKey("partners.id"), nullable=False, index=True)
    legal_name = Column(String(255), nullable=True)
    trading_name = Column(String(255), nullable=True)
    agreement_pdf_path = Column(String(512), nullable=True)  # Path to generated agreement PDF
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    # relationships
    boarding_events = relationship("BoardingEvent", back_populates="merchant")
    users = relationship("MerchantUser", back_populates="merchant")
