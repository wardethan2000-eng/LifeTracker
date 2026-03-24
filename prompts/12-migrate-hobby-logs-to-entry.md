# LifeKeeper — Migrate Hobby Logs to the Unified Entry System

This document is the complete implementation reference for retiring the legacy `HobbyLog` model and making the unified `Entry` system the sole source for hobby log data. It is broken into sequential phases designed to be executed one at a time.

Unlike the other two legacy surfaces (Asset Timeline Entries and Project Notes), the HobbyLog system is simpler: it has no dedicated API routes — logs are embedded in hobby session detail responses. The frontend already uses the Entry system for hobby entries (the hobby entries page reads from `getEntries`). The remaining gaps are: the session detail endpoint still includes legacy `HobbyLog` rows, the household JSON export reads from `HobbyLog` directly, and the Prisma model/table still exists.

**Key files to understand before starting:**
- `apps/api/prisma/schema.prisma` — `HobbyLog` model (lines 2274–2289)
- `apps/api/src/routes/hobbies/sessions.ts` — session detail includes `session.logs`
- `apps/api/src/routes/exports/index.ts` — household JSON export includes `hobbyLogs`
- `apps/api/src/scripts/migrate-legacy-entries.ts` — `migrateHobbyLogs` function
- `packages/types/src/index.ts` — `hobbyLogSchema`, `createHobbyLogInputSchema`, `hobbySessionDetailSchema` (includes `logs` field)
- `packages/utils/src/index.ts` — `mapHobbyLogTypeToEntryType`, `buildHobbyLogEntryTags`, `LEGACY_ENTRY_SOURCE_TYPES`

---

## Current state

### What already works
- The hobby entries page (`/hobbies/[hobbyId]/entries/`) reads exclusively from `getEntries` — it does **not** fetch `HobbyLog` records.
- The migration script converts `HobbyLog` rows to `Entry` rows with `sourceType: "hobby_log"` and `entityType: "hobby"` or `"hobby_session"`.
- All new hobby log writes appear to go through the Entry system (no `createHobbyLog` calls found in the frontend).

### What still needs to happen
1. The session detail endpoint (`sessions.ts`) returns `logs: HobbyLog[]` from the legacy table. It should return Entry records instead.
2. The household JSON export (`exports/index.ts`) reads `hobbyLogs` from the legacy table. It should read from `Entry` with `sourceType: "hobby_log"` or `entityType` in `["hobby", "hobby_session"]`.
3. The `hobbySessionDetailSchema` in `packages/types` includes a `logs` field typed as `hobbyLogSchema[]`. This needs to return Entry-shaped data or be restructured.
4. The `HobbyLog` Prisma model and table should be removed.
5. Type definitions (`hobbyLogSchema`, `createHobbyLogInputSchema`, `updateHobbyLogInputSchema`) should be cleaned up.

---

## Phase 1 — Replace session detail logs with Entry data

**Goal:** The hobby session detail endpoint returns entries from the `Entry` table instead of `HobbyLog` rows.

### 1.1 Update the session detail endpoint

In `apps/api/src/routes/hobbies/sessions.ts`, find the session detail route. Currently it includes `logs` from the `HobbyLog` relation. Change it to:

1. Remove the `logs` include from the Prisma query on `HobbySession`.
2. After fetching the session, query `Entry` where `entityType = "hobby_session"` and `entityId = session.id`.
3. Map the Entry records to the expected response shape.

**Option A — Preserve the `logs` response field (backward compatible):**
```typescript
const entries = await app.prisma.entry.findMany({
  where: {
    entityType: "hobby_session",
    entityId: session.id
  },
  orderBy: { entryDate: "desc" }
});

// Map to legacy-compatible shape
const logs = entries.map((entry) => ({
  id: entry.id,
  hobbyId: hobbyId,
  sessionId: session.id,
  title: entry.title,
  content: entry.body,
  logDate: entry.entryDate.toISOString(),
  logType: mapEntryTypeToHobbyLogType(entry.entryType),
  createdAt: entry.createdAt.toISOString(),
  updatedAt: entry.updatedAt.toISOString(),
}));
```

**Option B — Return entries directly (cleaner, requires frontend update):**
Replace the `logs` field with an `entries` field containing full Entry response objects. Update the frontend type and any components that render session logs.

Choose Option A if minimizing frontend changes; choose Option B if you want a clean break.

### 1.2 Add `mapEntryTypeToHobbyLogType` utility (if using Option A)

