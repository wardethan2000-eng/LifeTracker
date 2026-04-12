# Aegis — Self-Hosted Server Setup Guide

**Target hardware:** i5-10310U, 16 GB RAM, 256 GB SSD, Linux Mint
**Architecture:** PostgreSQL + MinIO in Docker Compose · API + notification worker + Next.js web app run natively via Node.js, managed by systemd
**Auth:** BetterAuth (self-hosted, email + password, sessions stored in Postgres)
**Network:** LAN-only initially · Tailscale appendix for remote access later
**Estimated RAM usage:** < 2 GB total for the full stack

---

## Prerequisites (before starting this guide)

- [ ] Signup page reimplemented to work cleanly with BetterAuth (no Clerk dependency)
- [ ] Linux Mint installed on the laptop
- [ ] Laptop connected to home network

---

## Phase 0 — Linux Mint Base Setup

These steps prepare the laptop as a headless server.

### 0.1 — Enable SSH

```bash
sudo apt update
sudo apt install -y openssh-server
sudo systemctl enable ssh
```

From here on, you can work from another machine via `ssh <user>@<server-ip>`.

### 0.2 — Static LAN IP

Set a static IP so the server address doesn't change. Two options:

**Option A — Router DHCP reservation (recommended):**
Log into your router admin panel, find the laptop's MAC address, and assign it a fixed IP (e.g. `192.168.1.100`).

**Option B — Network Manager CLI:**
```bash
# List connections
nmcli con show

# Set static IP on your wired connection (replace "Wired connection 1" with your connection name)
nmcli con mod "Wired connection 1" \
  ipv4.addresses 192.168.1.100/24 \
  ipv4.gateway 192.168.1.1 \
  ipv4.dns "1.1.1.1,8.8.8.8" \
  ipv4.method manual

nmcli con up "Wired connection 1"
```

Verify: `ip addr show` — should show your chosen IP.

### 0.3 — Install Docker

```bash
sudo apt install -y docker.io docker-compose-v2
sudo usermod -aG docker $USER
```

**Log out and back in** (or run `newgrp docker`) for the group change to take effect.

Verify: `docker run --rm hello-world`

### 0.4 — Install Node.js 20 LTS

```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
```

Verify: `node --version` → `v20.x.x`

### 0.5 — Install pnpm v10

```bash
corepack enable
corepack prepare pnpm@10 --activate
```

Verify: `pnpm --version` → `10.x.x`

### 0.6 — Install git

```bash
sudo apt install -y git
```

### 0.7 — Prevent lid-close suspend

The laptop will run with the lid closed. Edit `/etc/systemd/logind.conf`:

```bash
sudo sed -i 's/#HandleLidSwitch=.*/HandleLidSwitch=ignore/' /etc/systemd/logind.conf
sudo sed -i 's/#HandleLidSwitchExternalPower=.*/HandleLidSwitchExternalPower=ignore/' /etc/systemd/logind.conf
sudo systemctl restart systemd-logind
```

### 0.8 — Optional: Disable GUI (save resources)

If running fully headless, switch to multi-user target to free ~500 MB RAM:

```bash
sudo systemctl set-default multi-user.target
sudo reboot
```

To temporarily start the GUI later: `sudo systemctl start display-manager`
To restore GUI on boot: `sudo systemctl set-default graphical.target`

---

## Phase 1 — Clone & Build the Monorepo

```bash
mkdir -p ~/apps && cd ~/apps
git clone <your-repo-url> aegis
cd aegis
pnpm install
pnpm build
```

`pnpm build` compiles all shared packages (`@aegis/types`, `@aegis/utils`, `@aegis/presets`).

---

## Phase 2 — Infrastructure Services (Docker Compose)

### 2.1 — Generate credentials

Run these on the server and save the output — you'll need them in several places:

```bash
echo "POSTGRES_PASSWORD=$(openssl rand -hex 24)"
echo "MINIO_ROOT_USER=aegis-admin"
echo "MINIO_ROOT_PASSWORD=$(openssl rand -hex 24)"
echo "BETTER_AUTH_SECRET=$(openssl rand -hex 32)"
```

