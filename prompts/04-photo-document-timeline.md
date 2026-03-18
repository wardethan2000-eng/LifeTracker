# LifeKeeper — Photo/Document Timeline Implementation Specification

This document is the complete implementation reference for the Photo/Document Timeline feature. It is broken into sequential phases designed to be executed one at a time. Each phase builds on the previous and must be completed before moving to the next.

The Photo/Document Timeline transforms project attachments from a flat file list into a visual chronological narrative. Users attach progress photos, receipts, permits, and inspection documents — then browse them on a scrollable timeline grouped by phase. Before/after comparisons make this the feature people actually show their friends.

**Use cases:** Kitchen remodel progress documentation (demo day → framing → electrical → drywall → paint → finish), roof replacement receipt and permit tracking, bathroom renovation before/after photos for insurance records.

---

## Guiding principles

- Build on the existing attachment system. Attachments already support `project_phase`, `project_task`, `project_note`, and `project_expense` entity types. This feature adds presentation and metadata — not a parallel storage system.
- Phase tagging uses existing `entityType` + `entityId` relationships. An attachment on a phase is already implicitly "tagged" to that phase.
- The timeline is read-only visualization — upload still happens through the existing attachment upload flow in phase detail, task detail, expense, and note sections.
- Before/after comparison is a pure client-side feature. No server changes needed — just two image URLs side by side.
- Favor progressive enhancement. The timeline starts as a scrollable photo grid and gains features (filtering, comparison, captions) as phases land.

---

## Current attachment system reference

The existing attachment infrastructure (all already implemented):

**Model:** `Attachment` with fields: `id`, `householdId`, `uploadedById`, `entityType` (enum: maintenance_log, asset, project_note, project_expense, project_phase, project_task, inventory_item), `entityId`, `storageKey`, `originalFilename`, `mimeType`, `fileSize`, `thumbnailKey`, `ocrResult`, `caption`, `sortOrder`, `status` (pending/active/deleted), `deletedAt`, `createdAt`, `updatedAt`.

**API:** Upload flow is two-stage: POST `/attachments/upload` → presigned URL → PUT to S3 → POST `/attachments/:id/confirm`. Download via GET `/attachments/:id/download` returns presigned URL. List via GET `/attachments?entityType=...&entityId=...`.

**Components:** `AttachmentSection` (container), `AttachmentUploader` (drag-drop upload with progress), `AttachmentGallery` (grid with lazy URL loading + lightbox), `AttachmentLightbox` (fullscreen image viewer).

**Allowed types:** image/jpeg, image/png, image/webp, image/heic, image/heif, application/pdf. Max 50MB.

---

## Phase 1 — Project Attachment Aggregation Endpoint

**Goal:** Create a single API endpoint that returns all attachments across a project (from all phases, tasks, notes, and expenses), enriched with phase context. This powers the timeline without N+1 queries.

### 1.1 API route

Add a new route in `apps/api/src/routes/projects/index.ts` (or a new file `apps/api/src/routes/projects/attachments.ts`):

```
GET /v1/households/:householdId/projects/:projectId/attachments
```

Query parameters:
- `mimeTypePrefix` — optional filter, e.g. `image/` for photos only, `application/pdf` for documents only
- `phaseId` — optional filter to scope to a single phase

**Response shape:**

```typescript
{
  attachments: Array<{
    id: string;
    entityType: AttachmentEntityType;
    entityId: string;
    originalFilename: string;
    mimeType: string;
    fileSize: number;
    caption: string | null;
    uploadedBy: { id: string; displayName: string } | null;
    createdAt: string;           // ISO datetime — the upload timestamp
    // Enriched context:
    phase: { id: string; name: string; sortOrder: number | null } | null;
    entityLabel: string;         // Human-readable: "Phase: Demolition", "Task: Remove cabinets", "Expense: Dumpster rental"
  }>;
  phases: Array<{
    id: string;
    name: string;
    sortOrder: number | null;
    attachmentCount: number;
  }>;
  totalCount: number;
}
```

**Implementation:** Query all attachments for the household where:
- `entityType = 'project_phase'` AND `entityId` is a phase of this project
- `entityType = 'project_task'` AND `entityId` is a task of this project
- `entityType = 'project_note'` AND `entityId` is a note of this project
- `entityType = 'project_expense'` AND `entityId` is an expense of this project
- `status = 'active'` AND `deletedAt IS NULL`

For each attachment, resolve the parent phase:
- Phase attachments: phase is the entity itself
- Task attachments: phase is the task's `phaseId` (may be null for unphased tasks)
- Note attachments: phase is the note's `phaseId` (if the note has one)
- Expense attachments: phase is the expense's `phaseId` (if the expense has one)

Order by `createdAt` descending (newest first).

### 1.2 Zod schemas

Add to `packages/types/src/index.ts`:

