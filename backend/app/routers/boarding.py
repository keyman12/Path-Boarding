import logging
import re
import secrets
import uuid
from datetime import datetime, timedelta, timezone

from pathlib import Path as PathLib

import httpx
from fastapi import APIRouter, Depends, Form, HTTPException, Query
from fastapi.responses import FileResponse, RedirectResponse
from sqlalchemy import func
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
    SubmitReviewResponse,
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
        "sumsub_verification_status": getattr(contact, "sumsub_verification_status", None),
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
        # Company (step4)
        "company_name": getattr(contact, "company_name", None),
        "company_number": getattr(contact, "company_number", None),
        "company_registered_office": getattr(contact, "company_registered_office", None),
        "company_incorporated_in": getattr(contact, "company_incorporated_in", None),
        "company_incorporation_date": getattr(contact, "company_incorporation_date", None),
        "company_industry_sic": getattr(contact, "company_industry_sic", None),
        # TrueLayer bank verification
        "truelayer_verified_at": (lambda t: t.isoformat() if t else None)(getattr(contact, "truelayer_verified_at", None)),
        "truelayer_account_match": getattr(contact, "truelayer_account_match", None),
        "truelayer_account_name_score": getattr(contact, "truelayer_account_name_score", None),
        "truelayer_director_score": getattr(contact, "truelayer_director_score", None),
        "truelayer_verification_message": getattr(contact, "truelayer_verification_message", None),
        "truelayer_verified": getattr(contact, "truelayer_verified", None),
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

    event = db.query(BoardingEvent).filter(BoardingEvent.id == invite.boarding_event_id).first()
    if not event:
        raise HTTPException(status_code=404, detail="Invalid link")
    # Allow completed boardings to access mini portal even if invite expired
    if event.status != BoardingStatus.completed and invite.expires_at and invite.expires_at < datetime.now(timezone.utc):
        raise HTTPException(status_code=404, detail="Link expired")
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
        partner=InviteInfoPartner(
            name=partner.name,
            logo_url=partner.logo_url,
            merchant_support_email=partner.merchant_support_email,
            merchant_support_phone=partner.merchant_support_phone,
        ),
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
    # If identity-critical fields changed and verification was completed, reset so user must re-verify
    identity_critical_changed = (
        getattr(contact, "sumsub_verification_status", None) == "completed"
        and (
            contact.legal_first_name != body.legal_first_name.strip()
            or contact.legal_last_name != body.legal_last_name.strip()
            or contact.date_of_birth != body.date_of_birth.strip()
            or contact.address_country != body.address_country.strip()
            or (contact.address_postcode or "") != (body.address_postcode or "").strip()
            or contact.address_line1 != body.address_line1.strip()
            or (contact.address_line2 or "") != (body.address_line2 or "").strip()
            or contact.address_town != body.address_town.strip()
        )
    )
    if identity_critical_changed:
        contact.sumsub_verification_status = None
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
    # Optional step5 and company data
    if body.vat_number is not None:
        contact.vat_number = (body.vat_number or "").strip() or None
    if body.customer_industry is not None:
        contact.customer_industry = (body.customer_industry or "").strip() or None
    if body.estimated_monthly_card_volume is not None:
        contact.estimated_monthly_card_volume = (body.estimated_monthly_card_volume or "").strip() or None
    if body.average_transaction_value is not None:
        contact.average_transaction_value = (body.average_transaction_value or "").strip() or None
    if body.delivery_timeframe is not None:
        contact.delivery_timeframe = (body.delivery_timeframe or "").strip() or None
    if body.customer_support_email is not None:
        contact.customer_support_email = (body.customer_support_email or "").strip() or None
    if body.customer_websites is not None:
        contact.customer_websites = (body.customer_websites or "").strip() or None
    if body.product_description is not None:
        contact.product_description = (body.product_description or "").strip() or None
    if body.company_name is not None:
        contact.company_name = (body.company_name or "").strip() or None
    if body.company_number is not None:
        contact.company_number = (body.company_number or "").strip() or None
    if body.company_registered_office is not None:
        contact.company_registered_office = (body.company_registered_office or "").strip() or None
    if body.company_incorporated_in is not None:
        contact.company_incorporated_in = (body.company_incorporated_in or "").strip() or None
    if body.company_incorporation_date is not None:
        contact.company_incorporation_date = (body.company_incorporation_date or "").strip() or None
    if body.company_industry_sic is not None:
        contact.company_industry_sic = (body.company_industry_sic or "").strip() or None
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