### 2.2 — Create Docker Compose environment file

Create `~/apps/aegis/.env.production` with the credentials from step 2.1:

```env
POSTGRES_PASSWORD=<paste-postgres-password>
MINIO_ROOT_USER=aegis-admin
MINIO_ROOT_PASSWORD=<paste-minio-password>
```

> **Security note:** This file contains secrets. Set permissions: `chmod 600 ~/apps/aegis/.env.production`

### 2.3 — Create the production compose file

Create `~/apps/aegis/compose.production.yaml`:

```yaml
services:
  postgres:
    image: postgres:16-alpine
    container_name: aegis-postgres
    restart: unless-stopped
    environment:
      POSTGRES_DB: aegis
      POSTGRES_USER: aegis
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
    ports:
      - "127.0.0.1:5432:5432"
    volumes:
      - aegis-postgres-data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U aegis -d aegis"]
      interval: 10s
      timeout: 5s
      retries: 10

  minio:
    image: minio/minio:latest
    container_name: aegis-minio
    restart: unless-stopped
    command: server /data --console-address :9001
    environment:
      MINIO_ROOT_USER: ${MINIO_ROOT_USER}
      MINIO_ROOT_PASSWORD: ${MINIO_ROOT_PASSWORD}
    ports:
      - "127.0.0.1:9000:9000"
      - "9001:9001"
    volumes:
      - aegis-minio-data:/data
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:9000/minio/health/live"]
      interval: 10s
      timeout: 5s
      retries: 10

volumes:
  aegis-postgres-data:
  aegis-minio-data:
```

> **Port binding notes:**
> - Postgres (`5432`) and MinIO S3 API (`9000`) are bound to `127.0.0.1` — only accessible from the server itself, not from LAN. The Node.js app connects locally.
> - MinIO Console (`9001`) is bound to `0.0.0.0` — accessible from LAN for admin use. You can restrict this to `127.0.0.1:9001:9001` if preferred.

### 2.4 — Start infrastructure

```bash
cd ~/apps/aegis
docker compose -f compose.production.yaml --env-file .env.production up -d
```

Verify both services are healthy:
```bash
docker compose -f compose.production.yaml ps
```

Expected: both `aegis-postgres` and `aegis-minio` show `healthy`.

### 2.5 — Create MinIO bucket

Open `http://<server-ip>:9001` in a browser on another device. Log in with your `MINIO_ROOT_USER` / `MINIO_ROOT_PASSWORD`. Create a bucket named `aegis-attachments`.

Alternatively, use the MinIO CLI:
```bash
# Install mc (MinIO Client)
curl -O https://dl.min.io/client/mc/release/linux-amd64/mc
chmod +x mc && sudo mv mc /usr/local/bin/

# Configure and create bucket
mc alias set aegis http://localhost:9000 aegis-admin <MINIO_ROOT_PASSWORD>
mc mb aegis/aegis-attachments
```

### 2.6 — Enable Docker auto-start on boot

```bash
sudo systemctl enable docker
```

Docker containers with `restart: unless-stopped` will auto-start when Docker starts.

---

## Phase 3 — Database Setup

### 3.1 — Generate Prisma client

```bash
cd ~/apps/aegis
pnpm db:generate
```

### 3.2 — Run migrations

Create the API env file first (needed for the DATABASE_URL). See Phase 4 for the full file, but at minimum you need:

```bash
# Temporary — just for migration. Full .env created in Phase 4.
export DATABASE_URL="postgresql://aegis:<POSTGRES_PASSWORD>@localhost:5432/aegis"
cd apps/api
npx prisma migrate deploy
cd ~/apps/aegis
```

> **Important:** Use `prisma migrate deploy` (not `prisma migrate dev`) for production. It applies pending migrations without generating new ones.

### 3.3 — Seed initial data

```bash
cd ~/apps/aegis
DATABASE_URL="postgresql://aegis:<POSTGRES_PASSWORD>@localhost:5432/aegis" pnpm db:seed
```

