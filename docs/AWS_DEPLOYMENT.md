# AWS deployment guide – Path Boarding (boarding.path2ai.tech)

This guide deploys the Path Merchant Boarding app on a single EC2 instance (Amazon Linux) with RDS PostgreSQL in the same VPC, nginx reverse proxy, HTTPS via Certbot, and systemd for the backend and frontend. Everything is same-origin (one domain, no cross-site requests). Reproducible from GitHub.

**Target:** Elastic IP `18.168.63.16`, domain `boarding.path2ai.tech`, HTTPS only, no public DB access.

**GitHub repo:** [keyman12/Path-Boarding](https://github.com/keyman12/Path-Boarding)

---

## 1. Architecture overview

- **EC2:** Amazon Linux 2023, same VPC as RDS. Hosts:
  - **Backend:** FastAPI (gunicorn + uvicorn) on `127.0.0.1:8000`
  - **Frontend:** Next.js on `127.0.0.1:3000`
  - **nginx:** Reverse proxy; TLS termination; routes `/health`, `/auth`, `/partners`, `/boarding`, `/admin`, `/uploads` to backend, everything else to frontend
  - **Future:** The same server will also run [Path-MCP-Server](https://github.com/keyman12/Path-MCP-Server) (MCP service). It will use a different port (e.g. 3020 or as per that repo’s docs), its own systemd unit, and optionally a separate nginx server block (e.g. `mcp.path2ai.tech`) or path. This guide does not configure MCP; it leaves port and directory layout ready so you can add it later without conflicting with 8000/3000.
- **RDS:** PostgreSQL in the **same VPC**, no public access. Security group allows inbound 5432 only from the EC2 security group.
- **DNS:** `boarding.path2ai.tech` → Elastic IP `18.168.63.16`. (A second domain for MCP, e.g. `mcp.path2ai.tech` → same IP, can be added when you deploy the MCP service.)
- **Secrets:** Backend `.env` and frontend env (e.g. `.env.production`) on the server only; never committed. RDS credentials in backend `.env`.

Same-origin: browser talks only to `https://boarding.path2ai.tech`; nginx proxies API paths to the backend. Frontend is built with `NEXT_PUBLIC_API_URL` empty so API calls use relative URLs.

---

## 2. Prerequisites

- AWS account; VPC where you will create (or already have) EC2 and RDS.
- Domain `boarding.path2ai.tech` pointing to `18.168.63.16` (A record) **before** running Certbot.
- EC2 instance launched with Amazon Linux 2023, in that VPC, with Elastic IP `18.168.63.16` attached.
- Security group for EC2: allow inbound 22 (SSH), 80 (HTTP for cert issuance), 443 (HTTPS); outbound all (or at least 80/443 for Certbot and npm/pip).
- This repo pushed to GitHub (or your Git host) so the server can clone it.

---

## 3. EC2 base setup (OS, Node, Python, nginx, Certbot)

SSH to the instance, then run the setup script (or follow the steps it encodes).

```bash
sudo -i
# Optional: create app user instead of root for app processes
# useradd -m -s /bin/bash app
# su - app  # then use /home/app and run backend/frontend as app

# From repo (after clone) or copy deploy/setup-ec2.sh to the server and run:
bash /path/to/deploy/setup-ec2.sh
```

The script (see `deploy/setup-ec2.sh`) will:

- Update the system (`dnf update -y`).
- Install Node.js 20 (or 18 LTS), Python 3.11+, nginx, certbot and python3-certbot-nginx.
- Create app directories, e.g. `/opt/boarding`, `/var/log/boarding`.
- Ensure nginx and certbot are enabled.

Do **not** configure nginx for the app yet; that comes after Certbot so we can use the correct server name and SSL.

---

## 4. RDS PostgreSQL (same VPC, no public access)

Create RDS in the **same VPC** as the EC2 instance.

1. **RDS → Create database**
   - Engine: PostgreSQL 15 (or 16).
   - Template: Dev/Test or Production as you prefer.
   - DB instance identifier: e.g. `boarding-db`.
   - Master username and password: set and **store securely** (you will put them in backend `.env`).

2. **Connectivity**
   - VPC: **same as EC2**.
   - Subnet: private preferred; no need for public.
   - **Do not** enable “Publicly accessible”.
   - VPC security group: create or select one that allows **inbound 5432** from the **EC2 instance’s security group** only (no 0.0.0.0/0).

3. **Additional**
   - Initial database name: e.g. `boarding` (or match `DATABASE_URL`).
   - Backup and maintenance window as needed.

4. **After creation**
   - Note the **Endpoint** (hostname). Port is 5432.
   - `DATABASE_URL` will be:  
     `postgresql://USER:PASSWORD@ENDPOINT:5432/boarding`  
     (replace USER, PASSWORD, ENDPOINT). No public access means the endpoint is only reachable from within the VPC (e.g. from EC2).

You can create RDS **before** or **after** installing the app; run migrations (Alembic) **after** the app is installed and `.env` is set (see below).

---

## 5. nginx and HTTPS (Certbot)

Domain must already point to the Elastic IP.

1. **Copy nginx app config** (from repo `deploy/nginx-boarding.path2ai.tech.conf`) to nginx:

   ```bash
   sudo cp /opt/boarding/repo/deploy/nginx-boarding.path2ai.tech.conf /etc/nginx/conf.d/boarding.path2ai.tech.conf
   ```

2. **Initial HTTP-only config for Certbot**  
   In the server block, use only `listen 80` and `server_name boarding.path2ai.tech`; comment out or omit `listen 443` until Certbot has run. Or use the provided “stage 1” snippet that only has port 80 and a simple `location /` returning 200 so Certbot can complete.

3. **Obtain certificate**

   ```bash
   sudo certbot --nginx -d boarding.path2ai.tech
   ```

   Certbot will add the SSL server block and redirect HTTP→HTTPS. If you use the full `deploy/nginx-boarding.path2ai.tech.conf` **after** Certbot (which already adds SSL), merge any app-specific `location` blocks (API proxy, frontend proxy) into the Certbot-generated server block so one server block has both SSL and your proxies.

4. **Final nginx config**  
   Ensure:
   - `listen 443 ssl` and `listen [::]:443 ssl`.
   - `ssl_certificate` and `ssl_certificate_key` (Certbot sets these).
   - API paths proxied to `http://127.0.0.1:8000`, e.g.:
     - `location /health`, `location /auth`, `location /partners`, `location /boarding`, `location /admin`, `location /uploads`
   - `location /` proxied to `http://127.0.0.1:3000` (Next.js).

   Reload nginx:

   ```bash
   sudo nginx -t && sudo systemctl reload nginx
   ```

5. **Auto-renewal**

   ```bash
   sudo systemctl enable certbot.timer
   sudo systemctl start certbot.timer
   ```

---

## 6. Deploy application (clone, env, build, migrations)

All steps on the EC2 instance. Paths assume app at `/opt/boarding/repo`; adjust if you use `/home/app` or another path.

6.1 **Clone repo**

```bash
sudo mkdir -p /opt/boarding
sudo git clone https://github.com/keyman12/Path-Boarding.git /opt/boarding/repo
# Or: git clone git@github.com:keyman12/Path-Boarding.git /opt/boarding/repo
cd /opt/boarding/repo
```

6.2 **Backend environment**

```bash
sudo cp backend/.env.example /opt/boarding/backend.env
sudo chmod 600 /opt/boarding/backend.env
sudo nano /opt/boarding/backend.env
```

Set at least:

- `DATABASE_URL=postgresql://USER:PASSWORD@RDS_ENDPOINT:5432/boarding`
- `SECRET_KEY=<long random string>`
- `FRONTEND_BASE_URL=https://boarding.path2ai.tech`
- `CORS_ORIGINS=` (empty for same-origin) or leave as-is if you keep defaults and nginx is same-origin
- SMTP vars if you send email (`SMTP_HOST`, `SMTP_USER`, `SMTP_PASSWORD`, etc.)
- `ADDRESS_LOOKUP_UK_API_KEY` if you use UK address lookup
- `UPLOAD_DIR=/opt/boarding/uploads` (and create the dir: `sudo mkdir -p /opt/boarding/uploads`)

Do not commit this file.

6.3 **Backend venv and run migrations**

```bash
cd /opt/boarding/repo/backend
sudo python3 -m venv /opt/boarding/venv
sudo /opt/boarding/venv/bin/pip install -r requirements.txt
# Load env and run migrations (RDS must be reachable)
set -a && source /opt/boarding/backend.env && set +a
/opt/boarding/venv/bin/alembic upgrade head
```

Or use the script: `deploy/run-migrations.sh` (it should source `/opt/boarding/backend.env` and run alembic).

6.4 **Frontend build (same-origin)**

```bash
cd /opt/boarding/repo/frontend
# Empty API URL so browser sends requests to same host (nginx proxies to backend)
echo "NEXT_PUBLIC_API_URL=" > .env.production
sudo npm ci
sudo npm run build
```

6.5 **Ownership (if using app user)**

If you created an `app` user, set ownership so the app can read repo and write logs/uploads:

```bash
sudo chown -R app:app /opt/boarding/repo /opt/boarding/uploads /var/log/boarding
# Keep backend.env readable only by app (or root if services run as root)
sudo chown app:app /opt/boarding/backend.env && sudo chmod 600 /opt/boarding/backend.env
```

---

## 7. systemd services (start on boot)

Copy the unit files from the repo and enable/start.

```bash
sudo cp /opt/boarding/repo/deploy/systemd/path-boarding-backend.service /etc/systemd/system/
sudo cp /opt/boarding/repo/deploy/systemd/path-boarding-frontend.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable path-boarding-backend path-boarding-frontend
sudo systemctl start path-boarding-backend path-boarding-frontend
sudo systemctl status path-boarding-backend path-boarding-frontend
```

Backend runs gunicorn with uvicorn workers bound to `127.0.0.1:8000`; frontend runs `next start` (port 3000). Both use WorkingDirectory and EnvironmentFile as in the unit files. Adjust paths in the units if you use `/home/app` instead of `/opt/boarding`.

---

## 8. Monitoring and health checks

- **Backend:** `GET https://boarding.path2ai.tech/health` returns `{"status":"ok","database":"connected"|"disconnected"}`. Use this for uptime checks.
- **Frontend:** Load `https://boarding.path2ai.tech`; 200 means nginx and Next.js are up.

Optional:

- **Cron:** Every 5 minutes, `curl -sSf https://boarding.path2ai.tech/health >/dev/null || echo "Backend unhealthy"` and log or alert.
- **CloudWatch:** Install CloudWatch agent and send logs from `/var/log/boarding` and nginx access/error logs; optionally create a dashboard and alarm on health endpoint.
- **Logrotate:** Rotate `/var/log/boarding/*.log` and nginx logs (often already configured for nginx).

---

## 9. Checklist and order of operations

1. VPC and EC2 (Amazon Linux 2023, Elastic IP 18.168.63.16 attached).
2. DNS: `boarding.path2ai.tech` → 18.168.63.16.
3. EC2 security group: 22, 80, 443 inbound; outbound as needed.
4. Run `deploy/setup-ec2.sh` (or equivalent) for OS, Node, Python, nginx, Certbot.
5. RDS PostgreSQL in same VPC, no public access; security group allows 5432 from EC2 only.
6. nginx: install app config, then `certbot --nginx -d boarding.path2ai.tech`, then ensure API + frontend proxy and reload nginx.
7. Clone repo to `/opt/boarding/repo`, create `/opt/boarding/backend.env` and `/opt/boarding/uploads`, run migrations.
8. Build frontend with `NEXT_PUBLIC_API_URL=` empty.
9. Install and start systemd units; verify `systemctl status` and `https://boarding.path2ai.tech/health`.

After this, the site is reproducible from GitHub: clone, set env, run migrations, build frontend, start services. You can add the identity provider integration on this build once stable.

---

## 10. Future: adding Path-MCP-Server on the same EC2

When you add [Path-MCP-Server](https://github.com/keyman12/Path-MCP-Server) to this server:

- **Port:** Use a port other than 8000 and 3000 (e.g. 3020 or whatever the MCP server’s docs specify). The current nginx config only proxies to 8000 and 3000, so no conflict.
- **Directory:** Install the MCP repo in a separate directory (e.g. `/opt/mcp` or `/opt/path-mcp-server`) so Path-Boarding stays under `/opt/boarding/repo`.
- **systemd:** Add a new unit file for the MCP service (e.g. `path-mcp-server.service`), enable and start it. See that repo’s DEPLOYMENT.md for run commands.
- **nginx:** If the MCP service exposes HTTP and you want it under a subdomain (e.g. `mcp.path2ai.tech`), add a new server block and run Certbot for that domain, or proxy a path on the same host if the MCP server is designed for that.
- **Resources:** Ensure the instance has enough memory/CPU for backend + frontend + MCP (the Path-MCP-Server repo has notes on low-memory builds if needed).

No changes to the Path-Boarding deployment in this doc are required for MCP; the layout above keeps the two services independent.

---

## 11. Files in this repo used for deployment

| File | Purpose |
|------|--------|
| `deploy/setup-ec2.sh` | Base EC2: dnf update, Node, Python, nginx, certbot, dirs |
| `deploy/nginx-boarding.path2ai.tech.conf` | nginx server block (API proxy + frontend proxy); adapt after Certbot |
| `deploy/systemd/path-boarding-backend.service` | gunicorn backend service |
| `deploy/systemd/path-boarding-frontend.service` | Next.js frontend service |
| `deploy/run-migrations.sh` | Run Alembic upgrade head (sources backend.env) |
| `deploy/health-check.sh` | Optional cron script to hit /health and log result |
| `backend/.env.example` | Template for backend env (copy to server as backend.env) |
| `docs/DEPLOYMENT.md` | High-level deployment and same-origin notes |
| `docs/AWS_DEPLOYMENT.md` | This guide |

**Separate repo (future):** [keyman12/Path-MCP-Server](https://github.com/keyman12/Path-MCP-Server) – deploy to the same EC2 when ready; see §10 above.
