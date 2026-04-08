# Aegis — AI Agent Instructions

Universal maintenance tracking platform. Turborepo monorepo, TypeScript end-to-end.

## Workspace layout

- `apps/api` — Fastify REST API with Prisma ORM (PostgreSQL)
- `apps/web` — Next.js App Router dashboard (primary working interface)
- `apps/mobile` — Expo/React Native shell (future phase)
- `packages/types` — Shared Zod schemas and TypeScript types (`@aegis/types`)
- `packages/utils` — Date math, trigger calculation helpers (`@aegis/utils`)
- `packages/presets` — Asset preset library JSON (`@aegis/presets`)
- `prisma/` schema lives at `apps/api/prisma/schema.prisma`

## Commands

Package manager is **pnpm** (v10). Always use `pnpm`, never npm or yarn.

```
pnpm install                          # install all workspace deps
pnpm db:generate                      # regenerate Prisma client after schema changes
pnpm db:migrate                       # run pending migrations
pnpm db:seed                          # seed dev data (idempotent)
pnpm --filter @aegis/api dev     # start API on :4000
pnpm --filter @aegis/web dev     # start web dashboard
pnpm --filter @aegis/api notifications:scan:now   # scan + deliver notifications locally
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
- Error handling: A centralized error handler plugin (`apps/api/src/plugins/error-handler.ts`) catches all unhandled errors. ZodErrors return 400 with `{ message, errors }`. Prisma NotFoundErrors return 404. Prisma unique constraint violations return 409. All other unhandled errors return 500. Route-level error responses for business logic (not found, forbidden, invalid state) should use `reply.code(xxx).send({ message: '...' })` with a human-readable message. Always use `message` as the error key - never `error`, `detail`, or other keys. Do not wrap `.parse()` calls in try/catch for the purpose of returning 400 - let the centralized handler do it.
- All responses serialize dates as ISO strings. Response serializer functions live in `apps/api/src/lib/serializers/` organized by domain (e.g., `serializers/assets.ts`, `serializers/projects.ts`). Import them from `../../lib/serializers/index.js` in route files. Never define inline `to*Response` functions in route files - always add new serializers to the appropriate domain file in the serializers directory.
- Household scoping: most queries filter by household membership. Use `getAccessibleAsset()` from `apps/api/src/lib/asset-access.ts` for asset-level checks.
- Activity logging: call `logActivity()` from `apps/api/src/lib/activity-log.ts` after create/update/delete mutations.
- Search index: call `syncToSearchIndex` / `removeSearchIndexEntry` from `apps/api/src/lib/search-index.ts` when entities that participate in search are mutated.

## Web app conventions

- App Router with server components by default. Client components use `"use client"` directive.
- **Streaming Suspense for all pages:** Every `page.tsx` that fetches data beyond `getMe()` must use a deferred async server component wrapped in `<Suspense>`. The page function itself stays thin (only `getMe()` + household guard + searchParams parsing). See the dedicated "Streaming Suspense page pattern" section below for the full specification and code template.
- API client lives in `apps/web/lib/api.ts` — a typed wrapper around fetch that handles auth headers and Zod parsing. Add new methods here for new endpoints.
- API proxy: All browser-to-API requests that need to pass through the Next.js server (for cookie forwarding or to avoid CORS) use a catch-all proxy at `apps/web/app/api/[...path]/route.ts`. It forwards requests to `${LIFEKEEPER_API_BASE_URL}/v1/${path}` with auth header passthrough. The shared proxy utility lives in `apps/web/lib/api-proxy.ts`. Do not create individual proxy route files for new endpoints — the catch-all handles them automatically.
- CSS is global in `apps/web/app/globals.css` — no CSS modules, no Tailwind. Use existing CSS custom properties (e.g. `var(--ink)`, `var(--surface)`, `var(--accent)`, `var(--border)`).
- **Dashboard/home pages** use a card-based layout (`.panel--studio`, `.kv-grid`).
- **Entity overview tabs must use `DashboardGrid`** — the root overview tab for every primary domain workspace tool (Assets, Projects, Hobbies, Ideas, and any future domain) must render its content as `DashboardCardDef[]` passed to `<DashboardGrid entityType="<domain>" entityId={entityId} cards={cards} defaultLayout={defaultLayout} />`. Never render a static `<section className="panel">` grid on an overview tab. The stats row may remain static above the grid. Layout is persisted per entity via `UserLayoutPreference`. Reference implementations: `components/asset-overview-grid.tsx` and `components/home-dashboard.tsx`.
- **Workbench screens** (asset create/edit, project create/settings) use the flat form paradigm with `.workbench-*` classes: `.workbench-form`, `.workbench-section`, `.workbench-grid`, `.workbench-table`, `.workbench-details`, `.workbench-bar`.
- ExpandableCard sections (Custom Fields, Maintenance Schedules, Usage Metrics, and similar dense editing sections on workbench surfaces) use inline collapse/expand — clicking the header toggle slides the full editing UI open directly in the page flow, pushing content below it down. They do not use modals. The ExpandModal component exists in the codebase but is not the active pattern for workbench surfaces. When collapsed, these cards show a compact preview summary. When expanded, they render the same workbench-table and workbench-grid content inline.
- Workbench surfaces use Card, CollapsibleCard, and ExpandableCard components as section containers. These are thin-bordered grouping containers, not decorative boxes. Card is always-open for primary field groups like Core Identity. CollapsibleCard is used in the aside column for secondary metadata (Purchase Details, Warranty, Location, etc.) that defaults to collapsed. ExpandableCard is used for dense editing sections that show a compact preview when collapsed and slide open inline when expanded.
- **Inline editing on reading panels:** Panels on reading-surface tabs that display metadata (purchase details, warranty, location, insurance, etc.) must support inline editing — they must NOT be read-only. Each panel renders a `<dl>` in read mode with an "Edit" button (`button--ghost button--xs`) in the panel header. Clicking it switches the panel to a form (`.workbench-grid`) with Save/Cancel. On save, call a server action directly via `useTransition`. Reference implementation: `apps/web/components/asset-details-cards.tsx`. Do not build read-only metadata panels — if the user needs to update the data, the panel itself should be the editing surface.
- **Click-to-edit for identity fields:** Key entity identity fields displayed in page headers (name, manufacturer, model, description) must use the `ClickToEdit` component (`apps/web/components/click-to-edit.tsx`) rather than a separate edit form. `ClickToEdit` renders as display text; clicking activates an input that saves on blur/Enter via `updateAssetFieldAction` or equivalent. Reference implementation: `apps/web/components/asset-hero-editor.tsx`. Never put a prominent "Edit" button on a detail page header when `ClickToEdit` suffices.
- **Drag-and-drop reordering:** Any ordered list (maintenance schedules, custom fields, project phases, tasks) must support drag-to-reorder. Use HTML5 drag events or a lightweight hook — no heavy libraries. Saves the new order immediately on drop via a `{ orderedIds: string[] }` server action. Never require a separate "Save Order" button. Drag handle class is `.drag-handle`; dragging row gets class `.dragging`; drop target gets `.drag-over`.
- **No unnecessary text:** The UI must not explain itself. Evaluate every rendered string: is it inferable from context? Use placeholder text over labels when context is clear. Widget headings provide field context — do not repeat section names in field labels. Contextual language rule: "Recently Deleted" not "Deleted," "No schedules yet" not "No records found," "Add schedule" not "Create new record." Never use "Submit," "OK," or "Confirm" as standalone button labels — attach the verb to the object ("Delete Asset," "Archive Project"). Empty state copy is title + one sentence only — no filler phrases ("It looks like…," "There are currently no…").
- **Not a form-filling application:** Never navigate the user to a separate page solely to edit an existing field on an entity. All entity metadata editing happens inline on the entity's own tab/panel. Dedicated creation pages (e.g. `/assets/new`) are acceptable because the entity does not yet exist. A "Settings" or "Edit" page that merely replicates the detail page fields in form format is always wrong.

## Navigation architecture (web)

- **Tab navigation systems:** There are exactly two tab navigation systems in the web app. Use the correct one — never invent a third.
  - `WorkspaceLayout` (`apps/web/components/workspace-layout.tsx`) — used by Projects, Hobbies, and Ideas. Renders pill-style tabs. All new domain tools must use this component.
  - `AssetTabNav` (`apps/web/components/asset-tab-nav.tsx`) — Assets only. Renders underline-style tabs inside the `detail-topbar`/`detail-hero` layout. Do not move Assets to `WorkspaceLayout` and do not use `AssetTabNav` for any non-asset domain.
- **Sidebar nav groups:** The sidebar is divided into fixed groups. New domain tools go in **Manage** (`/assets`, `/inventory`, `/projects`, `/hobbies`, `/maintenance`). New reporting/analytics tools go in **Insights**. Do not add top-level nav items to **Capture** or **Insights** without explicit instruction.

## Domain overview page template

Every domain entity overview page (the root tab for Assets, Projects, Hobbies, Ideas) must follow this required top-of-page pattern before any domain-specific content:

1. **`IdeaProvenanceBar`** — rendered only if the entity was promoted from an Idea (`sourceIdeaId !== null`).
2. **`PinnedNotesCard`** — rendered only if pinned entries exist for this entity.
3. Domain-specific overview content (stats, recent activity, related entities).

Never omit these checks from an overview page. See `apps/web/components/idea-provenance-bar.tsx` and `apps/web/components/pinned-notes-card.tsx`.

## Empty states

Every list, table, grid, or collection that can have zero items **must** have an explicit empty state. A blank container or silent `null` is never acceptable.

CSS pattern: `.empty-state` > `.empty-state__icon` (emoji) + `.empty-state__title` + `.empty-state__body` + optional `.empty-state__actions`.

```tsx
<div className="empty-state">
  <p className="empty-state__icon">📦</p>
  <p className="empty-state__title">No inventory items linked</p>
  <p className="empty-state__body">Link consumables and spare parts that belong to this asset.</p>
