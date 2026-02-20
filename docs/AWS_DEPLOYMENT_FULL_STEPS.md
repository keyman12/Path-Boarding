# AWS Deployment – Full Step-by-Step Guide

Complete deployment guide for Path Boarding on AWS, including DocuSign e-signature, TrueLayer bank verification, and Services Agreement. Use this for **initial deployment** or **major updates**.

**For routine updates after initial setup, see [UPDATE_WORKFLOW.md](UPDATE_WORKFLOW.md).**

---

## Quick Upload Reference (from your Mac)

| What | Command |
|------|---------|
| **Code** | `git pull` on server (no upload needed) |
| **Services Agreement** | `scp "/path/to/Services Agreement.pdf" ec2-user@boarding.path2ai.tech:/tmp/` |
| **DocuSign private key** | `scp /path/to/private.key ec2-user@boarding.path2ai.tech:/tmp/` → move to `/opt/boarding/keys/private.key` |
| **Secrets** | Edit `/opt/boarding/backend.env` on server (never commit) |

---

## 1. Files and Assets Checklist

### From Git (pulled via `git clone` / `git pull`)

| Path | Purpose |
|------|---------|
| `backend/` | FastAPI app, models, services |
| `frontend/` | Next.js app |
| `deploy/` | setup-ec2.sh, nginx config, systemd units |
| `backend/alembic/versions/` | Database migrations (including 018, 019, 020) |

### Manual Upload (not in Git)

| File | Destination on AWS | Purpose |
|------|--------------------|---------|
| **Services Agreement.pdf** | `/opt/boarding/repo/backend/static/Services Agreement.pdf` | DocuSign: second document in signing flow; must exist for both docs to be signed |
| **path-logo.png** | `/opt/boarding/repo/backend/static/path-logo.png` | Path logo in PDFs and emails (may already be in repo) |
| **private.key** (DocuSign) | `/opt/boarding/keys/private.key` | DocuSign JWT RSA private key; referenced by `DOCUSIGN_PRIVATE_KEY` in backend.env |

**Services Agreement:** Copy from your source (e.g. Path Design / Desktop). Filename must be exactly `Services Agreement.pdf` (with space). If missing, only the Path Agreement is signed.

**DocuSign private key:** Upload once; path is set in `backend.env` as `DOCUSIGN_PRIVATE_KEY=/opt/boarding/keys/private.key`.

### Supporting Packages (from requirements.txt)

Backend Python packages installed via `pip install -r requirements.txt`:

| Package | Purpose |
|---------|---------|
| `docusign-esign` | DocuSign e-signature API |
| `pypdf` | Merge Services Agreement with signature block page |
| `reportlab` | PDF generation |
| *(others)* | FastAPI, SQLAlchemy, etc. |

---

## 2. Environment Variables

Edit `/opt/boarding/backend.env` on the server. Key variables:

### Core (required)

```
DATABASE_URL="postgresql://USER:PASSWORD@RDS_ENDPOINT:5432/boarding"
SECRET_KEY="<long random string>"
FRONTEND_BASE_URL="https://boarding.path2ai.tech"
CORS_ORIGINS="[]"
UPLOAD_DIR="/opt/boarding/uploads"
```

### DocuSign (required for e-signature)

| Variable | Description | Example |
|----------|-------------|---------|
| `DOCUSIGN_INTEGRATION_KEY` | Integration Key from DocuSign Apps and Keys | `...` |
| `DOCUSIGN_USER_ID` | User ID (GUID) from DocuSign | `...` |
| `DOCUSIGN_ACCOUNT_ID` | Optional; from userinfo if not set | `...` |
| `DOCUSIGN_PRIVATE_KEY` | Path to `.key` file or full RSA key contents | `/opt/boarding/keys/private.key` |
| `DOCUSIGN_AUTH_SERVER` | Optional; Demo: `account-d.docusign.com`; Prod: `account.docusign.com` | `account-d.docusign.com` |
| `DOCUSIGN_BASE_PATH` | Optional; Demo: `https://demo.docusign.net`; Prod: `https://na.docusign.net` | `https://demo.docusign.net` |
| `DOCUSIGN_RETURN_URL_BASE` | Where DocuSign redirects after signing | `https://boarding.path2ai.tech` |

**DocuSign redirect URI:** Add `https://boarding.path2ai.tech/boarding/docusign-callback` in DocuSign Admin → Apps and Keys → Add URI.

### TrueLayer (required for UK bank verification)

