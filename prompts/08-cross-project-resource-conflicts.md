# LifeKeeper — Cross-Project Resource Conflict Detection Implementation Specification

This document is the complete implementation reference for the Cross-Project Resource Conflict Detection feature. It is broken into sequential phases designed to be executed one at a time. Each phase builds on the previous and must be completed before moving to the next.

Cross-Project Resource Conflicts surface situations where two or more active projects compete for the same limited resources — inventory items, equipment, or service providers. When both "Deck Build" and "Fence Repair" plan to use the same table saw and need 50 deck screws during overlapping timeframes, the system should flag this before the user discovers it mid-project.

**Use cases:** Two projects needing the same power tools during overlapping weekends, multiple projects drawing from the same fastener inventory and total demand exceeding stock, two projects planning to use the same contractor during the same month.

---

## Guiding principles

- Conflicts are advisory, not blocking. The system surfaces conflicts as warnings — it never prevents a user from allocating resources. Household projects are flexible, and users may know something the system doesn't.
- Detection runs on-demand and at key moments (project creation, supply addition, inventory allocation). No background jobs needed for a household-scale dataset.
- Three resource dimensions: **inventory items** (consumables with quantity limits), **equipment** (durable items with availability constraints), and **service providers** (contractors with scheduling conflicts).
- Conflicts are scoped to **active projects only**. Completed, cancelled, and planning-stage projects don't compete for resources.
- The conflict API is read-only. No new models — conflicts are computed from existing relationships between `ProjectPhaseSupply`, `ProjectInventoryItem`, and `InventoryItem`.

---

## Current resource allocation reference

**Two parallel linkage paths exist:**

1. **ProjectInventoryItem** — Project-level inventory planning:
   - Fields: `projectId`, `inventoryItemId`, `quantityNeeded`, `quantityAllocated`, `budgetedUnitCost`, `notes`
   - Unique constraint: `[projectId, inventoryItemId]` — one record per item per project
   - `quantityAllocated` tracks how much has been consumed from inventory

2. **ProjectPhaseSupply** — Phase-level supply line items:
   - Fields: `phaseId`, `name`, `quantityNeeded`, `quantityOnHand`, `unit`, `estimatedUnitCost`, `actualUnitCost`, `supplier`, `isProcured`, `inventoryItemId` (nullable link to InventoryItem)
   - `quantityOnHand` tracks how much has been allocated from inventory to this supply

**InventoryItem** tracks global stock:
   - `quantityOnHand` — current physical quantity available
   - `itemType` — `consumable` (quantity-limited) or `equipment` (availability-limited)
   - `reorderThreshold` — low stock warning level

**ServiceProvider** is linked to projects through `ProjectExpense.serviceProviderId` and project assets.

**Key gap:** Currently, there is no mechanism to aggregate demand across projects, compare it to available supply, or detect temporal overlaps between projects needing the same equipment.

---

## Phase 1 — Inventory Conflict Detection Engine

**Goal:** Build a server-side engine that identifies inventory items where total demand across active projects exceeds available supply. Expose via API endpoint.

### 1.1 Conflict detection library

Create `apps/api/src/lib/resource-conflicts.ts`:

