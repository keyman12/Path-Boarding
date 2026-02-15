import logging
import re
import secrets
import uuid
from datetime import datetime, timedelta, timezone

import httpx
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

logger = logging.getLogger(__name__)

from app.core.config import settings
from app.core.deps import get_db
from app.core.security import get_password_hash, verify_password, create_access_token
from app.models.boarding_contact import BoardingContact
from app.models.boarding_event import BoardingEvent, BoardingStatus
from app.models.invite import Invite
from app.models.merchant import Merchant
from app.models.merchant_user import MerchantUser
from app.models.verification_code import VerificationCode
from app.schemas.boarding import (
    InviteInfoResponse,
    InviteInfoPartner,
    ProductPackageDisplay,
    ProductPackageItemDisplay,
    Step1Submit,
    Step1Response,
    Step2Submit,
    Step2Response,
    Step6Submit,
    Step6Response,
    SumsubTokenResponse,
    VerifyEmailCodeSubmit,
    VerifyEmailResponse,
    VerifyStatusResponse,
    TestClearEmailSubmit,
    TestClearEmailResponse,
    BoardingLoginSubmit,
    BoardingLoginResponse,
    SaveForLaterSubmit,
)
from app.services.email import send_verification_code_email, send_save_for_later_email

router = APIRouter()

# 6-digit email code expiry (industry norm ~10–15 mins)
VERIFY_CODE_EXPIRE_MINUTES = 15


@router.get("/saved-data")
def get_saved_data(
    token: str = Query(..., description="Invite token from boarding URL"),
    db: Session = Depends(get_db),
):
    """
    Public: get saved boarding data for the contact (if any exists).
    Returns the saved personal details and current step so the frontend can pre-populate forms.
    """
    invite = db.query(Invite).filter(Invite.token == token).first()
    if not invite:
        raise HTTPException(status_code=404, detail="Invalid or expired link")
    
    event = db.query(BoardingEvent).filter(BoardingEvent.id == invite.boarding_event_id).first()
    if not event:
        raise HTTPException(status_code=404, detail="Invalid link")
    
    contact = db.query(BoardingContact).filter(BoardingContact.boarding_event_id == event.id).first()
    if not contact:
        return {
            "has_data": False,
            "current_step": None,
            "email": None,
            "email_verified": False,
        }
    
    return {
        "has_data": True,
        "current_step": contact.current_step,
        "email": contact.email,
        "email_verified": contact.email_verified_at is not None,
        # Step 2 personal details
        "legal_first_name": contact.legal_first_name,
        "legal_last_name": contact.legal_last_name,
        "date_of_birth": contact.date_of_birth,
        "address_country": contact.address_country,
        "address_postcode": contact.address_postcode,
        "address_line1": contact.address_line1,
        "address_line2": contact.address_line2,
        "address_town": contact.address_town,
        "phone_country_code": contact.phone_country_code,
        "phone_number": contact.phone_number,
        # Step 5 business details
        "vat_number": getattr(contact, "vat_number", None),
        "customer_industry": getattr(contact, "customer_industry", None),
        "estimated_monthly_card_volume": getattr(contact, "estimated_monthly_card_volume", None),
        "average_transaction_value": getattr(contact, "average_transaction_value", None),
        "delivery_timeframe": getattr(contact, "delivery_timeframe", None),
        "customer_support_email": getattr(contact, "customer_support_email", None),
        "customer_websites": getattr(contact, "customer_websites", None),
        "product_description": getattr(contact, "product_description", None),
        # Step 6 bank details
        "bank_account_name": getattr(contact, "bank_account_name", None),
        "bank_currency": getattr(contact, "bank_currency", None),
        "bank_country": getattr(contact, "bank_country", None),
        "bank_sort_code": getattr(contact, "bank_sort_code", None),
        "bank_account_number": getattr(contact, "bank_account_number", None),
        "bank_iban": getattr(contact, "bank_iban", None),
    }