```typescript
export const projectAttachmentTimelineItemSchema = z.object({
  id: z.string().cuid(),
  entityType: attachmentEntityTypeSchema,
  entityId: z.string(),
  originalFilename: z.string(),
  mimeType: z.string(),
  fileSize: z.number().int(),
  caption: z.string().nullable(),
  uploadedBy: shallowUserSchema.nullable(),
  createdAt: z.string().datetime(),
  phase: z.object({
    id: z.string().cuid(),
    name: z.string(),
    sortOrder: z.number().int().nullable(),
  }).nullable(),
  entityLabel: z.string(),
});

export const projectAttachmentTimelineSchema = z.object({
  attachments: z.array(projectAttachmentTimelineItemSchema),
  phases: z.array(z.object({
    id: z.string().cuid(),
    name: z.string(),
    sortOrder: z.number().int().nullable(),
    attachmentCount: z.number().int(),
  })),
  totalCount: z.number().int(),
});

export type ProjectAttachmentTimelineItem = z.infer<typeof projectAttachmentTimelineItemSchema>;
export type ProjectAttachmentTimeline = z.infer<typeof projectAttachmentTimelineSchema>;
```

### 1.3 API client

Add to `apps/web/lib/api.ts`:

```typescript
export async function fetchProjectAttachments(
  householdId: string,
  projectId: string,
  filters?: { mimeTypePrefix?: string; phaseId?: string }
): Promise<ProjectAttachmentTimeline> { ... }
```

### 1.4 Tests

Add `apps/api/test/project-attachments.test.ts`:

- Create a project with 2 phases, each with tasks and notes. Upload attachments to various entities. Verify the aggregation endpoint returns all with correct phase context.
- Verify `mimeTypePrefix=image/` filters correctly
- Verify `phaseId` filter scopes to a single phase
- Verify attachments on unphased tasks appear with `phase: null`
- Verify soft-deleted attachments are excluded

---

## Phase 2 — Timeline UI Component

**Goal:** Build the visual photo/document timeline as a new section on the project detail page.

### 2.1 Project detail integration

In the project detail page (`apps/web/app/(dashboard)/projects/[projectId]/page.tsx`), add a new ExpandableCard section titled "Photo & Document Timeline" after the existing phases section. When expanded, it fetches project attachments and renders the timeline.

Compact preview (when collapsed): "12 photos, 3 documents across 4 phases" — a single summary line.

### 2.2 Timeline component

Create `apps/web/components/project-attachment-timeline.tsx`.

**Props:**
```typescript
{
  householdId: string;
  projectId: string;
  attachments: ProjectAttachmentTimelineItem[];
  phases: Array<{ id: string; name: string; sortOrder: number | null; attachmentCount: number }>;
}
```

**Layout:**
- **Phase filter bar** at top: horizontal pill-style buttons for each phase + "All" option. Shows attachment count per phase.
- **Media type filter**: "All" | "Photos" | "Documents" toggle
- **Timeline body**: Attachments grouped by date (day boundaries), displayed in a responsive grid
  - Each group has a date header: "March 15, 2026" or "Today"
  - Images render as thumbnails (lazy-loaded via presigned URL)
  - PDFs render as a document icon card with filename
  - Each item shows: thumbnail/icon, filename, caption (if any), phase name badge, uploaded by name
- **Empty state**: "No photos or documents yet. Upload them from the phase detail or task views."

**Interactions:**
- Click an image thumbnail → open the existing `AttachmentLightbox` component
- Click a PDF → open presigned download URL in new tab (existing behavior)
- Click phase badge → filter to that phase
- Inline caption editing: click caption text to edit, blur to save (calls `updateAttachment`)

### 2.3 CSS additions

Add to `apps/web/app/globals.css`:

```css
.attachment-timeline { ... }
.attachment-timeline__filters { ... }
.attachment-timeline__phase-pill { ... }
.attachment-timeline__phase-pill--active { ... }
.attachment-timeline__date-group { ... }
.attachment-timeline__date-header { ... }
.attachment-timeline__grid { ... }
.attachment-timeline__item { ... }
.attachment-timeline__thumbnail { ... }
.attachment-timeline__doc-icon { ... }
.attachment-timeline__caption { ... }
.attachment-timeline__meta { ... }
```

Use existing CSS custom properties. Grid should be responsive: 4 columns on desktop, 3 on tablet, 2 on mobile.

### 2.4 Server action

Add `updateAttachmentCaptionAction` to `apps/web/app/actions.ts`:

```typescript
export async function updateAttachmentCaptionAction(formData: FormData): Promise<void> {
  const householdId = getString(formData, "householdId");
  const attachmentId = getString(formData, "attachmentId");
  const caption = getOptionalString(formData, "caption") ?? null;
  await updateAttachment(householdId, attachmentId, { caption });
  // revalidate project paths
}
```