### 3.4 — Verify

```bash
docker exec aegis-postgres psql -U aegis -d aegis -c '\dt' | head -20
```

Should show many tables (User, Household, Asset, etc.).

---

## Phase 4 — Application Environment Files

### 4.1 — API environment (`apps/api/.env`)

Create `~/apps/aegis/apps/api/.env`:

```env
# ── Server ──────────────────────────────────────────────
NODE_ENV=production
PORT=4000
HOST=0.0.0.0

# ── Database ────────────────────────────────────────────
DATABASE_URL="postgresql://aegis:<POSTGRES_PASSWORD>@localhost:5432/aegis"

# ── Authentication ──────────────────────────────────────
AUTH_MODE=better-auth
BETTER_AUTH_SECRET=<BETTER_AUTH_SECRET from Phase 2.1>
ALLOW_DEV_AUTH_BYPASS=false
APP_BASE_URL=http://<SERVER_LAN_IP>:4000
CORS_ALLOWED_ORIGINS=http://<SERVER_LAN_IP>:3000

# ── File Storage (MinIO) ───────────────────────────────
STORAGE_ENABLED=true
S3_ENDPOINT=http://localhost:9000
S3_ACCESS_KEY_ID=aegis-admin
S3_SECRET_ACCESS_KEY=<MINIO_ROOT_PASSWORD>
S3_BUCKET=aegis-attachments
S3_FORCE_PATH_STYLE=true
S3_REGION=us-east-1

# ── Background Jobs ────────────────────────────────────
ENABLE_QUEUES=true
ENABLE_RECURRING_JOBS=true

# ── Notifications ───────────────────────────────────────
NOTIFICATION_DELIVERY_MODE=log
NOTIFICATION_SCAN_CRON=0 * * * *
COMPLIANCE_SCAN_CRON=15 * * * *
DIGEST_BATCH_CRON=0 8 * * *

# ── Rate Limiting (relaxed for self-hosted) ─────────────
GLOBAL_RATE_LIMIT_MAX=600
USER_RATE_LIMIT_MAX=400
```

> Replace all `<PLACEHOLDERS>` with real values from Phase 2.1.
> Set permissions: `chmod 600 ~/apps/aegis/apps/api/.env`

### 4.2 — Web environment (`apps/web/.env`)

Create `~/apps/aegis/apps/web/.env`:

```env
NODE_ENV=production

# Server-side API URL (Next.js server → API, localhost because same machine)
AEGIS_API_BASE_URL=http://127.0.0.1:4000

# Browser-side API URL (user's browser → server LAN IP → Next.js proxy → API)
NEXT_PUBLIC_AEGIS_API_BASE_URL=http://<SERVER_LAN_IP>:4000

# BetterAuth client needs to know where the API is
NEXT_PUBLIC_LIFEKEEPER_API_BASE_URL=http://<SERVER_LAN_IP>:4000

# Auth
NEXT_PUBLIC_DEV_AUTH_BYPASS=false
```

> Replace `<SERVER_LAN_IP>` with the static IP from Phase 0.2 (e.g. `192.168.1.100`).

---

## Phase 5 — Build for Production

```bash
cd ~/apps/aegis

# Build the API (TypeScript → JavaScript in apps/api/dist/)
pnpm --filter @aegis/api build

# Build the web app (Next.js production build in apps/web/.next/)
pnpm --filter @aegis/web build
```

> The web build may take 2-3 minutes. This is normal.

---

## Phase 6 — Create First User Account

After the API is running (start it temporarily to create the account):

```bash
cd ~/apps/aegis/apps/api
node dist/index.js &
API_PID=$!

# Wait for API to start
sleep 3

# Create your user account
curl -X POST http://localhost:4000/api/auth/sign-up/email \
  -H "Content-Type: application/json" \
  -d '{
    "email": "your-email@example.com",
    "password": "your-strong-password",
    "name": "Ethan"
  }'

# Stop the temporary API process
kill $API_PID
```

