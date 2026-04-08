# Aegis — Ideas Feature Phase 5: Promotion, Demotion, and Cross-Domain Integration

This document covers the promotion and demotion flows that connect Ideas to the rest of the platform (Projects, Assets, Hobbies). It also covers the "demote to idea" entry points on project, asset, and hobby detail pages.

**Prerequisites:** Phases 1-4 must be complete.

**Execution model:** This prompt is designed for GitHub Copilot Agent mode. Read the entire document before writing any code. All changes must be additive and non-breaking.

---

## Guiding principles

- Promotion creates a new entity (Project/Asset/Hobby) and archives the idea. The idea is never deleted — it's the historical record of where the thought started.
- Demotion creates a new idea from an existing entity. The source entity is NOT modified or deleted — the user decides what to do with it independently. This keeps demotion safe and reversible.
- Both flows create links between the idea and the entity so users can trace the lineage in either direction.

---

## 5.1 Promotion flow — enhanced detail

The promotion card (`apps/web/components/idea-promotion-card.tsx` from Phase 3) needs a richer inline promotion form. Enhance it as follows.

### When the user clicks "Promote Now"

The card expands to show a promotion form with:

1. **Target selector**: Three large radio-style cards (not a dropdown):
   - **Project** — "Plan with phases, tasks, budget, and a timeline"
   - **Asset** — "Something to track and maintain over time"
   - **Hobby** — "A pursuit to log sessions and progress for"

2. **Name override**: Pre-filled with the idea title. Editable.

3. **Description override**: Pre-filled with the idea description. Editable.

4. **What carries over** — a read-only preview showing what data will transfer:
   - For **Project**: "Title, description, and {N} steps will become project tasks"
   - For **Asset**: "Title and description will be set. Category will default to 'other'."
   - For **Hobby**: "Title and description will be set. Activity mode defaults to 'session'."

5. **Confirm button**: "Create [Project/Asset/Hobby]"

6. **Cancel button**: Collapses the form back to the simple dropdown state.

### On promotion success

1. The API archives the idea and returns the created entity's type and ID.
2. Show a success message: "Idea promoted to [type]!"
3. Redirect to the new entity's detail page:
   - Project → `/projects/[projectId]`
   - Asset → `/assets/[assetId]`
   - Hobby → `/hobbies/[hobbyId]`

### Promotion card CSS

Add to `globals.css`:

```css
/* ── Promotion Target Cards ─────────────────────────────────────── */

.promotion-targets {
  display: grid;
  gap: 8px;
}

.promotion-target-option {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px;
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  cursor: pointer;
  transition: border-color 150ms ease, background 150ms ease;
  background: var(--surface);
}

.promotion-target-option:hover {
  border-color: var(--accent);
}

.promotion-target-option--selected {
  border-color: var(--accent);
  background: color-mix(in srgb, var(--accent) 5%, transparent);
}

.promotion-target-option__title {
  font-size: 0.88rem;
  font-weight: 600;
  color: var(--ink);
}

.promotion-target-option__desc {
  font-size: 0.78rem;
  color: var(--ink-muted);
  margin-top: 2px;
}

.promotion-preview {
  padding: 10px 12px;
  background: var(--surface-alt);
  border-radius: var(--radius-lg);
  font-size: 0.8rem;
  color: var(--ink-muted);
  margin: 12px 0;
}
```

---

## 5.2 Demotion entry points

Add "Demote to Idea" buttons on project, asset, and hobby detail pages. These allow users to send a stalled or abandoned entity back to the ideas staging area.

### Project detail page

File: `apps/web/app/(dashboard)/projects/[projectId]/page.tsx`

Add a "Demote to Idea" button in the project settings section or the danger zone area. Look at where the existing delete/archive actions live and add the demote button nearby.

**Behavior:**
1. User clicks "Demote to Idea"
2. A small confirmation dialog appears: "This will create a new idea from this project's name and description. The project itself will not be changed."
3. On confirm, call `demoteToIdeaAction(householdId, { sourceType: "project", sourceId: projectId })`
4. On success, show a toast "Idea created from project" with a link to the new idea
5. Do NOT navigate away from the project page — let the user decide what to do with the project

### Asset detail page

File: `apps/web/app/(dashboard)/assets/[assetId]/settings/page.tsx` (or wherever the danger zone / archive actions live for assets)

Same pattern as projects:
1. "Demote to Idea" button in the danger zone or settings area
2. Confirmation: "This will create a new idea from this asset's name and description. The asset itself will not be changed."
3. Call `demoteToIdeaAction(householdId, { sourceType: "asset", sourceId: assetId })`
4. Toast with link to new idea

### Hobby detail page

File: `apps/web/app/(dashboard)/hobbies/[hobbyId]/page.tsx` (or the edit page, wherever settings/archive actions live)

Same pattern:
1. "Demote to Idea" button
2. Confirmation dialog
3. Call `demoteToIdeaAction(householdId, { sourceType: "hobby", sourceId: hobbyId })`
4. Toast with link to new idea