```typescript
export interface InventoryConflict {
  inventoryItemId: string;
  inventoryItemName: string;
  itemType: "consumable" | "equipment";
  unit: string;
  quantityOnHand: number;
  totalDemand: number;           // sum of quantityNeeded across all active projects
  totalAllocated: number;        // sum of quantityAllocated across all active projects
  remainingDemand: number;       // totalDemand - totalAllocated
  shortfall: number;             // max(0, remainingDemand - quantityOnHand)
  projects: Array<{
    projectId: string;
    projectName: string;
    projectStatus: string;
    quantityNeeded: number;      // this project's demand
    quantityAllocated: number;   // this project's allocation so far
    phases: Array<{              // phase-level supply detail
      phaseId: string;
      phaseName: string;
      supplyName: string;
      quantityNeeded: number;
      quantityOnHand: number;
      startDate: string | null;
      targetEndDate: string | null;
    }>;
  }>;
}

export interface EquipmentConflict {
  inventoryItemId: string;
  inventoryItemName: string;
  unit: string;
  projects: Array<{
    projectId: string;
    projectName: string;
    phases: Array<{
      phaseId: string;
      phaseName: string;
      startDate: string | null;
      targetEndDate: string | null;
    }>;
  }>;
  overlappingPeriods: Array<{    // pairs of projects with overlapping phase dates
    projectA: { id: string; name: string; phaseId: string; phaseName: string };
    projectB: { id: string; name: string; phaseId: string; phaseName: string };
    overlapStart: string;
    overlapEnd: string;
  }>;
}

export interface ServiceProviderConflict {
  providerId: string;
  providerName: string;
  projects: Array<{
    projectId: string;
    projectName: string;
    phases: Array<{
      phaseId: string;
      phaseName: string;
      startDate: string | null;
      targetEndDate: string | null;
    }>;
  }>;
  overlappingPeriods: Array<{
    projectA: { id: string; name: string; phaseId: string; phaseName: string };
    projectB: { id: string; name: string; phaseId: string; phaseName: string };
    overlapStart: string;
    overlapEnd: string;
  }>;
}

export interface ResourceConflictReport {
  inventoryConflicts: InventoryConflict[];
  equipmentConflicts: EquipmentConflict[];
  serviceProviderConflicts: ServiceProviderConflict[];
  totalConflicts: number;
  generatedAt: string;
}

export async function detectResourceConflicts(
  prisma: PrismaClient,
  householdId: string,
  options?: {
    projectId?: string;          // scope to conflicts involving this project
    inventoryItemId?: string;    // scope to conflicts involving this item
  }
): Promise<ResourceConflictReport>;
```

### 1.2 Detection algorithm

**Consumable inventory conflicts:**

1. Find all active projects (`status IN ('planning', 'active')`) in the household
2. For each project, aggregate inventory demand from both linkage paths:
   - `ProjectInventoryItem.quantityNeeded` (project-level)
   - `ProjectPhaseSupply.quantityNeeded` where `inventoryItemId IS NOT NULL` (phase-level, deduplicated against project-level links)
3. Group by `inventoryItemId`. Sum demand across all projects.
4. Compare total remaining demand (`totalDemand - totalAllocated`) to `InventoryItem.quantityOnHand`
5. If remaining demand > quantityOnHand, this is a conflict with `shortfall = remainingDemand - quantityOnHand`

