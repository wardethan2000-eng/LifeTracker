# LifeKeeper — Ideas Feature Phase 3: Idea Detail Page

This document covers the idea detail page — the workspace where a user develops a single idea over time by adding notes, links, materials, and steps.

**Prerequisites:** Phase 1 (backend) and Phase 2 (API client, list page) must be complete.

**Execution model:** This prompt is designed for GitHub Copilot Agent mode. Read the entire document before writing any code. All changes must be additive and non-breaking.

---

## 3.1 New route: `/ideas/[ideaId]`

Create the page file at `apps/web/app/(dashboard)/ideas/[ideaId]/page.tsx`.

This is a **server component** page that:

1. Reads the `ideaId` param from the route.
2. Fetches the household context (same pattern as `/projects/[projectId]/page.tsx`).
3. Calls `api.getIdea(householdId, ideaId)` to fetch the full idea detail.
4. Renders the page header and passes data down to client components for interactivity.

### Page layout

Use the two-column `resource-layout` pattern from the UI Design Guide (same as asset settings, project detail):

```
┌─────────────────────────────────────────────────────────────┐
│  ← Back to Ideas                          [Archive] [Edit]  │
│  Category eyebrow (if set)                                  │
│  Idea Title                                                 │
│  Stage chip · Priority dot · "Created Mar 15"               │
├───────────────────────────────────┬─────────────────────────┤
│  PRIMARY COLUMN (2fr)             │  ASIDE COLUMN (1fr)     │
│                                   │                         │
│  Card: Description                │  Card: Status & Meta    │
│  Card: Notes Log                  │  Card: Promotion Target │
│  Card: Links / Bookmarks          │  Card: Provenance       │
│                                   │                         │
├───────────────────────────────────┴─────────────────────────┤
│  Card: Materials & Resources (full width below grid)        │
│  Card: Steps Checklist (full width below grid)              │
└─────────────────────────────────────────────────────────────┘
```

---

## 3.2 Page header

Follow the standard `page-header` and `detail-topbar` pattern used by asset and project detail pages:

- **Back link:** `← Back to Ideas` linking to `/ideas`
- **Category eyebrow:** If the idea has a category, show it as small uppercase muted text above the title (e.g., "HOME IMPROVEMENT")
- **Title:** The idea title, rendered as `<h1>`
- **Subtitle row:** Stage chip (Spark / Developing / Ready, using `status-chip` classes), priority dot, creation date
- **Actions:** Archive button (ghost), Edit toggle (if inline editing is planned — for now, a link to a future edit mode, or make the detail page directly editable)

---

## 3.3 Primary column components

### Card: Description

Create `apps/web/components/idea-description-card.tsx` — a **client component**.

- Static card showing the idea's description text
- If no description, show "No description yet" in muted text with an "Add description" button
- Inline editable: clicking the text or an edit icon enters an inline textarea. On blur or Enter, save via `updateIdeaAction`. On Escape, cancel.
- Use the `card` / `card__header` / `card__body` pattern

### Card: Notes Log

Create `apps/web/components/idea-notes-log.tsx` — a **client component**.

This is the core workspace feature. It displays a chronological log of timestamped notes and provides a form to append new ones.

**Layout:**

```
┌─────────────────────────────────────────┐
│  Notes (3)                    [Expand]  │
├─────────────────────────────────────────┤
│                                         │
│  ┌── Mar 21, 2026 ──────────────────┐   │
│  │ Talked to the neighbor, he       │   │
│  │ recommends a specific contractor │   │
│  │ for the deck work.          [×]  │   │
│  └──────────────────────────────────┘   │
│                                         │
│  ┌── Mar 18, 2026 ──────────────────┐   │
│  │ Lumber prices dropped 15% this   │   │
│  │ month according to the index. [×]│   │
│  └──────────────────────────────────┘   │
│                                         │
│  ┌── Mar 12, 2026 ──────────────────┐   │
│  │ Saw a great composite deck on    │   │
│  │ the walk today. Research Trex.   │   │
│  │                              [×] │   │
│  └──────────────────────────────────┘   │
│                                         │
│  ┌─────────────────────────────────┐    │
│  │ Add a note...              [Add]│    │
│  └─────────────────────────────────┘    │
│                                         │
└─────────────────────────────────────────┘
```

