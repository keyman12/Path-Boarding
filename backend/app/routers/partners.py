import secrets
import uuid
from datetime import datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.auth import get_current_partner
from app.core.config import settings
from app.core.deps import get_db
from app.models.boarding_event import BoardingEvent, BoardingStatus
from app.models.invite import Invite
from app.models.partner import Partner
from app.models.product_catalog import ProductCatalog
from app.models.product_package import ProductPackage
from app.models.product_package_item import ProductPackageItem
from app.models.invite_device_detail import InviteDeviceDetail
from app.schemas.invite import InviteCreate, InviteResponse
from app.schemas.product_catalog import ProductCatalogItem
from app.schemas.product_package import (
    PackageItemCreate,
    PackageItemResponse,
    ProductPackageCreate,
    ProductPackageResponse,
    ProductPackageUpdate,
)

router = APIRouter()


def _generate_package_uid() -> str:
    return "PKG-" + secrets.token_urlsafe(8).upper().replace("-", "").replace("_", "")[:12]


# --- Fee Schedule (partner's minimums for package wizard) ---


@router.get("/fee-schedule")
def get_partner_fee_schedule(
    db: Session = Depends(get_db),
    partner: Partner = Depends(get_current_partner),
):
    """Return the current partner's fee schedule rates (minimums for product package wizard)."""
    if not partner.fee_schedule_id:
        return {"rates": {}}
    from app.models.fee_schedule import FeeSchedule
    schedule = db.query(FeeSchedule).filter(FeeSchedule.id == partner.fee_schedule_id).first()
    if not schedule:
        return {"rates": {}}
    return {"rates": schedule.rates or {}}


# --- Product Catalog ---


@router.get("/product-catalog", response_model=list[ProductCatalogItem])
def list_product_catalog(
    db: Session = Depends(get_db),
    partner: Partner = Depends(get_current_partner),
):
    """List available products from the global catalog."""
    products = db.query(ProductCatalog).order_by(ProductCatalog.product_type, ProductCatalog.product_code).all()
    return [
        ProductCatalogItem(
            id=p.id,
            product_type=p.product_type,
            product_code=p.product_code,
            name=p.name,
            config_schema=p.config_schema,
            requires_store_epos=p.requires_store_epos or False,
        )
        for p in products
    ]


# --- Product Packages ---


@router.get("/product-packages", response_model=list[ProductPackageResponse])
def list_product_packages(
    db: Session = Depends(get_db),
    partner: Partner = Depends(get_current_partner),
):
    """List product packages for the current partner."""
    packages = db.query(ProductPackage).filter(ProductPackage.partner_id == partner.id).order_by(ProductPackage.created_at.desc()).all()
    result = []
    for pkg in packages:
        items = []
        for it in pkg.items:
            cat = it.catalog_product
            items.append(
                PackageItemResponse(
                    id=it.id,
                    catalog_product_id=it.catalog_product_id,
                    product_code=cat.product_code if cat else None,
                    product_name=cat.name if cat else None,
                    product_type=cat.product_type if cat else None,
                    config=it.config,
                    sort_order=it.sort_order,
                    requires_store_epos=cat.requires_store_epos if cat else False,
                )
            )
        result.append(
            ProductPackageResponse(
                id=pkg.id,
                partner_id=pkg.partner_id,
                uid=pkg.uid,
                name=pkg.name,
                description=pkg.description,
                items=items,
                created_at=pkg.created_at.isoformat() if pkg.created_at else None,
            )
        )
    return result


@router.post("/product-packages", response_model=ProductPackageResponse)
def create_product_package(
    body: ProductPackageCreate,
    db: Session = Depends(get_db),
    partner: Partner = Depends(get_current_partner),
):
    """Create a new product package."""
    uid = _generate_package_uid()
    while db.query(ProductPackage).filter(ProductPackage.partner_id == partner.id, ProductPackage.uid == uid).first():
        uid = _generate_package_uid()

    pkg_id = str(uuid.uuid4())
    pkg = ProductPackage(
        id=pkg_id,
        partner_id=partner.id,
        uid=uid,
        name=body.name,
        description=body.description,
    )
    db.add(pkg)

    for i, item in enumerate(body.items):
        db.add(
            ProductPackageItem(
                id=str(uuid.uuid4()),
                package_id=pkg_id,
                catalog_product_id=item.catalog_product_id,
                config=item.config,
                sort_order=item.sort_order if item.sort_order else i,
            )
        )
    db.commit()
    db.refresh(pkg)
    return _package_to_response(pkg)


@router.get("/product-packages/{package_id}", response_model=ProductPackageResponse)
def get_product_package(
    package_id: str,
    db: Session = Depends(get_db),
    partner: Partner = Depends(get_current_partner),
):
    """Get a product package by ID."""
    pkg = db.query(ProductPackage).filter(ProductPackage.id == package_id, ProductPackage.partner_id == partner.id).first()
    if not pkg:
        raise HTTPException(status_code=404, detail="Package not found")
    return _package_to_response(pkg)


