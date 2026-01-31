from sqlalchemy import Column, String, DateTime
from sqlalchemy.sql import func

from app.core.database import Base


class AdminUser(Base):
    __tablename__ = "admin_users"

    id = Column(String(36), primary_key=True, index=True)
    username = Column(String(100), unique=True, index=True, nullable=False)
    hashed_password = Column(String(255), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