@router.get("/truelayer-auth-url")
def get_truelayer_auth_url(
    token: str = Query(..., description="Invite token from boarding URL"),
    db: Session = Depends(get_db),
):
    """
    Public: get TrueLayer auth URL for bank verification.
    User must have completed step6 (bank details) first.
    Returns { auth_url } to redirect user to TrueLayer.
    """
    if not settings.TRUELAYER_CLIENT_ID or not settings.TRUELAYER_CLIENT_SECRET:
        raise HTTPException(status_code=503, detail="Bank verification is not configured.")
    invite = db.query(Invite).filter(Invite.token == token).first()
    if not invite or invite.used_at or (invite.expires_at and invite.expires_at < datetime.now(timezone.utc)):
        raise HTTPException(status_code=404, detail="Invalid or expired link")
    event = db.query(BoardingEvent).filter(BoardingEvent.id == invite.boarding_event_id).first()
    if not event:
        raise HTTPException(status_code=404, detail="Invalid link")
    contact = db.query(BoardingContact).filter(BoardingContact.boarding_event_id == event.id).first()
    if not contact:
        raise HTTPException(status_code=400, detail="Complete previous steps first.")
    if not contact.bank_sort_code or not contact.bank_account_number:
        raise HTTPException(
            status_code=400,
            detail="Please save your bank details first (UK sort code and account number required for verification).",
        )
    try:
        from app.services.truelayer_verification import build_auth_url
        auth_url = build_auth_url(state=token)
        return {"auth_url": auth_url}
    except ValueError as e:
        raise HTTPException(status_code=503, detail=str(e)) from e


def _process_truelayer_callback(code: str, state: str | None, db: Session) -> RedirectResponse:
    """
    Shared logic for TrueLayer callback (GET or POST).
    If state is missing, redirects to frontend with error.
    """
    from urllib.parse import quote

    frontend_base = settings.FRONTEND_BASE_URL.rstrip("/")
    if not state or not state.strip():
        logger.warning("TrueLayer callback received without state parameter")
        return RedirectResponse(
            url=f"{frontend_base}/?error=bank_verification_failed&reason=missing_state",
            status_code=302,
        )
    state = state.strip()
    invite = db.query(Invite).filter(Invite.token == state).first()
    if not invite or invite.used_at or (invite.expires_at and invite.expires_at < datetime.now(timezone.utc)):
        frontend_base = settings.FRONTEND_BASE_URL.rstrip("/")
        return RedirectResponse(url=f"{frontend_base}/board/{state}?error=invalid_link", status_code=302)
    event = db.query(BoardingEvent).filter(BoardingEvent.id == invite.boarding_event_id).first()
    if not event:
        frontend_base = settings.FRONTEND_BASE_URL.rstrip("/")
        return RedirectResponse(url=f"{frontend_base}/board/{state}?error=invalid_link", status_code=302)
    contact = db.query(BoardingContact).filter(BoardingContact.boarding_event_id == event.id).first()
    if not contact:
        frontend_base = settings.FRONTEND_BASE_URL.rstrip("/")
        return RedirectResponse(url=f"{frontend_base}/board/{state}?error=invalid_link", status_code=302)

    from app.services.truelayer_verification import (
        exchange_code_for_token,
        run_verification,
    )

    try:
        access_token = exchange_code_for_token(code)
    except Exception as e:
        logger.exception("TrueLayer token exchange failed: %s", e)
        contact.truelayer_verified_at = datetime.now(timezone.utc)
        contact.truelayer_verified = False
        contact.truelayer_verification_message = (f"Token exchange failed: {str(e)}")[:512]
        db.commit()
        frontend_base = settings.FRONTEND_BASE_URL.rstrip("/")
        err_msg = str(e)[:100] if str(e) else "unknown"
        return RedirectResponse(
            url=f"{frontend_base}/board/{state}?step=step6&bank_verified=0&error=token_exchange&error_detail={quote(err_msg, safe='')}",
            status_code=302,
        )

    try:
        result = run_verification(
            access_token=access_token,
            user_bank_account_name=contact.bank_account_name or "",
            user_sort_code=contact.bank_sort_code,
            user_account_number=contact.bank_account_number,
            company_name=contact.company_name or "",
            director_first_name=contact.legal_first_name or "",
            director_last_name=contact.legal_last_name or "",
        )
    except Exception as e:
        logger.exception("TrueLayer verification failed: %s", e)
        contact.truelayer_verified_at = datetime.now(timezone.utc)
        contact.truelayer_verified = False
        contact.truelayer_verification_message = (f"Verification failed: {str(e)}")[:512]
        db.commit()
        frontend_base = settings.FRONTEND_BASE_URL.rstrip("/")
        err_msg = str(e)[:100] if str(e) else "unknown"
        return RedirectResponse(
            url=f"{frontend_base}/board/{state}?step=step6&bank_verified=0&error=verification_failed&error_detail={quote(err_msg, safe='')}",
            status_code=302,
        )

    contact.truelayer_verified_at = datetime.now(timezone.utc)
    contact.truelayer_verified = result.get("verified")
    contact.truelayer_account_match = result.get("account_match")
    contact.truelayer_account_name_score = result.get("account_name_score")
    contact.truelayer_director_score = result.get("director_score")
    contact.truelayer_account_holder_names = (
        ",".join(result.get("account_holder_names", []))[:512] if result.get("account_holder_names") else None
    )
    contact.truelayer_verification_message = (result.get("message") or "")[:512]
    db.commit()

    frontend_base = settings.FRONTEND_BASE_URL.rstrip("/")
    verified = 1 if result.get("verified") else 0
    msg = result.get("message", "")
    redirect_url = f"{frontend_base}/board/{state}?step=step6&bank_verified={verified}"
    if msg:
        redirect_url += f"&bank_verification_message={quote(msg, safe='')}"
    return RedirectResponse(url=redirect_url, status_code=302)


