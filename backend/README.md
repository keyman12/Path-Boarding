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

## Structure

- `app/main.py` – FastAPI app, CORS, routers.
- `app/core/` – config, database, security, deps.
- `app/models/` – SQLAlchemy models (partners, boarding_events, invites, merchants, merchant_users, verification_codes, audit_log).
- `app/routers/` – health; auth and boarding routers to be added.
- `app/schemas/` – Pydantic schemas.
- `app/services/` – validation, postcode, KYC, export (to be added).
- `alembic/` – migrations.