> The signup page in the web app will handle this in the future. This is a one-time bootstrap step.
> After signing up, the seed data or a manual API call may be needed to create a Household and link your user to it. Check if the web app's onboarding flow handles household creation automatically.

---

## Phase 7 — Systemd Services

Create three unit files so everything auto-starts on boot and auto-restarts on crash. Replace `<USER>` with your Linux username throughout.

### 7.1 — API service

```bash
sudo tee /etc/systemd/system/aegis-api.service << 'EOF'
[Unit]
Description=Aegis API Server
After=docker.service
Requires=docker.service

[Service]
Type=simple
User=<USER>
WorkingDirectory=/home/<USER>/apps/aegis/apps/api
ExecStart=/usr/bin/node dist/index.js
EnvironmentFile=/home/<USER>/apps/aegis/apps/api/.env
Restart=always
RestartSec=5
# Give Postgres time to be ready after Docker starts
ExecStartPre=/bin/sleep 10

[Install]
WantedBy=multi-user.target
EOF
```

### 7.2 — Notification worker service

```bash
sudo tee /etc/systemd/system/aegis-worker.service << 'EOF'
[Unit]
Description=Aegis Notification Worker
After=aegis-api.service

[Service]
Type=simple
User=<USER>
WorkingDirectory=/home/<USER>/apps/aegis/apps/api
ExecStart=/usr/bin/node dist/workers/notifications.js
EnvironmentFile=/home/<USER>/apps/aegis/apps/api/.env
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
EOF
```

### 7.3 — Web dashboard service

```bash
sudo tee /etc/systemd/system/aegis-web.service << 'EOF'
[Unit]
Description=Aegis Web Dashboard
After=aegis-api.service

[Service]
Type=simple
User=<USER>
WorkingDirectory=/home/<USER>/apps/aegis/apps/web
ExecStart=/usr/bin/npx next start --port 3000
EnvironmentFile=/home/<USER>/apps/aegis/apps/web/.env
Restart=always
RestartSec=5
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
EOF
```

### 7.4 — Enable and start all services

```bash
sudo systemctl daemon-reload
sudo systemctl enable aegis-api aegis-worker aegis-web
sudo systemctl start aegis-api aegis-worker aegis-web
```

Check status:
```bash
sudo systemctl status aegis-api aegis-worker aegis-web
```

View logs:
```bash
# Follow API logs
journalctl -u aegis-api -f

# Follow worker logs
journalctl -u aegis-worker -f

# Follow web logs
journalctl -u aegis-web -f

# View last 50 lines of a service
journalctl -u aegis-api -n 50
```

---

## Phase 8 — Verification Checklist

Run through each check from the server and from another device on the LAN.

| # | Check | Command / Action | Expected Result |
|---|-------|-----------------|-----------------|
| 1 | Postgres | `docker exec aegis-postgres pg_isready` | "accepting connections" |
| 2 | MinIO | `curl http://localhost:9000/minio/health/live` | 200 OK |
| 3 | API | `curl http://localhost:4000/health` | `{"status":"ok"}` |
| 4 | Web (LAN) | Open `http://<SERVER_IP>:3000` from phone/laptop | Login page loads |
| 5 | Auth | Sign in via web UI with user from Phase 6 | Dashboard loads |
| 6 | Data | Create an asset in the web UI | Asset appears in dashboard |
| 7 | Uploads | Upload an attachment to an asset | File appears in MinIO console |
| 8 | Worker | `journalctl -u aegis-worker -f` | pg-boss started, cron jobs registered |
| 9 | Reboot | `sudo reboot`, wait 2 min, re-check items 1-5 | All services auto-started |

---

## Phase 9 — Routine Maintenance

### Updating after code changes

```bash
cd ~/apps/aegis
git pull
pnpm install
pnpm db:generate

# Only if prisma/schema.prisma changed:
cd apps/api && npx prisma migrate deploy && cd ../..

pnpm build
sudo systemctl restart aegis-api aegis-worker aegis-web
```

### Checking service health

