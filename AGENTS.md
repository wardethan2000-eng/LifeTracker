# LifeKeeper — AI Agent Instructions

Universal maintenance tracking platform. Turborepo monorepo, TypeScript end-to-end.

## Workspace layout

- `apps/api` — Fastify REST API with Prisma ORM (PostgreSQL)
- `apps/web` — Next.js App Router dashboard (primary working interface)
- `apps/mobile` — Expo/React Native shell (future phase)
- `packages/types` — Shared Zod schemas and TypeScript types (`@lifekeeper/types`)
- `packages/utils` — Date math, trigger calculation helpers (`@lifekeeper/utils`)
- `packages/presets` — Asset preset library JSON (`@lifekeeper/presets`)
- `prisma/` schema lives at `apps/api/prisma/schema.prisma`

## Commands

Package manager is **pnpm** (v10). Always use `pnpm`, never npm or yarn.

```
pnpm install                          # install all workspace deps
pnpm db:generate                      # regenerate Prisma client after schema changes
pnpm db:migrate                       # run pending migrations
pnpm db:seed                          # seed dev data (idempotent)
pnpm --filter @lifekeeper/api dev     # start API on :4000
pnpm --filter @lifekeeper/web dev     # start web dashboard
pnpm --filter @lifekeeper/api notifications:scan:now   # scan + deliver notifications locally
```

Run `pnpm db:generate` after every Prisma schema change before writing code that uses new models. Forgetting this causes TypeScript errors that look like missing properties on `prisma.*` calls.

## Tech stack decisions (do not deviate)

- **TypeScript everywhere** — shared types between API, web, and mobile eliminate a class of bugs. Never introduce plain JS files.
- **Zod for validation** — all API input/output contracts live in `packages/types/src/index.ts`. New endpoints must define Zod schemas there and import them in both the API route and the web client.
- **Prisma for DB access** — no raw SQL unless Prisma cannot express the query. Schema is the source of truth.
- **Fastify, not Express** — the API uses Fastify plugins and decorators. Do not use Express middleware patterns.
- **BullMQ + Redis** — background job processing. Workers live in `apps/api/src/workers/`.
- **Clerk** — authentication. Auth is hybrid: Clerk tokens in production, `x-dev-user-id` header bypass in development. See `apps/api/src/plugins/auth.ts`.

## API conventions

- Routes live in `apps/api/src/routes/` grouped by domain (assets, schedules, projects, comments, etc.).
- Every route file exports a `FastifyPluginAsync` registered on the app instance.
- Route paths are versioned: `/v1/assets`, `/v1/households/:householdId/projects`, etc.
- All responses serialize dates as ISO strings. Response serializer functions live in `apps/api/src/lib/serializers/` organized by domain (e.g., `serializers/assets.ts`, `serializers/projects.ts`). Import them from `../../lib/serializers/index.js` in route files. Never define inline `to*Response` functions in route files - always add new serializers to the appropriate domain file in the serializers directory.
- Household scoping: most queries filter by household membership. Use `getAccessibleAsset()` from `apps/api/src/lib/asset-access.ts` for asset-level checks.
- Activity logging: call `logActivity()` from `apps/api/src/lib/activity-log.ts` after create/update/delete mutations.
- Search index: call `syncToSearchIndex` / `removeSearchIndexEntry` from `apps/api/src/lib/search-index.ts` when entities that participate in search are mutated.

## Web app conventions

- App Router with server components by default. Client components use `"use client"` directive.
- API client lives in `apps/web/lib/api.ts` — a typed wrapper around fetch that handles auth headers and Zod parsing. Add new methods here for new endpoints.
- CSS is global in `apps/web/app/globals.css` — no CSS modules, no Tailwind. Use existing CSS custom properties (e.g. `var(--ink)`, `var(--surface)`, `var(--accent)`, `var(--border)`).
- **Dashboard/home pages** use a card-based layout (`.panel--studio`, `.kv-grid`).
- **Workbench screens** (asset create/edit, project create/settings) use the flat form paradigm with `.workbench-*` classes: `.workbench-form`, `.workbench-section`, `.workbench-grid`, `.workbench-table`, `.workbench-details`, `.workbench-bar`.
- ExpandableCard sections (Custom Fields, Maintenance Schedules, Usage Metrics, and similar dense editing sections on workbench surfaces) use inline collapse/expand — clicking the header toggle slides the full editing UI open directly in the page flow, pushing content below it down. They do not use modals. The ExpandModal component exists in the codebase but is not the active pattern for workbench surfaces. When collapsed, these cards show a compact preview summary. When expanded, they render the same workbench-table and workbench-grid content inline.
- Workbench surfaces use Card, CollapsibleCard, and ExpandableCard components as section containers. These are thin-bordered grouping containers, not decorative boxes. Card is always-open for primary field groups like Core Identity. CollapsibleCard is used in the aside column for secondary metadata (Purchase Details, Warranty, Location, etc.) that defaults to collapsed. ExpandableCard is used for dense editing sections that show a compact preview when collapsed and slide open inline when expanded.

## Shared types contract

`packages/types/src/index.ts` is the single source of truth for API shapes. When adding a new domain:

1. Define the Zod schema (e.g. `projectPhaseSchema`) and its create/update variants.
2. Export inferred TypeScript types (`export type ProjectPhase = z.infer<typeof projectPhaseSchema>`).
3. Import the schema in the API route for request validation and in `apps/web/lib/api.ts` for response parsing.

Never duplicate type definitions across apps. If a type exists in `packages/types`, import it.

## Preset library

Presets live in `packages/presets/src/library.ts`. Each preset is built with helper functions (`libraryPreset`, `schedule`, `metric`, `customField`, `notification`) that enforce consistent structure. New presets must use these helpers and follow the depth/specificity standard of existing presets (30+ schedules for complex asset types, domain-expert quality).

## Adding a new feature — checklist

1. Schema: add or modify models in `apps/api/prisma/schema.prisma`.
2. Generate: run `pnpm db:generate` then `pnpm db:migrate`.
3. Types: add Zod schemas and TS types in `packages/types/src/index.ts`.
4. API routes: create or extend route files in `apps/api/src/routes/`. Wire activity log and search index.
5. Web client: add API methods in `apps/web/lib/api.ts`, then build UI components.
6. Seed data: update `apps/api/prisma/seed.ts` if the feature needs demo data.

## Things to avoid

- Do not break existing functionality. All changes must be additive and non-breaking.
- Do not install new dependencies without explicit instruction. The stack is intentionally lean.
- Do not create separate CSS files or introduce a CSS framework. Extend `globals.css`.
- Do not use `any` types. TypeScript strict mode is enforced.
- Do not hardcode user IDs, household IDs, or environment-specific values. Use env vars or seeded constants.
- Do not put business logic in web components. Validation and computation belong in `packages/types` or `packages/utils`.