@router.get("/truelayer-callback")
def truelayer_callback_get(
    code: str = Query(..., description="Authorization code from TrueLayer"),
    state: str | None = Query(None, description="Invite token (state) - required for session"),
    db: Session = Depends(get_db),
):
    """
    Callback from TrueLayer after user connects their bank (GET redirect).
    Exchanges code for token, runs verification, saves result, redirects to frontend.
    """
    return _process_truelayer_callback(code, state, db)


@router.post("/truelayer-callback")
def truelayer_callback_post(
    code: str = Form(..., description="Authorization code from TrueLayer"),
    state: str | None = Form(None, description="Invite token (state) - required for session"),
    db: Session = Depends(get_db),
):
    """
    Callback from TrueLayer when response_mode=form_post is used.
    Same logic as GET; params come from form body instead of query.
    """
    return _process_truelayer_callback(code, state, db)


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
    if body.company_name is not None:
        contact.company_name = body.company_name
    if body.company_number is not None:
        contact.company_number = body.company_number
    if body.company_registered_office is not None:
        contact.company_registered_office = body.company_registered_office
    if body.company_incorporated_in is not None:
        contact.company_incorporated_in = body.company_incorporated_in
    if body.company_incorporation_date is not None:
        contact.company_incorporation_date = body.company_incorporation_date
    if body.company_industry_sic is not None:
        contact.company_industry_sic = body.company_industry_sic
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
    
    # When re-verifying (identity changed, status was reset), use a new userId so SumSub
    # creates a fresh applicant instead of returning the previous verification result.
    is_reverification = (
        contact.sumsub_applicant_id is not None
        and contact.sumsub_verification_status is None
    )
    sumsub_user_id = f"{event.id}-rev-{int(datetime.now(timezone.utc).timestamp() * 1000)}" if is_reverification else event.id

    try:
        logger.info(f"Generating SumSub token for user_id={sumsub_user_id}, level={settings.SUMSUB_LEVEL_NAME}")
        result = await generate_access_token(
            user_id=sumsub_user_id,
            ttl_seconds=1200  # 20 minutes
        )
        
        # Store the applicant ID in the database
        contact.sumsub_applicant_id = sumsub_user_id
        contact.sumsub_verification_status = "pending"
        db.commit()
        
        logger.info(f"Successfully generated SumSub token for user_id={sumsub_user_id}")
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