```bash
# Quick status of all three services
sudo systemctl status aegis-api aegis-worker aegis-web --no-pager

# Docker infrastructure status
docker compose -f compose.production.yaml ps
```

### Viewing logs

```bash
# Last hour of API errors only
journalctl -u aegis-api --since "1 hour ago" -p err

# Full worker log for today
journalctl -u aegis-worker --since today
```

### Restarting individual services

```bash
sudo systemctl restart aegis-api      # restart API only
sudo systemctl restart aegis-worker   # restart worker only
sudo systemctl restart aegis-web      # restart web only
```

---

## Appendix A — Tailscale for Remote Access

When you want to access Aegis from outside your home network:

### A.1 — Install Tailscale on the server

```bash
curl -fsSL https://tailscale.com/install.sh | sh
sudo tailscale up
```

Follow the auth URL to link the server to your Tailscale account. Note the Tailscale IP (e.g. `100.x.y.z`).

### A.2 — Install Tailscale on client devices

Install the Tailscale app on your phone, laptop, etc. and sign in with the same account.

### A.3 — Update environment files

Add the Tailscale IP to CORS origins in `apps/api/.env`:

```env
CORS_ALLOWED_ORIGINS=http://192.168.1.100:3000,http://100.x.y.z:3000
```

Update the web app's API URL in `apps/web/.env` if accessing from Tailscale:

```env
NEXT_PUBLIC_AEGIS_API_BASE_URL=http://100.x.y.z:4000
NEXT_PUBLIC_LIFEKEEPER_API_BASE_URL=http://100.x.y.z:4000
```

Restart services:
```bash
sudo systemctl restart aegis-api aegis-web
```

Access from anywhere: `http://100.x.y.z:3000`

> Tailscale traffic is encrypted end-to-end (WireGuard). No HTTPS/TLS setup needed. No port forwarding. No firewall changes.

---

## Appendix B — Automated Backups

### B.1 — Database backup (daily, keep 7 days)

```bash
# Create backup directory
sudo mkdir -p /var/backups/aegis
sudo chown $USER:$USER /var/backups/aegis

# Add to crontab: crontab -e
0 3 * * * docker exec aegis-postgres pg_dump -U aegis aegis | gzip > /var/backups/aegis/db-$(date +\%F).sql.gz
0 4 * * * find /var/backups/aegis -name "db-*.sql.gz" -mtime +7 -delete
```

### B.2 — MinIO backup (weekly mirror)

```bash
# Add to crontab
0 5 * * 0 mc mirror --overwrite aegis/aegis-attachments /var/backups/aegis/minio/
```

### B.3 — Restore from backup

```bash
# Restore database
gunzip -c /var/backups/aegis/db-2026-04-12.sql.gz | docker exec -i aegis-postgres psql -U aegis aegis

# Restore MinIO files
mc mirror --overwrite /var/backups/aegis/minio/ aegis/aegis-attachments
```

### B.4 — External drive (optional)

If you add a USB drive for off-machine backups:

```bash
# Mount the drive (find device with lsblk)
sudo mkdir -p /mnt/backup
sudo mount /dev/sdb1 /mnt/backup

# Add to /etc/fstab for auto-mount on boot
echo "/dev/sdb1 /mnt/backup ext4 defaults,nofail 0 2" | sudo tee -a /etc/fstab

# Change backup paths in crontab to /mnt/backup/aegis/
```

---

## Appendix C — Storage Expansion

The 256 GB SSD is sufficient for the app and database. If file attachments grow large:

1. **Check current usage:**
   ```bash
   docker system df                                    # Docker disk usage
   du -sh /var/lib/docker/volumes/aegis-minio-data/   # MinIO data size
   du -sh /var/lib/docker/volumes/aegis-postgres-data/ # Postgres data size
   ```

