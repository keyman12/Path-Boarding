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


class Step2Submit(BaseModel):
    legal_first_name: str
    legal_last_name: str
    date_of_birth: str
    address_country: str
    address_postcode: Optional[str] = None
    address_line1: str
    address_line2: Optional[str] = None
    address_town: str
    email: EmailStr
    phone_country_code: str
    phone_number: str


class Step2Response(BaseModel):
    saved: bool = True


class BoardingLoginSubmit(BaseModel):
    email: EmailStr
    password: str


class BoardingLoginResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    current_step: Optional[str] = None
    boarding_event_id: str
    invite_token: Optional[str] = None