@router.get("/docusign-callback")
def docusign_callback(
    state: str = Query(..., description="Invite token (passed as state)"),
    event: str = Query(None, description="DocuSign event e.g. signing_complete"),
    db: Session = Depends(get_db),
):
    """
    DocuSign redirects here after user completes signing.
    Marks boarding complete, downloads signed PDF, sends completion email, redirects to done page.
    """
    token = state
    invite = db.query(Invite).filter(Invite.token == token).first()
    if not invite:
        # Redirect to frontend with error
        frontend_url = f"{settings.FRONTEND_BASE_URL.rstrip('/')}/board/{token}?error=invalid_link"
        return RedirectResponse(url=frontend_url, status_code=302)
    event_obj = db.query(BoardingEvent).filter(BoardingEvent.id == invite.boarding_event_id).first()
    if not event_obj or not event_obj.merchant_id:
        frontend_url = f"{settings.FRONTEND_BASE_URL.rstrip('/')}/board/{token}?error=invalid_link"
        return RedirectResponse(url=frontend_url, status_code=302)
    merchant = db.query(Merchant).filter(Merchant.id == event_obj.merchant_id).first()
    contact = db.query(BoardingContact).filter(BoardingContact.boarding_event_id == event_obj.id).first()
    if not merchant or not contact:
        frontend_url = f"{settings.FRONTEND_BASE_URL.rstrip('/')}/board/{token}?error=invalid_link"
        return RedirectResponse(url=frontend_url, status_code=302)

    # Already completed – just redirect to done page
    if event_obj.status == BoardingStatus.completed:
        return RedirectResponse(
            url=f"{settings.FRONTEND_BASE_URL.rstrip('/')}/board/{token}",
            status_code=302,
        )

    upload_dir = PathLib(settings.UPLOAD_DIR)
    envelope_id = merchant.docusign_envelope_id
    if not envelope_id:
        logger.warning("DocuSign callback for token %s but no envelope_id", token)
        # Still mark complete and send email with unsigned PDF
        event_obj.status = BoardingStatus.completed
        event_obj.completed_at = datetime.now(timezone.utc)
        contact.current_step = "done"
        db.commit()
        pdf_path = upload_dir / (merchant.agreement_pdf_path or "")
        if pdf_path.exists():
            from app.services.email import send_completion_email

            portal_url = f"{settings.FRONTEND_BASE_URL.rstrip('/')}/board/{token}"
            merchant_name = f"{(contact.legal_first_name or '').strip()} {(contact.legal_last_name or '').strip()}".strip() or (contact.email or "Merchant")
            send_completion_email(
                to_email=contact.email,
                merchant_name=merchant_name,
                portal_url=portal_url,
                pdf_path=str(pdf_path),
            )
        return RedirectResponse(
            url=f"{settings.FRONTEND_BASE_URL.rstrip('/')}/board/{token}",
            status_code=302,
        )

    # Download signed PDF and send completion email
    signed_pdf_path = None
    try:
        from app.services.docusign_signing import download_completed_document

        upload_dir = PathLib(settings.UPLOAD_DIR)
        agreements_dir = upload_dir / "agreements"
        agreements_dir.mkdir(parents=True, exist_ok=True)
        signed_filename = f"signed-{merchant.id}-{envelope_id[:8]}.pdf"
        signed_pdf_path = agreements_dir / signed_filename
        if download_completed_document(envelope_id, str(signed_pdf_path)):
            relative_signed = f"agreements/{signed_filename}"
            merchant.signed_agreement_pdf_path = relative_signed
            pdf_for_email = str(signed_pdf_path)
        else:
            # Fallback to unsigned if download fails
            pdf_for_email = str(upload_dir / (merchant.agreement_pdf_path or ""))
            if not PathLib(pdf_for_email).exists():
                pdf_for_email = ""
    except Exception as e:
        logger.exception("Failed to download signed DocuSign document: %s", e)
        pdf_for_email = str(upload_dir / (merchant.agreement_pdf_path or "")) if merchant.agreement_pdf_path else ""
        if not PathLib(pdf_for_email).exists():
            pdf_for_email = ""

    event_obj.status = BoardingStatus.completed
    event_obj.completed_at = datetime.now(timezone.utc)
    contact.current_step = "done"
    db.commit()

    if pdf_for_email and PathLib(pdf_for_email).exists():
        from app.services.email import send_completion_email

        portal_url = f"{settings.FRONTEND_BASE_URL.rstrip('/')}/board/{token}"
        merchant_name = f"{(contact.legal_first_name or '').strip()} {(contact.legal_last_name or '').strip()}".strip() or (contact.email or "Merchant")
        send_completion_email(
            to_email=contact.email,
            merchant_name=merchant_name,
            portal_url=portal_url,
            pdf_path=pdf_for_email,
        )

    return RedirectResponse(
        url=f"{settings.FRONTEND_BASE_URL.rstrip('/')}/board/{token}",
        status_code=302,
    )


