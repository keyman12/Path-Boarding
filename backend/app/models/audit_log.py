from sqlalchemy import Column, String, DateTime, Text
from sqlalchemy.sql import func

from app.core.database import Base


class AuditLog(Base):
    __tablename__ = "audit_log"

    id = Column(String(36), primary_key=True, index=True)
    action = Column(String(100), nullable=False, index=True)
    actor_type = Column(String(50), nullable=True)  # partner, merchant, system
    actor_id = Column(String(36), nullable=True, index=True)
    resource_type = Column(String(50), nullable=True)
    resource_id = Column(String(36), nullable=True, index=True)
    details = Column(Text, nullable=True)
    ip_address = Column(String(45), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
