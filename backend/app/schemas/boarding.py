from typing import Any, Optional

from pydantic import BaseModel, EmailStr


class InviteInfoPartner(BaseModel):
    name: str
    logo_url: Optional[str] = None


class ProductPackageItemDisplay(BaseModel):
    id: str
    product_code: str
    product_name: str
    product_type: str
    config: Optional[dict[str, Any]] = None
    store_name: Optional[str] = None
    store_address: Optional[str] = None
    epos_terminal: Optional[str] = None


class ProductPackageDisplay(BaseModel):
    id: str
    uid: str
    name: str
    description: Optional[str] = None
    items: list[ProductPackageItemDisplay] = []


class InviteInfoResponse(BaseModel):
    partner: InviteInfoPartner
    merchant_name: Optional[str] = None
    boarding_event_id: str
    valid: bool
    product_package: Optional[ProductPackageDisplay] = None


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


class SumsubTokenResponse(BaseModel):
    token: str
    user_id: str


class SaveForLaterSubmit(BaseModel):
    current_step: Optional[str] = None  # form, verify, step2, step3, step4, step5
    # Step 5 business details (optional, for step5)
    vat_number: Optional[str] = None
    customer_industry: Optional[str] = None
    estimated_monthly_card_volume: Optional[str] = None
    average_transaction_value: Optional[str] = None
    delivery_timeframe: Optional[str] = None
    customer_support_email: Optional[str] = None
    customer_websites: Optional[str] = None
    product_description: Optional[str] = None
