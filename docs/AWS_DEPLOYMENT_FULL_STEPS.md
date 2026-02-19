# AWS Deployment – Full Step-by-Step Guide

Complete deployment guide for Path Boarding on AWS, including DocuSign e-signature and Services Agreement. Use this for **initial deployment** or **major updates** (e.g. DocuSign + Services Agreement).

**For routine updates after initial setup, see [UPDATE_WORKFLOW.md](UPDATE_WORKFLOW.md).**

---

## 1. Files and Assets Checklist

### From Git (pulled via `git clone` / `git pull`)

| Path | Purpose |
|------|---------|
| `backend/` | FastAPI app, models, services |
| `frontend/` | Next.js app |
| `deploy/` | setup-ec2.sh, nginx config, systemd units |
| `backend/alembic/versions/` | Database migrations (including 018, 019) |

### Manual Upload (not in Git)

| File | Destination on AWS | Purpose |
|------|--------------------|---------|
| **Services Agreement.pdf** | `/opt/boarding/repo/backend/static/Services Agreement.pdf` | DocuSign: second document in signing flow; must exist for both docs to be signed |
| **path-logo.png** | `/opt/boarding/repo/backend/static/path-logo.png` | Path logo in PDFs and emails (may already be in repo) |

**Services Agreement:** Copy from your source (e.g. Path Design / Desktop). Filename must be exactly `Services Agreement.pdf` (with space). If missing, only the Path Agreement is signed.

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
| `DOCUSIGN_PRIVATE_KEY` | RSA private key contents or path to `.key` file | `-----BEGIN RSA PRIVATE KEY-----...` |
| `DOCUSIGN_AUTH_SERVER` | Demo: `account-d.docusign.com`; Prod: `account.docusign.com` | `account-d.docusign.com` |
| `DOCUSIGN_BASE_PATH` | Demo: `https://demo.docusign.net`; Prod: `https://na.docusign.net` or `https://eu.docusign.net` | `https://demo.docusign.net` |
| `DOCUSIGN_RETURN_URL_BASE` | Where DocuSign redirects after signing | `https://boarding.path2ai.tech` |

**DocuSign redirect URI:** Add `https://boarding.path2ai.tech/boarding/docusign-callback` in DocuSign Admin → Apps and Keys → Add URI.

### Other (as needed)

- SMTP vars for email
- SumSub vars for identity verification
- `ADDRESS_LOOKUP_UK_API_KEY` for UK address lookup

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

### 3.3 Upload Services Agreement PDF (if not already present)

```bash
# From your local machine (in a separate terminal):
scp "/path/to/Services Agreement.pdf" ec2-user@boarding.path2ai.tech:/tmp/

# On the server:
sudo mkdir -p /opt/boarding/repo/backend/static
sudo mv /tmp/Services\ Agreement.pdf /opt/boarding/repo/backend/static/
sudo chown -R ec2-user:ec2-user /opt/boarding/repo/backend/static
# Or match ownership of other repo files
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
echo "NEXT_PUBLIC_API_URL=" > .env.production
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

---

## 6. Reference

- **Full AWS setup:** [AWS_DEPLOYMENT.md](AWS_DEPLOYMENT.md)
- **Update workflow:** [UPDATE_WORKFLOW.md](UPDATE_WORKFLOW.md)
- **DocuSign setup:** [DOCUSIGN_INTEGRATION_PLAN.md](DOCUSIGN_INTEGRATION_PLAN.md)
