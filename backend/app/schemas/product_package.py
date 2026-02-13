from typing import Any, Optional

from pydantic import BaseModel


class PackageItemCreate(BaseModel):
    catalog_product_id: str
    config: Optional[dict[str, Any]] = None
    sort_order: int = 0


class PackageItemResponse(BaseModel):
    id: str
    catalog_product_id: str
    product_code: Optional[str] = None
    product_name: Optional[str] = None
    product_type: Optional[str] = None
    config: Optional[dict[str, Any]] = None
    sort_order: int
    requires_store_epos: bool = False


class ProductPackageCreate(BaseModel):
    name: str
    description: Optional[str] = None
    items: list[PackageItemCreate] = []


class ProductPackageUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    items: Optional[list[PackageItemCreate]] = None


class ProductPackageResponse(BaseModel):
    id: str
    partner_id: str
    uid: str
    name: str
    description: Optional[str] = None
    items: list[PackageItemResponse] = []
    created_at: Optional[str] = None
