import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.core.auth import get_current_partner
from app.core.deps import get_db
from app.core.security import get_password_hash, verify_password, create_access_token
from app.models.partner import Partner
from app.schemas.partner import PartnerCreate, PartnerLogin, PartnerResponse, TokenResponse

router = APIRouter()


class PartnerMeResponse(BaseModel):
    name: str


@router.post("/partner/register", response_model=PartnerResponse)
def partner_register(data: PartnerCreate, db: Session = Depends(get_db)):
    """Register a new partner (ISV)."""
    existing = db.query(Partner).filter(Partner.email == data.email).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email already registered",
        )
    partner = Partner(
        id=str(uuid.uuid4()),
        name=data.name,
        email=data.email,
        hashed_password=get_password_hash(data.password),
        is_active=True,
    )
    db.add(partner)
    db.commit()
    db.refresh(partner)
    return partner


@router.post("/partner/login", response_model=TokenResponse)
def partner_login(data: PartnerLogin, db: Session = Depends(get_db)):
    """Login as partner; returns JWT access token."""
    partner = db.query(Partner).filter(Partner.email == data.email).first()
    if not partner or not verify_password(data.password, partner.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
        )
    if not partner.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Partner account is inactive",
        )
    token = create_access_token(subject=partner.id)
    return TokenResponse(access_token=token)


@router.get("/partner/me", response_model=PartnerMeResponse)
def partner_me(partner: Partner = Depends(get_current_partner)):
    """Return current partner name (requires valid Bearer token). Returns 401 if token missing or expired."""
    return PartnerMeResponse(name=partner.name)
