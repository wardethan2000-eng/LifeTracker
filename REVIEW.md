# LifeKeeper — Repository Review (2026-03-17)

## Summary

LifeKeeper is a well-structured universal maintenance tracking platform built as a TypeScript monorepo. The architecture is solid and conventions are clearly documented. Below are findings organized by severity.

---

## Bugs & Issues to Fix

### 1. Zero test coverage (Critical)
No test files, no test framework, no CI test step. The `packages/utils` module contains complex scheduling logic (due date calculations, cost forecasting, anomaly detection, Pearson correlation) that should have comprehensive unit tests. A regression in `calculateNextDue` or `calculateScheduleStatus` could silently break all maintenance scheduling.

### 2. CORS is wide open (High)
`apps/api/src/app.ts:62` — `origin: true` reflects any origin. In production any website can make authenticated cookie-based requests. Lock to specific allowed origins.

### 3. No rate limiting (High)
Zero rate limiting on any endpoint. The public share link endpoint (`/v1/public/share/:token`) requires no auth and increments a view counter — trivially abusable. The barcode lookup endpoint makes external API calls with no throttle.

### 4. `Function` type in schedule routes (Medium)
`apps/api/src/routes/schedules/index.ts:38` uses bare `Function` type, bypassing TypeScript safety. Should use `PrismaClient` or the proper delegate type.

### 5. Duplicate `toInputJsonValue` helper (Low)
Same cast defined in both `apps/api/src/routes/assets/index.ts:47` and `apps/api/src/routes/schedules/index.ts:58`. Extract to shared utility.

### 6. Missing error handling in mobile app (Medium)
`apps/mobile/App.tsx:40-42` — `handleAssetScan` and `handleProductScan` have no try/catch. A failed API call leaves the app stuck on the loading screen with no way to recover.

### 7. Dashboard makes duplicate data fetches (Low)
`apps/web/app/(dashboard)/page.tsx` — `DashboardStatsRow`, `DashboardAssetRegistry`, and `DashboardAsidePanels` each call `getDashboardData()` independently. React `cache()` may deduplicate within a render pass, but this is fragile.

### 8. Hardcoded seed IDs in mobile app (Low)
`apps/mobile/App.tsx:11` hardcodes `clkeeperhouse000000000001`. These should be centralized dev constants or loaded from env.

---

## Refactors Needed

### 1. Split Prisma schema (Medium)
1300+ lines in a single file. The "Projects" header appears twice (lines 567 and 719), and "Core — Users & Households" appears in two places (166 and 971). Use Prisma multi-file schema support.

### 2. Group route registration (Medium)
`apps/api/src/app.ts` registers 40+ plugins in a flat list. Use Fastify `register(plugin, { prefix })` for grouping and per-group middleware (e.g., separating public vs authenticated routes).

### 3. Reduce JSON blob columns (Low)
`purchaseDetails`, `warrantyDetails`, `locationDetails`, `insuranceDetails`, `dispositionDetails` have predictable structures that could be proper columns with DB-level validation and indexing.

### 4. Split types package (Medium)
`packages/types/src/index.ts` is 42K+ tokens. Split into domain files (assets.ts, projects.ts, hobbies.ts) re-exported from index.ts, like the analytics types already are.

---

## Design Gaps

### 1. No pagination on list endpoints (High)
`GET /v1/assets`, schedules, logs, projects, inventory items all return full result sets with no limit/offset/cursor. This will become a performance wall as data grows.

### 2. No soft-delete consistency (Medium)
Assets have `deletedAt` and `isArchived`, but projects, schedules, logs, and inventory items only have cascade deletes. Accidental deletion is permanent and unrecoverable.

### 3. No webhook/event system (Medium)
The notification system scans for due schedules, but there is no general event bus. As the platform grows, low stock alerts, project deadline warnings, and hobby session reminders will each need bespoke scanning jobs.

### 4. Inconsistent authorization patterns (Medium)
Some routes use `assertMembership`, some use `getAccessibleAsset`, some inline `household.members.some` in Prisma where clauses. A unified middleware or Fastify decorator would prevent authorization bugs.

### 5. No full data export (Low)
There is asset CSV export and share links, but no full account data export for GDPR/privacy compliance.

### 6. Comments limited to assets (Low)
The `Comment` model is tied to `assetId`. Projects, hobbies, and inventory items don't have commenting, which is a natural expectation for a collaborative household tool.

### 7. Open TODOs in source
- `apps/api/src/routes/analytics/comparative.ts:232-238` — Multiple TODO comments for on-time/late completion analytics, computed percentages, and inventory rollup queries.
- `apps/api/src/routes/invitations/index.ts:52` — Email send not wired (needs SendGrid/SES).

---

## Recommended Next Features (Priority Order)

1. **Testing infrastructure** — Set up Vitest; unit tests for `packages/utils`, integration tests for key API routes, component tests for critical web flows.
2. **Rate limiting & security hardening** — `@fastify/rate-limit`, lock CORS origins, input size limits, audit logging on destructive operations.
3. **Pagination on all list endpoints** — Cursor-based or offset pagination. Prerequisite for scaling beyond demo data.
4. **Notification delivery** — Wire email (SendGrid/SES) and Expo push adapter.
5. **Mobile app completion** — Asset browsing, schedule completion, quick-log-entry flows.
6. **Recurring scheduled jobs** — Replace manual "scan notifications" button with BullMQ repeatable jobs or cron triggers.
7. **Multi-entity comments** — Extend comments to projects, hobbies, and inventory items.

---

## What's Done Well

- Clean TypeScript throughout with Zod as the single source of truth for validation
- Thoughtful Prisma schema with proper indexes, cascading deletes, and relationship naming
- Well-organized serializer layer keeping response shapes consistent
- Solid auth plugin with production safety checks (dev bypass blocked in prod)
- Good use of Fastify plugin architecture
- Comprehensive preset library with domain-expert depth
- The hobby/brewing domain is surprisingly deep and well-modeled
- Activity logging and search index patterns are properly cross-cutting
- The web dashboard uses React Server Components well with proper Suspense boundaries
- Excellent developer documentation (AGENTS.md, README, UI guide, implementation spec)