2. **Move MinIO to external drive:**
   ```bash
   # Stop MinIO
   docker compose -f compose.production.yaml stop minio

   # Copy data to external drive
   sudo rsync -av /var/lib/docker/volumes/aegis-minio-data/_data/ /mnt/external/minio-data/

   # Update compose.production.yaml volume:
   # Change: aegis-minio-data:/data
   # To:     /mnt/external/minio-data:/data

   # Restart
   docker compose -f compose.production.yaml --env-file .env.production up -d
   ```

---

## Appendix D — HTTPS with Caddy (future, requires domain)

If you ever point a domain at this server (e.g. via Cloudflare Tunnel or public IP):

```bash
sudo apt install -y caddy
```

Create `/etc/caddy/Caddyfile`:

```
aegis.example.com {
    handle /api/* {
        reverse_proxy localhost:4000
    }
    handle {
        reverse_proxy localhost:3000
    }
}
```

```bash
sudo systemctl enable caddy
sudo systemctl start caddy
```

Caddy auto-provisions and renews TLS certificates via Let's Encrypt. Update `CORS_ALLOWED_ORIGINS` and `NEXT_PUBLIC_AEGIS_API_BASE_URL` to use `https://aegis.example.com`.

---

## Appendix E — Troubleshooting

### Service won't start

```bash
# Check logs for the specific service
journalctl -u aegis-api -n 100 --no-pager

# Common issues:
# - DATABASE_URL wrong → "Connection refused" or "authentication failed"
# - Port already in use → "EADDRINUSE"
# - Missing .env file → "Cannot read properties of undefined"
# - Prisma client outdated → Run pnpm db:generate && pnpm --filter @aegis/api build
```

### Postgres container won't start

```bash
docker logs aegis-postgres

# Common: password mismatch after changing credentials
# Fix: remove volume and re-create (DESTROYS DATA)
docker compose -f compose.production.yaml down -v
docker compose -f compose.production.yaml --env-file .env.production up -d
# Then re-run migrations and seed
```

### Web app loads but API calls fail

1. Check CORS: `CORS_ALLOWED_ORIGINS` in API `.env` must include the exact URL you're accessing from (e.g. `http://192.168.1.100:3000`)
2. Check API base URL: `NEXT_PUBLIC_AEGIS_API_BASE_URL` in web `.env` must be reachable from the browser
3. Check API is running: `curl http://localhost:4000/health`

### Worker not processing jobs

```bash
journalctl -u aegis-worker -n 50

# Check if ENABLE_QUEUES=true in the API .env
# Check if pg-boss tables exist:
docker exec aegis-postgres psql -U aegis -d aegis -c "SELECT count(*) FROM pgboss.job"
```

### Out of disk space

```bash
df -h                                    # Check disk usage
docker system prune -a                   # Remove unused Docker images/containers
journalctl --vacuum-size=100M            # Trim systemd logs
```

---

## Quick Reference Card

| Service | Port | URL | Managed By |
|---------|------|-----|------------|
| **Web Dashboard** | 3000 | `http://<SERVER_IP>:3000` | systemd (`aegis-web`) |
| **API Server** | 4000 | `http://localhost:4000` | systemd (`aegis-api`) |
| **Notification Worker** | — | — | systemd (`aegis-worker`) |
| **PostgreSQL** | 5432 | `localhost:5432` | Docker (`aegis-postgres`) |
| **MinIO S3 API** | 9000 | `localhost:9000` | Docker (`aegis-minio`) |
| **MinIO Console** | 9001 | `http://<SERVER_IP>:9001` | Docker (`aegis-minio`) |

| Action | Command |
|--------|---------|
| Start all app services | `sudo systemctl start aegis-api aegis-worker aegis-web` |
| Stop all app services | `sudo systemctl stop aegis-api aegis-worker aegis-web` |
| Restart all app services | `sudo systemctl restart aegis-api aegis-worker aegis-web` |
| View API logs | `journalctl -u aegis-api -f` |
| Start infrastructure | `docker compose -f compose.production.yaml --env-file .env.production up -d` |
| Stop infrastructure | `docker compose -f compose.production.yaml down` |
| Full restart (after reboot) | Everything auto-starts — verify with `systemctl status aegis-api` |
