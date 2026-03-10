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

## Current phase

Phase 1 currently includes:

- Turborepo and package boundaries
- Shared maintenance trigger schemas and due-date utilities
- Prisma schema for users, households, assets, schedules, logs, and notifications
- Fastify asset CRUD endpoints with household-aware visibility checks
- Usage metric CRUD endpoints with schedule recalculation hooks
- Maintenance schedule CRUD endpoints with stored next-due date and usage thresholds
- Maintenance log CRUD and schedule completion endpoints that advance schedule state
- A broad preset library for vehicles, homes, marine assets, yard equipment, HVAC systems, and workshop equipment
- Household custom preset profile CRUD and asset preset application flows
- Starter preset templates for vehicle and home onboarding

## Next milestones

1. Replace development header-based auth context with Clerk session verification.
2. Add preset-aware mobile onboarding and quick-apply flows for assets.
3. Introduce BullMQ workers for notification dispatch and overdue escalation.
4. Build mobile asset management flows and completion screens.
