import os
import shutil
import uuid
from pathlib import Path

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from sqlalchemy.orm import Session

from app.core.auth import get_current_admin
from app.core.config import settings
from app.core.deps import get_db
from app.core.security import create_access_token, get_password_hash
from app.models.admin_user import AdminUser
from app.models.boarding_contact import BoardingContact
from app.models.boarding_event import BoardingEvent
from app.models.invite import Invite
from app.models.merchant import Merchant
from app.models.merchant_user import MerchantUser
from app.models.partner import Partner
from app.schemas.admin import (
    AdminChangePassword,
    AdminCreate,
    AdminLogin,
    AdminPartnerCreate,
    AdminPartnerUpdate,
    AdminPartnerResponse,
    AdminUserResponse,
    TokenResponse,
)

router = APIRouter()

# Allowed logo extensions
LOGO_EXTENSIONS = {".png", ".jpg", ".jpeg", ".svg", ".webp"}


def _ensure_upload_dir():
    d = Path(settings.UPLOAD_DIR) / "partners"
    d.mkdir(parents=True, exist_ok=True)
    return d


@router.post("/login", response_model=TokenResponse)
def admin_login(body: AdminLogin, db: Session = Depends(get_db)):
    """Path Admin login. Initial account: Admin / keywee50."""
    admin = db.query(AdminUser).filter(AdminUser.username == body.username).first()
    if not admin:
        raise HTTPException(status_code=401, detail="Invalid username or password")
    from app.core.security import verify_password
    if not verify_password(body.password, admin.hashed_password):
        raise HTTPException(status_code=401, detail="Invalid username or password")
    token = create_access_token(subject=admin.id, extra_claims={"role": "admin"})
    return TokenResponse(access_token=token)


@router.post("/users", response_model=AdminUserResponse)
def create_admin_user(
    body: AdminCreate,
    db: Session = Depends(get_db),
    admin: AdminUser = Depends(get_current_admin),
):
    """Create a new Path Admin account."""
    existing = db.query(AdminUser).filter(AdminUser.username == body.username).first()
    if existing:
        raise HTTPException(status_code=400, detail="Username already exists")
    new_admin = AdminUser(
        id=str(uuid.uuid4()),
        username=body.username,
        hashed_password=get_password_hash(body.password),
    )
    db.add(new_admin)
    db.commit()
    db.refresh(new_admin)
    return new_admin


@router.get("/users", response_model=list[AdminUserResponse])
def list_admin_users(
    db: Session = Depends(get_db),
    admin: AdminUser = Depends(get_current_admin),
):
    """List all Path Admin users."""
    admins = db.query(AdminUser).order_by(AdminUser.username).all()
    return admins


@router.patch("/users/{admin_id}/password")
def change_admin_password(
    admin_id: str,
    body: AdminChangePassword,
    db: Session = Depends(get_db),
    admin: AdminUser = Depends(get_current_admin),
):
    """Change an admin user's password."""
    target = db.query(AdminUser).filter(AdminUser.id == admin_id).first()
    if not target:
        raise HTTPException(status_code=404, detail="Admin user not found")
    target.hashed_password = get_password_hash(body.new_password)
    db.commit()
    return {"ok": True, "message": "Password updated"}


@router.post("/partners", response_model=AdminPartnerResponse)
def setup_new_isv(
    name: str = Form(...),
    email: str = Form(...),
    password: str = Form(...),
    external_id: str = Form(None),
    logo: UploadFile = File(None),
    db: Session = Depends(get_db),
    admin: AdminUser = Depends(get_current_admin),
):
    """Setup a new ISV (partner). Optional logo upload (size limit for welcome screen)."""
    existing = db.query(Partner).filter(Partner.email == email).first()
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")
    partner_id = str(uuid.uuid4())
    partner = Partner(
        id=partner_id,
        name=name,
        email=email,
        hashed_password=get_password_hash(password),
        external_id=external_id or None,
        is_active=True,
    )
    db.add(partner)
    db.flush()

    logo_url = None
    if logo and logo.filename:
        ext = Path(logo.filename).suffix.lower()
        if ext not in LOGO_EXTENSIONS:
            raise HTTPException(status_code=400, detail=f"Logo must be one of: {', '.join(LOGO_EXTENSIONS)}")
        content = logo.file.read()
        if len(content) > settings.LOGO_MAX_SIZE_BYTES:
            raise HTTPException(
                status_code=400,
                detail=f"Logo must be under {settings.LOGO_MAX_SIZE_BYTES // 1024}KB",
            )
        upload_dir = _ensure_upload_dir()
        logo_path = upload_dir / f"{partner_id}{ext}"
        with open(logo_path, "wb") as f:
            f.write(content)
        logo_url = f"/uploads/partners/{partner_id}{ext}"
        partner.logo_url = logo_url

    db.commit()
    db.refresh(partner)
    return partner


@router.get("/partners", response_model=list[AdminPartnerResponse])
def list_partners(
    db: Session = Depends(get_db),
    admin: AdminUser = Depends(get_current_admin),
):
    """List all ISVs (partners)."""
    partners = db.query(Partner).order_by(Partner.name).all()
    return partners


