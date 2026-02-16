# Deploy Update – January 2026 (Merchant Portal, Partner Support, PDF Fixes)

Step-by-step guide to save, push to GitHub, and promote this release to AWS. This update includes:

- **New database columns:** `partners.merchant_support_email`, `partners.merchant_support_phone`
- **New migration:** `017_partner_merchant_support`
- **New static file:** `Services Agreement.pdf` (must be uploaded to server manually)
- **Frontend & backend changes:** Portal copy, partner support fields, company data in PDF, email fixes

---

## Part 1: Save and Push to GitHub (Local)

### Step 1.1 – Add Services Agreement PDF to .gitignore

The PDF is a legal document and should not be committed. Add to `.gitignore`:

```
# Services Agreement (copy manually to server)
backend/static/*.pdf
```

### Step 1.2 – Stage and Commit

```bash
cd /Users/davidkey/Documents/Path/Boarding\ Build

# Stage all changes (PDF will be ignored)
git add .
git status   # Verify: backend/static/Services Agreement.pdf should NOT appear

# Commit with descriptive message
git commit -m "Merchant portal updates: partner support fields, company data in PDF, Services Agreement attachment, email fixes"
```

### Step 1.3 – Push to GitHub

```bash
git push origin main
```

---

## Part 2: Deploy to AWS

SSH into your EC2 instance:

```bash
ssh ec2-user@boarding.path2ai.tech
# or: ssh ec2-user@18.168.63.16
```

### Step 2.1 – Pull Latest Code

```bash
cd /opt/boarding/repo
sudo git pull origin main
```

### Step 2.2 – Upload Services Agreement PDF

The PDF must be present at `backend/static/Services Agreement.pdf` for:
- Completion email attachment
- Portal download link

**Option A – SCP from your Mac:**

```bash
# Run from your Mac (not on the server)
scp "/path/to/Services Agreement.pdf" ec2-user@boarding.path2ai.tech:/tmp/
```

Then on the server:

```bash
sudo mkdir -p /opt/boarding/repo/backend/static
sudo mv /tmp/Services\ Agreement.pdf /opt/boarding/repo/backend/static/
sudo chown -R ec2-user:ec2-user /opt/boarding/repo/backend/static
```

**Option B – If the file is already on the server:**

```bash
sudo mkdir -p /opt/boarding/repo/backend/static
# Copy or move your PDF to /opt/boarding/repo/backend/static/Services Agreement.pdf
```

**Verify the file exists:**

```bash
ls -la /opt/boarding/repo/backend/static/
# Should show: Services Agreement.pdf
```

### Step 2.3 – Run Database Migrations

This adds `merchant_support_email` and `merchant_support_phone` to the `partners` table:

```bash
cd /opt/boarding/repo/backend
set -a && source /opt/boarding/backend.env && set +a
/opt/boarding/venv/bin/alembic upgrade head
```

Expected output: `INFO  [alembic.runtime.migration] Running upgrade 016_company_fields -> 017_partner_merchant_support, Add merchant support email and phone to partners`

**If you see "Target database is not up to date":** Run `alembic upgrade head` again. If migrations 015 or 016 are missing, they will run first.

### Step 2.4 – Update Backend Dependencies (if requirements changed)

```bash
cd /opt/boarding/repo/backend
sudo /opt/boarding/venv/bin/pip install -r requirements.txt
```

### Step 2.5 – Rebuild Frontend

```bash
cd /opt/boarding/repo/frontend
sudo npm ci
sudo npm run build
```

### Step 2.6 – Restart Services

```bash
sudo systemctl restart path-boarding-backend path-boarding-frontend
```

### Step 2.7 – Verify Deployment

```bash
# Check services are running
sudo systemctl status path-boarding-backend path-boarding-frontend

# Health check
curl -s https://boarding.path2ai.tech/health

# Check logs for errors
sudo journalctl -u path-boarding-backend -n 30 --no-pager
```

**Manual checks:**
1. Log in to admin: https://boarding.path2ai.tech/admin
2. Edit an existing partner – confirm "Merchant Support Email Address" and "Merchant Support Telephone Number" fields appear
3. Create a new partner – both fields should be required
4. Complete a boarding flow – verify the generated PDF includes company details
5. Check completion email – should include both Merchant Agreement PDF and Services Agreement PDF attachments

---

## Part 3: Post-Deploy – Existing Partners

Existing partners will have `merchant_support_email` and `merchant_support_phone` as `NULL`. To show support info in the portal:

1. Go to Admin → Update Partner Details
2. Select each partner
3. Fill in Merchant Support Email Address and Merchant Support Telephone Number
4. Click Update partner

---

## Rollback (if needed)

**Code rollback:**
```bash
cd /opt/boarding/repo
sudo git log --oneline   # find previous commit
sudo git checkout <previous-commit-hash>
# Rebuild frontend, restart services
```

**Database rollback (revert migration 017):**
```bash
cd /opt/boarding/repo/backend
set -a && source /opt/boarding/backend.env && set +a
/opt/boarding/venv/bin/alembic downgrade -1
sudo systemctl restart path-boarding-backend
```

---

## Summary Checklist

- [ ] Add `backend/static/*.pdf` to .gitignore
- [ ] `git add .` and `git commit`
- [ ] `git push origin main`
- [ ] SSH to AWS server
- [ ] `git pull origin main`
- [ ] Upload `Services Agreement.pdf` to `backend/static/`
- [ ] Run `alembic upgrade head`
- [ ] Rebuild frontend (`npm run build`)
- [ ] Restart backend and frontend services
- [ ] Verify health, admin, and boarding flow
- [ ] Update existing partners with support email/phone
