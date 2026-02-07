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
from app.core.security import get_password_hash
from app.models.boarding_contact import BoardingContact
from app.models.boarding_event import BoardingEvent, BoardingStatus
from app.models.invite import Invite
from app.models.merchant import Merchant
from app.models.merchant_user import MerchantUser
from app.models.verification_code import VerificationCode
from app.schemas.boarding import (
    InviteInfoResponse,
    InviteInfoPartner,
    Step1Submit,
    Step1Response,
    VerifyEmailCodeSubmit,
    VerifyEmailResponse,
    VerifyStatusResponse,
    TestClearEmailSubmit,
    TestClearEmailResponse,
)
from app.services.email import send_verification_code_email

router = APIRouter()

# 6-digit email code expiry (industry norm ~10–15 mins)
VERIFY_CODE_EXPIRE_MINUTES = 15


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

    return InviteInfoResponse(
        partner=InviteInfoPartner(name=partner.name, logo_url=partner.logo_url),
        merchant_name=invite.merchant_name,
        boarding_event_id=event.id,
        valid=True,
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
