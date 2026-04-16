#!/usr/bin/env bash
# Deploy LifeTracker to the homelab server (LXC 101 @ 192.168.68.52).
#
# Usage:
#   ./deploy.sh          — pull latest + build web + restart everything
#   ./deploy.sh api      — pull latest + restart API only  (no build, fast)
#   ./deploy.sh web      — pull latest + build web + restart web only
#
# Run AFTER pushing your changes to GitHub:
#   git push && ./deploy.sh

set -euo pipefail

TARGET="${1:-all}"
SSH_KEY="${SSH_KEY:-$HOME/.ssh/proxmox_key}"
PROXMOX_HOST="root@192.168.68.50"
LXC_ID="101"

run() {
  ssh -i "$SSH_KEY" "$PROXMOX_HOST" "pct exec $LXC_ID -- bash -c '$*'"
}

echo "==> Pulling latest code on server..."
run "cd /opt/lifetracker && git pull --rebase"

if [[ "$TARGET" == "api" || "$TARGET" == "all" ]]; then
  echo "==> Restarting API..."
  run "pm2 restart lifetracker-api"
fi

if [[ "$TARGET" == "web" || "$TARGET" == "all" ]]; then
  echo "==> Building web app (this takes ~1-2 minutes)..."
  run "cd /opt/lifetracker/apps/web && pnpm build"
  echo "==> Restarting web..."
  run "pm2 restart lifetracker-web"
fi

echo "==> Done. Visit http://lifetracker.home"