@router.post("/submit-review", response_model=SubmitReviewResponse)
def submit_review(
    token: str = Query(..., description="Invite token"),
    db: Session = Depends(get_db),
):
    """
    Public: Generate agreement PDF, store against merchant, and complete boarding.
    Requires completed step6 (bank details). Creates the PDF and saves path to merchant.
    """
    from app.services.agreement_pdf import generate_agreement_pdf
    from app.models.fee_schedule import FeeSchedule

    invite = db.query(Invite).filter(Invite.token == token).first()
    if not invite or invite.used_at:
        raise HTTPException(status_code=404, detail="Invalid or expired link")
    event = db.query(BoardingEvent).filter(BoardingEvent.id == invite.boarding_event_id).first()
    if not event:
        raise HTTPException(status_code=404, detail="Invalid link")
    contact = db.query(BoardingContact).filter(BoardingContact.boarding_event_id == event.id).first()
    if not contact:
        raise HTTPException(status_code=400, detail="Complete previous steps first.")
    if not event.merchant_id:
        raise HTTPException(status_code=400, detail="Merchant not found. Please complete account setup.")
    merchant = db.query(Merchant).filter(Merchant.id == event.merchant_id).first()
    if not merchant:
        raise HTTPException(status_code=400, detail="Merchant not found.")

    # Already completed – return existing agreement (merchant can access mini portal)
    if event.status == BoardingStatus.completed and merchant.agreement_pdf_path:
        return SubmitReviewResponse(success=True, agreement_pdf_path=merchant.agreement_pdf_path)

    # Ensure agreements directory exists
    upload_dir = PathLib(settings.UPLOAD_DIR)
    agreements_dir = upload_dir / "agreements"
    agreements_dir.mkdir(parents=True, exist_ok=True)
    pdf_filename = f"agreement-{merchant.id}-{datetime.now(timezone.utc).strftime('%Y%m%d%H%M%S')}.pdf"
    pdf_path = agreements_dir / pdf_filename

    # Build product package with items (like invite-info)
    product_package = None
    if invite.product_package_id and invite.product_package:
        pkg = invite.product_package
        item_by_id = {it.id: it for it in pkg.items}
        dd_by_item = {}
        for dd in invite.device_details:
            dd_by_item.setdefault(dd.package_item_id, []).append(dd)
        items = []
        for idx, dd in enumerate(invite.device_details):
            it = item_by_id.get(dd.package_item_id)
            if not it:
                continue
            cat = it.catalog_product
            items.append({"catalog_product": cat, "config": it.config, "product_name": cat.name if cat else ""})
        for it in pkg.items:
            if it.id in dd_by_item:
                continue
            cat = it.catalog_product
            items.append({"catalog_product": cat, "config": it.config, "product_name": cat.name if cat else ""})
        product_package = type("ProductPackage", (), {"items": items})()

    # Fee schedule from partner
    fee_schedule = None
    if invite.partner and invite.partner.fee_schedule_id:
        fee_schedule = db.query(FeeSchedule).filter(FeeSchedule.id == invite.partner.fee_schedule_id).first()

    try:
        generate_agreement_pdf(
            output_path=str(pdf_path),
            contact=contact,
            merchant=merchant,
            invite=invite,
            product_package=product_package,
            fee_schedule=fee_schedule,
        )
    except Exception as e:
        logger.exception("Failed to generate agreement PDF: %s", e)
        raise HTTPException(status_code=500, detail="Failed to generate agreement. Please try again.")

    # Store relative path for portability
    relative_path = f"agreements/{pdf_filename}"
    merchant.agreement_pdf_path = relative_path

    # DocuSign: create envelope and return signing URL (don't complete yet)
    if settings.DOCUSIGN_INTEGRATION_KEY and settings.DOCUSIGN_USER_ID:
        try:
            from app.services.docusign_signing import create_envelope_and_get_signing_url

            return_url_base = settings.DOCUSIGN_RETURN_URL_BASE.rstrip("/")
            return_url = f"{return_url_base}/boarding/docusign-callback?state={token}"
            signer_email = contact.email or ""
            signer_name = f"{(contact.legal_first_name or '').strip()} {(contact.legal_last_name or '').strip()}".strip() or "Signer"
            if not signer_email:
                raise HTTPException(status_code=400, detail="Email required for e-signature.")
            backend_root = PathLib(__file__).resolve().parent.parent.parent
            services_path = backend_root / settings.SERVICES_AGREEMENT_PATH
            envelope_id, signing_url = create_envelope_and_get_signing_url(
                pdf_path=str(pdf_path),
                signer_email=signer_email,
                signer_name=signer_name,
                return_url=return_url,
                services_agreement_path=str(services_path) if services_path.exists() else None,
            )
            merchant.docusign_envelope_id = envelope_id
            contact.current_step = "step6"  # Keep at review until signed
            db.commit()
            return SubmitReviewResponse(
                success=True,
                agreement_pdf_path=relative_path,
                redirect_to_signing=True,
                signing_url=signing_url,
            )
        except ValueError as e:
            logger.warning("DocuSign setup issue: %s. Completing without e-sign.", e)
            # Fall through to non-DocuSign flow
        except Exception as e:
            logger.exception("DocuSign envelope creation failed: %s", e)
            err_msg = str(e)
            raise HTTPException(
                status_code=500,
                detail=f"Failed to create signing session: {err_msg}",
            )

    # Non-DocuSign flow: mark completed and send email
    contact.current_step = "done"
    event.status = BoardingStatus.completed
    event.completed_at = datetime.now(timezone.utc)
    db.commit()

    # Send completion email with attachments
    from app.services.email import send_completion_email

    portal_url = f"{settings.FRONTEND_BASE_URL.rstrip('/')}/board/{token}"
    merchant_name = f"{(contact.legal_first_name or '').strip()} {(contact.legal_last_name or '').strip()}".strip() or (contact.email or "Merchant")
    send_completion_email(
        to_email=contact.email,
        merchant_name=merchant_name,
        portal_url=portal_url,
        pdf_path=str(pdf_path),
    )

    return SubmitReviewResponse(success=True, agreement_pdf_path=relative_path)


