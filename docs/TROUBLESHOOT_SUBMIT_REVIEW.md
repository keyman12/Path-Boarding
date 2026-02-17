# Troubleshooting: "Request failed" on Review & Submit

When submitting the final review step in production, the request can fail for several reasons. Follow these steps to diagnose and fix.

---

## Step 1: Check Backend Logs (Most Important)

SSH to your AWS server and check the backend error log:

```bash
ssh ec2-user@boarding.path2ai.tech

# Last 100 lines of backend errors
sudo journalctl -u path-boarding-backend -n 100 --no-pager

# Or the error log file
sudo tail -100 /var/log/boarding/backend-error.log
```

**Look for:**
- `Failed to generate agreement PDF` – PDF generation issue (permissions, reportlab, path-logo)
- `Permission denied` or `PermissionError` – uploads directory not writable
- `FileNotFoundError` – missing path-logo.png or wrong UPLOAD_DIR
- `Database` / `connection` errors – RDS connectivity
- `invite.used_at` or `Invalid or expired link` – invite already completed

---

## Step 2: Verify UPLOAD_DIR and Permissions

The backend must write PDFs to `UPLOAD_DIR/agreements/`. On AWS this should be `/opt/boarding/uploads`.

```bash
# Check backend.env has UPLOAD_DIR
grep UPLOAD_DIR /opt/boarding/backend.env
# Should show: UPLOAD_DIR=/opt/boarding/uploads

# Ensure directory exists and is writable
sudo mkdir -p /opt/boarding/uploads/agreements
sudo chown -R root:root /opt/boarding/uploads   # or ec2-user if backend runs as ec2-user
sudo chmod 755 /opt/boarding/uploads
sudo chmod 755 /opt/boarding/uploads/agreements

# Test write (backend runs as root per systemd)
sudo touch /opt/boarding/uploads/agreements/test-write && sudo rm /opt/boarding/uploads/agreements/test-write
echo "Write OK"
```

---

## Step 3: Verify path-logo.png Exists

The PDF generator looks for `backend/static/path-logo.png`:

```bash
ls -la /opt/boarding/repo/backend/static/
# Should show: path-logo.png, Services Agreement.pdf, README.md
```

If `path-logo.png` is missing, the PDF still generates but uses text fallback. If the path is wrong, it may fail.

---

## Step 4: Verify Services Agreement PDF

```bash
ls -la /opt/boarding/repo/backend/static/"Services Agreement.pdf"
# File must exist (with space in name)
```

---

## Step 5: Test the API Directly

From your Mac or from the server:

```bash
# Replace TOKEN with a valid invite token from the boarding URL
curl -X POST "https://boarding.path2ai.tech/boarding/submit-review?token=YOUR_TOKEN_HERE" \
  -H "Content-Type: application/json" \
  -d '{}'
```

- **200 + JSON** – Success; frontend issue (e.g. CORS, parsing)
- **500 + JSON** – Backend error; check `detail` in response and backend logs
- **502/504** – nginx or backend timeout; check if backend is running

---

## Step 6: Common Fixes

### Fix 1: Create uploads directory and set permissions

```bash
sudo mkdir -p /opt/boarding/uploads/agreements
sudo chown -R root:root /opt/boarding/uploads
sudo chmod -R 755 /opt/boarding/uploads
```

### Fix 2: Ensure UPLOAD_DIR in backend.env

```bash
sudo nano /opt/boarding/backend.env
# Add or update: UPLOAD_DIR=/opt/boarding/uploads
sudo systemctl restart path-boarding-backend
```

### Fix 3: Install/verify reportlab

```bash
/opt/boarding/venv/bin/pip list | grep -i reportlab
# Should show reportlab. If missing:
/opt/boarding/venv/bin/pip install reportlab
sudo systemctl restart path-boarding-backend
```

### Fix 4: Invite already used

If the invite was already submitted, you'll get "Invalid or expired link". Create a new invite from the admin panel and use that link.

---

## Step 7: Improved Error Messages (After Deploy)

The latest code improves error display. After pulling and rebuilding:

1. Rebuild frontend: `cd frontend && npm run build`
2. Restart: `sudo systemctl restart path-boarding-frontend`

When submit fails, the alert will now show:
- The HTTP status code (e.g. 500)
- The first 150 chars of the response (e.g. backend error detail)

This helps identify the cause without checking logs.

---

## Quick Checklist

- [ ] Backend logs checked (`journalctl` or `backend-error.log`)
- [ ] `UPLOAD_DIR=/opt/boarding/uploads` in backend.env
- [ ] `/opt/boarding/uploads/agreements` exists and is writable
- [ ] `path-logo.png` in `backend/static/`
- [ ] `Services Agreement.pdf` in `backend/static/`
- [ ] Backend service running: `sudo systemctl status path-boarding-backend`
- [ ] Health check OK: `curl -s https://boarding.path2ai.tech/health`