@router.get("/partners/{partner_id}", response_model=AdminPartnerResponse)
def get_partner(
    partner_id: str,
    db: Session = Depends(get_db),
    admin: AdminUser = Depends(get_current_admin),
):
    """Get one ISV by id."""
    partner = db.query(Partner).filter(Partner.id == partner_id).first()
    if not partner:
        raise HTTPException(status_code=404, detail="Partner not found")
    return partner


@router.patch("/partners/{partner_id}", response_model=AdminPartnerResponse)
def update_partner(
    partner_id: str,
    body: AdminPartnerUpdate,
    db: Session = Depends(get_db),
    admin: AdminUser = Depends(get_current_admin),
):
    """Update ISV details including password reset."""
    partner = db.query(Partner).filter(Partner.id == partner_id).first()
    if not partner:
        raise HTTPException(status_code=404, detail="Partner not found")
    if body.name is not None:
        partner.name = body.name
    if body.email is not None:
        existing = db.query(Partner).filter(Partner.email == body.email, Partner.id != partner_id).first()
        if existing:
            raise HTTPException(status_code=400, detail="Email already in use")
        partner.email = body.email
    if body.password is not None:
        partner.hashed_password = get_password_hash(body.password)
    if body.is_active is not None:
        partner.is_active = body.is_active
    if body.external_id is not None:
        partner.external_id = body.external_id or None
    db.commit()
    db.refresh(partner)
    return partner


def _delete_partner_logo_file(logo_url: str) -> None:
    """Remove logo file from disk. logo_url is like /uploads/partners/xxx.png."""
    if not logo_url or not logo_url.startswith("/uploads/partners/"):
        return
    name = logo_url.replace("/uploads/partners/", "")
    if not name or ".." in name:
        return
    upload_dir = _ensure_upload_dir()
    path = upload_dir / name
    if path.exists():
        try:
            path.unlink()
        except OSError:
            pass


@router.patch("/partners/{partner_id}/logo", response_model=AdminPartnerResponse)
def update_partner_logo(
    partner_id: str,
    logo: UploadFile = File(...),
    db: Session = Depends(get_db),
    admin: AdminUser = Depends(get_current_admin),
):
    """Upload or replace partner logo. Replaces any existing logo."""
    partner = db.query(Partner).filter(Partner.id == partner_id).first()
    if not partner:
        raise HTTPException(status_code=404, detail="Partner not found")
    if not logo.filename:
        raise HTTPException(status_code=400, detail="No file provided")
    ext = Path(logo.filename).suffix.lower()
    if ext not in LOGO_EXTENSIONS:
        raise HTTPException(status_code=400, detail=f"Logo must be one of: {', '.join(LOGO_EXTENSIONS)}")
    content = logo.file.read()
    if len(content) > settings.LOGO_MAX_SIZE_BYTES:
        raise HTTPException(
            status_code=400,
            detail=f"Logo must be under {settings.LOGO_MAX_SIZE_BYTES // 1024}KB",
        )
    _delete_partner_logo_file(partner.logo_url or "")
    upload_dir = _ensure_upload_dir()
    logo_path = upload_dir / f"{partner_id}{ext}"
    with open(logo_path, "wb") as f:
        f.write(content)
    partner.logo_url = f"/uploads/partners/{partner_id}{ext}"
    db.commit()
    db.refresh(partner)
    return partner


@router.delete("/partners/{partner_id}/logo", response_model=AdminPartnerResponse)
def delete_partner_logo(
    partner_id: str,
    db: Session = Depends(get_db),
    admin: AdminUser = Depends(get_current_admin),
):
    """Remove partner logo and delete file from disk."""
    partner = db.query(Partner).filter(Partner.id == partner_id).first()
    if not partner:
        raise HTTPException(status_code=404, detail="Partner not found")
    _delete_partner_logo_file(partner.logo_url or "")
    partner.logo_url = None
    db.commit()
    db.refresh(partner)
    return partner


@router.delete("/partners/{partner_id}")
def delete_partner(
    partner_id: str,
    db: Session = Depends(get_db),
    admin: AdminUser = Depends(get_current_admin),
):
    """Delete an ISV (partner) and all associated data: invites, boarding events, contacts, merchants, merchant users."""
    partner = db.query(Partner).filter(Partner.id == partner_id).first()
    if not partner:
        raise HTTPException(status_code=404, detail="Partner not found")

    event_ids = [r.id for r in db.query(BoardingEvent.id).filter(BoardingEvent.partner_id == partner_id).all()]
    merchant_ids = [r.id for r in db.query(Merchant.id).filter(Merchant.partner_id == partner_id).all()]

    if event_ids:
        db.query(BoardingContact).filter(BoardingContact.boarding_event_id.in_(event_ids)).delete(synchronize_session=False)
    db.query(Invite).filter(Invite.partner_id == partner_id).delete(synchronize_session=False)
    db.query(BoardingEvent).filter(BoardingEvent.partner_id == partner_id).update({BoardingEvent.merchant_id: None}, synchronize_session=False)
    db.query(BoardingEvent).filter(BoardingEvent.partner_id == partner_id).delete(synchronize_session=False)
    if merchant_ids:
        db.query(MerchantUser).filter(MerchantUser.merchant_id.in_(merchant_ids)).delete(synchronize_session=False)
    db.query(Merchant).filter(Merchant.partner_id == partner_id).delete(synchronize_session=False)
    db.query(Partner).filter(Partner.id == partner_id).delete(synchronize_session=False)
    db.commit()
    return {"ok": True, "message": "Partner deleted"}
