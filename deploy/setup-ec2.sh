#!/usr/bin/env bash
# Base EC2 setup for Path Boarding on Amazon Linux 2023.
# Run as root (e.g. sudo bash setup-ec2.sh).
# Creates /opt/boarding, installs Node, Python, nginx, certbot.

set -e

echo "==> Updating system (Amazon Linux 2023)"
dnf update -y

echo "==> Installing Node.js 20"
dnf install -y nodejs

echo "==> Installing Python 3.11+ and pip"
dnf install -y python3.11 python3.11-pip

echo "==> Installing nginx"
dnf install -y nginx

echo "==> Installing Certbot for nginx (Let's Encrypt)"
dnf install -y certbot python3-certbot-nginx

echo "==> Installing cronie (for certbot auto-renewal via cron)"
dnf install -y cronie

echo "==> Stopping and disabling httpd (Apache) if present (port 80/443 conflict)"
systemctl stop httpd 2>/dev/null || true
systemctl disable httpd 2>/dev/null || true

echo "==> Creating app directories"
mkdir -p /opt/boarding
mkdir -p /opt/boarding/uploads
mkdir -p /var/log/boarding

echo "==> Enabling nginx (start on boot)"
systemctl enable nginx

echo "==> Enabling crond (start on boot)"
systemctl enable crond
systemctl start crond

echo "==> Setup complete. Next steps:"
echo "  1. Clone repo to /opt/boarding/repo"
echo "  2. Create /opt/boarding/backend.env from backend/.env.example"
echo "  3. Configure nginx (see deploy/nginx-boarding.path2ai.tech.conf), then: certbot --nginx -d boarding.path2ai.tech"
echo "  4. Run migrations: deploy/run-migrations.sh"
echo "  5. Build frontend (NEXT_PUBLIC_API_URL= empty), install systemd units, start services"