@router.get("/invite-info", response_model=InviteInfoResponse)
def get_invite_info(
    token: str = Query(..., description="Invite token from the boarding URL"),
    db: Session = Depends(get_db),
):
    """
    Public: get partner and merchant context for the boarding page.
    Returns 404 if token invalid or expired.
    """
    invite = db.query(Invite).filter(Invite.token == token).first()
    if not invite:
        raise HTTPException(status_code=404, detail="Invalid or expired link")
    if invite.used_at:
        raise HTTPException(status_code=404, detail="Link already used")
    if invite.expires_at and invite.expires_at < datetime.now(timezone.utc):
        raise HTTPException(status_code=404, detail="Link expired")

    event = db.query(BoardingEvent).filter(BoardingEvent.id == invite.boarding_event_id).first()
    if not event:
        raise HTTPException(status_code=404, detail="Invalid link")
    partner = invite.partner
    if not partner:
        raise HTTPException(status_code=404, detail="Invalid link")

    product_package = None
    if invite.product_package_id and invite.product_package:
        pkg = invite.product_package
        item_by_id = {it.id: it for it in pkg.items}
        dd_by_item: dict = {}
        for dd in invite.device_details:
            dd_by_item.setdefault(dd.package_item_id, []).append(dd)
        items = []
        for idx, dd in enumerate(invite.device_details):
            it = item_by_id.get(dd.package_item_id)
            if not it:
                continue
            cat = it.catalog_product
            items.append(
                ProductPackageItemDisplay(
                    id=f"{it.id}-{idx}",
                    product_code=cat.product_code if cat else "",
                    product_name=cat.name if cat else "",
                    product_type=cat.product_type if cat else "",
                    config=it.config,
                    store_name=dd.store_name,
                    store_address=dd.store_address,
                    epos_terminal=dd.epos_terminal,
                )
            )
        for it in pkg.items:
            if it.id in dd_by_item:
                continue
            cat = it.catalog_product
            items.append(
                ProductPackageItemDisplay(
                    id=it.id,
                    product_code=cat.product_code if cat else "",
                    product_name=cat.name if cat else "",
                    product_type=cat.product_type if cat else "",
                    config=it.config,
                    store_name=None,
                    store_address=None,
                    epos_terminal=None,
                )
            )
        product_package = ProductPackageDisplay(
            id=pkg.id,
            uid=pkg.uid,
            name=pkg.name,
            description=pkg.description,
            items=items,
        )

    return InviteInfoResponse(
        partner=InviteInfoPartner(name=partner.name, logo_url=partner.logo_url),
        merchant_name=invite.merchant_name,
        boarding_event_id=event.id,
        valid=True,
        product_package=product_package,
    )


@router.get("/verify-status", response_model=VerifyStatusResponse)
def get_verify_status(
    token: str = Query(..., description="Invite token from boarding URL"),
    db: Session = Depends(get_db),
):
    """
    Public: check if the contact for this invite has verified their email.
    Used by the original tab to update when the user clicks the link in another tab.
    """
    invite = db.query(Invite).filter(Invite.token == token).first()
    if not invite or invite.used_at or (invite.expires_at and invite.expires_at < datetime.now(timezone.utc)):
        return VerifyStatusResponse(verified=False)
    event = db.query(BoardingEvent).filter(BoardingEvent.id == invite.boarding_event_id).first()
    if not event:
        return VerifyStatusResponse(verified=False)
    contact = db.query(BoardingContact).filter(BoardingContact.boarding_event_id == event.id).first()
    if not contact:
        return VerifyStatusResponse(verified=False)
    return VerifyStatusResponse(verified=contact.email_verified_at is not None)


