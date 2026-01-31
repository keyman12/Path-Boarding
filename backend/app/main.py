from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.core.config import settings
from app.models import Base  # noqa: F401 - register models
from app.routers import admin, auth, boarding, health, partners

app = FastAPI(
    title="Path Boarding API",
    description="Merchant boarding for payment acceptance",
    version="0.1.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(health.router, prefix="/health")
app.include_router(auth.router, prefix="/auth")
app.include_router(partners.router, prefix="/partners")
app.include_router(boarding.router, prefix="/boarding")
app.include_router(admin.router, prefix="/admin")

# Serve uploaded partner logos
upload_dir = Path(settings.UPLOAD_DIR)
upload_dir.mkdir(parents=True, exist_ok=True)
app.mount("/uploads", StaticFiles(directory=str(upload_dir)), name="uploads")


@app.on_event("startup")
async def startup():
    # Seed initial Path Admin if no admin users exist (Admin / keywee50)
    from app.core.database import SessionLocal
    from app.core.security import get_password_hash
    from app.models.admin_user import AdminUser
    db = SessionLocal()
    try:
        if db.query(AdminUser).first() is None:
            import uuid
            admin = AdminUser(
                id=str(uuid.uuid4()),
                username="Admin",
                hashed_password=get_password_hash("keywee50"),
            )
            db.add(admin)
            db.commit()
    finally:
        db.close()


@app.on_event("shutdown")
async def shutdown():
    pass
