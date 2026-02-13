from sqlalchemy import Column, String, DateTime, ForeignKey, Integer
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.core.database import Base


class ProductPackage(Base):
    """Product package created by ISV - bundle of products with UID."""

    __tablename__ = "product_packages"

    id = Column(String(36), primary_key=True, index=True)
    partner_id = Column(String(36), ForeignKey("partners.id"), nullable=False, index=True)
    uid = Column(String(64), nullable=False, index=True)  # Unique per partner, e.g. PKG-abc123
    name = Column(String(255), nullable=False)
    description = Column(String(2048), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    partner = relationship("Partner", back_populates="product_packages")
    items = relationship(
        "ProductPackageItem",
        back_populates="package",
        order_by="ProductPackageItem.sort_order",
        cascade="all, delete-orphan",
    )
    invites = relationship("Invite", back_populates="product_package")