@router.post("/step/1", response_model=Step1Response)
def submit_step1(
    token: str = Query(..., description="Invite token"),
    body: Step1Submit = ...,
    db: Session = Depends(get_db),
):
    """
    Public: submit step 1 (email, confirm email, password).
    Validates, stores contact, sends verification email with link.
    """
    logger.info("Step 1 request: token=%s, email=%s", token[:8] + "...", body.email)
    if body.email != body.confirm_email:
        raise HTTPException(status_code=400, detail="Email and confirm email do not match")

    invite = db.query(Invite).filter(Invite.token == token).first()
    if not invite or invite.used_at or (invite.expires_at and invite.expires_at < datetime.now(timezone.utc)):
        raise HTTPException(status_code=404, detail="Invalid or expired link")

    event = db.query(BoardingEvent).filter(BoardingEvent.id == invite.boarding_event_id).first()
    if not event:
        raise HTTPException(status_code=404, detail="Invalid link")

    existing = db.query(BoardingContact).filter(BoardingContact.boarding_event_id == event.id).first()
    if existing:
        raise HTTPException(status_code=400, detail="Step 1 already submitted for this link")

    # 6-digit code (industry-standard email verification)
    verify_code = f"{secrets.randbelow(1_000_000):06d}"
    expires_at = datetime.now(timezone.utc) + timedelta(minutes=VERIFY_CODE_EXPIRE_MINUTES)
    vc = VerificationCode(
        id=str(uuid.uuid4()),
        channel="email",
        contact=body.email,
        code=verify_code,
        expires_at=expires_at,
    )
    db.add(vc)

    contact = BoardingContact(
        id=str(uuid.uuid4()),
        boarding_event_id=event.id,
        email=body.email,
        hashed_password=get_password_hash(body.password),
        current_step="verify",  # User needs to verify email next
        invite_token=token,  # Store token so user can resume later
    )
    db.add(contact)
    event.status = BoardingStatus.in_progress
    event.current_step = 1
    db.commit()

    logger.info("Sending verification code to %s (expires in %s min)", body.email, VERIFY_CODE_EXPIRE_MINUTES)
    sent = send_verification_code_email(body.email, verify_code, VERIFY_CODE_EXPIRE_MINUTES)
    logger.info("Step 1 done: email_sent=%s", sent)

    return Step1Response(
        sent=True,
        message=f"Verification code sent to {body.email}. Enter the 6-digit code on the next screen.",
    )


def _do_email_verified_flow(
    invite: Invite,
    event: BoardingEvent,
    contact: BoardingContact,
    db: Session,
) -> None:
    """Mark contact verified, create merchant and merchant_user, advance to step 2."""
    contact.email_verified_at = datetime.now(timezone.utc)
    contact.current_step = "step2"  # User can now proceed to personal details
    merchant = Merchant(
        id=str(uuid.uuid4()),
        partner_id=event.partner_id,
        trading_name=invite.merchant_name or None,
    )
    db.add(merchant)
    db.flush()
    merchant_user = MerchantUser(
        id=str(uuid.uuid4()),
        merchant_id=merchant.id,
        email=contact.email,
        hashed_password=contact.hashed_password,
        email_verified_at=contact.email_verified_at,
        is_active=True,
    )
    db.add(merchant_user)
    event.merchant_id = merchant.id
    event.current_step = 2
    db.commit()


@router.post("/verify-email-code", response_model=VerifyEmailResponse)
def verify_email_code(
    invite_token: str = Query(..., description="Invite token from boarding URL"),
    body: VerifyEmailCodeSubmit = ...,
    db: Session = Depends(get_db),
):
    """
    Public: verify email with 6-digit code (from email). Creates merchant and merchant_user, advances to step 2.
    """
    code = "".join(c for c in body.code if c.isdigit())
    if len(code) != 6:
        raise HTTPException(status_code=400, detail="Please enter the 6-digit code from your email.")

    invite = db.query(Invite).filter(Invite.token == invite_token).first()
    if not invite or invite.used_at or (invite.expires_at and invite.expires_at < datetime.now(timezone.utc)):
        raise HTTPException(status_code=404, detail="Invalid or expired link")

    event = db.query(BoardingEvent).filter(BoardingEvent.id == invite.boarding_event_id).first()
    if not event:
        raise HTTPException(status_code=404, detail="Invalid link")

    contact = db.query(BoardingContact).filter(BoardingContact.boarding_event_id == event.id).first()
    if not contact:
        raise HTTPException(status_code=400, detail="Complete step 1 first")
    if contact.email_verified_at:
        return VerifyEmailResponse(verified=True, message="Already verified.")

    vc = (
        db.query(VerificationCode)
        .filter(
            VerificationCode.channel == "email",
            VerificationCode.contact == contact.email,
            VerificationCode.code == code,
            VerificationCode.used_at.is_(None),
            VerificationCode.expires_at > datetime.now(timezone.utc),
        )
        .order_by(VerificationCode.created_at.desc())
        .first()
    )
    if not vc:
        raise HTTPException(status_code=400, detail="Invalid or expired code. Check the code and try again.")

    # One email = one merchant_user (unique constraint). If they already completed boarding with this email, return a clear error.
    existing_user = db.query(MerchantUser).filter(MerchantUser.email == contact.email).first()
    if existing_user:
        raise HTTPException(
            status_code=400,
            detail="This email is already registered. Please use a different email address or sign in to your existing account.",
        )

    vc.used_at = datetime.now(timezone.utc)
    _do_email_verified_flow(invite, event, contact, db)
    return VerifyEmailResponse(verified=True)