</div>
```

For empty rows inside a `workbench-table`, use `<tr className="workbench-table__empty"><td colSpan={N}><div className="empty-state">…</div></td></tr>`. For panel-level empty states use `<div className="panel__empty">…</div>` (renders as muted italic text).

## Status pills

Entity status values must always be displayed using `.pill` + variant class, never as raw text.

Standard variant mapping:

| Domain | Status | Pill class |
|--------|--------|------------|
| Project | `active` | `pill--success` |
| Project | `on_hold` | `pill--warning` |
| Project | `planning` | `pill--info` |
| Project | `completed` | `pill--muted` |
| Project | `cancelled` | `pill--danger` |
| Hobby | `active` | `pill--success` |
| Hobby | `paused` | `pill--warning` |
| Hobby | `archived` | `pill--muted` |
| Idea | `spark` | `pill--warning` |
| Idea | `developing` | `pill--info` |
| Idea | `ready` | `pill--success` |
| Idea (archived) | `archivedAt !== null` | `pill--muted` |

When passing `statusVariant` to `WorkspaceLayout`, use the string variants: `"success"`, `"warning"`, `"info"`, `"muted"`, `"danger"`. These map to the same pill classes.

## Destructive actions

- **Soft delete (archive/trash):** No confirmation required. Execute immediately with an undo option visible for ~5 seconds. Use `button--ghost` or `button--subtle`.
- **Hard delete:** Always requires an explicit confirmation step. Render the confirmation inline below the trigger button (not a modal). The confirmation message must name what data will be permanently lost. Use `button--danger` for the confirm action and `button--ghost` for cancel.
- Never use `button--primary` for destructive actions.
- Group all destructive actions for an entity in a "Danger Zone" section at the bottom of the entity's Settings tab, visually separated from other content.

## Streaming Suspense page pattern (REQUIRED)

Every `page.tsx` under `(dashboard)/` that fetches data beyond `getMe()` **must** use the streaming Suspense pattern. This ensures the page shell renders instantly while heavy API calls stream in.

### Structure

```tsx
import { Suspense, type JSX } from "react";

