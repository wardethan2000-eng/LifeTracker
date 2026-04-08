# Aegis — Project Dashboard / Activity Feed Implementation Specification

This document is the complete implementation reference for the Project Activity Feed feature. It is broken into sequential phases designed to be executed one at a time. Each phase builds on the previous and must be completed before moving to the next.

The Project Activity Feed provides a per-project stream of recent changes: "Jane completed Task X", "Supply Y was procured", "Budget updated". This is especially valuable for multi-member households where you want visibility into what your partner did on the project while you were away.

**Use cases:** Couples coordinating a bathroom remodel ("what did you do on the project today?"), family tracking a deck build across weekends, roommates splitting household improvement work.

---

## Guiding principles

- Build on the existing `ActivityLog` model. The system already records mutations via `logActivity()` after every create/update/delete. This feature surfaces those logs in a user-friendly format per project.
- Activity rendering is a presentation concern. The raw activity log stores `action`, `entityType`, `entityId`, and `metadata`. This feature adds human-readable message generation — a formatter function, not new data.
- The feed is read-only. No new write paths. No new models.
- Pagination via cursor-based scrolling (existing `activityLogQuerySchema` already supports `cursor` and `limit`).
- Real-time updates are out of scope. The feed refreshes on page load and manual refresh. WebSocket/SSE can be added later without schema changes.

---

## Current activity log reference

**Model:** `ActivityLog` with fields: `id`, `householdId`, `userId`, `action` (string), `entityType` (string), `entityId` (string), `metadata` (JSON nullable), `createdAt`.

**Existing actions logged across the codebase (non-exhaustive):**
- `asset.created`, `asset.updated`, `asset.deleted`
- `project.created`, `project.updated`, `project.deleted`
- `project.phase.created`, `project.phase.updated`, `project.phase.deleted`
- `project.task.created`, `project.task.updated`, `project.task.deleted`, `project.task.promoted`
- `project.expense.created`, `project.expense.updated`, `project.expense.deleted`
- `project.note.created`, `project.note.updated`, `project.note.deleted`
- `project.supply.created`, `project.supply.updated`, `project.supply.deleted`
- `project.supply.inventory_allocated`
- `project.inventory.linked`, `project.inventory.updated`, `project.inventory.unlinked`, `project.inventory.allocated`
- `project.budget_category.created`, `project.budget_category.updated`, `project.budget_category.deleted`
- `project.asset.linked`, `project.asset.unlinked`
- `attachment.confirmed`, `attachment.deleted`
- `comment.created`, `comment.updated`, `comment.deleted`

**Existing API:** GET `/v1/households/:householdId/activity` with query params: `entityType`, `entityId`, `userId`, `since`, `limit` (default 50, max 100), `cursor`.

**Existing helper:** `logActivity(prisma, { householdId, userId, action, entityType, entityId, metadata })` in `apps/api/src/lib/activity-log.ts`.

---

## Phase 1 — Project-Scoped Activity Endpoint

**Goal:** Create an endpoint that returns activity logs scoped to a specific project, including activity on all child entities (phases, tasks, expenses, notes, supplies, attachments, comments). Enrich each entry with the actor's display name and a human-readable message.

### 1.1 API route

Add a new route in `apps/api/src/routes/projects/index.ts` (or a new file `apps/api/src/routes/projects/activity.ts`):

```
GET /v1/households/:householdId/projects/:projectId/activity
```

Query parameters (reuse existing `activityLogQuerySchema` shape):
- `limit` — default 30, max 100
- `cursor` — cursor-based pagination (activity log ID)
- `since` — ISO datetime filter
- `userId` — filter to a specific user's actions

**Implementation strategy:**

The challenge is that activity logs use `entityType` + `entityId`, not `projectId`. To scope to a project, the query must find all entity IDs that belong to this project:

