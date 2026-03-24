# LifeKeeper — Migrate Project Notes to the Unified Entry System

This document is the complete implementation reference for retiring the legacy `ProjectNote` CRUD surface and making the unified `Entry` system the sole write and read path for project notes. It is broken into sequential phases designed to be executed one at a time.

The `ProjectNote` model has a dedicated table, API routes, and frontend calls. Much of the migration is already in progress: `createProjectNoteAction` already writes to `Entry`, and the notes page already merges legacy + Entry data. This spec closes the remaining gaps: edit flows for legacy notes, attachment management, removing the legacy read path, and deleting the old surface.

**Key files to understand before starting:**
- `apps/api/src/routes/projects/notes.ts` — legacy CRUD routes (to be deleted)
- `apps/api/src/routes/entries/index.ts` — unified Entry CRUD (the target)
- `apps/web/app/actions.ts` — server actions (`createProjectNoteAction` at line 2817, `updateProjectNoteAction` at line 2855, `deleteProjectNoteAction` at line 2902, `toggleProjectNotePinAction` at line 2917)
- `apps/web/app/(dashboard)/projects/[projectId]/notes/page.tsx` — notes page with merge logic
- `apps/web/components/note-create-form.tsx` — note creation form
- `apps/web/lib/api.ts` — frontend API client (legacy `getProjectNotes` + `createProjectNote` etc.)
- `packages/utils/src/index.ts` — `buildProjectEntryDetails`, `parseProjectEntryPayload`

---

## Current state

### What already works
- `createProjectNoteAction` (line 2817) **already writes exclusively to `Entry`** via `createEntry`. It uses `buildProjectEntryDetails` to map category, URL, and pin state to Entry tags/flags.
- `updateProjectNoteAction` (line 2855) branches on `sourceSystem`: entry-backed notes use `updateEntry`, legacy notes use `updateProjectNote`.
- `deleteProjectNoteAction` (line 2902) branches on `sourceSystem`: entry-backed notes use `deleteEntry`, legacy notes use `deleteProjectNote`.
- `toggleProjectNotePinAction` (line 2917) branches on `sourceSystem`: entry-backed notes toggle the `"pinned"` flag, legacy notes toggle `isPinned`.
- The notes page (`notes/page.tsx`) fetches both `getProjectNotes` (legacy) and `getEntries` (unified), merges them, deduplicates by checking `sourceId` against legacy IDs, and renders a unified list.
- The migration script backfills `ProjectNote` rows as `Entry` rows with `sourceType: "project_note"`.

### What still needs to happen
1. Remove the legacy branch from `updateProjectNoteAction` — all updates should go through `updateEntry`.
2. Remove the legacy branch from `deleteProjectNoteAction` and `toggleProjectNotePinAction`.
3. The notes page must stop fetching from `getProjectNotes` and read exclusively from `getEntries`.
4. Remove the merge/dedup logic from the notes page.
5. Entry-backed notes have `canManageAttachments: false` (line 139 of notes page) — this must become `true` so users can upload attachments to Entry-backed notes.
6. Frontend API wrappers for legacy routes (`getProjectNotes`, `createProjectNote`, `updateProjectNote`, `deleteProjectNote`) need to be deleted.
7. The legacy route file and Prisma model should be removed.

---

## Phase 1 — Remove legacy branches from server actions

**Goal:** All project note write operations go exclusively through the Entry API.

### 1.1 Update `updateProjectNoteAction`

In `apps/web/app/actions.ts` (line 2855):
- Remove the `sourceSystem` check.
- Remove the `else` branch that calls `updateProjectNote`.
- Always use the Entry path: call `buildProjectEntryDetails` and `updateEntry`.
- Every form that calls this action must pass the Entry ID (not the legacy `ProjectNote` ID). Since migrated entries store the legacy ID in `sourceId`, the forms should already be passing the Entry `id` for entry-backed items. For any remaining legacy notes that haven't been migrated, the migration script must be run first.

### 1.2 Update `deleteProjectNoteAction`

In `apps/web/app/actions.ts` (line 2902):
- Remove the `sourceSystem` check.
- Remove the legacy `deleteProjectNote` branch.
- Always call `deleteEntry`.

### 1.3 Update `toggleProjectNotePinAction`

In `apps/web/app/actions.ts` (line 2917):
- Remove the `sourceSystem` check.
- Remove the legacy `updateProjectNote` branch.
- Always call `updateEntry` with the `flags` array (add/remove `"pinned"`).

### 1.4 Remove `sourceSystem` hidden inputs from forms

In `notes/page.tsx`, the forms pass `<input type="hidden" name="sourceSystem" value={note.sourceSystem} />`. Remove these since the actions no longer branch on `sourceSystem`.