@router.post("/step/2", response_model=Step2Response)
def submit_step2(
    token: str = Query(..., description="Invite token"),
    body: Step2Submit = ...,
    db: Session = Depends(get_db),
):
    """
    Public: persist step 2 personal details. Requires completed step 1 and email verification.
    """
    invite = db.query(Invite).filter(Invite.token == token).first()
    if not invite or invite.used_at or (invite.expires_at and invite.expires_at < datetime.now(timezone.utc)):
        raise HTTPException(status_code=404, detail="Invalid or expired link")
    event = db.query(BoardingEvent).filter(BoardingEvent.id == invite.boarding_event_id).first()
    if not event:
        raise HTTPException(status_code=404, detail="Invalid link")
    contact = db.query(BoardingContact).filter(BoardingContact.boarding_event_id == event.id).first()
    if not contact:
        raise HTTPException(status_code=400, detail="Complete step 1 first.")
    if not contact.email_verified_at:
        raise HTTPException(status_code=400, detail="Verify your email first.")
    contact.legal_first_name = body.legal_first_name.strip()
    contact.legal_last_name = body.legal_last_name.strip()
    contact.date_of_birth = body.date_of_birth.strip()
    contact.address_country = body.address_country.strip()
    contact.address_postcode = (body.address_postcode or "").strip() or None
    contact.address_line1 = body.address_line1.strip()
    contact.address_line2 = (body.address_line2 or "").strip() or None
    contact.address_town = body.address_town.strip()
    contact.phone_country_code = body.phone_country_code.strip()
    contact.phone_number = body.phone_number.strip()
    contact.current_step = "step3"  # User can now proceed to identity verification
    if event.merchant_id:
        merchant = db.query(Merchant).filter(Merchant.id == event.merchant_id).first()
        if merchant:
            merchant.legal_name = f"{contact.legal_first_name} {contact.legal_last_name}".strip()
    db.commit()
    return Step2Response()


@router.post("/step/6", response_model=Step6Response)
def submit_step6(
    token: str = Query(..., description="Invite token"),
    body: Step6Submit = ...,
    db: Session = Depends(get_db),
):
    """
    Public: persist step 6 bank details. Requires completed step 5.
    """
    invite = db.query(Invite).filter(Invite.token == token).first()
    if not invite or invite.used_at or (invite.expires_at and invite.expires_at < datetime.now(timezone.utc)):
        raise HTTPException(status_code=404, detail="Invalid or expired link")
    event = db.query(BoardingEvent).filter(BoardingEvent.id == invite.boarding_event_id).first()
    if not event:
        raise HTTPException(status_code=404, detail="Invalid link")
    contact = db.query(BoardingContact).filter(BoardingContact.boarding_event_id == event.id).first()
    if not contact:
        raise HTTPException(status_code=400, detail="Complete previous steps first.")
    contact.bank_account_name = body.bank_account_name.strip()
    contact.bank_currency = body.bank_currency.strip()
    contact.bank_country = body.bank_country.strip()
    contact.bank_sort_code = (body.bank_sort_code or "").strip() or None
    contact.bank_account_number = (body.bank_account_number or "").strip() or None
    contact.bank_iban = (body.bank_iban or "").strip() or None
    contact.current_step = "step6"
    db.commit()
    return Step6Response()


