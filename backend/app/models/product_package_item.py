from sqlalchemy import Column, String, Integer, DateTime, ForeignKey
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.core.database import Base


class ProductPackageItem(Base):
    """Item in a product package - links to catalog product with config override."""

    __tablename__ = "product_package_items"

    id = Column(String(36), primary_key=True, index=True)
    package_id = Column(String(36), ForeignKey("product_packages.id", ondelete="CASCADE"), nullable=False, index=True)
    catalog_product_id = Column(String(36), ForeignKey("product_catalog.id"), nullable=False, index=True)
    config = Column(JSONB, nullable=True)  # Override: {debit_pct: 0.9}, {enabled: true}, etc.
    sort_order = Column(Integer, default=0, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    package = relationship("ProductPackage", back_populates="items")
    catalog_product = relationship("ProductCatalog", backref="package_items")
