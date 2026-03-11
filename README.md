# LifeKeeper

LifeKeeper is a universal maintenance tracking platform for assets across vehicles, homes, equipment, and household-owned systems. This repository contains the Phase 1 monorepo scaffold, shared domain contracts, Prisma schema, and the first API slice for asset CRUD.

## Workspace layout

- `apps/api`: Fastify + Prisma backend
- `apps/mobile`: Expo app shell for Phase 1 mobile work
- `apps/web`: placeholder for Phase 2 Next.js application
- `packages/types`: shared TypeScript types and Zod schemas
- `packages/utils`: shared utility functions for dates and trigger calculations
- `packages/presets`: starter preset templates for onboarding

## Getting started

1. Install dependencies with `pnpm install`.
2. Copy `apps/api/.env.example` to `apps/api/.env` and provide PostgreSQL, Redis, and Clerk values.
3. Generate the Prisma client with `pnpm db:generate`.
4. Run migrations with `pnpm db:migrate`.
5. Seed development data with `pnpm db:seed`.
6. Start the API with `pnpm --filter @lifekeeper/api dev`.

If you use Docker locally, you can start PostgreSQL and Redis with:

1. `docker compose -f compose.local.yaml up -d`
2. `pnpm db:migrate`
3. `pnpm db:seed`
4. `pnpm --filter @lifekeeper/api notifications:scan:now`

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

The development bypass is rejected in production.

## Notification development

The notification worker stack uses BullMQ with Redis.

Useful local commands:

1. Start workers with `pnpm --filter @lifekeeper/api notifications:worker`.
2. Enqueue a scan with `pnpm --filter @lifekeeper/api notifications:scan`.
3. Run scan plus immediate local log delivery with `pnpm --filter @lifekeeper/api notifications:scan:now`.

The seed data includes an overdue shared schedule so notification generation can be verified immediately.

If PostgreSQL or Redis are not running locally, `pnpm db:migrate`, `pnpm db:seed`, and the notification worker commands will fail until those services are available.

## Next milestones

1. Add notification dismissal, snooze rules, and digest batching.
2. Wire a real Expo push delivery adapter on top of the current delivery abstraction.
3. Add preset-aware mobile onboarding and quick-apply flows for assets.
4. Build mobile asset management flows and completion screens.
