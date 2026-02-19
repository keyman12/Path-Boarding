from typing import Any, Optional

from pydantic import BaseModel, EmailStr


class InviteInfoPartner(BaseModel):
    name: str
    logo_url: Optional[str] = None
    merchant_support_email: Optional[str] = None
    merchant_support_phone: Optional[str] = None


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


class Step6Submit(BaseModel):
    bank_account_name: str
    bank_currency: str
    bank_country: str
    bank_sort_code: Optional[str] = None  # UK only (GBP + UK)
    bank_account_number: Optional[str] = None  # UK only (GBP + UK)
    bank_iban: Optional[str] = None  # EUR / non-UK
    # Optional step5 and company data (sent when progressing from step5->step6)
    vat_number: Optional[str] = None
    customer_industry: Optional[str] = None
    estimated_monthly_card_volume: Optional[str] = None
    average_transaction_value: Optional[str] = None
    delivery_timeframe: Optional[str] = None
    customer_support_email: Optional[str] = None
    customer_websites: Optional[str] = None
    product_description: Optional[str] = None
    company_name: Optional[str] = None
    company_number: Optional[str] = None
    company_registered_office: Optional[str] = None
    company_incorporated_in: Optional[str] = None
    company_incorporation_date: Optional[str] = None
    company_industry_sic: Optional[str] = None


class Step6Response(BaseModel):
    saved: bool = True


class SubmitReviewResponse(BaseModel):
    success: bool = True
    agreement_pdf_path: Optional[str] = None
    redirect_to_signing: bool = False
    signing_url: Optional[str] = None


class SaveForLaterSubmit(BaseModel):
    current_step: Optional[str] = None  # form, verify, step2, step3, step4, step5, step6
    # Step 5 business details (optional, for step5)
    vat_number: Optional[str] = None
    customer_industry: Optional[str] = None
    estimated_monthly_card_volume: Optional[str] = None
    average_transaction_value: Optional[str] = None
    delivery_timeframe: Optional[str] = None
    customer_support_email: Optional[str] = None
    customer_websites: Optional[str] = None
    product_description: Optional[str] = None
    # Step 6 bank details (optional, for step6)
    bank_account_name: Optional[str] = None
    bank_currency: Optional[str] = None
    bank_country: Optional[str] = None
    bank_sort_code: Optional[str] = None
    bank_account_number: Optional[str] = None
    bank_iban: Optional[str] = None
    # Company (step4)
    company_name: Optional[str] = None
    company_number: Optional[str] = None
    company_registered_office: Optional[str] = None
    company_incorporated_in: Optional[str] = None
    company_incorporation_date: Optional[str] = None
    company_industry_sic: Optional[str] = None