@router.patch("/product-packages/{package_id}", response_model=ProductPackageResponse)
def update_product_package(
    package_id: str,
    body: ProductPackageUpdate,
    db: Session = Depends(get_db),
    partner: Partner = Depends(get_current_partner),
):
    """Update a product package."""
    pkg = db.query(ProductPackage).filter(ProductPackage.id == package_id, ProductPackage.partner_id == partner.id).first()
    if not pkg:
        raise HTTPException(status_code=404, detail="Package not found")

    if body.name is not None:
        pkg.name = body.name
    if body.description is not None:
        pkg.description = body.description
    if body.items is not None:
        for it in pkg.items:
            db.delete(it)
        for i, item in enumerate(body.items):
            db.add(
                ProductPackageItem(
                    id=str(uuid.uuid4()),
                    package_id=pkg.id,
                    catalog_product_id=item.catalog_product_id,
                    config=item.config,
                    sort_order=item.sort_order if item.sort_order else i,
                )
            )
    db.commit()
    db.refresh(pkg)
    return _package_to_response(pkg)


@router.delete("/product-packages/{package_id}", status_code=204)
def delete_product_package(
    package_id: str,
    db: Session = Depends(get_db),
    partner: Partner = Depends(get_current_partner),
):
    """Delete a product package."""
    pkg = db.query(ProductPackage).filter(ProductPackage.id == package_id, ProductPackage.partner_id == partner.id).first()
    if not pkg:
        raise HTTPException(status_code=404, detail="Package not found")
    db.delete(pkg)
    db.commit()


def _package_to_response(pkg: ProductPackage) -> ProductPackageResponse:
    items = []
    for it in pkg.items:
        cat = it.catalog_product
        items.append(
            PackageItemResponse(
                id=it.id,
                catalog_product_id=it.catalog_product_id,
                product_code=cat.product_code if cat else None,
                product_name=cat.name if cat else None,
                product_type=cat.product_type if cat else None,
                config=it.config,
                sort_order=it.sort_order,
                requires_store_epos=cat.requires_store_epos if cat else False,
            )
        )
    return ProductPackageResponse(
        id=pkg.id,
        partner_id=pkg.partner_id,
        uid=pkg.uid,
        name=pkg.name,
        description=pkg.description,
        items=items,
        created_at=pkg.created_at.isoformat() if pkg.created_at else None,
    )


@router.post("/boarding/invite", response_model=InviteResponse)
def create_invite(
    body: InviteCreate,
    db: Session = Depends(get_db),
    partner: Partner = Depends(get_current_partner),
):
    """
    Create a boarding event and invite; returns a URL to send to the merchant.
    Partner-only (requires Bearer token).
    Optional: product_package_uid + device_details (required when package has POS devices).
    """
    product_package_id = None
    if body.product_package_uid:
        pkg = db.query(ProductPackage).filter(
            ProductPackage.partner_id == partner.id,
            ProductPackage.uid == body.product_package_uid,
        ).first()
        if not pkg:
            raise HTTPException(status_code=404, detail="Product package not found")
        product_package_id = pkg.id
        # Validate device_details when package has POS items (one or more per POS type)
        pos_items = [it for it in pkg.items if it.catalog_product and it.catalog_product.requires_store_epos]
        if pos_items:
            if not body.device_details:
                raise HTTPException(
                    status_code=400,
                    detail="Device details (store name, address, EPOS) required for each POS device instance in the package",
                )
            pos_item_ids = {it.id for it in pos_items}
            for dd in body.device_details:
                if dd.package_item_id not in pos_item_ids:
                    raise HTTPException(status_code=400, detail=f"Unknown package item: {dd.package_item_id}")
            # Each POS type must have at least one device detail
            dd_by_item = {}
            for dd in body.device_details:
                dd_by_item.setdefault(dd.package_item_id, []).append(dd)
            for pos_it in pos_items:
                if not dd_by_item.get(pos_it.id):
                    raise HTTPException(
                        status_code=400,
                        detail=f"At least one device detail required for {pos_it.catalog_product.name if pos_it.catalog_product else 'POS device'}",
                    )

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
    invite_id = str(uuid.uuid4())
    token = secrets.token_urlsafe(32)
    expires_at = datetime.utcnow() + timedelta(days=settings.INVITE_TOKEN_EXPIRE_DAYS)
    invite = Invite(
        id=invite_id,
        partner_id=partner.id,
        boarding_event_id=event_id,
        token=token,
        email=body.email,
        merchant_name=merchant_name,
        expires_at=expires_at,
        product_package_id=product_package_id,
    )
    db.add(invite)

    if body.device_details and product_package_id:
        for dd in body.device_details:
            db.add(
                InviteDeviceDetail(
                    id=str(uuid.uuid4()),
                    invite_id=invite_id,
                    package_item_id=dd.package_item_id,
                    store_name=dd.store_name,
                    store_address=dd.store_address,
                    epos_terminal=dd.epos_terminal,
                )
            )

    db.commit()

    base = settings.FRONTEND_BASE_URL.rstrip("/")
    invite_url = f"{base}/board/{token}"

    return InviteResponse(
        invite_url=invite_url,
        expires_at=expires_at,
        boarding_event_id=event_id,
        token=token,
    )