**Behavior:**
- Notes display newest first
- Each note shows the text and a formatted date (e.g., "Mar 21, 2026" or "2 days ago" for recent notes)
- Each note has a small delete button (×) that calls `removeIdeaNoteAction`
- The bottom of the card has a textarea + "Add" button. Submitting calls `addIdeaNoteAction` and optimistically prepends the note to the list
- The textarea auto-focuses after submission so the user can rapid-fire add notes
- If there are no notes, show "No notes yet. Start building context for this idea." in muted text

### Card: Links / Bookmarks

Create `apps/web/components/idea-links-card.tsx` — a **client component**.

**Layout:**

```
┌─────────────────────────────────────────┐
│  Links (2)                              │
├─────────────────────────────────────────┤
│                                         │
│  🔗 Trex Composite Decking Guide  [×]  │
│     trex.com/resources/guide            │
│                                         │
│  🔗 Deck Cost Calculator          [×]  │
│     decks.com/calculator                │
│                                         │
│  ┌── URL ────────── Label ─── [Add] ┐   │
│  └──────────────────────────────────┘   │
│                                         │
└─────────────────────────────────────────┘
```

**Behavior:**
- Each link shows the label as a clickable anchor (opens in new tab) and the URL hostname below it in muted text
- Each link has a delete button (×) that calls `removeIdeaLinkAction`
- Bottom add form has two inline inputs (URL and label) plus an "Add" button
- Calls `addIdeaLinkAction` on submit
- If no links, show "No links saved yet."

---

## 3.4 Aside column components

### Card: Status & Meta

A static card showing:
- **Stage** selector — a small set of 3 radio buttons or a segmented control (Spark / Developing / Ready) that updates the stage on click via `updateIdeaStageAction`
- **Priority** selector — a dropdown (Low / Medium / High) that updates via `updateIdeaAction`
- **Category** selector — a dropdown of categories that updates via `updateIdeaAction`
- **Created** date — formatted relative date
- **Last updated** date — formatted relative date

Make this a client component: `apps/web/components/idea-status-card.tsx`.

### Card: Promotion Target

A static card showing:
- If not promoted: a dropdown to set the intended destination (Project / Asset / Hobby / Undecided) and a "Promote Now" button that triggers the promotion flow
- If promoted: a read-only display showing "Promoted to [Project/Asset/Hobby]" with a link to the created entity, and the promotion date
- If demoted from something: a note showing "Demoted from [type] on [date]" with a link to the source entity

Make this a client component: `apps/web/components/idea-promotion-card.tsx`.

**Promote flow:**
1. User clicks "Promote Now"
2. A small inline form appears asking for optional name/description overrides (pre-filled from the idea)
3. User confirms — calls `promoteIdeaAction`
4. On success, redirect to the newly created entity's detail page (e.g., `/projects/[newProjectId]`)

### Card: Provenance

A collapsible card (using `CollapsibleCard` component) that shows:
- `demotedFromType` and `demotedFromId` if this idea was demoted from something — with a link to that entity
- Creation metadata (who created it, when)
- Default collapsed. Summary: "Created Mar 12" or "Demoted from Project on Mar 15"

---

## 3.5 Full-width cards below the grid

### Card: Materials & Resources

Create `apps/web/components/idea-materials-card.tsx` — a **client component**.

Render this as a full-width card below the two-column grid (same pattern as how project detail has full-width sections below the grid).

**Layout:** Use the existing `workbench-table` pattern — a table with columns: Item, Quantity, Notes, and a delete button. Add row button at the bottom.

**Behavior:**
- Inline editing: all cells are editable inline (input fields in the table cells)
- Adding a row appends a blank row with auto-focused first cell
- Removing a row removes it from the array
- On any change, debounce 500ms then call `updateIdeaAction` with the full `materials` array
- This is the same pattern already used in `idea-workbench.tsx` — preserve the existing UX, just wire it to the API instead of localStorage

### Card: Steps Checklist

Create `apps/web/components/idea-steps-card.tsx` — a **client component**.

**Layout:**