---

## Phase 3 — Before/After Comparison

**Goal:** Allow users to select two images and view them in a side-by-side or slider comparison mode. This is the hero feature — the one people share.

### 3.1 Comparison component

Create `apps/web/components/attachment-compare.tsx`.

**Props:**
```typescript
{
  householdId: string;
  leftImage: ProjectAttachmentTimelineItem;
  rightImage: ProjectAttachmentTimelineItem;
  onClose: () => void;
}
```

**Layout:** Full-screen overlay (similar to lightbox) with two modes:

1. **Side-by-side**: Two images at equal width, vertically centered. Left has "Before" label + phase name + date, right has "After" label + phase name + date.

2. **Slider**: Both images stacked, with a draggable vertical divider. Left side shows the "before" image, right side shows the "after" image, clipped at the divider position. The divider has a handle that can be dragged horizontally.

Toggle between modes with a button in the comparison header.

### 3.2 Comparison entry point

In the timeline component, add a "Compare" mode:

1. Click "Compare" button in the filter bar → enters selection mode
2. User clicks two image thumbnails (they get a numbered badge: 1, 2)
3. "Compare" confirmation button appears → opens comparison overlay
4. First selected image = "Before" (left), second = "After" (right)
5. "Cancel" to exit selection mode

### 3.3 CSS additions

```css
.attachment-compare { ... }
.attachment-compare__header { ... }
.attachment-compare__side-by-side { ... }
.attachment-compare__slider { ... }
.attachment-compare__divider { ... }
.attachment-compare__label { ... }
.attachment-compare__select-badge { ... }
```

### 3.4 Slider implementation

The slider is pure CSS + a small client-side interaction:
- Both images are positioned absolutely in the same container
- The "before" image has `clip-path: inset(0 ${100 - percent}% 0 0)` (or use `width` on a wrapper div)
- A `mousedown`/`touchstart` handler on the divider tracks horizontal movement and updates the clip percentage via React state
- No external libraries needed

---

## Phase 4 — Document Organization Enhancements

**Goal:** Add document-specific features that make the timeline useful for record-keeping, not just photo viewing.

### 4.1 Document type badges

For PDF attachments, attempt to categorize them by filename patterns and show a badge:

| Pattern | Badge |
|---------|-------|
| `receipt`, `invoice` | Receipt |
| `permit` | Permit |
| `inspection` | Inspection |
| `contract`, `agreement` | Contract |
| `warranty` | Warranty |
| `quote`, `estimate`, `bid` | Quote |
| (default) | Document |

This is a client-side heuristic based on `originalFilename` — no schema changes needed. Add a `getDocumentCategory(filename: string): string` helper in the component.

### 4.2 Phase summary cards

At the top of the timeline (when "All" phases is selected), show a horizontal scrollable row of phase summary cards:

```
┌─────────────┐  ┌─────────────┐  ┌─────────────┐
│ Demolition   │  │ Framing      │  │ Electrical   │
│ 8 photos     │  │ 12 photos    │  │ 3 photos     │
│ 2 documents  │  │ 1 document   │  │ 4 documents  │
│ Jan 5-12     │  │ Jan 15-28    │  │ Feb 1-8      │
│ [thumbnail]  │  │ [thumbnail]  │  │ [thumbnail]  │
└─────────────┘  └─────────────┘  └─────────────┘
```

Each card shows the first uploaded image as a small thumbnail, counts of photos vs documents, and the date range of attachments in that phase. Clicking a card filters to that phase.

### 4.3 Download all

Add a "Download all" button that triggers the browser to download a ZIP file of all visible (filtered) attachments. Since we use presigned S3 URLs, this must be done client-side:

1. Fetch presigned URLs for all visible attachments
2. Use a client-side ZIP library (e.g., `fflate` — small, fast, no dependencies) to stream downloads and pack them
3. Name files: `{phaseNumber}-{phaseName}/{originalFilename}` for phase-organized output
4. Trigger download of the resulting ZIP

Add `fflate` as a dependency of `apps/web`.

---

## Data model summary

No new database models are needed. This feature builds entirely on the existing `Attachment` model and adds:

- One new aggregation API endpoint (Phase 1)
- Timeline visualization component (Phase 2)
- Before/after comparison component (Phase 3)
- Document categorization heuristics and ZIP download (Phase 4)

```
Existing:
  Attachment (entityType, entityId, mimeType, caption, createdAt)
    ├─ entityType: project_phase → direct phase association
    ├─ entityType: project_task → phase via task.phaseId
    ├─ entityType: project_note → phase via note.phaseId
    └─ entityType: project_expense → phase via expense.phaseId

New endpoint:
  GET /projects/:projectId/attachments
    → aggregates across all entity types
    → enriches with phase context
    → supports mimeTypePrefix and phaseId filters
```
