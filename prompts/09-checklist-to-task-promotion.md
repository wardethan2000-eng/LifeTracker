# LifeKeeper — Checklist-to-Task Promotion at Phase Level Implementation Specification

This document is the complete implementation reference for the Phase Checklist-to-Task Promotion feature. This is a single-phase implementation — the scope is small and self-contained.

Phase checklists are currently simple: a title and a completed boolean. This feature allows promoting a phase checklist item to a full project task — with assignee, due date, estimated cost, and all other task fields. This mirrors the existing quick-todo-to-full-task promotion pattern but operates at the phase checklist level, letting people start with a rough plan and progressively refine it as the project evolves.

**Use cases:** User creates a rough phase checklist ("buy paint", "tape edges", "paint first coat", "paint second coat", "clean up"), then later promotes "paint first coat" to a full task with an assignee, due date, and cost estimate. The checklist item is replaced by the task — no duplication.

---

## Guiding principles

- Follow the existing promotion pattern. `ProjectTask` already has a `POST .../tasks/:taskId/promote` endpoint that converts a quick todo to a full task. This feature uses the same concept for phase checklist items.
- Promotion is a create-and-delete: create a new `ProjectTask` from the checklist item's title and completion state, then delete the checklist item. This is an atomic operation.
- The new task inherits the checklist item's `title` and `isCompleted` state. All other fields (assignee, due date, cost, description) come from the promotion request body.
- The new task is automatically associated with the phase (`phaseId` is set).
- Activity logging captures the promotion for the project activity feed.

---

## Current system reference

**ProjectPhaseChecklistItem model:**
- Fields: `id`, `phaseId`, `title`, `isCompleted`, `completedAt`, `sortOrder`, `createdAt`, `updatedAt`
- Relations: `phase: ProjectPhase`
- Simple model — no assignee, no dates, no cost, no description

**ProjectTask model:**
- Fields: `id`, `projectId`, `phaseId` (nullable), `title`, `description`, `status`, `taskType` ("quick" | "full"), `isCompleted`, `assignedToId`, `dueDate`, `completedAt`, `estimatedCost`, `actualCost`, `sortOrder`, `scheduleId`, `createdAt`, `updatedAt`
- Relations: `project`, `phase`, `assignedTo`, `schedule`, `checklistItems`
- Rich model with full planning fields

**Existing task promotion endpoint:**
- `POST /v1/households/:householdId/projects/:projectId/tasks/:taskId/promote`
- Converts a quick todo (`taskType: "quick"`) to a full task (`taskType: "full"`)
- Accepts: `status`, `assignedToId`, `dueDate`, `estimatedCost`
- This is task-to-task promotion (changes type). Our feature is checklist-item-to-task promotion (creates new entity, deletes old one).

**Phase checklist endpoints:**
- `POST .../phases/:phaseId/checklist` — create item
- `PATCH .../phases/:phaseId/checklist/:checklistItemId` — update (title, isCompleted, sortOrder)
- `DELETE .../phases/:phaseId/checklist/:checklistItemId` — delete item

**Phase detail response** includes both `checklistItems: ProjectPhaseChecklistItem[]` and `tasks: ProjectTask[]`.

---

## Implementation

### 1. API endpoint

Add a new route in `apps/api/src/routes/projects/phases.ts`:

```
POST /v1/households/:householdId/projects/:projectId/phases/:phaseId/checklist/:checklistItemId/promote
```

**Request body** (all optional — the title comes from the checklist item):

```typescript
{
  description?: string;          // max 2000 chars
  status?: "pending" | "in_progress" | "completed" | "skipped";  // default: maps from isCompleted
  assignedToId?: string;         // cuid, nullable
  dueDate?: string;              // ISO datetime
  estimatedCost?: number;        // min 0
  sortOrder?: number;            // integer, nullable
}
```

**Handler logic:**

