from typing import Any, Optional

from pydantic import BaseModel


class ProductCatalogItem(BaseModel):
    id: str
    product_type: str
    product_code: str
    name: str
    config_schema: Optional[dict[str, Any]] = None
    requires_store_epos: bool = False