@router.post("/test-clear-email", response_model=TestClearEmailResponse)
def test_clear_email(body: TestClearEmailSubmit, db: Session = Depends(get_db)):
    """
    Testing only: remove existing registration for an email so you can re-use it.
    Deletes the merchant_user and their merchant, resets any boarding contact verification for that email.
    """
    email = body.email.strip().lower()
    if not email:
        raise HTTPException(status_code=400, detail="Email is required.")

    user = db.query(MerchantUser).filter(MerchantUser.email == email).first()
    if not user:
        db.rollback()
        return TestClearEmailResponse(cleared=False, message="No registration found for this email.")

    merchant_id = user.merchant_id
    db.delete(user)
    # Unlink events from this merchant and reset their step so the flow can run again
    db.query(BoardingEvent).filter(BoardingEvent.merchant_id == merchant_id).update(
        {BoardingEvent.merchant_id: None, BoardingEvent.current_step: 1}
    )
    merchant = db.query(Merchant).filter(Merchant.id == merchant_id).first()
    if merchant:
        db.delete(merchant)
    # Remove contact(s) for this email so the user can do step 1 again (same invite, new code)
    contacts = db.query(BoardingContact).filter(BoardingContact.email == email).all()
    for c in contacts:
        db.query(BoardingEvent).filter(BoardingEvent.id == c.boarding_event_id).update(
            {BoardingEvent.current_step: 1}
        )
        db.delete(c)
    db.commit()
    logger.info("Test clear email: removed registration for %s", email)
    return TestClearEmailResponse(cleared=True, message="Registration cleared. You can use this email again.")


# UK postcode format for address lookup validation
_UK_POSTCODE_REGEX = re.compile(r"^[A-Z]{1,2}[0-9][0-9A-Z]?\s?[0-9][A-Z]{2}$", re.IGNORECASE)


def _normalise_uk_postcode(postcode: str) -> str:
    """Uppercase and single space."""
    s = postcode.strip().upper().replace(" ", "")
    if len(s) >= 5:
        # Insert space before last 3 chars (e.g. SW1A2AA -> SW1A 2AA)
        s = s[:-3] + " " + s[-3:]
    return s


def _ideal_postcodes_uk_lookup(postcode: str, api_key: str) -> list:
    """Call Ideal Postcodes API for UK; return list of { addressLine1, addressLine2, town, postcode }."""
    # Postcode in path: space and case insensitive; we send normalised
    url = f"https://api.ideal-postcodes.co.uk/v1/postcodes/{postcode}"
    params = {"api_key": api_key}
    with httpx.Client(timeout=10.0) as client:
        resp = client.get(url, params=params)
    if resp.status_code == 402:
        try:
            body = resp.json()
            code = body.get("code")
            if code == 4020:
                raise HTTPException(
                    status_code=503,
                    detail="Address lookup credit has run out. Please add credits or update the API key in settings.",
                )
            if code == 4021:
                raise HTTPException(
                    status_code=503,
                    detail="Address lookup limit reached for today. Please try again tomorrow or increase your limit.",
                )
        except HTTPException:
            raise
        except Exception:
            pass
        raise HTTPException(
            status_code=503,
            detail="Address lookup credit or limit reached. Please update the API key or add credits.",
        )
    if resp.status_code != 200:
        try:
            body = resp.json()
            msg = body.get("message", resp.text[:200])
        except Exception:
            msg = resp.text[:200] or "Address lookup temporarily unavailable."
        logger.warning("Ideal Postcodes returned %s: %s", resp.status_code, msg)
        raise HTTPException(
            status_code=503,
            detail="Address lookup temporarily unavailable. Please enter your address manually.",
        )
    try:
        data = resp.json()
    except Exception as e:
        logger.warning("Ideal Postcodes invalid JSON: %s", e)
        raise HTTPException(
            status_code=502,
            detail="Could not load addresses. Please enter your address manually.",
        ) from e
    # Response: { "code": 2000, "result": [ { "line_1", "line_2", "post_town", "postcode", ... } ] }
    results = data.get("result") if isinstance(data.get("result"), list) else []
    out = []
    for r in results:
        if not isinstance(r, dict):
            continue
        line1 = (r.get("line_1") or "").strip()
        line2 = (r.get("line_2") or "").strip()
        town = (r.get("post_town") or r.get("town_or_city") or "").strip()
        pc = (r.get("postcode") or "").strip() or postcode
        if line1:
            out.append({
                "addressLine1": line1,
                "addressLine2": line2,
                "town": town,
                "postcode": pc,
            })
    return out


