# LifeKeeper — Migrate Asset Timeline Entries to the Unified Entry System

This document is the complete implementation reference for retiring the legacy `AssetTimelineEntry` CRUD surface and making the unified `Entry` system the sole write and read path for asset timeline data. It is broken into sequential phases designed to be executed one at a time.

The legacy `AssetTimelineEntry` model, its dedicated API routes, and corresponding frontend API calls will be replaced. The migration script that backfills existing rows already exists (`apps/api/src/scripts/migrate-legacy-entries.ts`). This spec covers the remaining gaps: ensuring all frontend write paths use `Entry`, removing the dual-path branching in server actions, enabling attachment management on Entry-backed timeline items, and finally deleting the legacy surface.

**Key files to understand before starting:**
- `apps/api/src/routes/assets/timeline-entries.ts` — legacy CRUD routes (to be deleted)
- `apps/api/src/routes/entries/index.ts` — unified Entry CRUD (the target)
- `apps/web/app/actions.ts` — server actions with `sourceSystem` branching
- `apps/web/lib/api.ts` — frontend API client (legacy + Entry wrappers)
- `apps/api/src/routes/assets/timeline.ts` — read path that merges legacy + Entry data
- `packages/utils/src/index.ts` — `buildAssetEntryDetails`, `LEGACY_ENTRY_SOURCE_TYPES`

---

## Current state

### What already works
- `createTimelineEntryAction` in `actions.ts` (line 1900) already writes to the Entry API **when `householdId` is available** (lines 1939–1961). It falls back to the legacy `createAssetTimelineEntry` API when `householdId` is missing.
- `updateTimelineEntryAction` (line 1970) branches on `sourceSystem`: entry-backed items go through `updateEntry`, legacy items go through `updateAssetTimelineEntry`.
- `deleteTimelineEntryAction` (line 2050) branches on `sourceSystem` the same way.
- The asset timeline read path in `timeline.ts` already fetches from both tables and deduplicates.
- The migration script converts `AssetTimelineEntry` rows to `Entry` rows with `sourceType: "asset_timeline_entry"`.

### What still needs to happen
1. The `createTimelineEntryAction` fallback path (when `householdId` is absent) still calls the legacy API. Every call site must supply `householdId`.
2. The `updateTimelineEntryAction` and `deleteTimelineEntryAction` legacy branches need to be removed.
3. The timeline read path must stop querying `AssetTimelineEntry` and read exclusively from `Entry`.
4. The `AttachmentSection` component is not rendered for Entry-backed timeline items (the asset detail page conditionally shows it only for legacy items).
5. Frontend API wrappers for the legacy routes (`createAssetTimelineEntry`, `updateAssetTimelineEntry`, `deleteAssetTimelineEntry`, `getAssetTimelineEntries`) need to be deleted.
6. The legacy route file and Prisma model should be removed.

---

## Phase 1 — Ensure `householdId` is always available in timeline write forms

**Goal:** Remove the legacy fallback in `createTimelineEntryAction` so it always writes to the Entry API.

### 1.1 Find all form elements that submit to `createTimelineEntryAction`

Search `apps/web/` for forms and components that call `createTimelineEntryAction`. Every form must include a hidden `householdId` field. The asset detail page already has the household context from `getAccessibleAsset` or the user's membership — thread it through to the form.

### 1.2 Update `createTimelineEntryAction`

In `apps/web/app/actions.ts`, change `createTimelineEntryAction` to:
- Make `householdId` required (use `getRequiredString` instead of `getOptionalString`).
- Remove the `if (!householdId)` fallback branch that calls `createAssetTimelineEntry`.
- Always call `createEntry` with the Entry-shaped payload.

### 1.3 Update `updateTimelineEntryAction`

- Make `householdId` required.
- Remove the `sourceSystem` check and the legacy branch that calls `updateAssetTimelineEntry`.
- Always call `updateEntry`.

### 1.4 Update `deleteTimelineEntryAction`

- Make `householdId` required.
- Remove the `sourceSystem` check and the legacy branch that calls `deleteAssetTimelineEntry`.
- Always call `deleteEntry`.

### 1.5 Verify all form components pass `sourceSystem="entry"` and `householdId`