```
┌─────────────────────────────────────────┐
│  Steps (3/5 completed)                  │
├─────────────────────────────────────────┤
│  ☑ 1. Research decking materials        │
│  ☑ 2. Get contractor quotes             │
│  ☑ 3. Check HOA requirements            │
│  ☐ 4. Create budget spreadsheet         │
│  ☐ 5. Schedule contractor walkthrough   │
│                                         │
│  [+ Add step]                           │
└─────────────────────────────────────────┘
```

**Behavior:**
- Each step has a checkbox toggle and an editable label
- Checking/unchecking a step calls `updateIdeaAction` with the full `steps` array (toggling the `done` boolean)
- Steps can be reordered via drag-and-drop (native HTML drag, same pattern as the board cards)
- Steps can be removed via a small × button on hover
- Adding a step appends a new unchecked step
- The header shows progress: "Steps (3/5 completed)"

---

## 3.6 CSS additions

Add to `apps/web/app/globals.css`:

```css
/* ── Idea Detail ────────────────────────────────────────────────── */

.idea-note-entry {
  background: var(--surface-alt);
  border-radius: var(--radius-lg);
  padding: 12px 14px;
  position: relative;
}

.idea-note-entry__date {
  font-size: 0.72rem;
  color: var(--ink-muted);
  margin-bottom: 4px;
  font-weight: 500;
}

.idea-note-entry__text {
  font-size: 0.84rem;
  color: var(--ink);
  white-space: pre-wrap;
  line-height: 1.5;
}

.idea-note-entry__remove {
  position: absolute;
  top: 8px;
  right: 8px;
  opacity: 0;
  transition: opacity 150ms ease;
}

.idea-note-entry:hover .idea-note-entry__remove {
  opacity: 1;
}

.idea-note-form {
  display: flex;
  gap: 8px;
  align-items: flex-end;
  margin-top: 12px;
}

.idea-note-form textarea {
  flex: 1;
  min-height: 60px;
  resize: vertical;
}

.idea-link-entry {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  padding: 8px 0;
  border-bottom: 1px solid var(--border);
}

.idea-link-entry:last-of-type {
  border-bottom: none;
}

.idea-link-entry__label {
  font-size: 0.84rem;
  font-weight: 500;
  color: var(--accent);
}

.idea-link-entry__url {
  font-size: 0.72rem;
  color: var(--ink-muted);
}

.idea-link-form {
  display: flex;
  gap: 8px;
  align-items: flex-end;
  margin-top: 12px;
}

.idea-step-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 6px 0;
}

.idea-step-item input[type="checkbox"] {
  flex-shrink: 0;
}

.idea-step-item--done .idea-step-item__label {
  text-decoration: line-through;
  color: var(--ink-muted);
}

.idea-step-item__label {
  flex: 1;
  font-size: 0.84rem;
}

.idea-step-item__number {
  font-size: 0.8rem;
  color: var(--ink-muted);
  min-width: 22px;
}

/* Stage selector (segmented control in aside) */
.stage-selector {
  display: flex;
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  overflow: hidden;
}

.stage-selector__option {
  flex: 1;
  padding: 6px 10px;
  font-size: 0.78rem;
  font-weight: 500;
  text-align: center;
  cursor: pointer;
  border: none;
  background: var(--surface);
  color: var(--ink-muted);
  transition: background 150ms ease, color 150ms ease;
}

.stage-selector__option:not(:last-child) {
  border-right: 1px solid var(--border);
}

.stage-selector__option--active {
  background: var(--accent);
  color: white;
}
```

---

## 3.7 Navigation wiring

Update the idea list page (`/ideas`) to make each idea title/row a clickable link to `/ideas/[ideaId]`. Both the board cards and table rows should be links.

In the board view, wrap the card content in a `<Link>` to the detail page. The drag functionality should still work — start the drag handler on `onDragStart` and navigate on click only if the drag didn't fire.

---

## Constraints and boundaries

- Do NOT modify any existing component outside the Ideas domain.
- Do NOT install new dependencies.
- Do NOT create separate CSS files. All styles go in `globals.css`.
- Do NOT use `any` types.
- Follow the same component patterns used by project detail and hobby detail pages.
- Use optimistic updates where appropriate (notes, links, steps) to keep the UI responsive.
- All client components must have `"use client"` directive.
- Server components fetch data; client components handle interactivity.
