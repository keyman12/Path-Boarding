from datetime import datetime
from typing import Optional

from pydantic import BaseModel, EmailStr


class InviteCreate(BaseModel):
    email: Optional[EmailStr] = None
    merchant_name: Optional[str] = None


class InviteResponse(BaseModel):
    invite_url: str
    expires_at: datetime
    boarding_event_id: str
    token: str