| Variable | Description | Example |
|----------|-------------|---------|
| `TRUELAYER_CLIENT_ID` | Client ID from TrueLayer Console | `...` |
| `TRUELAYER_CLIENT_SECRET` | Client secret from TrueLayer Console | `...` |
| `TRUELAYER_REDIRECT_URI` | Callback URL – must match Console | `https://boarding.path2ai.tech/boarding/truelayer-callback` |
| `TRUELAYER_AUTH_URL` | Sandbox: `https://auth.truelayer-sandbox.com`; Live: `https://auth.truelayer.com` | `https://auth.truelayer-sandbox.com` |
| `TRUELAYER_API_URL` | Sandbox: `https://api.truelayer-sandbox.com`; Live: `https://api.truelayer.com` | `https://api.truelayer-sandbox.com` |

**TrueLayer redirect URI:** Add `https://boarding.path2ai.tech/boarding/truelayer-callback` in TrueLayer Console → Redirect URIs.

### Other (as needed)

| Variable | Purpose |
|----------|---------|
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`, `SMTP_FROM_*` | Email (verification links) |
| `SUMSUB_APP_TOKEN`, `SUMSUB_SECRET_KEY`, `SUMSUB_BASE_URL`, `SUMSUB_LEVEL_NAME` | SumSub identity verification |
| `ADDRESS_LOOKUP_UK_API_KEY` | UK address lookup (Ideal Postcodes) |

---

## 2a. Uploading Secrets and Private Keys

Secrets and private keys are **never committed to Git**. You must upload or configure them manually on the server.

### Option A: Paste into backend.env (simplest)

Edit `/opt/boarding/backend.env` on the server and paste values directly:

```bash
# On the server
sudo nano /opt/boarding/backend.env
```

**DocuSign private key** – paste the full RSA key including headers:

```
DOCUSIGN_PRIVATE_KEY="-----BEGIN RSA PRIVATE KEY-----
MIIEpAIBAAKCAQEA...
...
-----END RSA PRIVATE KEY-----"
```

Use quotes and ensure newlines are preserved. Alternatively, use `\n` for line breaks in a single line.

**Other secrets** – paste `TRUELAYER_CLIENT_SECRET`, `SUMSUB_SECRET_KEY`, `SMTP_PASSWORD`, etc. directly into the file.

**Secure the file:**

```bash
sudo chmod 600 /opt/boarding/backend.env
sudo chown ec2-user:ec2-user /opt/boarding/backend.env
```

### Option B: Upload private key file (DocuSign) – current setup

The production server uses `/opt/boarding/keys/private.key`. If the key is not yet on the server:

1. **From your Mac** (where `private.key` lives, e.g. from DocuSign Apps and Keys → Generate RSA):

```bash
scp /path/to/private.key ec2-user@boarding.path2ai.tech:/tmp/private.key
```

2. **On the server:**

```bash
# Create keys directory and move key (matches current AWS setup)
sudo mkdir -p /opt/boarding/keys
sudo mv /tmp/private.key /opt/boarding/keys/private.key

# Restrict permissions (only owner can read)
sudo chmod 600 /opt/boarding/keys/private.key
sudo chown ec2-user:ec2-user /opt/boarding/keys/private.key

rm -f /tmp/private.key
```

3. **In `/opt/boarding/backend.env`**, set:

```
DOCUSIGN_PRIVATE_KEY=/opt/boarding/keys/private.key
```

The backend reads the key from the file when it starts. If the key is already at this path, no upload is needed.

### Option C: AWS Secrets Manager (advanced)

For production, you can store secrets in AWS Secrets Manager and inject them at runtime:

1. Create a secret in AWS Secrets Manager (e.g. `boarding/production`).
2. Store key-value pairs: `DOCUSIGN_PRIVATE_KEY`, `TRUELAYER_CLIENT_SECRET`, etc.
3. Grant the EC2 instance role permission to read the secret.
4. Use a startup script or systemd `EnvironmentFile` that fetches secrets before launching the backend.

### Security checklist

- [ ] Never commit `backend.env`, `private.key`, or any file containing secrets
- [ ] Use `chmod 600` on env and key files
- [ ] Keep keys in `/opt/boarding/keys/` (outside repo)
- [ ] Rotate secrets if they may have been exposed

---

## 3. Deployment Steps (Full)

### 3.1 SSH to EC2

```bash
ssh ec2-user@boarding.path2ai.tech
# or: ssh ec2-user@18.168.63.16
```

### 3.2 Pull Latest Code

```bash
cd /opt/boarding/repo
sudo git pull origin main
```

### 3.3 Upload Files from Your Mac (manual assets + private keys)

Run these **from your Mac** in a separate terminal (replace paths with your actual file locations):

```bash
# 1. Services Agreement PDF (required for DocuSign dual-document signing)
scp "/path/to/Services Agreement.pdf" ec2-user@boarding.path2ai.tech:/tmp/

