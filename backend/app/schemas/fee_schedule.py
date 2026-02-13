from typing import Any

from pydantic import BaseModel, ConfigDict


# Single source of truth for fee schedule products. Add new products here only.
# Format: code -> { label, default rates }. DEFAULT_RATES is derived from this.
PRODUCT_SCHEMA: dict[str, dict[str, Any]] = {
    "pax_a920_pro": {"label": "PAX A920 Pro", "min_per_month": 20, "min_per_device": 250, "min_service": 5},
    "verifone_p400": {"label": "Verifone P400", "min_per_month": 20, "min_per_device": 250, "min_service": 5},
    "softpos": {"label": "SoftPOS", "min_per_month": 10},
    "payby_link": {"label": "PaybyLink", "min_amount": 0.2},
    "virtual_terminal": {"label": "QR code generation", "min_amount": 0.2},
    "debit": {"label": "Debit", "min_pct": 0.8},
    "credit": {"label": "Credit", "min_pct": 1.3},
    "premium": {"label": "Premium", "min_pct": 0.5},
    "cross_border": {"label": "Cross Border", "min_pct": 0.6},
    "cnp": {"label": "CNP", "min_pct": 0.4},
    "auth_fee": {"label": "Authorisation Fee", "min_amount": 0.01},
    "refund_fee": {"label": "Refund Fee", "min_amount": 0.05},
    "three_d_secure_fee": {"label": "3D Secure Fee", "min_amount": 0.03},
}

# Rate keys to exclude from the rates dict (metadata only)
_RATE_KEYS = {"min_pct", "min_amount", "min_per_month", "min_per_device", "min_service"}


def _product_to_rates(product: dict[str, Any]) -> dict[str, Any]:
    return {k: v for k, v in product.items() if k in _RATE_KEYS and isinstance(v, (int, float))}


DEFAULT_RATES: dict[str, dict[str, Any]] = {
    code: _product_to_rates(p) for code, p in PRODUCT_SCHEMA.items()
}


class FeeScheduleCreate(BaseModel):
    name: str
    rates: dict[str, dict[str, Any]] | None = None


class FeeScheduleUpdate(BaseModel):
    name: str | None = None
    rates: dict[str, dict[str, Any]] | None = None


class FeeScheduleResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    name: str
    rates: dict[str, dict[str, Any]]
