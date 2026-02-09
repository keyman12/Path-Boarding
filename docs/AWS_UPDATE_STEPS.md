# AWS Update Quick Reference

This is the exact process that works for your AWS deployment at `boarding.path2ai.tech`.

## Prerequisites
- Changes committed and pushed to GitHub from your local machine
- SSH access to AWS EC2 instance

## Update Steps

### 1. Pull Latest Code
```bash
cd /opt/boarding/repo
sudo git pull origin main
```

### 2. Backend Updates
```bash
# Activate venv (located at /opt/boarding/venv, NOT in repo)
source /opt/boarding/venv/bin/activate

# Install any new dependencies
pip install -r backend/requirements.txt

# Load environment variables and run migrations
cd backend
export $(grep -v '^#' /opt/boarding/backend.env | xargs)
alembic upgrade head

# Deactivate venv
deactivate
```

### 3. Frontend Updates
```bash
cd /opt/boarding/repo/frontend
sudo npm install
sudo npm run build
```

### 4. Restart Services
```bash
# Service names are path-boarding-* (not boarding-*)
sudo systemctl restart path-boarding-backend
sudo systemctl restart path-boarding-frontend
```

### 5. Verify Deployment
```bash
# Check service status
sudo systemctl status path-boarding-backend
sudo systemctl status path-boarding-frontend

# Check logs if needed
sudo tail -f /var/log/boarding/backend-error.log
sudo tail -f /var/log/boarding/frontend-error.log
```

### 6. Test in Browser
1. Visit `https://boarding.path2ai.tech/boarding-api`
2. Test the boarding flow
3. Test login at `https://boarding.path2ai.tech/board`
4. Verify all new features work as expected

## Key Details About Your Setup
- **Venv location**: `/opt/boarding/venv` (shared, not in repo)
- **Backend service**: `path-boarding-backend.service`
- **Frontend service**: `path-boarding-frontend.service`
- **Environment file**: `/opt/boarding/backend.env`
- **Repo location**: `/opt/boarding/repo`

## Troubleshooting

### If migrations fail with "connection refused"
Make sure you exported the environment variables:
```bash
export $(grep -v '^#' /opt/boarding/backend.env | xargs)
```

### If npm commands fail with permission errors
Use `sudo` for npm commands in the frontend directory

### If services don't restart
Check logs:
```bash
sudo journalctl -u path-boarding-backend -n 50
sudo journalctl -u path-boarding-frontend -n 50
```
