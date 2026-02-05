# Path Boarding API (FastAPI)

Backend for merchant boarding: partner auth, invite URL API, boarding steps, health.

## Setup

```bash
python -m venv venv
source venv/bin/activate   # or venv\Scripts\activate on Windows
pip install -r requirements.txt
cp .env.example .env
# Edit .env: set DATABASE_URL (PostgreSQL)
```

## Database

- Create database: `createdb boarding` (or use RDS).
- Run migrations: `alembic upgrade head`
- Rollback one revision: `alembic downgrade -1`

## Run

```bash
uvicorn app.main:app --reload --port 8000
```

- API docs: [http://localhost:8000/docs](http://localhost:8000/docs)
- Health: [http://localhost:8000/health](http://localhost:8000/health)

## Email (verification link)

Step 1 sends a verification link to the merchant’s email (from a Path2ai.tech address). Set SMTP in `.env`.

**Full step-by-step guide:** [docs/EMAIL_VERIFICATION_SETUP.md](../docs/EMAIL_VERIFICATION_SETUP.md) — Fasthosts, WP Mail SMTP Pro, `.env` values, testing, and troubleshooting.

Summary:
- **Fasthosts**: Use your domain’s SMTP (e.g. `mail.path2ai.tech`) and an email account’s credentials in `.env`.
- **WP Mail SMTP Pro**: Use the same SMTP host, port, user and password from the WordPress plugin in this backend’s `.env`.

If SMTP is not configured, the app still accepts step 1 but does not send the email (useful for local dev).

## Structure

- `app/main.py` – FastAPI app, CORS, routers.
- `app/core/` – config, database, security, deps.
- `app/models/` – SQLAlchemy models (partners, boarding_events, invites, merchants, merchant_users, verification_codes, audit_log).
- `app/routers/` – health; auth and boarding routers to be added.
- `app/schemas/` – Pydantic schemas.
- `app/services/` – validation, postcode, KYC, export (to be added).
- `alembic/` – migrations.
