# Fee Schedule Architecture Plan

## Overview

Move from hardcoded minimum fees to Admin-configurable fee schedules. Each ISV (partner) must have an attached fee schedule; one fee schedule can be shared by many partners.

## Relationships

- **Partner** → has one `fee_schedule_id` (required)
- **Fee schedule** → can be assigned to many partners (1:many)

## Design Decisions

| Aspect | Design |
|--------|--------|
| **Fee schedule content** | Minimums per product/field (same structure as today) |
| **Edit access** | Admin only; ISVs see and use minimums when creating packages |
| **Cardinality** | Partner has 1 schedule; Schedule can serve many partners |
| **Defaults** | New schedules pre-filled from current hardcoded values; Admin edits and saves with a name |
| **Mandatory** | Partner cannot exist without an attached fee schedule |
| **Location** | Admin page only |

## Partner Creation Flow

1. Admin creates fee schedule (pre-loaded with defaults) → saves with name (e.g. "Standard Retail")
2. Admin creates partner → selects/attaches that fee schedule (or creates new one from defaults)
3. Fee schedule can be reused when creating additional partners

## Implementation

### Backend
- `fee_schedules` table: `id`, `name`, `rates` (JSONB)
- `partners.fee_schedule_id` (required FK)
- Admin CRUD for fee schedules
- Partner create: require fee_schedule_id
- Partner/package APIs: return fee schedule minimums for validation

### Frontend
- Admin: Fee schedule list/create/edit; partner form requires schedule selection
- Product package wizard: load minimums from partner's fee schedule

### Adding new products

**Single place to add:** `backend/app/schemas/fee_schedule.py` → `PRODUCT_SCHEMA`

```python
PRODUCT_SCHEMA = {
    "new_product_code": {"label": "Display Name", "min_amount": 0.5},  # or min_pct, min_per_month, etc.
    ...
}
```

DEFAULT_RATES is derived automatically. The admin fee schedule editor and wizard use this via `GET /admin/fee-schedule-schema`. Also add the product to the catalog migration if it's a new catalog item.
