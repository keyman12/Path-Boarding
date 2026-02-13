from datetime import datetime
from typing import Optional

from pydantic import BaseModel, EmailStr


class DeviceDetailInput(BaseModel):
    package_item_id: str
    store_name: Optional[str] = None
    store_address: Optional[str] = None
    epos_terminal: Optional[str] = None


class InviteCreate(BaseModel):
    email: Optional[EmailStr] = None
    merchant_name: Optional[str] = None
    product_package_uid: Optional[str] = None
    device_details: Optional[list[DeviceDetailInput]] = None


class InviteResponse(BaseModel):
    invite_url: str
    expires_at: datetime
    boarding_event_id: str
    token: str