# 2. Path logo (if not already in repo)
scp /path/to/path-logo.png ec2-user@boarding.path2ai.tech:/tmp/

# 3. DocuSign private key (if using file instead of pasting into env)
#    Get this from DocuSign Apps and Keys → Generate RSA
scp /path/to/private.key ec2-user@boarding.path2ai.tech:/tmp/
```

**On the server** (after SSH):

```bash
# Services Agreement
sudo mkdir -p /opt/boarding/repo/backend/static
sudo mv "/tmp/Services Agreement.pdf" /opt/boarding/repo/backend/static/
sudo chown -R ec2-user:ec2-user /opt/boarding/repo/backend/static

# Path logo (if uploaded)
sudo mv /tmp/path-logo.png /opt/boarding/repo/backend/static/ 2>/dev/null || true

# DocuSign private key (if not already at /opt/boarding/keys/private.key)
sudo mkdir -p /opt/boarding/keys
sudo mv /tmp/private.key /opt/boarding/keys/private.key 2>/dev/null || true
sudo chmod 600 /opt/boarding/keys/private.key 2>/dev/null || true
sudo chown ec2-user:ec2-user /opt/boarding/keys/private.key 2>/dev/null || true
rm -f /tmp/private.key
```

### 3.4 Backend: Install Dependencies and Run Migrations

```bash
cd /opt/boarding/repo/backend

# Install/update Python packages (includes pypdf, docusign-esign)
sudo /opt/boarding/venv/bin/pip install -r requirements.txt

# Load env and run migrations (018_docusign, 019_signed_agreement)
set -a && source /opt/boarding/backend.env && set +a
/opt/boarding/venv/bin/alembic upgrade head
```

### 3.5 Frontend: Build

```bash
cd /opt/boarding/repo/frontend
echo "NEXT_PUBLIC_API_URL=https://boarding.path2ai.tech" > .env.production
sudo npm install
sudo npm run build
```

### 3.6 Restart Services

```bash
sudo systemctl restart path-boarding-backend
sudo systemctl restart path-boarding-frontend
```

### 3.7 Verify

```bash
# Service status
sudo systemctl status path-boarding-backend path-boarding-frontend

# Health check
curl -s https://boarding.path2ai.tech/health

# Test in browser: complete a boarding flow and submit for signing
```

---

## 4. Quick Update (After Initial Deployment)

For routine updates (code changes, no new env vars or files):

```bash
cd /opt/boarding/repo
sudo git pull origin main

# Backend
sudo /opt/boarding/venv/bin/pip install -r backend/requirements.txt
cd backend && set -a && source /opt/boarding/backend.env && set +a
/opt/boarding/venv/bin/alembic upgrade head
cd ..

# Frontend
cd frontend && sudo npm install && sudo npm run build && cd ..

# Restart
sudo systemctl restart path-boarding-backend path-boarding-frontend
```

---

## 5. Troubleshooting

### 502 Bad Gateway / Backend workers fail to boot

If `curl -s https://boarding.path2ai.tech/health` returns 502 and `systemctl status path-boarding-backend` shows `activating (auto-restart)`:

**1. Check application error log**

```bash
sudo cat /var/log/boarding/backend-error.log
```

**2. Common fixes**

- **TypeError "unsupported operand type(s) for |"** – Server runs Python 3.9; code used `str | None` (Python 3.10+). Pull latest code (uses `Optional[str]`) and restart.
- **ModuleNotFoundError: No module named 'reportlab'** – Run `sudo /opt/boarding/venv/bin/pip install -r /opt/boarding/repo/backend/requirements.txt` then restart.
- **column ... does not exist** – Run migrations: `cd /opt/boarding/repo/backend && set -a && source /opt/boarding/backend.env && set +a && /opt/boarding/venv/bin/alembic upgrade head`

**3. Restart backend**

```bash
sudo systemctl restart path-boarding-backend
```

### "No module named 'pypdf'"

```bash
sudo /opt/boarding/venv/bin/pip install pypdf
sudo systemctl restart path-boarding-backend
```

### Services Agreement not in signing flow

- Ensure `Services Agreement.pdf` exists at `/opt/boarding/repo/backend/static/Services Agreement.pdf`
- Filename must match exactly (including space)
- Restart backend after adding the file

### DocuSign "consent_required"

- Open the consent URL in a browser, log in as the impersonated user, click ACCEPT
- See `docs/DOCUSIGN_INTEGRATION_PLAN.md`

