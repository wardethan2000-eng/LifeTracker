# Aegis — Project Timeline / Gantt View Implementation Specification

This document is the complete implementation reference for the Project Timeline / Gantt View feature. It is broken into sequential phases designed to be executed one at a time. Each phase builds on the previous and must be completed before moving to the next.

The Project Timeline transforms the project planning experience from a flat checklist into a visual scheduling tool. Phases already have `startDate` and `targetEndDate` fields — this feature renders them on an interactive timeline, adds task-level dependencies, and surfaces the critical path so users can see which work items control the overall project schedule.

**Use cases:** Kitchen remodel with sequential trades (demo → plumbing → electrical → drywall → paint), boat restoration with parallel workstreams (hull and engine work simultaneously), seasonal home maintenance with weather-dependent phases.

---

## Guiding principles

- All changes are additive and non-breaking. The existing phase list / expandable card UI remains the default view. The timeline is an alternative visualization toggled by the user.
- Phase dates drive the timeline. Phases without dates appear in an "unscheduled" sidebar so they are never hidden from the user.
- Task dependencies are optional. A project works fine with zero dependencies — they are a progressive refinement for users who want scheduling precision.
- The critical path is computed on the server and returned as metadata, not computed on the client. This keeps the frontend thin and allows future notification integration ("your critical path task is overdue").
- No external Gantt library. Use native HTML/CSS with a thin canvas or SVG overlay for dependency arrows. This keeps the bundle small and the styling consistent with the existing design system.

---

## Phase 1 — Task Dependency Schema

**Goal:** Add a `ProjectTaskDependency` model that tracks finish-to-start and start-to-start relationships between tasks within the same project. Add API endpoints for CRUD on dependencies. No UI yet.

### 1.1 Prisma schema changes

Open `apps/api/prisma/schema.prisma`.

Add a new model after the existing `ProjectTaskChecklistItem` model:

```prisma
model ProjectTaskDependency {
  id               String   @id @default(cuid())
  projectId        String
  predecessorId    String
  successorId      String
  dependencyType   String   @default("finish_to_start")  // "finish_to_start" | "start_to_start"
  lagDays          Int      @default(0)                   // delay in days after predecessor condition is met
  createdAt        DateTime @default(now())
  updatedAt        DateTime @updatedAt

  project          Project      @relation(fields: [projectId], references: [id], onDelete: Cascade)
  predecessor      ProjectTask  @relation("PredecessorDeps", fields: [predecessorId], references: [id], onDelete: Cascade)
  successor        ProjectTask  @relation("SuccessorDeps", fields: [successorId], references: [id], onDelete: Cascade)

  @@unique([predecessorId, successorId])
  @@index([projectId])
  @@index([predecessorId])
  @@index([successorId])
}
```

Update the `ProjectTask` model to add the reverse relations:

```prisma
predecessorOf  ProjectTaskDependency[] @relation("PredecessorDeps")
successorOf    ProjectTaskDependency[] @relation("SuccessorDeps")
```

Update the `Project` model to add the relation:

```prisma
taskDependencies ProjectTaskDependency[]
```

Run `pnpm db:generate` then `pnpm db:migrate --name add_task_dependencies`.

### 1.2 Zod schema and type updates

Open `packages/types/src/index.ts`.

Add dependency type enum and schemas:

```typescript
export const taskDependencyTypeValues = ["finish_to_start", "start_to_start"] as const;
export const taskDependencyTypeSchema = z.enum(taskDependencyTypeValues);
export type TaskDependencyType = z.infer<typeof taskDependencyTypeSchema>;

export const projectTaskDependencySchema = z.object({
  id: z.string().cuid(),
  projectId: z.string().cuid(),
  predecessorId: z.string().cuid(),
  successorId: z.string().cuid(),
  dependencyType: taskDependencyTypeSchema,
  lagDays: z.number().int(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type ProjectTaskDependency = z.infer<typeof projectTaskDependencySchema>;

export const createProjectTaskDependencySchema = z.object({
  predecessorId: z.string().cuid(),
  successorId: z.string().cuid(),
  dependencyType: taskDependencyTypeSchema.default("finish_to_start"),
  lagDays: z.number().int().min(0).max(365).default(0),
});
export type CreateProjectTaskDependencyInput = z.infer<typeof createProjectTaskDependencySchema>;

export const updateProjectTaskDependencySchema = z.object({
  dependencyType: taskDependencyTypeSchema.optional(),
  lagDays: z.number().int().min(0).max(365).optional(),
});
export type UpdateProjectTaskDependencyInput = z.infer<typeof updateProjectTaskDependencySchema>;
```

### 1.3 API routes

Create `apps/api/src/routes/projects/dependencies.ts` as a Fastify plugin.

Endpoints:

| Method | Path | Description |
|--------|------|-------------|
| GET | `/v1/households/:householdId/projects/:projectId/dependencies` | List all dependencies for a project |
| POST | `/v1/households/:householdId/projects/:projectId/dependencies` | Create a dependency. Validate: both tasks belong to this project, no self-reference, no circular chains |
| PATCH | `/v1/households/:householdId/projects/:projectId/dependencies/:dependencyId` | Update dependencyType or lagDays |
| DELETE | `/v1/households/:householdId/projects/:projectId/dependencies/:dependencyId` | Remove a dependency |

