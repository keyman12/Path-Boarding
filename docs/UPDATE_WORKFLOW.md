# Update Workflow – Deploying Changes to AWS

This guide covers how to deploy updates to the production AWS environment after making changes locally.

---

## Quick Reference

### Standard Update (no database changes)
```bash
# On AWS server
cd /opt/boarding/repo
sudo git pull origin main
# If frontend changed:
cd frontend && npm run build && cd ..
# Restart services
sudo systemctl restart path-boarding-frontend path-boarding-backend
```

### Update with Database Migrations
```bash
# On AWS server
cd /opt/boarding/repo
sudo git pull origin main
# Run migrations
cd backend
set -a && source /opt/boarding/backend.env && set +a
/opt/boarding/venv/bin/alembic upgrade head
cd ..
# If frontend changed:
cd frontend && npm run build && cd ..
# Restart services
sudo systemctl restart path-boarding-backend path-boarding-frontend
```

---

## Detailed Workflow

### 1. Local Development

**Make your changes locally:**
```bash
# Frontend changes
cd frontend
# ... edit files ...
npm run dev  # test locally at http://localhost:3000

# Backend changes
cd backend
# ... edit files ...
# Test locally (if running local postgres)
```

**Test thoroughly locally** before deploying to production.

---

### 2. Commit and Push to GitHub

```bash
cd /Users/davidkey/Documents/Path/Boarding\ Build
git add .
git commit -m "Descriptive commit message"
git push origin main
```

---

### 3. Deploy to AWS

SSH into your AWS server:
```bash
ssh ec2-user@boarding.path2ai.tech
# or: ssh ec2-user@18.168.63.16
```

#### 3a. Pull Latest Changes

```bash
cd /opt/boarding/repo
sudo git pull origin main
```

#### 3b. Handle Different Types of Changes

**Frontend changes only:**
```bash
cd /opt/boarding/repo/frontend
npm install  # if package.json changed
npm run build
sudo systemctl restart path-boarding-frontend
```

**Backend changes only (no migrations):**
```bash
cd /opt/boarding/repo/backend
# If requirements.txt changed:
sudo /opt/boarding/venv/bin/pip install -r requirements.txt
sudo systemctl restart path-boarding-backend
```

**Backend with database migrations:**
```bash
cd /opt/boarding/repo/backend
# If requirements.txt changed:
sudo /opt/boarding/venv/bin/pip install -r requirements.txt
# Run migrations
set -a && source /opt/boarding/backend.env && set +a
/opt/boarding/venv/bin/alembic upgrade head
# Restart backend
sudo systemctl restart path-boarding-backend
```

**Environment variable changes:**
```bash
sudo nano /opt/boarding/backend.env  # or frontend .env.production
# Make your changes, save
sudo systemctl restart path-boarding-backend  # or frontend
```

**Nginx configuration changes:**
```bash
sudo cp /opt/boarding/repo/deploy/nginx-boarding.path2ai.tech.conf /etc/nginx/conf.d/boarding.path2ai.tech.conf
sudo nginx -t  # test config
sudo systemctl reload nginx  # apply without downtime
```

**systemd service changes:**
```bash
sudo cp /opt/boarding/repo/deploy/systemd/path-boarding-backend.service /etc/systemd/system/
sudo cp /opt/boarding/repo/deploy/systemd/path-boarding-frontend.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl restart path-boarding-backend path-boarding-frontend
```

---

### 4. Verify Deployment

After deploying changes, always verify:

```bash
# Check service status
sudo systemctl status path-boarding-backend path-boarding-frontend

# Check logs for errors
sudo journalctl -u path-boarding-backend -n 50 --no-pager
sudo journalctl -u path-boarding-frontend -n 50 --no-pager

# Test health endpoint
curl https://boarding.path2ai.tech/health

# Test in browser
# Open https://boarding.path2ai.tech and test your changes
```

---

## Best Practices

### 1. Use Feature Branches for Major Changes

For significant features or risky changes:
```bash
# Create feature branch locally
git checkout -b feature/new-verification-flow
# ... make changes, commit ...
git push origin feature/new-verification-flow

# After testing, merge to main
git checkout main
git merge feature/new-verification-flow
git push origin main
# Then deploy to AWS
```

### 2. Backup Before Major Updates

Before deploying major changes (especially with migrations):
```bash
# Backup database (from AWS server)
pg_dump -h boarding-db.cvkkcu0qiu9w.eu-west-2.rds.amazonaws.com \
  -U boarding -d boarding > /tmp/boarding_backup_$(date +%Y%m%d_%H%M%S).sql

# Or use RDS automated backups/snapshots from AWS console
```

### 3. Test Migrations on a Copy First

For complex migrations:
1. Create a copy of your RDS database (snapshot → restore)
2. Test migrations on the copy
3. Once verified, run on production

### 4. Zero-Downtime Deployments

For changes that need zero downtime:
```bash
# Start new backend process on different port (e.g., 8001)
# Update nginx to point to new port
# Stop old backend process

# Or use blue-green deployment with multiple instances
```

