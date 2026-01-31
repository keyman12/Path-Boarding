from pydantic_settings import BaseSettings
from typing import List


class Settings(BaseSettings):
    """Application settings from env."""

    # Database
    DATABASE_URL: str = "postgresql://postgres:postgres@localhost:5432/boarding"

    # Security
    SECRET_KEY: str = "change-me-in-production"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60

    # CORS
    CORS_ORIGINS: List[str] = ["http://localhost:3000", "http://127.0.0.1:3000"]

    # App
    API_V1_PREFIX: str = ""
    # Invite link validity; boarding page is effectively torn down after this or when boarding completes
    INVITE_TOKEN_EXPIRE_DAYS: int = 3
    # Base URL for invite links (e.g. https://app.example.com or http://localhost:3000)
    FRONTEND_BASE_URL: str = "http://localhost:3000"

    # Uploads (ISV logos) – path on disk; served at /uploads/
    UPLOAD_DIR: str = "uploads"
    LOGO_MAX_SIZE_BYTES: int = 512 * 1024  # 512KB for welcome screen

    class Config:
        env_file = ".env"
        case_sensitive = True


settings = Settings()
