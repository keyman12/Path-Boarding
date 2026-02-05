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


class VerifyEmailCodeSubmit(BaseModel):
    code: str  # 6-digit code from email (digits only, validated in endpoint)


class VerifyEmailResponse(BaseModel):
    verified: bool
    message: str = "Email verified. You can continue."


class VerifyStatusResponse(BaseModel):
    verified: bool


class TestClearEmailSubmit(BaseModel):
    email: str  # email to clear for testing (re-use same email)


class TestClearEmailResponse(BaseModel):
    cleared: bool
    message: str
