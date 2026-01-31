from sqlalchemy import Column, String, DateTime, Integer
from sqlalchemy.sql import func

from app.core.database import Base


class VerificationCode(Base):
    __tablename__ = "verification_codes"

    id = Column(String(36), primary_key=True, index=True)
    channel = Column(String(20), nullable=False)  # email, sms
    contact = Column(String(255), nullable=False, index=True)  # email or phone
    code = Column(String(10), nullable=False)
    expires_at = Column(DateTime(timezone=True), nullable=False)
    used_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