@router.get("/address-lookup")
def address_lookup(
    postcode: str = Query(..., min_length=1, description="UK postcode"),
):
    """
    Public: lookup UK addresses by postcode via Ideal Postcodes.
    Returns a list of { addressLine1, addressLine2, town, postcode }.
    If ADDRESS_LOOKUP_UK_API_KEY is not set or the API fails (e.g. credit depleted), returns 503 so the frontend can fall back to manual entry.
    """
    if not settings.ADDRESS_LOOKUP_UK_API_KEY:
        raise HTTPException(
            status_code=503,
            detail="Address lookup not configured. Please enter your address manually.",
        )
    normalised = _normalise_uk_postcode(postcode)
    if not _UK_POSTCODE_REGEX.match(normalised):
        raise HTTPException(status_code=400, detail="Invalid UK postcode format.")
    try:
        return _ideal_postcodes_uk_lookup(normalised, settings.ADDRESS_LOOKUP_UK_API_KEY)
    except HTTPException:
        raise
    except httpx.RequestError as e:
        logger.warning("Ideal Postcodes request failed: %s", e)
        raise HTTPException(
            status_code=502,
            detail="Could not load addresses. Please enter your address manually.",
        ) from e


@router.post("/save-for-later")
def save_for_later(
    token: str = Query(..., description="Invite token"),
    body: SaveForLaterSubmit = ...,
    db: Session = Depends(get_db),
):
    """
    Public: save progress and send 'save for later' email to the user.
    Accepts current_step and step5 business details to persist before sending email.
    """
    invite = db.query(Invite).filter(Invite.token == token).first()
    if not invite:
        raise HTTPException(status_code=404, detail="Invalid or expired link")
    
    event = db.query(BoardingEvent).filter(BoardingEvent.id == invite.boarding_event_id).first()
    if not event:
        raise HTTPException(status_code=404, detail="Invalid link")
    
    contact = db.query(BoardingContact).filter(BoardingContact.boarding_event_id == event.id).first()
    if not contact:
        raise HTTPException(status_code=400, detail="No account found. Please create an account first.")
    
    # Save progress: current step and step5 data
    if body.current_step:
        contact.current_step = body.current_step
    if body.vat_number is not None:
        contact.vat_number = body.vat_number
    if body.customer_industry is not None:
        contact.customer_industry = body.customer_industry
    if body.estimated_monthly_card_volume is not None:
        contact.estimated_monthly_card_volume = body.estimated_monthly_card_volume
    if body.average_transaction_value is not None:
        contact.average_transaction_value = body.average_transaction_value
    if body.delivery_timeframe is not None:
        contact.delivery_timeframe = body.delivery_timeframe
    if body.customer_support_email is not None:
        contact.customer_support_email = body.customer_support_email
    if body.customer_websites is not None:
        contact.customer_websites = body.customer_websites
    if body.product_description is not None:
        contact.product_description = body.product_description
    if body.bank_currency is not None:
        contact.bank_currency = body.bank_currency
    if body.bank_country is not None:
        contact.bank_country = body.bank_country
    if body.bank_sort_code is not None:
        contact.bank_sort_code = body.bank_sort_code
    if body.bank_account_number is not None:
        contact.bank_account_number = body.bank_account_number
    if body.bank_account_name is not None:
        contact.bank_account_name = body.bank_account_name
    if body.bank_iban is not None:
        contact.bank_iban = body.bank_iban
    db.commit()
    
    # Get user's name for personalization
    user_name = contact.legal_first_name or "there"
    
    # Send email
    sent = send_save_for_later_email(contact.email, user_name)
    
    if not sent:
        raise HTTPException(
            status_code=500,
            detail="Failed to send email. Please check SMTP configuration."
        )
    
    return {
        "sent": True,
        "message": "Email sent successfully. You can return anytime within 14 days."
    }