**Cycle detection:** When creating a dependency, walk the dependency graph from the successor forward. If you reach the predecessor, reject with 409 and message `"Adding this dependency would create a circular chain"`. Use a simple DFS traversal — project task counts are small enough that this is always fast.

Add a serializer in `apps/api/src/lib/serializers/projects.ts`:

```typescript
export function toProjectTaskDependencyResponse(dep: ProjectTaskDependencyWithRelations) {
  return {
    id: dep.id,
    projectId: dep.projectId,
    predecessorId: dep.predecessorId,
    successorId: dep.successorId,
    dependencyType: dep.dependencyType,
    lagDays: dep.lagDays,
    createdAt: dep.createdAt.toISOString(),
    updatedAt: dep.updatedAt.toISOString(),
  };
}
```

Register the plugin in the projects route index. Log activity on create/delete.

### 1.4 Tests

Add `apps/api/test/task-dependencies.test.ts`:

- Create two tasks, add a finish-to-start dependency, verify it appears in GET
- Verify self-referencing dependency is rejected (400)
- Verify circular dependency is rejected (409): A→B, B→C, then C→A should fail
- Verify deleting a task cascades to its dependencies
- Verify cross-project dependency is rejected (tasks must belong to same project)
- Verify duplicate dependency is rejected (unique constraint, 409)

---

## Phase 2 — Critical Path Computation

**Goal:** Add a server-side endpoint that computes the critical path for a project based on task dependencies and phase/task dates. Return it as metadata alongside the project detail response.

### 2.1 Critical path library

Create `apps/api/src/lib/critical-path.ts`.

Implement a forward/backward pass CPM algorithm:

```typescript
export interface TimelineTask {
  id: string;
  phaseId: string | null;
  title: string;
  startDate: Date | null;    // from task.dueDate or phase.startDate
  endDate: Date | null;       // from task.dueDate or phase.targetEndDate
  durationDays: number;       // computed from dates, or default 1
  status: string;
  dependencies: { predecessorId: string; dependencyType: string; lagDays: number }[];
}

export interface CriticalPathResult {
  criticalTaskIds: string[];         // task IDs on the critical path
  earliestProjectEnd: string | null; // ISO date
  totalFloat: Record<string, number>; // taskId → float in days
}

export function computeCriticalPath(tasks: TimelineTask[]): CriticalPathResult;
```

