# LifeKeeper — Ideas Feature Phase 2: Web API Client & List Page

This document covers the web API client methods and the refactored Ideas list page. It replaces the existing localStorage-based prototype with real API-backed data.

**Prerequisites:** Phase 1 (schema, types, API routes) must be complete. The `Idea` model exists in Prisma, Zod schemas exist in `packages/types`, and the API routes are live at `/v1/households/:householdId/ideas`.

**Execution model:** This prompt is designed for GitHub Copilot Agent mode. Read the entire document before writing any code. All changes must be additive and non-breaking.

---

## 2.1 Web API client methods

Open `apps/web/lib/api.ts`. Add the following methods, following the exact same pattern used by existing methods (e.g., `getHobbies`, `createHobby`, `getProject`, etc.).

Import these schemas from `@lifekeeper/types` at the top of the file (add to the existing import block):

```typescript
ideaSchema,
ideaSummarySchema,
addIdeaNoteSchema,
addIdeaLinkSchema,
```

Add these methods to the API client:

```typescript
// ── Ideas ───────────────────────────────────────────────────────────

getIdeas(householdId: string, params?: {
  stage?: string;
  category?: string;
  priority?: string;
  search?: string;
  includeArchived?: boolean;
  limit?: number;
  cursor?: string;
})
// GET /households/:householdId/ideas
// Parse response items with ideaSummarySchema

getIdea(householdId: string, ideaId: string)
// GET /households/:householdId/ideas/:ideaId
// Parse response with ideaSchema

createIdea(householdId: string, data: CreateIdeaInput)
// POST /households/:householdId/ideas
// Parse response with ideaSchema

updateIdea(householdId: string, ideaId: string, data: UpdateIdeaInput)
// PATCH /households/:householdId/ideas/:ideaId
// Parse response with ideaSchema

deleteIdea(householdId: string, ideaId: string)
// DELETE /households/:householdId/ideas/:ideaId

addIdeaNote(householdId: string, ideaId: string, data: { text: string })
// POST /households/:householdId/ideas/:ideaId/notes
// Parse response with ideaSchema

removeIdeaNote(householdId: string, ideaId: string, noteId: string)
// DELETE /households/:householdId/ideas/:ideaId/notes/:noteId
// Parse response with ideaSchema

addIdeaLink(householdId: string, ideaId: string, data: { url: string; label: string })
// POST /households/:householdId/ideas/:ideaId/links
// Parse response with ideaSchema

removeIdeaLink(householdId: string, ideaId: string, linkId: string)
// DELETE /households/:householdId/ideas/:ideaId/links/:linkId
// Parse response with ideaSchema

updateIdeaStage(householdId: string, ideaId: string, stage: string)
// PATCH /households/:householdId/ideas/:ideaId/stage
// Parse response with ideaSchema

promoteIdea(householdId: string, ideaId: string, data: PromoteIdeaInput)
// POST /households/:householdId/ideas/:ideaId/promote
// Response includes { idea, createdEntity: { type, id } }

demoteToIdea(householdId: string, data: DemoteToIdeaInput)
// POST /households/:householdId/ideas/demote
// Parse response with ideaSchema
```

Follow the exact fetch wrapper pattern used by existing methods. Use the catch-all proxy — do not create individual proxy route files.

---

## 2.2 Server actions

Open `apps/web/app/actions.ts`. Add server actions for idea mutations, following the same pattern as existing server actions in the file (revalidation paths, error handling, etc.).

Add these server actions:

```typescript
createIdeaAction(householdId: string, data: CreateIdeaInput)
// Calls api.createIdea, revalidates "/ideas"

updateIdeaAction(householdId: string, ideaId: string, data: UpdateIdeaInput)
// Calls api.updateIdea, revalidates "/ideas" and "/ideas/[ideaId]" equivalent

deleteIdeaAction(householdId: string, ideaId: string)
// Calls api.deleteIdea, revalidates "/ideas"

addIdeaNoteAction(householdId: string, ideaId: string, text: string)
// Calls api.addIdeaNote, revalidates the idea detail

removeIdeaNoteAction(householdId: string, ideaId: string, noteId: string)
// Calls api.removeIdeaNote

addIdeaLinkAction(householdId: string, ideaId: string, url: string, label: string)
// Calls api.addIdeaLink

removeIdeaLinkAction(householdId: string, ideaId: string, linkId: string)
// Calls api.removeIdeaLink

updateIdeaStageAction(householdId: string, ideaId: string, stage: string)
// Calls api.updateIdeaStage, revalidates "/ideas"

promoteIdeaAction(householdId: string, ideaId: string, data: PromoteIdeaInput)
// Calls api.promoteIdea, revalidates "/ideas", "/projects", "/assets", "/hobbies" as appropriate

demoteToIdeaAction(householdId: string, data: DemoteToIdeaInput)
// Calls api.demoteToIdea, revalidates "/ideas"
```

---