1. Fetch the project to confirm access
2. Collect all related entity IDs:
   - `entityType = 'project'` AND `entityId = projectId`
   - `entityType = 'project_phase'` AND `entityId IN (SELECT id FROM ProjectPhase WHERE projectId = ?)`
   - `entityType = 'project_task'` AND `entityId IN (SELECT id FROM ProjectTask WHERE projectId = ?)`
   - `entityType = 'project_expense'` AND `entityId IN (SELECT id FROM ProjectExpense WHERE projectId = ?)`
   - `entityType = 'project_note'` AND `entityId IN (SELECT id FROM ProjectNote WHERE projectId = ?)`
   - `entityType = 'project_phase_supply'` AND `entityId IN (SELECT id FROM ProjectPhaseSupply WHERE phase.projectId = ?)`
   - `entityType = 'project_budget_category'` AND `entityId IN (SELECT id FROM ProjectBudgetCategory WHERE projectId = ?)`
   - `entityType = 'project_asset'` AND `entityId IN (SELECT id FROM ProjectAsset WHERE projectId = ?)`
   - `entityType = 'project_inventory'` AND `entityId IN (SELECT id FROM ProjectInventoryItem WHERE projectId = ?)`
   - `entityType = 'attachment'` with metadata `parentEntityType` matching project entities
   - `entityType = 'comment'` with metadata `parentEntityType` matching project entities

3. Query `ActivityLog` with a compound OR across these conditions, ordered by `createdAt DESC`, with cursor pagination

**Performance optimization:** Use a single Prisma raw query or build the WHERE clause dynamically. For projects with modest entity counts (typical household use), collecting IDs first and using `IN` clauses is performant. Add an index comment noting that for very large projects, a `projectId` column on `ActivityLog` would be the optimization path.

Alternatively, and more simply: query activity logs for this household where:
- (`entityType = 'project'` AND `entityId = projectId`) OR
- `metadata` contains `projectId` (if you add `projectId` to metadata going forward)

The cleanest approach: **add `projectId` to the metadata** of all project-related activity logs going forward (Phase 1.2), and backfill existing logs. Then the query becomes a simple JSON field filter.

### 1.2 Enrich activity log metadata

Update all project-related `logActivity()` calls in `apps/api/src/routes/projects/` to include `projectId` in the metadata:

```typescript
await logActivity(request.server.prisma, {
  householdId,
  userId: request.auth.userId,
  action: "project.task.created",
  entityType: "project_task",
  entityId: task.id,
  metadata: {
    projectId,           // ADD THIS to all project-related logs
    taskTitle: task.title,
    phaseId: task.phaseId,
    // ... existing metadata
  },
});
```

Audit every `logActivity` call in:
- `apps/api/src/routes/projects/index.ts`
- `apps/api/src/routes/projects/phases.ts`
- `apps/api/src/routes/projects/tasks.ts`
- `apps/api/src/routes/projects/expenses.ts`
- `apps/api/src/routes/projects/notes.ts`
- `apps/api/src/routes/projects/inventory.ts`
- `apps/api/src/routes/projects/budget-categories.ts`
- `apps/api/src/routes/projects/assets.ts`
- `apps/api/src/routes/attachments/index.ts` (for project-related attachments)
- `apps/api/src/routes/comments/index.ts` (for project-related comments)

Ensure every call includes `projectId` in metadata when the action is project-related.

### 1.3 Human-readable message formatter

Create `apps/api/src/lib/activity-formatter.ts`:

```typescript
export function formatActivityMessage(log: {
  action: string;
  entityType: string;
  metadata: Record<string, unknown> | null;
  user: { displayName: string };
}): string;
```

Mapping examples:

| action | formatted message |
|--------|-------------------|
| `project.updated` | "{user} updated the project" |
| `project.phase.created` | "{user} added phase \"{phaseName}\"" |
| `project.phase.updated` (status changed) | "{user} marked phase \"{phaseName}\" as {status}" |
| `project.task.created` | "{user} added task \"{taskTitle}\"" |
| `project.task.updated` (status=completed) | "{user} completed task \"{taskTitle}\"" |
| `project.task.promoted` | "{user} promoted \"{taskTitle}\" to a full task" |
| `project.expense.created` | "{user} logged expense \"{description}\" (${amount})" |
| `project.supply.inventory_allocated` | "{user} allocated {qty} {unit} of \"{supplyName}\" from inventory" |
| `project.note.created` | "{user} added a {category} note" |
| `project.asset.linked` | "{user} linked asset \"{assetName}\"" |
| `attachment.confirmed` | "{user} uploaded \"{filename}\"" |
| `comment.created` | "{user} commented" |
| (fallback) | "{user} performed {action}" |

Pull names from metadata fields (`taskTitle`, `phaseName`, `description`, `filename`, etc.) that are already being logged. For any metadata fields not currently logged, add them in Phase 1.2.

### 1.4 Response shape

```typescript
{
  activities: Array<{
    id: string;
    action: string;
    entityType: string;
    entityId: string;
    message: string;              // Human-readable, from formatter
    user: { id: string; displayName: string };
    metadata: Record<string, unknown> | null;
    createdAt: string;            // ISO datetime
  }>;
  nextCursor: string | null;      // ID of last item, null if no more
  hasMore: boolean;
}
```

### 1.5 Zod schemas

Add to `packages/types/src/index.ts`:

```typescript
export const projectActivityItemSchema = z.object({
  id: z.string().cuid(),
  action: z.string(),
  entityType: z.string(),
  entityId: z.string(),
  message: z.string(),
  user: shallowUserSchema,
  metadata: z.record(z.string(), z.unknown()).nullable(),
  createdAt: z.string().datetime(),
});

export const projectActivityFeedSchema = z.object({
  activities: z.array(projectActivityItemSchema),
  nextCursor: z.string().cuid().nullable(),
  hasMore: z.boolean(),
});

export type ProjectActivityItem = z.infer<typeof projectActivityItemSchema>;
export type ProjectActivityFeed = z.infer<typeof projectActivityFeedSchema>;
```

### 1.6 API client

Add to `apps/web/lib/api.ts`:

```typescript
export async function fetchProjectActivity(
  householdId: string,
  projectId: string,
  params?: { limit?: number; cursor?: string; since?: string; userId?: string }
): Promise<ProjectActivityFeed> { ... }
```

### 1.7 Tests

Add `apps/api/test/project-activity.test.ts`:

- Create a project, add phases and tasks, perform various mutations. Verify the activity endpoint returns them in reverse chronological order with correct messages.
- Verify cursor pagination works (fetch 5, use cursor, fetch next 5)
- Verify `userId` filter returns only that user's actions
- Verify `since` filter excludes older entries
- Verify activity from other projects in the same household is excluded

---

## Phase 2 — Activity Feed UI Component

**Goal:** Build the activity feed component and integrate it into the project detail page.

### 2.1 Project detail integration

In the project detail page (`apps/web/app/(dashboard)/projects/[projectId]/page.tsx`), add a new section in the aside column (right side) titled "Recent Activity".

This section shows the most recent 10 activities inline, with a "View all" link that expands to a full feed with infinite scroll.

### 2.2 Activity feed component

Create `apps/web/components/project-activity-feed.tsx`.

**Props:**
```typescript
{
  householdId: string;
  projectId: string;
  initialActivities?: ProjectActivityItem[];  // server-fetched for SSR
  compact?: boolean;                           // true for aside, false for full view
}
```

**Compact mode (aside):**
- Shows last 10 activities
- Each entry: user avatar placeholder (first initial circle) + message + relative time ("2h ago", "yesterday")
- No pagination — just a "View all activity" link at the bottom
- Grouped by day with subtle date separators

**Full mode:**
- Infinite scroll with cursor-based pagination
- User filter dropdown (household members)
- "Since" date picker for filtering
- Each entry: avatar + message + absolute timestamp + entity type icon
- Day-group separators: "Today", "Yesterday", "March 15, 2026"