@router.post("/regenerate-agreement", response_model=SubmitReviewResponse)
def regenerate_agreement(
    token: str = Query(..., description="Invite token from boarding URL"),
    db: Session = Depends(get_db),
):
    """
    Regenerate the merchant agreement PDF from current data.
    For testing/iteration on the PDF template. Works for any boarding with a merchant.
    """
    from app.services.agreement_pdf import generate_agreement_pdf
    from app.models.fee_schedule import FeeSchedule

    invite = db.query(Invite).filter(Invite.token == token).first()
    if not invite or (invite.expires_at and invite.expires_at < datetime.now(timezone.utc)):
        raise HTTPException(status_code=404, detail="Invalid or expired link")
    event = db.query(BoardingEvent).filter(BoardingEvent.id == invite.boarding_event_id).first()
    if not event:
        raise HTTPException(status_code=404, detail="Invalid link")
    contact = db.query(BoardingContact).filter(BoardingContact.boarding_event_id == event.id).first()
    if not contact:
        raise HTTPException(status_code=400, detail="Complete previous steps first.")
    if not event.merchant_id:
        raise HTTPException(status_code=400, detail="Merchant not found. Please complete account setup.")
    merchant = db.query(Merchant).filter(Merchant.id == event.merchant_id).first()
    if not merchant:
        raise HTTPException(status_code=400, detail="Merchant not found.")

    upload_dir = PathLib(settings.UPLOAD_DIR)
    agreements_dir = upload_dir / "agreements"
    agreements_dir.mkdir(parents=True, exist_ok=True)
    pdf_filename = f"agreement-{merchant.id}-{datetime.now(timezone.utc).strftime('%Y%m%d%H%M%S')}.pdf"
    pdf_path = agreements_dir / pdf_filename

    product_package = None
    if invite.product_package_id and invite.product_package:
        pkg = invite.product_package
        item_by_id = {it.id: it for it in pkg.items}
        dd_by_item = {}
        for dd in invite.device_details:
            dd_by_item.setdefault(dd.package_item_id, []).append(dd)
        items = []
        for idx, dd in enumerate(invite.device_details):
            it = item_by_id.get(dd.package_item_id)
            if not it:
                continue
            cat = it.catalog_product
            items.append({"catalog_product": cat, "config": it.config, "product_name": cat.name if cat else ""})
        for it in pkg.items:
            if it.id in dd_by_item:
                continue
            cat = it.catalog_product
            items.append({"catalog_product": cat, "config": it.config, "product_name": cat.name if cat else ""})
        product_package = type("ProductPackage", (), {"items": items})()

    fee_schedule = None
    if invite.partner and invite.partner.fee_schedule_id:
        fee_schedule = db.query(FeeSchedule).filter(FeeSchedule.id == invite.partner.fee_schedule_id).first()

    try:
        generate_agreement_pdf(
            output_path=str(pdf_path),
            contact=contact,
            merchant=merchant,
            invite=invite,
            product_package=product_package,
            fee_schedule=fee_schedule,
        )
    except Exception as e:
        logger.exception("Failed to regenerate agreement PDF: %s", e)
        raise HTTPException(status_code=500, detail="Failed to regenerate agreement. Please try again.")

    relative_path = f"agreements/{pdf_filename}"
    merchant.agreement_pdf_path = relative_path
    db.commit()

    return SubmitReviewResponse(success=True, agreement_pdf_path=relative_path)