**Deduplication rule:** If an inventory item appears in both `ProjectInventoryItem` and `ProjectPhaseSupply` for the same project, use the `ProjectInventoryItem.quantityNeeded` as the authoritative demand (it's the project-level plan). Don't double-count.

**Equipment conflicts:**

1. Find all `InventoryItem` records with `itemType = 'equipment'` that are linked to multiple active projects (via `ProjectPhaseSupply` or `ProjectInventoryItem`)
2. For each such item, collect the phase date ranges from each project
3. Detect temporal overlaps: if project A's phase using this equipment overlaps with project B's phase using the same equipment, flag it
4. Overlap detection: two phases overlap if `A.startDate < B.targetEndDate AND B.startDate < A.targetEndDate` (both dates must be non-null to detect overlap — skip phases without dates)

**Service provider conflicts:**

1. Find all `ServiceProvider` records referenced by expenses in multiple active projects
2. Collect phase date ranges for expenses referencing each provider
3. Detect temporal overlaps using the same logic as equipment

### 1.3 API route

Create `apps/api/src/routes/projects/resource-conflicts.ts` (or add to household-level routes):

```
GET /v1/households/:householdId/resource-conflicts
```

Query parameters:
- `projectId` — optional, scope to conflicts involving this project
- `inventoryItemId` — optional, scope to conflicts involving this inventory item
- `includeEquipment` — default true, include equipment scheduling conflicts
- `includeProviders` — default true, include service provider scheduling conflicts

Returns: `ResourceConflictReport`

Also add a project-scoped convenience endpoint:

```
GET /v1/households/:householdId/projects/:projectId/resource-conflicts
```

This calls the same detection logic with `projectId` filter, returning only conflicts that involve the specified project.

### 1.4 Zod schemas

Add to `packages/types/src/index.ts`:

```typescript
export const inventoryConflictSchema = z.object({
  inventoryItemId: z.string().cuid(),
  inventoryItemName: z.string(),
  itemType: z.enum(["consumable", "equipment"]),
  unit: z.string(),
  quantityOnHand: z.number(),
  totalDemand: z.number(),
  totalAllocated: z.number(),
  remainingDemand: z.number(),
  shortfall: z.number(),
  projects: z.array(z.object({
    projectId: z.string().cuid(),
    projectName: z.string(),
    projectStatus: z.string(),
    quantityNeeded: z.number(),
    quantityAllocated: z.number(),
    phases: z.array(z.object({
      phaseId: z.string().cuid(),
      phaseName: z.string(),
      supplyName: z.string(),
      quantityNeeded: z.number(),
      quantityOnHand: z.number(),
      startDate: z.string().datetime().nullable(),
      targetEndDate: z.string().datetime().nullable(),
    })),
  })),
});

export const equipmentConflictSchema = z.object({
  inventoryItemId: z.string().cuid(),
  inventoryItemName: z.string(),
  unit: z.string(),
  projects: z.array(z.object({
    projectId: z.string().cuid(),
    projectName: z.string(),
    phases: z.array(z.object({
      phaseId: z.string().cuid(),
      phaseName: z.string(),
      startDate: z.string().datetime().nullable(),
      targetEndDate: z.string().datetime().nullable(),
    })),
  })),
  overlappingPeriods: z.array(z.object({
    projectA: z.object({ id: z.string(), name: z.string(), phaseId: z.string(), phaseName: z.string() }),
    projectB: z.object({ id: z.string(), name: z.string(), phaseId: z.string(), phaseName: z.string() }),
    overlapStart: z.string().datetime(),
    overlapEnd: z.string().datetime(),
  })),
});

export const serviceProviderConflictSchema = z.object({
  providerId: z.string().cuid(),
  providerName: z.string(),
  projects: z.array(z.object({
    projectId: z.string().cuid(),
    projectName: z.string(),
    phases: z.array(z.object({
      phaseId: z.string().cuid(),
      phaseName: z.string(),
      startDate: z.string().datetime().nullable(),
      targetEndDate: z.string().datetime().nullable(),
    })),
  })),
  overlappingPeriods: z.array(z.object({
    projectA: z.object({ id: z.string(), name: z.string(), phaseId: z.string(), phaseName: z.string() }),
    projectB: z.object({ id: z.string(), name: z.string(), phaseId: z.string(), phaseName: z.string() }),
    overlapStart: z.string().datetime(),
    overlapEnd: z.string().datetime(),
  })),
});

export const resourceConflictReportSchema = z.object({
  inventoryConflicts: z.array(inventoryConflictSchema),
  equipmentConflicts: z.array(equipmentConflictSchema),
  serviceProviderConflicts: z.array(serviceProviderConflictSchema),
  totalConflicts: z.number().int(),
  generatedAt: z.string().datetime(),
});

export type InventoryConflict = z.infer<typeof inventoryConflictSchema>;
export type EquipmentConflict = z.infer<typeof equipmentConflictSchema>;
export type ServiceProviderConflict = z.infer<typeof serviceProviderConflictSchema>;
export type ResourceConflictReport = z.infer<typeof resourceConflictReportSchema>;
```

### 1.5 API client

Add to `apps/web/lib/api.ts`:

```typescript
export async function fetchResourceConflicts(
  householdId: string,
  params?: { projectId?: string; inventoryItemId?: string }
): Promise<ResourceConflictReport> { ... }

export async function fetchProjectResourceConflicts(
  householdId: string,
  projectId: string
): Promise<ResourceConflictReport> { ... }
```

### 1.6 Tests

Add `apps/api/test/resource-conflicts.test.ts`:

**Consumable inventory conflicts:**
- Two active projects each needing 30 screws, inventory has 40. Shortfall = 20.
- Two projects needing same item, but one is completed — no conflict (only active projects).
- One project needs 10, inventory has 20. No conflict.
- Three projects needing same item with overlapping demand. Verify shortfall calculation.

**Equipment conflicts:**
- Two projects using same table saw with overlapping phase dates → conflict with overlap period.
- Two projects using same equipment with non-overlapping dates → no conflict.
- Phases without dates are skipped for overlap detection.

**Service provider conflicts:**
- Two projects using same contractor with overlapping phase dates → conflict.
- Same contractor, non-overlapping → no conflict.

**Scoping:**
- `projectId` filter returns only conflicts involving that project.
- `inventoryItemId` filter returns only conflicts for that item.

---

## Phase 2 — Conflict UI in Project Detail

**Goal:** Show resource conflicts on the project detail page as a warning banner and in the supply sections.

### 2.1 Project detail conflict banner

In the project detail page, fetch project-scoped conflicts. If any exist, show a warning banner below the project header:

```
┌──────────────────────────────────────────────────────────┐
│ ⚠ 2 resource conflicts detected                          │
│                                                           │
│ • Deck Screws (2"): Both this project and "Fence Repair"  │
│   need 30 each, but only 40 are in stock (shortfall: 20)  │
│                                                           │
│ • Table Saw: Overlaps with "Fence Repair" during          │
│   Mar 15–22 (both projects have phases scheduled)         │
│                                                           │
│ [View details]  [Dismiss]                                 │
└──────────────────────────────────────────────────────────┘
```

### 2.2 Conflict banner component

Create `apps/web/components/resource-conflict-banner.tsx`:

**Props:**
```typescript
{
  conflicts: ResourceConflictReport;
  currentProjectId: string;
  currentProjectName: string;
}
```

**Rendering:**
- Only shown if `totalConflicts > 0`
- Each conflict as a bullet point with item name, competing project name(s), and shortfall or overlap period
- "View details" opens an expanded view (or scrolls to the conflict detail section)
- "Dismiss" hides the banner for this session (client state only — `useState`)

### 2.3 Supply card conflict indicators

In `apps/web/components/project-supply-card.tsx`, when a supply has an inventory link, check if that inventory item appears in the conflict report. If so, show a warning indicator:

```
┌─────────────────────────────────────────────┐
│ Deck Screws (2")                             │
│ Need: 30  |  On hand: 12  |  In stock: 40   │
│ ⚠ Also needed by "Fence Repair" (30 units)  │
│    Total demand: 60 | Available: 40          │
└─────────────────────────────────────────────┘
```

### 2.4 CSS additions

```css
.conflict-banner { ... }
.conflict-banner__icon { ... }
.conflict-banner__title { ... }
.conflict-banner__item { ... }
.conflict-banner__actions { ... }
.conflict-indicator { ... }
.conflict-indicator--warning { ... }
.conflict-indicator--critical { ... }
```

Use `var(--ink-warning)` for warnings (shortfall < 50% of demand) and `var(--ink-danger)` for critical (shortfall > 50% of demand or complete overlap).

---

## Phase 3 — Household-Level Conflict Dashboard

**Goal:** Add a household-level conflict overview accessible from the main navigation, showing all resource conflicts across all active projects.

### 3.1 Conflict dashboard page

Create `apps/web/app/(dashboard)/resource-conflicts/page.tsx`.

**Layout:**
- Header: "Resource Conflicts" with total conflict count
- Three sections (tabs or collapsible cards):
  1. **Inventory Shortfalls** — Consumable items where demand exceeds supply
  2. **Equipment Scheduling** — Equipment needed by multiple projects at the same time
  3. **Contractor Scheduling** — Service providers booked by multiple projects simultaneously

### 3.2 Inventory shortfall section

For each conflicting inventory item:

```
┌─────────────────────────────────────────────────────┐
│ Deck Screws (2")                                     │
│ In stock: 40 | Total demand: 60 | Shortfall: 20     │
│ ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ (67% covered)      │
│                                                       │
│ Projects:                                             │
│   Deck Build         30 needed  (12 allocated)        │
│   Fence Repair       30 needed  (0 allocated)         │
│                                                       │
│ Suggestions:                                          │
│ • Purchase 20 more to cover all projects              │
│ • Prioritize one project and defer the other          │
└─────────────────────────────────────────────────────┘
```

### 3.3 Equipment scheduling section

For each conflicting equipment item:

```
┌─────────────────────────────────────────────────────┐
│ Table Saw                                            │
│ Used by 2 active projects                            │
│                                                       │
│ Overlap: Mar 15–22, 2026                             │
│   Deck Build → "Cutting & Assembly" phase            │
│   Fence Repair → "Build fence panels" phase          │
│                                                       │
│ Suggestion: Stagger phases to avoid overlap           │
└─────────────────────────────────────────────────────┘
```

### 3.4 Navigation integration

Add a link to the resource conflicts page in the main navigation sidebar. Show a badge with the conflict count (fetched on layout load or periodically).

Only show the badge/link if there are active conflicts. Use a lightweight "count-only" API variant:

```
GET /v1/households/:householdId/resource-conflicts/count
```

Returns: `{ totalConflicts: number }`

### 3.5 Conflict in project portfolio

Add a "Conflicts" column to the project portfolio table (`apps/web/components/project-portfolio-table.tsx`). Show the count of conflicts per project. Clicking the count links to the project detail page scrolled to the conflict banner.

---

## Phase 4 — Conflict-Aware Allocation Warnings

**Goal:** Show real-time conflict warnings when a user is about to allocate inventory that would create or worsen a shortfall.

### 4.1 Allocation warning in supply card

When a user clicks "Allocate from inventory" on a supply card, before executing the allocation, check if this allocation would create a shortfall:

```
Allocating 15 deck screws to this phase.

⚠ Warning: After this allocation, only 25 will remain in stock.
"Fence Repair" also needs 30 deck screws for its "Build panels" phase.
Total remaining demand will exceed available stock by 5 units.

[Allocate anyway]  [Cancel]
```

This is a client-side check using the conflict data already fetched. No new API call needed — compare the proposed allocation against existing conflict data.

### 4.2 Supply creation warning

When creating a new phase supply with an inventory link, if the inventory item already appears in other active projects, show an inline notice:

```
ℹ This item is also planned for:
  • Fence Repair — 30 units needed
Current stock: 40 units
```

This uses the conflict report data and does not require a new endpoint.

### 4.3 Notification integration

When the notification scan worker runs, check for new resource conflicts and generate notifications:

- `NotificationType`: use the existing `inventory_low_stock` type or add a new `resource_conflict` type
- Notification message: "Deck Screws: total demand across active projects (60) exceeds available stock (40)"
- Only notify once per conflict (track in notification metadata to avoid duplicates)

---

## Data model summary

No new database models. This feature is entirely computed from existing relationships.

```
Existing models used for conflict detection:

InventoryItem (quantityOnHand, itemType, reorderThreshold)
  ├─ ProjectInventoryItem (projectId, quantityNeeded, quantityAllocated)
  │   └─ Project (name, status — filter to active/planning only)
  └─ ProjectPhaseSupply (phaseId, quantityNeeded, quantityOnHand, inventoryItemId)
      └─ ProjectPhase (name, startDate, targetEndDate — for temporal overlap)

ServiceProvider
  └─ ProjectExpense (projectId, serviceProviderId)
      └─ Project + ProjectPhase (for temporal context)

New code:
  apps/api/src/lib/resource-conflicts.ts    — detection engine
  apps/api/src/routes/projects/resource-conflicts.ts — API endpoints
  apps/web/components/resource-conflict-banner.tsx   — project-level warnings
  apps/web/app/(dashboard)/resource-conflicts/page.tsx — household dashboard
```
