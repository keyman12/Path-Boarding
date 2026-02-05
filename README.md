# Path Merchant Boarding

Merchant boarding application for payment acceptance (Stripe Connect–style). ISV partners own the merchant relationship; merchants complete onboarding via invite URL. Includes AML/KYC, UK postcode lookup, and Path branding.

## Repo layout

- **backend/** – Python FastAPI app (auth, boarding API, invite URL API, health). See [backend/README.md](backend/README.md).
- **frontend/** – Next.js App Router (boarding UI, Path design tokens, logo). See [frontend/README.md](frontend/README.md).
- **Path Design/** – Path brand guidelines and logo (reference for frontend).

## Quick start (local on your Mac)

The steps below are for **local development on your Mac**. For AWS deployment when the app is complete, see [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md).

1. **Backend**
   - `cd backend && python -m venv venv && source venv/bin/activate` (or `venv\Scripts\activate` on Windows).
   - `pip install -r requirements.txt`
   - Copy `.env.example` to `.env` and set `DATABASE_URL` (PostgreSQL).
   - Create DB: `createdb boarding` (or equivalent).
   - `alembic upgrade head`
   - `uvicorn app.main:app --reload --port 8000`

2. **Frontend**
   - `cd frontend && npm install`
   - Set `NEXT_PUBLIC_API_URL=http://localhost:8000` (or in `.env.local`).
   - `npm run dev` (runs on port 3000).

3. Open [http://localhost:3000](http://localhost:3000) and [http://localhost:8000/docs](http://localhost:8000/docs) for API docs.
4. **API tester (ISV developers):** [http://localhost:3000/developer](http://localhost:3000/developer) — register, login, and generate a boarding link in one place. For production this can be hosted at **boardingapi.path2ai.tech** (or similar) so third-party ISVs have all the info in one place.

## Deployment

- **AWS:** See [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) for the requirement to deploy so the frontend and API are **same-origin** (no CORS/cross-site requests), avoiding browser blocking and security issues from cross-origin access.
- Detailed steps (RDS Postgres, EC2, nginx, systemd, secrets, HTTPS/ALB) are in the project plan (`.cursor/plans/merchant_boarding_application_*.plan.md` or equivalent).