// Deferred async server component — does the heavy fetching
async function PageContent({ householdId, ...props }: { householdId: string }): Promise<JSX.Element> {
  const [data1, data2] = await Promise.all([
    getHeavyData(householdId),
    getMoreData(householdId),
  ]);
  return <ClientOrServerUI data1={data1} data2={data2} />;
}

// Default export — thin shell, renders instantly
export default async function Page({ params, searchParams }): Promise<JSX.Element> {
  const me = await getMe(); // cached, essentially free
  const household = me.households[0];
  if (!household) return <p>No household found.</p>;

  return (
    <Suspense fallback={<div className="panel"><div className="panel__body--padded"><p className="note">Loading…</p></div></div>}>
      <PageContent householdId={household.id} />
    </Suspense>
  );
}
```

### Rules

- **`getMe()` stays in the page function.** It is wrapped in `React.cache()` with 5-minute ISR and is essentially free. Layout files already call it, so subpage calls are cache hits.
- **All other API calls go in the deferred component** (`PageContent`, `SettingsContent`, etc.). This includes `getHouseholdAssets`, `getHouseholdNotifications`, `getDisplayPreferences`, `getEntry`, `getCanvas`, etc.
- **Pass primitives as props** to the deferred component — `householdId: string`, `entityId: string`, searchParam values. Never pass the full `household` object (it would serialize the entire object into the RSC payload).
- **Error handling inside the deferred component:** Wrap API calls in try/catch. On `ApiError`, render a fallback `.panel` with the error message. Re-throw unexpected errors.
- **Fallback content** should be a minimal skeleton matching the page header structure (e.g., `<header className="page-header"><h1>Title</h1></header>` + a loading panel). Keep fallbacks lightweight.
- **Pages that only call `getMe()`** (e.g., pages that just render a client component with `householdId`) do not need Suspense — they are already fast enough.
- **`getDisplayPreferences()`** is cached with 60s ISR. It can live in either the page function or the deferred component depending on whether its result is needed for the page shell.
- **Module-level helpers** (formatters, constants, option arrays, helper functions) stay at module scope — they are not moved into the deferred component.
- **When the page has searchParams** that control query filters (cursor, status, etc.), parse them in the page function and pass the parsed values as props to the deferred component.

### When NOT to use Suspense

- Redirect pages (e.g., `costs/page.tsx` → `/analytics`)
- Pages that only call `getMe()` and render a client component
- Creation pages (`/new`) that only need `getMe()` for the household ID

## Error and loading feedback

- **Server action errors:** Render inline below the form that triggered the action using `<p style={{ color: "var(--tone-danger, red)" }}>`. Never use global toasts or banners for form submission errors.
- **Loading state:** While a `useTransition` action is pending, `disabled={isPending}` all interactive elements and change the submit label to `"Saving…"` / `"Deleting…"`. No spinner overlays for button-level actions.
- **Page-level loading:** Add a `loading.tsx` to every dynamic route under `(dashboard)/`. Render a minimal `.panel` skeleton. This is the route-segment-level fallback; the streaming Suspense pattern above provides finer-grained per-section loading.
- **API error fallback:** In deferred Suspense content components, catch `ApiError` and render a fallback `.panel` with the error message. Re-throw unexpected (non-API) errors. Do not wrap the entire page function in try/catch — errors in the deferred component are caught by the Suspense boundary.

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
6. **Page components: follow the streaming Suspense pattern.** Every new `page.tsx` that fetches data beyond `getMe()` must use a deferred async server component wrapped in `<Suspense>`. See the "Streaming Suspense page pattern" section above.
7. Seed data: update `apps/api/prisma/seed.ts` if the feature needs demo data.

## Onboarding walkthrough maintenance

The onboarding checklist lives in `apps/web/components/onboarding-checklist.tsx` and is rendered conditionally on the dashboard home page at `apps/web/app/(dashboard)/page.tsx`. It is hidden once the user dismisses it or all steps are completed.

**Adding a step for a new feature:**
1. Add a new entry to the `steps` array in `OnboardingChecklist` with an `id`, `label`, `description`, `href`, and a `completed` expression (e.g. `myFeatureCount > 0`).
2. Add a corresponding count prop to `OnboardingChecklistProps` (e.g. `myFeatureCount: number`) and destructure it in the component.
3. In `page.tsx`, fetch the relevant count (add it to the parallel `Promise.all` block), derive the numeric count, and pass it as a prop to `<OnboardingChecklistClient />`.

**If you rename or move a route** that an onboarding step links to, update the `href` field in the corresponding step in the `steps` array.

**Completion detection** is automatic — each step checks whether its related entity count is greater than zero. There is no manual completion tracking.

**Dismissal** is persisted via `UserLayoutPreference` with `entityType: "onboarding"` and `entityId: "dismissed"`. The server component reads this with `getLayoutPreference("onboarding", "dismissed")` and skips rendering the checklist if the preference exists. The client wrapper `OnboardingChecklistClient` writes it on dismiss and calls `router.refresh()`.

**CSS styles** for the checklist are in `apps/web/app/globals.css` under the `/* Onboarding Checklist */` comment in section 56.

**Keep it lightweight** — the checklist must not make its own API calls. All data is passed as props from the server component in `page.tsx`. Add new fetches there, not inside the component.

## Domain tool feature parity — REQUIRED

Every primary domain workspace tool (Assets, Projects, Hobbies, Ideas) **must** expose the same set of common tabs and routes. Never remove or omit these features when building or modifying a domain tool's tab navigation.

**Required tab matrix:**

| Feature | Tab label | Route segment | Web component | Notes |
|---------|-----------|---------------|---------------|-------|
| Notes / Journal | "Notes" or "Journal" | `/[entityId]/notes` or `/[entityId]/entries` | `EntryTimeline` (`entityType=<domain>`) | Assets → `"asset"`, Projects → notepad, Hobbies → entries, Ideas → `"idea"` |
| Canvas | "Canvas" | `/[entityId]/canvas` | `EntityCanvasList` (`entityType=<domain>`) | Generic component in `apps/web/components/entity-canvas-list.tsx` |
| Comments | "Comments" | `/[entityId]/comments` | `EntityComments` + domain-specific actions | Generic component in `apps/web/components/entity-comments.tsx`; needs API comment route per domain |
| Activity / History | "Activity" or "History" | `/[entityId]/activity` or `/[entityId]/history` | `getHouseholdActivity` filtered by `entityId` | Existing pattern in Projects (`/timeline`), Assets (`/history`), Hobbies (`/activity`), Ideas (`/activity`) |
| **Inventory** | "Inventory" | `/[entityId]/inventory` | Domain-specific inventory links component | Assets → `AssetInventoryLinks`; Hobbies → `HobbyLinksManager`; Projects → supply tab. **Ideas do not have inventory.** |

**Current status (update when extending):**

| Feature | Assets | Projects | Hobbies | Ideas |
|---------|--------|----------|---------|-------|
| Notes | ✅ `/notes` | ✅ `/notepad` | ✅ `/entries` | ✅ `/notes` |
| Canvas | ✅ `/canvas` | ✅ `/canvas` | ✅ `/canvas` | ✅ `/canvas` |
| Comments | ✅ `/comments` | ✅ `/comments` | ✅ `/comments` | ✅ `/comments` |
| Activity | ✅ `/history` | ✅ `/timeline` | ✅ `/activity` | ✅ `/activity` |
| Inventory | ✅ `/inventory` | ✅ `/supplies` | ✅ `/inventory` | N/A |

**When adding a new domain tool**, include all four feature areas from the start — do not defer them as "future work".

**When modifying existing tab navigation** (e.g. updating a layout file or tab-nav component), verify that all four feature areas are preserved before and after the change.

**Implementation notes:**
- `EntityCanvasList` (`apps/web/components/entity-canvas-list.tsx`) — generic canvas CRUD client component; pass `entityType` and `entityId` props.
- `EntityComments` (`apps/web/components/entity-comments.tsx`) — generic threaded comments server component; pass `comments` array and a `config` object with `hiddenFields`, `createAction`, `updateAction`, `deleteAction`.
- Comments require: (a) API route for the domain, (b) `getXxxComments` / `createXxxComment` / `updateXxxComment` / `deleteXxxComment` methods in `apps/web/lib/api.ts`, (c) corresponding server actions in `apps/web/app/actions.ts`.
- For `attachments` to work on a domain entity, its entity type string must be present in `attachmentEntityTypeValues` (`packages/types/src/index.ts`) and have a `validateEntityOwnership` case in `apps/api/src/routes/attachments/index.ts`.

## Things to avoid

- Do not break existing functionality. All changes must be additive and non-breaking.
- Do not install new dependencies without explicit instruction. The stack is intentionally lean.
- Do not create separate CSS files or introduce a CSS framework. Extend `globals.css`.
- Do not use `any` types. TypeScript strict mode is enforced.
- Do not hardcode user IDs, household IDs, or environment-specific values. Use env vars or seeded constants.
- Do not put business logic in web components. Validation and computation belong in `packages/types` or `packages/utils`.