### 5. Rollback Plan

If something goes wrong:

**Rollback code:**
```bash
cd /opt/boarding/repo
sudo git log --oneline  # find previous commit hash
sudo git checkout <previous-commit-hash>
# Rebuild and restart as needed
```

**Rollback migrations:**
```bash
cd /opt/boarding/repo/backend
set -a && source /opt/boarding/backend.env && set +a
/opt/boarding/venv/bin/alembic downgrade -1  # go back one migration
# Or: alembic downgrade <revision>
```

---

## Common Update Scenarios

### Adding a New Frontend Page

```bash
# Local: create page, test, commit, push
# AWS:
cd /opt/boarding/repo
sudo git pull origin main
cd frontend
npm run build
sudo systemctl restart path-boarding-frontend
```

### Adding a New API Endpoint

```bash
# Local: add route, test, commit, push
# AWS:
cd /opt/boarding/repo
sudo git pull origin main
sudo systemctl restart path-boarding-backend
# Test: curl or check /docs
```

### Adding a New Database Column

```bash
# Local:
# 1. Update model in backend/app/models/
# 2. Create migration: alembic revision --autogenerate -m "Add column"
# 3. Test migration locally
# 4. Commit and push

# AWS:
cd /opt/boarding/repo
sudo git pull origin main
cd backend
set -a && source /opt/boarding/backend.env && set +a
/opt/boarding/venv/bin/alembic upgrade head
sudo systemctl restart path-boarding-backend
```

### Updating npm/pip Dependencies

```bash
# Local: update package.json or requirements.txt, test, commit, push

# AWS (npm):
cd /opt/boarding/repo
sudo git pull origin main
cd frontend
npm install
npm run build
sudo systemctl restart path-boarding-frontend

# AWS (pip):
cd /opt/boarding/repo
sudo git pull origin main
sudo /opt/boarding/venv/bin/pip install -r backend/requirements.txt
sudo systemctl restart path-boarding-backend
```

---

## Automation (Optional)

For frequent updates, consider:

### Simple Deploy Script

Create `/opt/boarding/deploy.sh`:
```bash
#!/bin/bash
set -e

echo "Pulling latest changes..."
cd /opt/boarding/repo
sudo git pull origin main

echo "Building frontend..."
cd frontend
npm install
npm run build
cd ..

echo "Updating backend dependencies..."
sudo /opt/boarding/venv/bin/pip install -r backend/requirements.txt

echo "Running migrations..."
cd backend
set -a && source /opt/boarding/backend.env && set +a
/opt/boarding/venv/bin/alembic upgrade head
cd ..

echo "Restarting services..."
sudo systemctl restart path-boarding-backend path-boarding-frontend

echo "Checking status..."
sleep 3
sudo systemctl status path-boarding-backend path-boarding-frontend

echo "Deployment complete!"
```

Make it executable:
```bash
chmod +x /opt/boarding/deploy.sh
```

Then deploy with:
```bash
sudo /opt/boarding/deploy.sh
```

### GitHub Actions (Advanced)

For CI/CD, add `.github/workflows/deploy.yml` to auto-deploy on push to main:
- Run tests
- SSH to AWS server
- Run deployment script
- Notify on success/failure

---

## Monitoring After Deployment

After any deployment:

1. **Check logs for 5-10 minutes:**
   ```bash
   sudo journalctl -u path-boarding-backend -f
   ```

2. **Monitor health endpoint:**
   ```bash
   watch -n 5 'curl -s https://boarding.path2ai.tech/health'
   ```

3. **Test critical paths:**
   - Admin login
   - Create partner
   - Send invite
   - Complete boarding flow

4. **Check nginx access logs:**
   ```bash
   sudo tail -f /var/log/nginx/access.log
   ```

---

## Quick Troubleshooting

**Service won't start after update:**
```bash
# Check logs
sudo journalctl -u path-boarding-backend -n 100
# Common issues: syntax errors, missing dependencies, config errors
```

**Frontend shows old content:**
```bash
# Clear browser cache
# Or: hard reload (Cmd+Shift+R on Mac, Ctrl+Shift+R on Windows)
# Verify build: ls -la /opt/boarding/repo/frontend/.next
```

**Database migration fails:**
```bash
# Check current revision
cd /opt/boarding/repo/backend
set -a && source /opt/boarding/backend.env && set +a
/opt/boarding/venv/bin/alembic current
# Check migration history
/opt/boarding/venv/bin/alembic history
# If stuck, may need to manually fix or stamp
```

---

## Summary

**Standard workflow:**
1. Develop and test locally
2. Commit and push to GitHub
3. SSH to AWS server
4. Pull changes
5. Rebuild (frontend) / Install deps (backend) / Run migrations (if needed)
6. Restart services
7. Verify deployment

**Remember:**
- Always test locally first
- Check logs after deployment
- Have a rollback plan
- Backup before major changes
- Document any manual steps needed