**Entity type icons (CSS-only, using existing icon patterns or Unicode):**
- Phase: `◆` (diamond)
- Task: `☐` (checkbox)
- Expense: `$`
- Note: `✎` (pencil)
- Supply: `▤` (grid)
- Attachment: `📎` (or use CSS)
- Comment: `💬` (or use CSS)
- Asset: `◈`
- Budget: `⊞`

### 2.3 Relative time helper

Add to `apps/web/lib/formatters.ts`:

```typescript
export function formatRelativeTime(isoDate: string): string {
  // Returns: "just now", "5m ago", "2h ago", "yesterday", "3 days ago", "Mar 15"
  // Use built-in Intl.RelativeTimeFormat where possible
}
```

### 2.4 CSS additions

Add to `apps/web/app/globals.css`:

```css
.activity-feed { ... }
.activity-feed--compact { ... }
.activity-feed__entry { ... }
.activity-feed__avatar { ... }
.activity-feed__message { ... }
.activity-feed__time { ... }
.activity-feed__day-separator { ... }
.activity-feed__icon { ... }
.activity-feed__load-more { ... }
.activity-feed__filters { ... }
.activity-feed__empty { ... }
```

### 2.5 Loading states

- Initial load: skeleton with 5 placeholder rows (pulsing gray bars)
- Load more: small spinner at the bottom of the list
- Empty state: "No activity yet. Changes to this project will appear here."

---

## Phase 3 — Activity Digest & Highlights

**Goal:** Add a daily activity summary at the top of the project detail page and enable digest-style notifications for project activity.

### 3.1 Activity summary endpoint

Add to the project detail response (or as a separate lightweight endpoint):

```
GET /v1/households/:householdId/projects/:projectId/activity-summary
```

Response:

```typescript
{
  today: {
    totalActions: number;
    uniqueUsers: number;
    highlights: string[];       // Top 3 most significant actions as formatted messages
  };
  thisWeek: {
    totalActions: number;
    uniqueUsers: number;
    taskCompletions: number;
    expensesLogged: number;
    totalSpent: number;         // sum of expenses created this week
  };
}
```

**Highlight selection logic:** Prioritize task completions, phase status changes, and large expenses over minor updates. Sort by "significance" (completion > creation > update) and take top 3.

### 3.2 Summary card

Create `apps/web/components/project-activity-summary.tsx`.

Display at the top of the project detail page (after the project header, before phases):

```
┌──────────────────────────────────────────────────┐
│ Today: 5 updates by Jane and Bob                  │
│ • Jane completed "Install backsplash tile"        │
│ • Bob logged $340 expense for countertop material │
│ • Jane uploaded 3 photos to Tiling phase          │
│                                                    │
│ This week: 12 tasks completed, $1,240 spent       │
└──────────────────────────────────────────────────┘
```

Only show this card if there is activity today or this week. Hide it for inactive projects.

### 3.3 Project activity in household dashboard

On the main dashboard page, add a "Recent project activity" section showing the latest 5 activities across all active projects, with project name badges. This gives a household-wide view of who is doing what.

Reuse the existing household activity endpoint with `entityType` filtering, or add a lightweight query.

---

## Data model summary

No new database models. This feature is a read-path enhancement over the existing `ActivityLog` model.

**Changes to existing code:**
- Add `projectId` to metadata in all project-related `logActivity()` calls
- Add entity name fields to metadata where not already present (for formatted messages)

**New code:**
- Project activity aggregation endpoint
- Activity message formatter
- Activity feed UI component (compact + full modes)
- Activity summary endpoint and card
- Relative time formatter

```
Existing:
  ActivityLog (action, entityType, entityId, metadata, userId, createdAt)
    ├─ action: "project.task.completed" (human action identifier)
    ├─ metadata: { projectId, taskTitle, phaseId, ... } (enriched context)
    └─ userId → User.displayName (for avatar + attribution)

New read paths:
  GET /projects/:projectId/activity          → paginated, formatted feed
  GET /projects/:projectId/activity-summary  → daily/weekly highlights
```
