from sqlalchemy import Column, String, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.core.database import Base


class InviteDeviceDetail(Base):
    """Store/EPOS details for POS devices - filled at invite creation."""

    __tablename__ = "invite_device_details"

    id = Column(String(36), primary_key=True, index=True)
    invite_id = Column(String(36), ForeignKey("invites.id", ondelete="CASCADE"), nullable=False, index=True)
    package_item_id = Column(String(36), ForeignKey("product_package_items.id", ondelete="CASCADE"), nullable=False, index=True)
    store_name = Column(String(255), nullable=True)
    store_address = Column(String(1024), nullable=True)
    epos_terminal = Column(String(255), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    invite = relationship("Invite", back_populates="device_details")
    package_item = relationship("ProductPackageItem", backref="invite_device_details")
