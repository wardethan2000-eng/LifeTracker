# Aegis

Aegis is a universal maintenance tracking platform for assets across vehicles, homes, equipment, and household-owned systems. This repository contains the Phase 1 monorepo scaffold, shared domain contracts, Prisma schema, and the first API slice for asset CRUD.

## Workspace layout

- `apps/api`: Fastify + Prisma backend
- `apps/mobile`: Expo app shell for Phase 1 mobile work
- `apps/web`: live Next.js dashboard for household maintenance management
- `packages/types`: shared TypeScript types and Zod schemas
- `packages/utils`: shared utility functions for dates and trigger calculations
- `packages/presets`: starter preset templates for onboarding

## Getting started

1. Install dependencies with `pnpm install`.
2. Copy `apps/api/.env.example` to `apps/api/.env` and provide PostgreSQL, Redis, and Clerk values.
3. Set `APP_BASE_URL` in `apps/api/.env` to the public web origin you want encoded into QR labels.
4. Generate the Prisma client with `pnpm db:generate`.
5. Run migrations with `pnpm db:migrate`.
6. Seed development data with `pnpm db:seed`.
7. Start the API with `pnpm --filter @aegis/api dev`.
8. Start the web dashboard with `pnpm --filter @aegis/web dev`.

If you use Docker locally, you can start PostgreSQL and Redis with:

1. `docker compose -f compose.local.yaml up -d`
2. `pnpm db:migrate`
3. `pnpm db:seed`
4. `pnpm --filter @aegis/api notifications:scan:now`

## Current phase

Phase 1 currently includes:

- Turborepo and package boundaries
- Shared maintenance trigger schemas and due-date utilities
- Prisma schema for users, households, assets, schedules, logs, and notifications
- Hybrid API authentication with Clerk token verification plus a development bypass for local testing
- Fastify current-user, household, household member, and asset CRUD endpoints with household-aware visibility checks
- Usage metric CRUD endpoints with schedule recalculation hooks
- Maintenance schedule CRUD endpoints with stored next-due date and usage thresholds
- Maintenance log CRUD and schedule completion endpoints that advance schedule state
- BullMQ-backed notification scan and delivery workers with log-mode local delivery
- Notification inbox, read-state, preference, and household dashboard aggregation APIs
- A broad preset library for vehicles, homes, marine assets, yard equipment, HVAC systems, and workshop equipment
- Household custom preset profile CRUD and asset preset application flows
- Starter preset templates for vehicle and home onboarding

## Auth modes

The API supports two practical development paths:

- Clerk-backed auth via a bearer token or Clerk `__session` cookie
- A development-only bypass that resolves a local user from `x-dev-user-id` or the `DEV_AUTH_DEFAULT_USER_ID` environment variable

Recommended local setup:

1. Keep `AUTH_MODE="hybrid"`.
2. Leave `ALLOW_DEV_AUTH_BYPASS="true"` locally.
3. Seed the database with `pnpm db:seed`.
4. Call the API either with a real Clerk token or with `x-dev-user-id: clkeeperuser0000000000001`.
5. For notification development, keep `NOTIFICATION_DELIVERY_MODE="log"`.
6. Keep `CORS_ALLOWED_ORIGINS` aligned with the web and Expo origins you actually use locally.
7. Keep `GLOBAL_RATE_LIMIT_MAX`, `GLOBAL_RATE_LIMIT_WINDOW_MS`, and `API_BODY_LIMIT_BYTES` aligned with the traffic and payload sizes you actually expect.

For production, start with tighter defaults unless a route has a demonstrated need for more headroom:

1. `API_BODY_LIMIT_BYTES="262144"`
2. `API_MAX_PARAM_LENGTH="120"`
3. `GLOBAL_RATE_LIMIT_MAX="120"`
4. `GLOBAL_RATE_LIMIT_WINDOW_MS="60000"`

The development bypass is rejected in production.

## Web dashboard

The web app now talks directly to the API and is intended as the primary interface for testing the current product slice.

Useful local defaults:

1. Keep the API running at `http://127.0.0.1:4000` or set `LIFEKEEPER_API_BASE_URL` for the web app.
2. Keep dev auth bypass enabled and use the seeded demo user `clkeeperuser0000000000001`, or set `LIFEKEEPER_DEV_USER_ID`.
3. Open the web app and use the seeded household `clkeeperhouse000000000001` if you want immediate demo data.
4. These seeded demo IDs are shared dev fixtures from `@aegis/types` and should not be used as production identifiers.

Current web flows include:

- Household dashboard with live due work, notifications, and asset overview cards
- Household switching for the current user
- Manual asset creation with optional library preset application
- Asset detail views with usage metric updates, schedule completion, and maintenance log capture

## Notification development

The notification worker stack uses BullMQ with Redis.

Recurring background jobs are registered by the worker process. By default, notification and low-stock scans run hourly and compliance checks run 15 minutes later. Override them with `NOTIFICATION_SCAN_CRON`, `COMPLIANCE_SCAN_CRON`, and `COMPLIANCE_GRACE_PERIOD_DAYS` in `apps/api/.env` if needed.

Useful local commands:

1. Start workers with `pnpm --filter @aegis/api notifications:worker`.
2. Enqueue a scan with `pnpm --filter @aegis/api notifications:scan`.
3. Run scan plus immediate local log delivery with `pnpm --filter @aegis/api notifications:scan:now`.

The seed data includes an overdue shared schedule so notification generation can be verified immediately.

If PostgreSQL or Redis are not running locally, `pnpm db:migrate`, `pnpm db:seed`, and the notification worker commands will fail until those services are available.

## Next milestones

1. Add notification dismissal, snooze rules, and digest batching.
2. Wire a real Expo push delivery adapter on top of the current delivery abstraction.
3. Add preset-aware mobile onboarding and quick-apply flows for assets.
4. Build mobile asset management flows and completion screens.