```typescript
async function promoteChecklistItem(request, reply) {
  const { householdId, projectId, phaseId, checklistItemId } = request.params;
  const body = promotePhaseChecklistItemSchema.parse(request.body);

  // 1. Verify household membership
  // 2. Verify project belongs to household
  // 3. Fetch the checklist item (404 if not found or wrong phase)
  const checklistItem = await prisma.projectPhaseChecklistItem.findFirst({
    where: { id: checklistItemId, phaseId },
  });
  if (!checklistItem) return reply.code(404).send({ message: "Checklist item not found" });

  // 4. Atomic transaction: create task + delete checklist item
  const result = await prisma.$transaction(async (tx) => {
    // Create the task
    const task = await tx.projectTask.create({
      data: {
        projectId,
        phaseId,
        title: checklistItem.title,
        description: body.description ?? null,
        taskType: "full",
        status: body.status ?? (checklistItem.isCompleted ? "completed" : "pending"),
        isCompleted: checklistItem.isCompleted,
        completedAt: checklistItem.isCompleted ? (checklistItem.completedAt ?? new Date()) : null,
        assignedToId: body.assignedToId ?? null,
        dueDate: body.dueDate ? new Date(body.dueDate) : null,
        estimatedCost: body.estimatedCost ?? null,
        sortOrder: body.sortOrder ?? checklistItem.sortOrder,
      },
      include: {
        assignedTo: { select: { id: true, displayName: true } },
        checklistItems: { orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }] },
      },
    });

    // Delete the checklist item
    await tx.projectPhaseChecklistItem.delete({
      where: { id: checklistItemId },
    });

    return task;
  });

  // 5. Log activity
  await logActivity(request.server.prisma, {
    householdId,
    userId: request.auth.userId,
    action: "project.phase.checklist_item.promoted",
    entityType: "project_task",
    entityId: result.id,
    metadata: {
      projectId,
      phaseId,
      originalChecklistItemId: checklistItemId,
      taskTitle: result.title,
      phaseName: undefined, // fetch if needed, or skip
    },
  });

  // 6. Sync search index for the new task
  await syncToSearchIndex(request.server.prisma, {
    householdId,
    entityType: "project_task",
    entityId: result.id,
    title: result.title,
    body: result.description,
  });

  return reply.code(201).send(toProjectTaskResponse(result));
}
```

### 2. Zod schemas

Add to `packages/types/src/index.ts`:

```typescript
export const promotePhaseChecklistItemSchema = z.object({
  description: z.string().max(2000).optional(),
  status: z.enum(projectTaskStatusValues).optional(),
  assignedToId: z.string().cuid().nullable().optional(),
  dueDate: z.string().datetime().nullable().optional(),
  estimatedCost: z.number().min(0).nullable().optional(),
  sortOrder: z.number().int().nullable().optional(),
});
export type PromotePhaseChecklistItemInput = z.infer<typeof promotePhaseChecklistItemSchema>;
```

### 3. API client

Add to `apps/web/lib/api.ts`:

```typescript
export async function promotePhaseChecklistItem(
  householdId: string,
  projectId: string,
  phaseId: string,
  checklistItemId: string,
  input: PromotePhaseChecklistItemInput
): Promise<ProjectTask> {
  return apiFetch(
    `/v1/households/${householdId}/projects/${projectId}/phases/${phaseId}/checklist/${checklistItemId}/promote`,
    {
      method: "POST",
      body: JSON.stringify(input),
    },
    projectTaskSchema
  );
}
```

### 4. Server action

Add to `apps/web/app/actions.ts`:

```typescript
export async function promotePhaseChecklistItemAction(formData: FormData): Promise<void> {
  const householdId = getString(formData, "householdId");
  const projectId = getString(formData, "projectId");
  const phaseId = getString(formData, "phaseId");
  const checklistItemId = getString(formData, "checklistItemId");

  const input: PromotePhaseChecklistItemInput = {};

  const description = getOptionalString(formData, "description");
  if (description) input.description = description;

  const status = getOptionalString(formData, "status");
  if (status) input.status = status as ProjectTaskStatus;

  const assignedToId = getOptionalString(formData, "assignedToId");
  if (assignedToId) input.assignedToId = assignedToId;

  const dueDate = getOptionalString(formData, "dueDate");
  if (dueDate) input.dueDate = new Date(dueDate).toISOString();

  const estimatedCost = getOptionalString(formData, "estimatedCost");
  if (estimatedCost) input.estimatedCost = parseFloat(estimatedCost);

  await promotePhaseChecklistItem(householdId, projectId, phaseId, checklistItemId, input);
  revalidateProjectPaths(householdId, projectId);
}
```

### 5. UI changes

#### 5.1 Promote button on checklist items

Modify `apps/web/components/project-checklist.tsx` to accept an optional `promoteAction` prop:

```typescript
interface ProjectChecklistProps {
  // ... existing props
  promoteAction?: (formData: FormData) => Promise<void>;
  householdMembers?: HouseholdMember[];  // for assignee dropdown in promote form
}
```

For each checklist item, add a small "Promote to task" button (↑ icon or text link) next to the delete button. This button is only shown when `promoteAction` is provided.

#### 5.2 Promote confirmation form

When the user clicks "Promote to task", show an inline expandable form (below the checklist item, pushing content down — following the ExpandableCard pattern):

