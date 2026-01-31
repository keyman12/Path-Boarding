from typing import Optional

from pydantic import BaseModel, EmailStr


class InviteInfoPartner(BaseModel):
    name: str
    logo_url: Optional[str] = None


class InviteInfoResponse(BaseModel):
    partner: InviteInfoPartner
    merchant_name: Optional[str] = None
    boarding_event_id: str
    valid: bool


class Step1Submit(BaseModel):
    email: EmailStr
    confirm_email: EmailStr
    password: str


class Step1Response(BaseModel):
    sent: bool
    message: str = "Verification email sent. Check your inbox."


class VerifyEmailSubmit(BaseModel):
    code: str


class VerifyEmailResponse(BaseModel):
    verified: bool
    message: str = "Email verified. You can continue."
