from sqlalchemy import Column, String, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from sqlalchemy.dialects.postgresql import JSONB

from app.core.database import Base


class FeeSchedule(Base):
    __tablename__ = "fee_schedules"

    id = Column(String(36), primary_key=True, index=True)
    name = Column(String(255), nullable=False)
    rates = Column(JSONB, nullable=False, default=dict)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    partners = relationship("Partner", back_populates="fee_schedule")
