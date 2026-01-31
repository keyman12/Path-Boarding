import random
import string
import uuid
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

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
    VerifyEmailSubmit,
    VerifyEmailResponse,
)

router = APIRouter()


def _generate_code(length: int = 6) -> str:
    return "".join(random.choices(string.digits, k=length))


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


@router.post("/step/1", response_model=Step1Response)
def submit_step1(
    token: str = Query(..., description="Invite token"),
    body: Step1Submit = ...,
    db: Session = Depends(get_db),
):
    """
    Public: submit step 1 (email, confirm email, password).
    Validates, stores contact, sends verification code (stub: code returned in message for dev).
    """
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

    code = _generate_code(6)
    expires_at = datetime.now(timezone.utc) + timedelta(minutes=15)
    vc = VerificationCode(
        id=str(uuid.uuid4()),
        channel="email",
        contact=body.email,
        code=code,
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

    # Stub: in production send email; for dev we could log or return code in response
    # For now we return a message; frontend can show "Check your email". For testing, expose code in dev only or log.
    return Step1Response(
        sent=True,
        message=f"Verification email sent to {body.email}. Use code {code} to verify (dev stub).",
    )


@router.post("/verify-email", response_model=VerifyEmailResponse)
def verify_email(
    token: str = Query(..., description="Invite token"),
    body: VerifyEmailSubmit = ...,
    db: Session = Depends(get_db),
):
    """
    Public: verify email with code from step 1. Creates merchant and merchant_user, advances to step 2.
    """
    invite = db.query(Invite).filter(Invite.token == token).first()
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
            VerificationCode.code == body.code.strip(),
            VerificationCode.used_at.is_(None),
            VerificationCode.expires_at > datetime.now(timezone.utc),
        )
        .order_by(VerificationCode.created_at.desc())
        .first()
    )
    if not vc:
        raise HTTPException(status_code=400, detail="Invalid or expired code")

    vc.used_at = datetime.now(timezone.utc)
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

    return VerifyEmailResponse(verified=True)
