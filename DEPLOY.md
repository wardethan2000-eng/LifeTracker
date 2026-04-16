# Deploying to lifetracker.home

Deployments are **always manual**. Nothing is pushed to the server automatically — you control when code goes live.

## Prerequisites

- SSH key at `~/.ssh/proxmox_key`
- Changes committed and pushed to GitHub

## Workflow

**1. Finish your changes and push to GitHub:**
```bash
git push
```

**2. Run the deploy script:**
```bash
./deploy.sh          # deploy everything (API + web)
./deploy.sh api      # API changes only — no build, takes ~2 seconds
./deploy.sh web      # web changes only — requires a build, takes ~1-2 minutes
```

The script pulls the latest commit from GitHub onto the server, builds if needed, and restarts the relevant process(es).

## What requires a web build?

Any change inside `apps/web/` requires `./deploy.sh web` (or `./deploy.sh`) because Next.js bundles everything at build time. API changes (`apps/api/`, `packages/`) do not require a build — the server runs TypeScript directly.

| Changed files | Command |
|---|---|
| `apps/api/**` or `packages/**` only | `./deploy.sh api` |
| `apps/web/**` only | `./deploy.sh web` |
| Both, or unsure | `./deploy.sh` |

## Checking server status

```bash
# View running processes and restart counts
ssh -i ~/.ssh/proxmox_key root@192.168.68.50 "pct exec 101 -- pm2 list"

# Tail live logs
ssh -i ~/.ssh/proxmox_key root@192.168.68.50 "pct exec 101 -- pm2 logs --lines 50"

# API logs only
ssh -i ~/.ssh/proxmox_key root@192.168.68.50 "pct exec 101 -- pm2 logs lifetracker-api --lines 50"
```

## Server details

| | |
|---|---|
| URL | http://lifetracker.home |
| Proxmox host | 192.168.68.50 |
| LXC container | 101 (192.168.68.52) |
| App directory | `/opt/lifetracker` |
| API port | 4000 |
| Web port | 3000 |
