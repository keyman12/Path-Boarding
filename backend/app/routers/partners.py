import secrets
import uuid
from datetime import datetime, timedelta

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.auth import get_current_partner
from app.core.config import settings
from app.core.deps import get_db
from app.models.boarding_event import BoardingEvent, BoardingStatus
from app.models.invite import Invite
from app.models.partner import Partner
from app.schemas.invite import InviteCreate, InviteResponse

router = APIRouter()


@router.post("/boarding/invite", response_model=InviteResponse)
def create_invite(
    body: InviteCreate,
    db: Session = Depends(get_db),
    partner: Partner = Depends(get_current_partner),
):
    """
    Create a boarding event and invite; returns a URL to send to the merchant.
    Partner-only (requires Bearer token).
    """
    # Create boarding event (draft)
    event_id = str(uuid.uuid4())
    event = BoardingEvent(
        id=event_id,
        partner_id=partner.id,
        merchant_id=None,
        status=BoardingStatus.draft,
        current_step=1,
    )
    db.add(event)

    # Don't store JWT or token-like strings as merchant_name (common mistake: pasting Bearer token into the field)
    merchant_name = body.merchant_name
    if merchant_name and (merchant_name.strip().startswith("eyJ") or len(merchant_name) > 200):
        merchant_name = None

    # Create invite with unique token
    token = secrets.token_urlsafe(32)
    expires_at = datetime.utcnow() + timedelta(days=settings.INVITE_TOKEN_EXPIRE_DAYS)
    invite = Invite(
        id=str(uuid.uuid4()),
        partner_id=partner.id,
        boarding_event_id=event_id,
        token=token,
        email=body.email,
        merchant_name=merchant_name,
        expires_at=expires_at,
    )
    db.add(invite)

    db.commit()

    base = settings.FRONTEND_BASE_URL.rstrip("/")
    invite_url = f"{base}/board/{token}"

    return InviteResponse(
        invite_url=invite_url,
        expires_at=expires_at,
        boarding_event_id=event_id,
        token=token,
    )