```
┌─────────────────────────────────────────────────────┐
│ Promote "Paint first coat" to task                   │
│                                                       │
│ Assignee:       [dropdown: household members]         │
│ Due date:       [date input]                          │
│ Estimated cost: [number input]                        │
│ Description:    [textarea]                            │
│                                                       │
│ [Promote]  [Cancel]                                   │
└─────────────────────────────────────────────────────┘
```

The title is pre-filled from the checklist item and is not editable in this form (it can be edited after promotion via the task edit UI).

If the checklist item was already completed (`isCompleted: true`), the status defaults to "completed". Otherwise it defaults to "pending".

Create `apps/web/components/checklist-promote-form.tsx`:

```typescript
interface ChecklistPromoteFormProps {
  checklistItemId: string;
  checklistItemTitle: string;
  isCompleted: boolean;
  householdId: string;
  projectId: string;
  phaseId: string;
  householdMembers: HouseholdMember[];
  promoteAction: (formData: FormData) => Promise<void>;
  onCancel: () => void;
}
```

This is a `"use client"` component with local state for the expandable form.

#### 5.3 Wire into phase detail

In `apps/web/components/project-phase-detail.tsx`, pass the `promoteAction` and `householdMembers` props to the `ProjectChecklist` component rendered for phase checklist items:

```typescript
<ProjectChecklist
  items={phase.checklistItems}
  householdId={householdId}
  projectId={projectId}
  parentFieldName="phaseId"
  parentId={phase.id}
  addAction={createPhaseChecklistItemAction}
  toggleAction={updatePhaseChecklistItemAction}
  deleteAction={deletePhaseChecklistItemAction}
  promoteAction={promotePhaseChecklistItemAction}     // NEW
  householdMembers={householdMembers}                  // NEW
  addPlaceholder="Add checklist item..."
  emptyMessage="No checklist items yet."
/>
```

#### 5.4 CSS additions

```css
.checklist-promote-btn { ... }         /* small icon/text button */
.checklist-promote-form { ... }        /* inline expandable form */
.checklist-promote-form__field { ... } /* form field rows */
.checklist-promote-form__actions { ... } /* promote/cancel buttons */
```

Style the promote button to be subtle (muted text, small font) so it doesn't clutter the checklist visually. It should be discoverable but not prominent.

### 6. Tests

Add tests to `apps/api/test/project-phases.test.ts` (or a new file `apps/api/test/checklist-promote.test.ts`):

**Happy path:**
- Create a phase with 3 checklist items. Promote the second one. Verify:
  - A new task exists with the correct title, phaseId, taskType="full"
  - The checklist item is deleted
  - The other two checklist items are unaffected
  - The phase detail response shows 2 checklist items and 1 new task

**Completion state transfer:**
- Promote a completed checklist item (isCompleted=true, completedAt set). Verify the new task has `status: "completed"`, `isCompleted: true`, and `completedAt` set.
- Promote an incomplete checklist item. Verify the new task has `status: "pending"`, `isCompleted: false`.

**With optional fields:**
- Promote with assignee, due date, estimated cost, description. Verify all fields transfer to the new task.
- Promote with no optional fields. Verify defaults are applied.

**Status override:**
- Promote a completed checklist item but pass `status: "in_progress"`. Verify the task gets `status: "in_progress"` (explicit override wins).

**Error cases:**
- Promote a non-existent checklist item → 404
- Promote a checklist item from a different phase → 404
- Promote with invalid assignedToId → 400

**Activity logging:**
- Verify an activity log entry with action `project.phase.checklist_item.promoted` is created after promotion.

---

## Data model summary

No new database models. This feature creates a bridge between two existing models.

```
Before promotion:
  ProjectPhase
    └─ checklistItems: [{ id: "abc", title: "Paint first coat", isCompleted: false }]

After promotion:
  ProjectPhase
    ├─ checklistItems: []  (item deleted)
    └─ tasks: [{ id: "xyz", title: "Paint first coat", taskType: "full",
                 status: "pending", phaseId: phase.id, assignedToId: "...",
                 dueDate: "...", estimatedCost: 50 }]

Flow:
  ProjectPhaseChecklistItem → [promote endpoint] → ProjectTask (with phaseId set)
                             → delete checklist item
                             → log activity
                             → sync search index
```

**Files to modify:**
- `apps/api/src/routes/projects/phases.ts` — add promote endpoint
- `packages/types/src/index.ts` — add promote input schema
- `apps/web/lib/api.ts` — add API client method
- `apps/web/app/actions.ts` — add server action
- `apps/web/components/project-checklist.tsx` — add promote button and form integration
- `apps/web/components/project-phase-detail.tsx` — pass promote props

**New files:**
- `apps/web/components/checklist-promote-form.tsx` — inline promotion form