### Migration errors

```bash
cd /opt/boarding/repo/backend
set -a && source /opt/boarding/backend.env && set +a
/opt/boarding/venv/bin/alembic current
/opt/boarding/venv/bin/alembic history
```

### Admin / Partners not visible

If you cannot see the Admin account or partner accounts on production:

**1. Check backend is running and reachable**

```bash
# On server
sudo systemctl status path-boarding-backend
curl -s https://boarding.path2ai.tech/health
```

**2. Verify database and migrations**

```bash
cd /opt/boarding/repo/backend
set -a && source /opt/boarding/backend.env && set +a
/opt/boarding/venv/bin/alembic current   # Should show latest revision (e.g. 020)
```

**3. Check admin_users and partners tables exist and have data**

```bash
# Connect to RDS (use DATABASE_URL from backend.env)
psql "$DATABASE_URL" -c "SELECT id, username FROM admin_users;"
psql "$DATABASE_URL" -c "SELECT id, name, email FROM partners;"
```

If `admin_users` is empty, the startup seed should have created Admin. Restart the backend once; it seeds on startup when no admin exists. Default: `Admin` / `keywee50`.

**4. Frontend API URL (build-time)**

`NEXT_PUBLIC_API_URL` is baked in at build time. If the frontend was built with `http://localhost:8000`, API calls from the browser would fail (no backend on the user’s machine).

```bash
# On server – ensure .env.production before build
cd /opt/boarding/repo/frontend
cat .env.production   # Should have: NEXT_PUBLIC_API_URL=https://boarding.path2ai.tech
# If wrong or missing, fix and rebuild:
echo "NEXT_PUBLIC_API_URL=https://boarding.path2ai.tech" > .env.production
sudo npm run build
sudo systemctl restart path-boarding-frontend
```

**5. Local vs production data**

Admin and partners live in the database. Local Postgres and production RDS are separate. Partners created locally are not in production. You need to create partners on production (or migrate data) if you expect them there.

**6. Backend logs**

```bash
sudo journalctl -u path-boarding-backend -n 100 --no-pager
```

Look for DB connection errors, migration failures, or startup exceptions.

---

## 6. AWS backend.env Reference

The production `backend.env` lives at `/opt/boarding/backend.env`. Structure (use placeholders for secrets):

```
# Core
DATABASE_URL="postgresql://USER:PASSWORD@RDS_ENDPOINT:5432/boarding"
SECRET_KEY="<long random string>"
ACCESS_TOKEN_EXPIRE_MINUTES=60
CORS_ORIGINS="[]"
INVITE_TOKEN_EXPIRE_DAYS=3
FRONTEND_BASE_URL="https://boarding.path2ai.tech"
UPLOAD_DIR="/opt/boarding/uploads"

# Email (SMTP)
SMTP_HOST="..."
SMTP_PORT=587
SMTP_USER="..."
SMTP_PASSWORD="..."
SMTP_FROM_EMAIL="noreply@path2ai.tech"
SMTP_FROM_NAME="Path Boarding"

# UK address lookup (optional)
ADDRESS_LOOKUP_UK_API_KEY="..."

# SumSub
SUMSUB_APP_TOKEN="..."
SUMSUB_SECRET_KEY="..."
SUMSUB_BASE_URL="https://api.sumsub.com"
SUMSUB_LEVEL_NAME="Personal ID"

# DocuSign (key file at /opt/boarding/keys/private.key)
DOCUSIGN_INTEGRATION_KEY="..."
DOCUSIGN_USER_ID="..."
DOCUSIGN_PRIVATE_KEY=/opt/boarding/keys/private.key
DOCUSIGN_RETURN_URL_BASE=https://boarding.path2ai.tech

# TrueLayer
TRUELAYER_CLIENT_ID="..."
TRUELAYER_CLIENT_SECRET="..."
TRUELAYER_REDIRECT_URI=https://boarding.path2ai.tech/boarding/truelayer-callback
TRUELAYER_AUTH_URL=https://auth.truelayer-sandbox.com
TRUELAYER_API_URL=https://api.truelayer-sandbox.com
```

**Key file location:** DocuSign private key is at `/opt/boarding/keys/private.key` (uploaded separately; see Section 2a).

---

## 7. Reference

- **Full AWS setup:** [AWS_DEPLOYMENT.md](AWS_DEPLOYMENT.md)
- **Update workflow:** [UPDATE_WORKFLOW.md](UPDATE_WORKFLOW.md)
- **DocuSign setup:** [DOCUSIGN_INTEGRATION_PLAN.md](DOCUSIGN_INTEGRATION_PLAN.md)