## 2.3 Ideas list page refactor

Replace the existing localStorage-based `IdeaList` component with a server-rendered list that fetches from the API.

### Refactor `apps/web/app/(dashboard)/ideas/page.tsx`

The page should:

1. Be a **server component** (no `"use client"` directive on the page itself).
2. Fetch the household ID using the same pattern other list pages use (look at how `/projects/page.tsx` or `/hobbies/page.tsx` gets the household context).
3. Call `api.getIdeas(householdId)` to fetch all non-archived ideas.
4. Pass the data down to a client component for interactive features.
5. Keep the existing page header with the `+ New Idea` button.
6. Add filter controls below the header: stage filter (All / Spark / Developing / Ready), category dropdown, priority dropdown, and a search input.

### Refactor `apps/web/components/idea-list.tsx`

Rewrite this as a **client component** that receives the initial ideas data as props (server-fetched) and handles:

1. **Two view modes** — toggled by buttons in the page header area:
   - **Board view** (default): A three-column Kanban layout with columns for Spark, Developing, and Ready. Each idea renders as a card showing title, category badge, priority indicator, and counts (notes, materials, steps). Cards can be dragged between columns to change stage (use the `updateIdeaStageAction`). No external drag library — use native HTML drag-and-drop (`draggable`, `onDragStart`, `onDragOver`, `onDrop`).
   - **Table view**: The existing data-table layout, enhanced with the new fields (stage chip, priority badge, category badge, note count, link count, material count, step progress).

2. **Client-side filtering** from the filter controls. Since the full dataset is loaded, filter in-memory. If the dataset grows large in the future, filtering can move to server-side — but for now, client-side is fine.

3. **Delete action** on each idea (archive) with a confirmation.

4. **Quick stage move** — right-click context menu or button dropdown to move an idea to a different stage without dragging.

### Board view CSS

Add these styles to `apps/web/app/globals.css`:

```css
/* ── Idea Board ─────────────────────────────────────────────────── */

.idea-board {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 16px;
  align-items: start;
}

.idea-board__column {
  display: grid;
  gap: 8px;
}

.idea-board__column-header {
  font-size: 0.82rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--ink-muted);
  padding: 8px 12px;
  border-bottom: 2px solid var(--border);
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.idea-board__column-header .count {
  font-size: 0.75rem;
  font-weight: 500;
  color: var(--ink-muted);
  background: var(--surface-alt);
  padding: 2px 8px;
  border-radius: 10px;
}

.idea-board__card {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  padding: 12px;
  cursor: grab;
  transition: box-shadow 150ms ease, border-color 150ms ease;
}

.idea-board__card:active {
  cursor: grabbing;
}

.idea-board__card:hover {
  border-color: var(--accent);
}

.idea-board__card.dragging {
  opacity: 0.5;
}

.idea-board__column.drag-over {
  background: var(--surface-alt);
  border-radius: var(--radius-lg);
}

.idea-board__card-title {
  font-size: 0.88rem;
  font-weight: 500;
  color: var(--ink);
  margin: 0 0 6px;
}

.idea-board__card-meta {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
  font-size: 0.75rem;
}

.idea-board__card-description {
  font-size: 0.8rem;
  color: var(--ink-muted);
  margin: 4px 0 8px;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

/* Priority indicators */
.priority-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  display: inline-block;
  flex-shrink: 0;
}

.priority-dot--high { background: var(--danger); }
.priority-dot--medium { background: var(--warning); }
.priority-dot--low { background: var(--surface-alt); border: 1px solid var(--border); }

/* Responsive: stack columns vertically on mobile */
@media (max-width: 768px) {
  .idea-board {
    grid-template-columns: 1fr;
  }
}
```

### Idea category badge styles

Add category-specific badge styles using the existing `status-chip` pattern:

```css
.category-chip {
  display: inline-flex;
  align-items: center;
  padding: 2px 8px;
  border-radius: 10px;
  font-size: 0.72rem;
  font-weight: 500;
  background: var(--surface-alt);
  color: var(--ink-muted);
}
```

---

## 2.4 Sidebar navigation

The sidebar already has an "Ideas" entry (icon: `lightbulb`, href: `/ideas`). Verify it exists in the nav items passed to `SidebarNav` in the layout. If it does not exist, add it between the Dashboard and Assets entries.

---

## Constraints and boundaries

- Do NOT delete the existing `idea-list.tsx` and `idea-workbench.tsx` files — refactor them in place.
- Do NOT modify any existing route, component, or schema field behavior outside of the Ideas domain.
- Do NOT install new dependencies. Use native HTML drag-and-drop for the board, not a library.
- Do NOT create separate CSS files. All styles go in `globals.css`.
- Do NOT use `any` types. TypeScript strict mode is enforced.
- The page structure follows the same patterns as `/hobbies/page.tsx` and `/projects/page.tsx`.
- The catch-all API proxy handles routing automatically — do not create individual proxy files.
