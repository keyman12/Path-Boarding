from typing import List

from pydantic import field_validator
from pydantic_settings import BaseSettings


def _parse_cors_origins(s: str) -> List[str]:
    """Parse CORS_ORIGINS from comma-separated or JSON array string."""
    s = (s or "").strip()
    if not s:
        return []
    if s.startswith("["):
        import json
        try:
            out = json.loads(s)
            return [str(x).strip() for x in out if x]
        except Exception:
            pass
    return [x.strip() for x in s.split(",") if x.strip()]


class Settings(BaseSettings):
    """Application settings from env."""

    # Database
    DATABASE_URL: str = "postgresql://postgres:postgres@localhost:5432/boarding"

    # Security
    SECRET_KEY: str = "change-me-in-production"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60

    # CORS – must include the origin where the frontend runs (e.g. where verification links open)
    CORS_ORIGINS: List[str] = ["http://localhost:3000", "http://127.0.0.1:3000"]

    @field_validator("CORS_ORIGINS", mode="before")
    @classmethod
    def cors_origins_list(cls, v: object) -> List[str]:
        if isinstance(v, list):
            return [str(x).strip() for x in v if x]
        return _parse_cors_origins(str(v) if v else "")

    # App
    API_V1_PREFIX: str = ""
    # Invite link validity; boarding page is effectively torn down after this or when boarding completes
    INVITE_TOKEN_EXPIRE_DAYS: int = 3
    # Base URL for invite links (e.g. https://app.example.com or http://localhost:3000)
    FRONTEND_BASE_URL: str = "http://localhost:3000"

    # Uploads (ISV logos) – path on disk; served at /uploads/
    UPLOAD_DIR: str = "uploads"
    # Services Agreement (static PDF) – path relative to app dir; filename must match file in folder
    SERVICES_AGREEMENT_PATH: str = "static/Services Agreement.pdf"
    LOGO_MAX_SIZE_BYTES: int = 512 * 1024  # 512KB for welcome screen

    # Email (verification link) – from Path2ai.tech; set in .env for production
    SMTP_HOST: str = ""
    SMTP_PORT: int = 587
    SMTP_USER: str = ""
    SMTP_PASSWORD: str = ""
    SMTP_FROM_EMAIL: str = "noreply@path2ai.tech"
    SMTP_FROM_NAME: str = "Path Boarding"
    # Logo URL in email body (absolute); e.g. FRONTEND_BASE_URL + /logo-path.png
    EMAIL_LOGO_URL: str = ""

    # Address lookup per country (optional). If empty for a country, lookup returns 503 and users can type manually.
    # UK: Ideal Postcodes – get a key at https://ideal-postcodes.co.uk/ (free trial then pay-as-you-go).
    # Add keys for other countries as needed, e.g. ADDRESS_LOOKUP_IE_API_KEY.
    ADDRESS_LOOKUP_UK_API_KEY: str = ""

    # SumSub Identity Verification (required for production)
    SUMSUB_APP_TOKEN: str = ""
    SUMSUB_SECRET_KEY: str = ""
    SUMSUB_BASE_URL: str = "https://api.sumsub.com"
    SUMSUB_LEVEL_NAME: str = "basic-kyc-level"

    # DocuSign eSignature (JWT auth)
    DOCUSIGN_INTEGRATION_KEY: str = ""
    DOCUSIGN_USER_ID: str = ""  # ds_impersonated_user_id
    DOCUSIGN_ACCOUNT_ID: str = ""  # Optional: from JWT userinfo if not set
    DOCUSIGN_PRIVATE_KEY: str = ""  # RSA private key contents (or path to file)
    DOCUSIGN_AUTH_SERVER: str = "account-d.docusign.com"  # Demo: account-d, Prod: account
    DOCUSIGN_BASE_PATH: str = "https://demo.docusign.net"  # Demo: demo.docusign.net, Prod: na.docusign.net or eu.docusign.net
    # Base URL for DocuSign return/callback (where DocuSign redirects after signing)
    DOCUSIGN_RETURN_URL_BASE: str = "http://localhost:8000"

    # TrueLayer bank verification (Data API + Verification API)
    TRUELAYER_CLIENT_ID: str = ""
    TRUELAYER_CLIENT_SECRET: str = ""
    # Redirect URI: where TrueLayer redirects after user connects bank. Local: http://localhost:8000/boarding/truelayer-callback. Prod: https://boarding.path2ai.tech/boarding/truelayer-callback
    TRUELAYER_REDIRECT_URI: str = "http://localhost:8000/boarding/truelayer-callback"
    # Sandbox: auth.truelayer-sandbox.com, api.truelayer-sandbox.com. Live: auth.truelayer.com, api.truelayer.com
    TRUELAYER_AUTH_URL: str = "https://auth.truelayer-sandbox.com"
    TRUELAYER_API_URL: str = "https://api.truelayer-sandbox.com"
    # Sandbox: uk-cs-mock. Live: uk-ob-all or specific providers
    TRUELAYER_PROVIDERS: str = "uk-cs-mock"

    class Config:
        env_file = ".env"
        case_sensitive = True


settings = Settings()