In `packages/utils/src/index.ts`, add the reverse mapping:
```typescript
export const mapEntryTypeToHobbyLogType = (entryType: string): "note" | "tasting" | "progress" | "issue" => {
  switch (entryType) {
    case "lesson": return "tasting";
    case "milestone": return "progress";
    default: return "note";
  }
};
```

Or adjust the mapping based on how `buildHobbyLogEntryTags` encodes the original `logType` in tags.

### 1.3 Update the `HobbySessionDetail` type

In `packages/types/src/index.ts`, update `hobbySessionDetailSchema`:
- **Option A:** Keep the `logs` field shape as-is (the mapped data will match).
- **Option B:** Replace `logs: z.array(hobbyLogSchema)` with `entries: z.array(entrySchema)`.

---

## Phase 2 — Update the household JSON export

**Goal:** The JSON export reads hobby log data from Entry instead of HobbyLog.

### 2.1 Update the export endpoint

In `apps/api/src/routes/exports/index.ts` (around line 1777):
- Remove the query to `prisma.hobbyLog.findMany(...)`.
- Instead, query `prisma.entry.findMany({ where: { householdId, entityType: { in: ["hobby", "hobby_session"] } } })`.
- Map the results to the export format.

### 2.2 Preserve export shape for backward compatibility

If external tools or users depend on the export JSON structure having a `hobbyLogs` key, map Entry records to the same shape:
```typescript
hobbyLogs: hobbyEntries.map((entry) => ({
  id: entry.sourceId ?? entry.id,
  hobbyId: entry.entityId, // or resolve from entity
  sessionId: entry.entityType === "hobby_session" ? entry.entityId : null,
  title: entry.title,
  content: entry.body,
  logDate: entry.entryDate.toISOString(),
  logType: mapEntryTypeToHobbyLogType(entry.entryType),
  createdAt: entry.createdAt.toISOString(),
  updatedAt: entry.updatedAt.toISOString(),
}))
```

Alternatively, if this is an internal-only export, rename the key to `hobbyEntries` and use the Entry shape directly.

---

## Phase 3 — Remove legacy HobbyLog surface

**Goal:** Delete all `HobbyLog` code and the database table.

### 3.1 Remove the Prisma model

In `apps/api/prisma/schema.prisma`:
- Delete the `HobbyLog` model (lines 2274–2289).
- Remove the `logs HobbyLog[]` relation from the `Hobby` model.
- Remove the `logs HobbyLog[]` relation from the `HobbySession` model (if present).

### 3.2 Create a Prisma migration to drop the table

```bash
npx prisma migrate dev --name drop_hobby_log
```

The migration should `DROP TABLE "HobbyLog"`. Also drop the `HobbyLogType` enum if no other model uses it.

### 3.3 Remove type definitions from `packages/types`

Delete:
- `hobbyLogSchema` and `HobbyLog` type
- `createHobbyLogInputSchema` and `CreateHobbyLogInput` type
- `updateHobbyLogInputSchema` and `UpdateHobbyLogInput` type
- `hobbyLogTypeSchema` and `HobbyLogType` type
- Remove `logs` from `hobbySessionDetailSchema` (or replace with `entries`)

### 3.4 Clean up the migration script

In `apps/api/src/scripts/migrate-legacy-entries.ts`, remove the `migrateHobbyLogs` function since the source table no longer exists.

### 3.5 Remove utility functions if unused

In `packages/utils/src/index.ts`, check if `mapHobbyLogTypeToEntryType` and `buildHobbyLogEntryTags` are still referenced. If they were only used by the migration script, delete them. If they are used by the session detail endpoint (Option A from Phase 1), keep them.

### 3.6 Search for stale references

Search the entire codebase for `HobbyLog`, `hobbyLog`, `hobby_log`, `hobbyLogs` and remove or update any remaining references.

---

## Verification checklist

- [ ] Hobby session detail endpoint returns log/entry data from the Entry table
- [ ] Household JSON export includes hobby entry data (no missing logs)
- [ ] The hobby entries page continues to work (it already reads from Entry)
- [ ] No references to `HobbyLog`, `hobbyLog`, `hobby_log` remain in the codebase
- [ ] The `HobbyLog` table has been dropped via migration
- [ ] The `HobbyLogType` enum has been dropped (if unused elsewhere)
- [ ] Existing hobby sessions with logs still show their historical data (backfilled as Entry records)
