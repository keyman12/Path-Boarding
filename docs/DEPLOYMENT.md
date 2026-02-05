# Deployment (AWS)

Notes for deploying the Path Merchant Boarding app to AWS (EC2, RDS, etc.). **Right now everything runs locally on your Mac;** this doc describes how to configure for **AWS when you deploy**.

Detailed steps (RDS Postgres, EC2, nginx, systemd, secrets, HTTPS/ALB) may live in a project plan or runbook; this doc captures **architecture decisions** and **env/config for local vs AWS**.

---

## Local (Mac) development

- **Backend:** Use `backend/.env` with defaults from `backend/.env.example` (e.g. `DATABASE_URL` to local Postgres, `FRONTEND_BASE_URL=http://localhost:3000`, `CORS_ORIGINS` with localhost).
- **Frontend:** Use `NEXT_PUBLIC_API_URL=http://localhost:8000` in `.env.local` (see `frontend/.env.example`).
- No CORS or cross-origin concerns; both run on localhost.

---

## AWS deployment (when complete)

Deploy so the frontend and backend are **same-origin** (no cross-origin requests). Then CORS is not required and browser cross-site restrictions do not apply.

### Same-origin deployment (no cross-site requests)

**When deploying to AWS, serve the frontend and backend from the same origin so that cross-origin (CORS) requests are not required.**

- **Why:** Browsers restrict cross-origin requests by default to limit malicious redirection, data exfiltration, and other risks. Relying on CORS means trusting the backend to allow your frontend’s origin; if misconfigured, users can see “Could not reach the server” (e.g. on the email verification link) or requests may be blocked.
- **How:** Use a single domain (or single host) and expose the API as a path behind the same host, e.g.:
  - Frontend: `https://your-domain.com`
  - API: `https://your-domain.com/api` (or `/boarding`, etc.) via reverse proxy (nginx, ALB path routing, or Next.js rewrites).
- **Result:** The browser sees one origin; no CORS configuration is needed and cross-site scripting/request concerns are avoided for this app.

### Env/config on AWS

- **Backend:** Set `DATABASE_URL` to RDS; set `FRONTEND_BASE_URL` to your public URL (e.g. `https://path2ai.tech`). You do **not** need to add that URL to `CORS_ORIGINS` if you deploy same-origin.
- **Frontend:** Build with `NEXT_PUBLIC_API_URL` empty (or the same host path) so API requests are same-origin; e.g. proxy `/boarding`, `/auth`, `/health` to the backend on the same host.

If you must use different origins (e.g. `app.example.com` and `api.example.com`), set the backend `CORS_ORIGINS` to include the frontend origin (see [EMAIL_VERIFICATION_SETUP.md](EMAIL_VERIFICATION_SETUP.md) and backend `.env.example`).