---

## Phase 2 — Switch the notes read path to Entry-only

**Goal:** The project notes page reads exclusively from `Entry` records.

### 2.1 Update `ProjectNotesPanelAsync` in `notes/page.tsx`

The current component (line 74) calls both `getProjectNotes` and `getEntries` in `Promise.all`, then merges and deduplicates. Change it to:
- Remove the `getProjectNotes` call.
- Fetch only from `getEntries` with `entityType: "project"` and `entityType: "project_phase"`.
- Remove the `migratedLegacyProjectNoteIds` deduplication logic (lines 143–149).
- Remove the `legacyCards` mapping (lines 151–165).
- Remove the merge in `mergedNotes` (line 167) — just use `entryCards` directly.
- Remove the `importedCount` / `legacyCount` UI banners (lines 194–199).
- Remove the `sourceSystem` distinction from the `ProjectNoteCard` type.

### 2.2 Update `parseProjectEntryPayload` usage

The `entryCards` mapping (line 114) uses `parseProjectEntryPayload` to extract category, URL, and pinned state from Entry tags/flags. This should continue working as-is — no changes needed to the parser.

### 2.3 Enable `canManageAttachments` for Entry-backed notes

Change line 139 from `canManageAttachments: false` to `canManageAttachments: true`. Then update the `AttachmentSection` rendering (line 259) to use `entityType: "entry"` instead of `entityType: "project_note"`.

If the attachment system doesn't yet support `entityType: "entry"`, see Phase 3.

---

## Phase 3 — Enable attachments on Entry-backed notes

**Goal:** The `AttachmentSection` component works for Entry-backed project notes.

### 3.1 Add `"entry"` to the attachment entity type enum

In `packages/types/src/index.ts`, the attachment entity type schema (around line 3707) lists allowed values. Add `"entry"` if it's not already present.

### 3.2 Update the attachment routes

In `apps/api/src/routes/attachments/index.ts`, ensure upload, list, and delete endpoints accept `entityType: "entry"` and validate that the referenced Entry exists and belongs to the household.

### 3.3 Test attachment upload and retrieval

Verify that:
- Uploading an attachment with `entityType: "entry"` and `entityId: <entryId>` succeeds.
- Listing attachments for an Entry returns the uploaded files.
- Deleting an attachment works.

---

## Phase 4 — Remove legacy API surface

**Goal:** Delete all legacy `ProjectNote` code.

### 4.1 Delete the legacy route file

Remove `apps/api/src/routes/projects/notes.ts` and its registration in the route tree.

### 4.2 Delete frontend legacy API wrappers

In `apps/web/lib/api.ts`, remove:
- `getProjectNotes` / `getProjectNotesCached` (line ~3486/1136)
- `createProjectNote` (line ~3514)
- `updateProjectNote`
- `deleteProjectNote`

Remove the corresponding type imports (`CreateProjectNoteInput`, `UpdateProjectNoteInput`).

### 4.3 Remove the serializer

Delete `toProjectNoteResponse` from `apps/api/src/lib/serializers/` and its export from the serializers index.

### 4.4 Remove the Zod schemas from `packages/types`

Delete `createProjectNoteSchema`, `updateProjectNoteSchema`, and the `ProjectNote` response type.

### 4.5 Create a Prisma migration to drop the table

```bash
npx prisma migrate dev --name drop_project_note
```

Remove the `ProjectNote` model from `schema.prisma`. The migration should `DROP TABLE "ProjectNote"`.

### 4.6 Clean up the migration script

In `apps/api/src/scripts/migrate-legacy-entries.ts`, remove the `migrateProjectNotes` function since the source table no longer exists.

### 4.7 Remove `NoteCategory` enum if unused

Check whether the `NoteCategory` Prisma enum is used by any other model. If `ProjectNote` was the only consumer, drop the enum in the migration.

---

## Verification checklist

- [ ] New project notes are created as Entry records
- [ ] Editing a project note updates the Entry record
- [ ] Deleting a project note deletes the Entry record
- [ ] Pinning/unpinning toggles the `"pinned"` flag on the Entry
- [ ] The notes page shows the same data as before (no missing notes)
- [ ] Attachments can be uploaded, viewed, and deleted on Entry-backed notes
- [ ] No references to `ProjectNote`, `createProjectNote`, `getProjectNotes`, `project_note` entity type (in attachments) remain in the codebase
- [ ] The `ProjectNote` table has been dropped via migration
- [ ] Phase-linked notes still appear correctly (entityType `"project_phase"` with the phase's ID)
- [ ] The rich text editor works for Entry-backed note editing