After this phase, no server action should reference the legacy `AssetTimelineEntry` API functions.

---

## Phase 2 — Switch the timeline read path to Entry-only

**Goal:** The asset timeline page reads exclusively from `Entry` records.

### 2.1 Update the timeline aggregation in `apps/api/src/routes/assets/timeline.ts`

The current read path queries both `AssetTimelineEntry` and `Entry`, then merges and deduplicates. Change it to:
- Query only `Entry` where `entityType = "asset"` and `entityId = assetId`.
- Remove the `AssetTimelineEntry` query.
- Remove the deduplication logic that filters out legacy entries with matching `sourceId`.
- Preserve the same response shape so the frontend does not need changes.

### 2.2 Update any frontend merge logic

If the asset timeline detail page or components merge legacy + entry data client-side, simplify to use only the Entry response.

### 2.3 Validate the migration script has been run

Add a startup check or migration status endpoint that warns if `AssetTimelineEntry` rows exist without corresponding `Entry` rows. This is a safety net — if the backfill hasn't been run, data would be invisible. Consider logging a warning in the API startup sequence.

---

## Phase 3 — Enable attachments on Entry-backed timeline items

**Goal:** The `AttachmentSection` component works for Entry-backed asset timeline items.

### 3.1 Add `"entry"` to the attachment entity type enum

In `packages/types/src/index.ts`, the attachment entity type schema (around line 3707) lists allowed values. Add `"entry"` if it's not already present.

### 3.2 Update the attachment routes

In `apps/api/src/routes/attachments/index.ts`, ensure the upload, list, and delete endpoints accept `entityType: "entry"` and validate that the referenced Entry exists and belongs to the household.

### 3.3 Render `AttachmentSection` for Entry-backed timeline items

In the asset timeline detail page/component, render `<AttachmentSection entityType="entry" entityId={entry.id} />` for all timeline items, not just legacy ones. Remove the conditional that hides attachments for Entry-sourced items.

---

## Phase 4 — Remove legacy API surface

**Goal:** Delete all legacy `AssetTimelineEntry` code.

### 4.1 Delete the legacy route file

Remove `apps/api/src/routes/assets/timeline-entries.ts` and its registration in the route tree (likely in `apps/api/src/routes/assets/index.ts` or the main app file).

### 4.2 Delete frontend legacy API wrappers

In `apps/web/lib/api.ts`, remove:
- `getAssetTimelineEntries` (line ~1623)
- `getAssetTimelineEntry` (line ~1632)
- `createAssetTimelineEntry` (line ~1636)
- `updateAssetTimelineEntry` (line ~1651)
- `deleteAssetTimelineEntry` (line ~1659)

Remove the corresponding type imports (`CreateAssetTimelineEntryInput`, `UpdateAssetTimelineEntryInput`).

### 4.3 Remove the serializer

Delete `toAssetTimelineEntryResponse` from `apps/api/src/lib/serializers/` and its export from the serializers index.

### 4.4 Remove the Zod schemas from `packages/types`

Delete `createAssetTimelineEntrySchema`, `updateAssetTimelineEntrySchema`, and the `AssetTimelineEntry` response type.

### 4.5 Create a Prisma migration to drop the table

```bash
npx prisma migrate dev --name drop_asset_timeline_entry
```

Remove the `AssetTimelineEntry` model from `schema.prisma`. The migration should `DROP TABLE "AssetTimelineEntry"`.

### 4.6 Clean up the migration script

In `apps/api/src/scripts/migrate-legacy-entries.ts`, remove the `migrateAssetTimelineEntries` function since the source table no longer exists.

---

## Verification checklist

- [ ] All asset timeline creates go through the Entry API
- [ ] All asset timeline updates go through the Entry API
- [ ] All asset timeline deletes go through the Entry API
- [ ] The timeline read page shows the same data as before (no missing entries)
- [ ] Attachments can be uploaded and viewed on Entry-backed timeline items
- [ ] No references to `AssetTimelineEntry`, `createAssetTimelineEntry`, `timeline-entries` remain in the codebase
- [ ] The `AssetTimelineEntry` table has been dropped via migration
- [ ] The search index continues to work for timeline entries (they are now indexed as Entry records)