### Demote button component

Create `apps/web/components/demote-to-idea-button.tsx` — a reusable **client component** used on all three surfaces.

```typescript
type DemoteToIdeaButtonProps = {
  householdId: string;
  sourceType: "project" | "asset" | "hobby";
  sourceId: string;
  sourceName: string; // For the confirmation dialog
};
```

**Behavior:**
1. Renders a ghost-style button: "Demote to Idea" (or an icon + text)
2. On click, shows an inline confirmation (not a browser `confirm()` — use a small expandable section below the button with "Are you sure?" text and Confirm/Cancel buttons)
3. On confirm, calls `demoteToIdeaAction` and shows a toast
4. While the request is in-flight, the button shows a loading state

### CSS for demote confirmation

```css
.demote-confirm {
  margin-top: 8px;
  padding: 10px 12px;
  background: var(--surface-alt);
  border-radius: var(--radius-lg);
  font-size: 0.82rem;
  color: var(--ink-muted);
}

.demote-confirm__actions {
  display: flex;
  gap: 8px;
  margin-top: 8px;
}
```

---

## 5.3 Provenance links

When viewing an idea that was promoted or demoted, and when viewing an entity that was created from an idea, show a provenance link connecting them.

### On promoted ideas

The idea detail page already has a Provenance card (Phase 3). Enhance it:
- If the idea has `promotedToType` and `promotedToId`, show: "Promoted to [Project: Kitchen Remodel](/projects/abc123) on Mar 21, 2026"
- The link should be a real `<Link>` to the entity's detail page

### On entities created from ideas

For projects, assets, and hobbies that were created via promotion, there is currently no link back to the source idea. To add this:

1. The promotion API response already includes the idea ID in the created entity's lineage (via the `promotedToId` field on the idea).
2. Since the created entity doesn't store a reference back to the idea (and we don't want to modify existing models), use a different approach: when rendering a project/asset/hobby detail page, check if any idea in the household has `promotedToType` and `promotedToId` matching this entity. If found, show a small "Originally an idea" badge/link.
3. This lookup can be done via a new API endpoint or a client-side query. The simplest approach: add an optional `getSourceIdea(householdId, entityType, entityId)` method to the API client that calls a new GET endpoint:

```
GET /v1/households/:householdId/ideas/source?entityType=project&entityId=abc123
```

This endpoint queries for an idea where `promotedToType = entityType` and `promotedToId = entityId`. Returns the idea summary or null.

4. On the project/asset/hobby detail page, if a source idea is found, show a small info bar at the top (below the breadcrumb, above the content):

```css
.provenance-bar {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 12px;
  background: color-mix(in srgb, var(--accent) 8%, transparent);
  border-radius: var(--radius-lg);
  font-size: 0.8rem;
  color: var(--ink-muted);
  margin-bottom: 12px;
}

.provenance-bar a {
  color: var(--accent);
  font-weight: 500;
}
```

Content: "💡 Originally captured as an idea: [Deck Build](/ideas/xyz789)"

This is a lightweight, non-intrusive integration that connects the dots without cluttering the existing pages.

---

## 5.4 Dashboard integration

Update the dashboard page to show a small "Ideas" section.

File: `apps/web/app/(dashboard)/page.tsx`

In the aside column of the dashboard (where Quick Actions and Recent Notifications live), add a new panel:

### Ideas Panel

```
┌─────────────────────────────────────────┐
│  💡 Ideas                     [View All] │
├─────────────────────────────────────────┤
│  3 spark · 2 developing · 1 ready       │
│                                         │
│  Recent:                                │
│  • Build a deck (Developing, High)      │
│  • Workshop dust collection (Spark)     │
│  • Try sourdough baking (Ready → Hobby) │
│                                         │
│  [+ Quick Capture]                      │
└─────────────────────────────────────────┘
```

**Implementation:**
1. Fetch idea summaries via `api.getIdeas(householdId, { limit: 5 })` in the dashboard server component
2. Show stage counts as a summary line
3. Show the 3-5 most recently updated ideas with their stage, priority, and promotion target
4. "View All" links to `/ideas`
5. "+ Quick Capture" opens the same quick capture popover from Phase 4 (or simply links to `/ideas/new` if integrating the popover into the dashboard is complex)

---

## Constraints and boundaries

- Do NOT modify the behavior of existing project, asset, or hobby creation flows. Promotion creates entities through the idea API, not by modifying the existing creation endpoints.
- Do NOT add foreign keys from projects/assets/hobbies back to ideas. The linkage is tracked only on the idea side.
- Do NOT delete or archive the source entity on demotion. The user decides that separately.
- Do NOT install new dependencies.
- Do NOT create separate CSS files.
- Do NOT use `any` types.
- Keep the demote confirmation inline (not a browser dialog or a heavy modal).
- The provenance bar on entity detail pages should be a light query — if the lookup is expensive, consider caching or skipping it. It's a nice-to-have, not critical.
