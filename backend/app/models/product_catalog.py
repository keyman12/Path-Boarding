from sqlalchemy import Column, String, Boolean, DateTime
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.sql import func

from app.core.database import Base


class ProductCatalog(Base):
    """Global product catalog - POS, Ecommerce, Acquiring, Other fees."""

    __tablename__ = "product_catalog"

    id = Column(String(36), primary_key=True, index=True)
    product_type = Column(String(32), nullable=False, index=True)  # physical_pos, ecomm, acquiring, other_fee
    product_code = Column(String(64), nullable=False, unique=True, index=True)
    name = Column(String(255), nullable=False)
    config_schema = Column(JSONB, nullable=True)  # min_pct, min_amount, can_standalone, etc.
    requires_store_epos = Column(Boolean, default=False, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