@router.get("/blank-agreement-pdf")
def get_blank_agreement_pdf():
    """
    Generate and download a blank merchant agreement PDF template.
    Use for layout review - all values are placeholders (—).
    No auth required; for local development/testing.
    """
    from app.services.agreement_pdf import generate_blank_agreement_pdf

    upload_dir = PathLib(settings.UPLOAD_DIR)
    agreements_dir = upload_dir / "agreements"
    agreements_dir.mkdir(parents=True, exist_ok=True)
    pdf_filename = f"Path-Merchant-Agreement-Blank-{datetime.now(timezone.utc).strftime('%Y%m%d%H%M%S')}.pdf"
    pdf_path = agreements_dir / pdf_filename

    generate_blank_agreement_pdf(output_path=str(pdf_path))

    return FileResponse(
        path=str(pdf_path),
        media_type="application/pdf",
        filename=pdf_filename,
    )


@router.get("/services-agreement")
def get_services_agreement():
    """
    Download the Path Services Agreement (static document).
    Same for all merchants; forms part of the full agreement with the Merchant Agreement PDF.
    """
    backend_root = PathLib(__file__).resolve().parent.parent.parent
    services_path = backend_root / settings.SERVICES_AGREEMENT_PATH
    if not services_path.exists():
        raise HTTPException(status_code=404, detail="Services Agreement not found")
    return FileResponse(
        path=str(services_path),
        media_type="application/pdf",
        filename="Services-Agreement.pdf",
    )


@router.get("/agreement-pdf")
def get_agreement_pdf(
    token: str = Query(..., description="Invite token from boarding URL"),
    db: Session = Depends(get_db),
):
    """
    Public: Download the merchant agreement PDF.
    Serves the signed PDF (with DocuSign e-sign info) when available, otherwise the unsigned PDF.
    Requires a valid invite token for a completed boarding.
    """
    invite = db.query(Invite).filter(Invite.token == token).first()
    if not invite:
        raise HTTPException(status_code=404, detail="Invalid or expired link")
    event = db.query(BoardingEvent).filter(BoardingEvent.id == invite.boarding_event_id).first()
    if not event or not event.merchant_id:
        raise HTTPException(status_code=404, detail="Agreement not found")
    merchant = db.query(Merchant).filter(Merchant.id == event.merchant_id).first()
    if not merchant:
        raise HTTPException(status_code=404, detail="Agreement not found")
    # Prefer signed PDF (with DocuSign e-sign info) when available
    pdf_path = merchant.signed_agreement_pdf_path or merchant.agreement_pdf_path
    if not pdf_path:
        raise HTTPException(status_code=404, detail="Agreement PDF not yet generated. Complete the flow or use Regenerate.")
    full_path = PathLib(settings.UPLOAD_DIR) / pdf_path
    if not full_path.exists():
        raise HTTPException(status_code=404, detail="Agreement file not found")
    return FileResponse(
        path=str(full_path),
        media_type="application/pdf",
        filename="Path-Merchant-Agreement.pdf",
    )


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
    contact = db.query(BoardingContact).filter(func.lower(BoardingContact.email) == body.email.lower()).first()
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