**Algorithm:**
1. Build adjacency list from dependencies
2. Topological sort (Kahn's algorithm — also detects cycles as a safety net)
3. Forward pass: compute earliest start (ES) and earliest finish (EF) for each task
4. The maximum EF across all terminal tasks is the earliest project end
5. Backward pass: compute latest start (LS) and latest finish (LF) for each task
6. Float = LS − ES for each task. Tasks with float = 0 are on the critical path
7. Tasks without dates get duration = 1 day and float relative to their chain

### 2.2 Timeline data endpoint

Add a new route in `apps/api/src/routes/projects/index.ts`:

```
GET /v1/households/:householdId/projects/:projectId/timeline-data
```

Response shape:

```typescript
{
  phases: Array<{
    id: string;
    name: string;
    status: string;
    sortOrder: number | null;
    startDate: string | null;
    targetEndDate: string | null;
    actualEndDate: string | null;
    tasks: Array<{
      id: string;
      title: string;
      status: string;
      dueDate: string | null;
      completedAt: string | null;
      isCompleted: boolean;
      assignee: { id: string; displayName: string } | null;
      isCritical: boolean;
      earliestStart: string | null;
      earliestFinish: string | null;
      totalFloat: number;
    }>;
  }>;
  unscheduledPhases: Array<{ id: string; name: string; taskCount: number }>;
  dependencies: Array<ProjectTaskDependency>;
  criticalPath: {
    criticalTaskIds: string[];
    earliestProjectEnd: string | null;
  };
  projectStartDate: string | null;
  projectTargetEndDate: string | null;
}
```

This endpoint fetches all phases (with tasks), all dependencies, runs `computeCriticalPath()`, and merges the results. Phases where both `startDate` and `targetEndDate` are null go into `unscheduledPhases`.

### 2.3 Zod response schema

Add `projectTimelineDataSchema` to `packages/types/src/index.ts` matching the response shape above.

### 2.4 API client method

Add to `apps/web/lib/api.ts`:

```typescript
export async function fetchProjectTimelineData(
  householdId: string,
  projectId: string
): Promise<ProjectTimelineData> { ... }
```

### 2.5 Tests

Add to `apps/api/test/critical-path.test.ts`:

- Linear chain A→B→C: all three are critical
- Diamond: A→B, A→C, B→D, C→D where B is longer: A, B, D are critical; C has float
- Parallel independent chains: each chain has its own critical path
- Tasks without dates: default duration = 1 day
- Empty project (no dependencies): all tasks have infinite float, no critical path
- Lag days shift earliest start correctly

---

## Phase 3 — Timeline UI Component

**Goal:** Build the visual Gantt-style timeline component for the project detail page. Add a view toggle between the existing phase list and the new timeline.

### 3.1 View toggle

In the project detail page (`apps/web/app/(dashboard)/projects/[projectId]/page.tsx`), add a view toggle at the top of the phases section:

```
[List View] [Timeline View]
```

Use a query parameter `?view=list|timeline` to persist the selection. Default to `list` (existing behavior). When `timeline` is selected, fetch timeline data and render the new component.

### 3.2 Timeline component

Create `apps/web/components/project-gantt-timeline.tsx`.

**Layout structure:**
- Left column (fixed ~250px): Phase names and task titles, nested under phases
- Right area (scrollable): Time-scaled horizontal bars
- Header row: Date labels (days/weeks depending on zoom)
- Phase rows: Full-width bars spanning `startDate` → `targetEndDate`, colored by status
- Task rows (nested under phases): Narrower bars, colored by status. Critical path tasks get `var(--accent)` left border or highlight
- Dependency arrows: SVG lines drawn between task bars (predecessor finish → successor start)

**Styling (use globals.css custom properties):**
- Phase bars: `var(--surface-raised)` background, `var(--border)` outline
- Task bars: solid fill using status-specific colors (pending=`var(--ink-faint)`, in_progress=`var(--accent)`, completed=`var(--ink-success)`, skipped=`var(--ink-muted)`)
- Critical path highlight: `var(--accent)` 3px left border on critical tasks
- Dependency arrows: `var(--border)` stroke, arrowhead markers
- Today marker: vertical dashed line in `var(--accent)`

**Interactions:**
- Hover a task bar → tooltip with title, assignee, dates, float days
- Click a task bar → scroll the list view to that task (or open inline detail)
- Horizontal scroll for panning the timeline
- Zoom controls: day / week / month granularity (changes header labels and bar scaling)

**Unscheduled sidebar:** Below the timeline, show phases without dates in a simple list with a prompt: "Add start and end dates to see these phases on the timeline."

### 3.3 CSS additions

Add to `apps/web/app/globals.css`:

```css
.gantt-container { ... }
.gantt-sidebar { ... }
.gantt-chart { ... }
.gantt-header { ... }
.gantt-row { ... }
.gantt-bar { ... }
.gantt-bar--critical { ... }
.gantt-dependency-svg { ... }
.gantt-today-marker { ... }
.gantt-tooltip { ... }
.gantt-zoom-controls { ... }
```

Follow existing naming conventions — flat BEM-style class names, no nesting beyond one level.

### 3.4 Server action

Add `fetchProjectTimelineDataAction` as a server-side data fetch in `apps/web/app/actions.ts` (or use the API client directly in the server component since this is read-only).

### 3.5 Dependency management UI

Add a lightweight dependency editor accessible from the timeline view:

- Right-click (or long-press) a task bar → "Add dependency" → select predecessor from dropdown of other tasks in the project
- Show existing dependencies as a list in the task detail expandable card
- Delete dependency via × button on each dependency row

Create `apps/web/components/project-task-dependency-editor.tsx`:
- Shows incoming (predecessors) and outgoing (successors) dependencies for a task
- Add form: select task dropdown + dependency type dropdown + lag days input
- Delete button per dependency row
- Server actions: `createTaskDependencyAction`, `deleteTaskDependencyAction`

---

## Phase 4 — Polish and Integration

**Goal:** Wire up the timeline with existing project features. Ensure date changes propagate and the view stays consistent.

### 4.1 Phase date validation

When updating a phase's `startDate` or `targetEndDate`, validate against dependencies:
- If a phase contains tasks that are successors, warn (don't block) if the new phase start date is before the predecessor's earliest finish + lag
- Return a `warnings` array in the update response

### 4.2 Critical path in project portfolio

Add `criticalPathLength` (number of days from first critical task start to last critical task finish) to the project summary response. This enables sorting projects by "longest critical path" in the portfolio table — a proxy for project complexity and risk.

### 4.3 Notification integration

When a critical path task becomes overdue, include `isCritical: true` in the notification metadata. The notification scan worker (`apps/api/src/workers/notifications.ts`) should check task dependencies when evaluating project tasks. Critical path tasks that slip should generate higher-priority notifications.

### 4.4 Print / export

The timeline should render cleanly when the page is printed (CSS `@media print`). Hide zoom controls and scrollbars. Scale the timeline to fit the page width.

---

## Data model summary

```
ProjectTask (existing)
  ├─ predecessorOf: ProjectTaskDependency[]  (tasks that depend on this one)
  └─ successorOf: ProjectTaskDependency[]    (tasks this one depends on)

ProjectTaskDependency (new)
  ├─ predecessorId → ProjectTask
  ├─ successorId → ProjectTask
  ├─ dependencyType: "finish_to_start" | "start_to_start"
  └─ lagDays: integer (default 0)

Timeline Data (computed, not stored)
  ├─ criticalTaskIds: string[]
  ├─ earliestProjectEnd: Date
  └─ totalFloat: Map<taskId, days>
```