@router.post("/sumsub/generate-token", response_model=SumsubTokenResponse)
async def generate_sumsub_token(
    token: str = Query(..., description="Invite token"),
    db: Session = Depends(get_db),
):
    """
    Public: Generate SumSub access token for identity verification.
    Uses the boarding_event_id as the SumSub user_id.
    """
    from app.services.sumsub import generate_access_token
    
    # Verify the invite token
    invite = db.query(Invite).filter(Invite.token == token).first()
    if not invite:
        raise HTTPException(status_code=404, detail="Invalid or expired link")
    
    event = db.query(BoardingEvent).filter(BoardingEvent.id == invite.boarding_event_id).first()
    if not event:
        raise HTTPException(status_code=404, detail="Invalid link")
    
    contact = db.query(BoardingContact).filter(BoardingContact.boarding_event_id == event.id).first()
    if not contact:
        raise HTTPException(status_code=400, detail="No account found. Please create an account first.")
    
    # Check if SumSub is configured
    if not settings.SUMSUB_APP_TOKEN or not settings.SUMSUB_SECRET_KEY:
        raise HTTPException(
            status_code=503,
            detail="Identity verification is not configured. Please contact support."
        )
    
    # Generate SumSub access token using boarding_event_id as user_id
    try:
        logger.info(f"Generating SumSub token for user_id={event.id}, level={settings.SUMSUB_LEVEL_NAME}")
        result = await generate_access_token(
            user_id=event.id,
            ttl_seconds=1200  # 20 minutes
        )
        
        # Store the applicant ID in the database
        contact.sumsub_applicant_id = event.id
        contact.sumsub_verification_status = "pending"
        db.commit()
        
        logger.info(f"Successfully generated SumSub token for user_id={event.id}")
        return SumsubTokenResponse(
            token=result["token"],
            user_id=result["userId"]
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to generate SumSub token: {type(e).__name__}: {str(e)}", exc_info=True)
        # Return more specific error message if available
        error_detail = "Failed to generate verification token. Please try again."
        if hasattr(e, 'response') and hasattr(e.response, 'text'):
            error_detail = f"SumSub API error: {e.response.text}"
        raise HTTPException(
            status_code=500,
            detail=error_detail
        )


@router.post("/sumsub/complete")
async def complete_sumsub_verification(
    token: str = Query(..., description="Invite token"),
    status: str = Query(..., description="Verification status: completed or rejected"),
    db: Session = Depends(get_db),
):
    """
    Public: Mark SumSub verification as complete.
    Called from frontend after user completes verification flow.
    """
    # Verify the invite token
    invite = db.query(Invite).filter(Invite.token == token).first()
    if not invite:
        raise HTTPException(status_code=404, detail="Invalid or expired link")
    
    event = db.query(BoardingEvent).filter(BoardingEvent.id == invite.boarding_event_id).first()
    if not event:
        raise HTTPException(status_code=404, detail="Invalid link")
    
    contact = db.query(BoardingContact).filter(BoardingContact.boarding_event_id == event.id).first()
    if not contact:
        raise HTTPException(status_code=400, detail="No account found.")
    
    # Update verification status
    contact.sumsub_verification_status = status
    if status == "completed":
        contact.current_step = "step4"  # Move to next step (business info)
    
    db.commit()
    
    return {
        "success": True,
        "status": status,
        "next_step": contact.current_step
    }


@router.post("/login", response_model=BoardingLoginResponse)
def boarding_login(
    body: BoardingLoginSubmit,
    db: Session = Depends(get_db),
):
    """
    Merchant boarding login: verify email/password and return JWT token.
    Returns the user's current step so the frontend can navigate them to where they left off.
    """
    # Find boarding contact by email
    contact = db.query(BoardingContact).filter(BoardingContact.email == body.email).first()
    if not contact:
        raise HTTPException(status_code=401, detail="Invalid email or password")
    
    # Verify password
    if not verify_password(body.password, contact.hashed_password):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    
    # Check if email is verified
    if not contact.email_verified_at:
        raise HTTPException(status_code=403, detail="Please verify your email first")
    
    # Create JWT token with boarding_event_id as subject
    access_token = create_access_token(
        subject=contact.boarding_event_id,
        extra_claims={"type": "boarding"}
    )
    
    return BoardingLoginResponse(
        access_token=access_token,
        token_type="bearer",
        current_step=contact.current_step or "step2",
        boarding_event_id=contact.boarding_event_id,
        invite_token=contact.invite_token,
    )
