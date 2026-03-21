# LifeKeeper — Ideas Feature Phase 4: Create & Edit Workbench

This document covers refactoring the idea creation page and adding an edit mode for existing ideas.

**Prerequisites:** Phases 1-3 must be complete (backend, list page, detail page).

**Execution model:** This prompt is designed for GitHub Copilot Agent mode. Read the entire document before writing any code. All changes must be additive and non-breaking.

---

## 4.1 Refactor the creation workbench

The existing `apps/web/components/idea-workbench.tsx` currently saves to localStorage. Refactor it to call the real API.

### Changes to `idea-workbench.tsx`

1. The component should accept an optional `idea` prop for edit mode. When present, the form is pre-populated with the idea's data and submits via `updateIdeaAction`. When absent, it creates via `createIdeaAction`.

2. Replace the `saveIdea()` function (localStorage) with API calls:
   - Create mode: call `createIdeaAction(householdId, data)`, then redirect to `/ideas/[newIdeaId]`
   - Edit mode: call `updateIdeaAction(householdId, ideaId, data)`, then redirect to `/ideas/[ideaId]`

3. The component needs the `householdId`. Receive it as a prop from the parent page (the page fetches the household context as a server component and passes it down).

4. Keep the existing layout structure — it already uses cards and the `workbench-layout` two-column pattern correctly. The main adjustments are:
   - Wire materials to API format (add `id` fields via `crypto.randomUUID()` on creation)
   - Wire tasks/steps to API format (add `id` and `done: false` on creation)
   - Add **category** and **priority** selectors to the aside column

5. Update the aside "Escalate Later" card:
   - Rename to "Promotion Target"
   - Keep the dropdown (Project / Asset / Hobby / Undecided)
   - This maps to the `promotionTarget` field on the API

6. Add a new aside card: **Priority & Category**
   - Priority: radio buttons or dropdown (Low / Medium / High), default Medium
   - Category: dropdown of category options (Home Improvement, Vehicle, Outdoor, etc.)

7. Add a new aside card: **Initial Stage**
   - Segmented control (Spark / Developing / Ready), default Spark
   - Only shown in create mode. In edit mode, the stage is changed from the detail page.

### Props for the refactored component

```typescript
type IdeaWorkbenchProps = {
  householdId: string;
  idea?: Idea; // When present, edit mode
};
```

---

## 4.2 Edit page

Create `apps/web/app/(dashboard)/ideas/[ideaId]/edit/page.tsx`.

This is a **server component** page that:

1. Fetches the idea by ID (same pattern as `/hobbies/[hobbyId]/edit/page.tsx`).
2. Renders the standard page header: "Edit Idea" with a back link to `/ideas/[ideaId]`.
3. Renders `<IdeaWorkbench householdId={householdId} idea={idea} />`.

The page reuses the same workbench component — the `idea` prop triggers edit mode.

---

## 4.3 Update creation page

Update `apps/web/app/(dashboard)/ideas/new/page.tsx`:

1. Make it a server component that fetches the household context.
2. Pass `householdId` to `<IdeaWorkbench householdId={householdId} />`.
3. Keep the existing page header ("Capture an Idea").

---

## 4.4 Quick capture popover

Create `apps/web/components/idea-quick-capture.tsx` — a **client component**.

This provides a lightweight way to capture an idea from anywhere in the app without navigating away from the current page. It should be accessible from the sidebar navigation.

### Trigger

Add a small "+" button next to the "Ideas" sidebar nav item (or in the sidebar footer area). Clicking it opens a popover/flyout anchored to the button.

### Popover content

A minimal form with:
- **Title** input (required) — auto-focused when the popover opens
- **Notes** textarea (optional) — for quick context
- **Save** button — creates the idea via `createIdeaAction` with `stage: "spark"` and closes the popover
- **Cancel** button — closes the popover
- Keyboard: Escape closes, Cmd/Ctrl+Enter submits

### Popover behavior

- Use a portal to render the popover above the sidebar
- Light backdrop click closes the popover
- On successful save, show a small toast/notification "Idea captured" (use the existing notification pattern if one exists, or a simple CSS animation that fades in and out)
- The popover does NOT navigate — the user stays on their current page

### Implementation

Do NOT use a library for the popover. Implement it as:
- A `<div>` with `position: fixed` anchored below the trigger button
- z-index above the sidebar
- Simple fade/slide-in CSS animation

### CSS

Add to `globals.css`:

```css
/* ── Quick Capture Popover ──────────────────────────────────────── */

.quick-capture-popover {
  position: fixed;
  z-index: 1000;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  box-shadow: 0 8px 30px rgba(0, 0, 0, 0.12);
  padding: 16px;
  width: 340px;
  animation: popover-in 150ms ease;
}

@keyframes popover-in {
  from {
    opacity: 0;
    transform: translateY(-8px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.quick-capture-popover__backdrop {
  position: fixed;
  inset: 0;
  z-index: 999;
}

.quick-capture-popover h3 {
  font-size: 0.88rem;
  font-weight: 600;
  margin: 0 0 12px;
  color: var(--ink);
}

.quick-capture-popover .field {
  margin-bottom: 10px;
}

.quick-capture-popover__actions {
  display: flex;
  gap: 8px;
  justify-content: flex-end;
  margin-top: 12px;
}

.quick-capture-toast {
  position: fixed;
  bottom: 24px;
  left: 50%;
  transform: translateX(-50%);
  background: var(--ink);
  color: var(--surface);
  padding: 8px 20px;
  border-radius: 20px;
  font-size: 0.82rem;
  font-weight: 500;
  z-index: 1001;
  animation: toast-in 200ms ease, toast-out 200ms ease 2s forwards;
}

@keyframes toast-in {
  from { opacity: 0; transform: translateX(-50%) translateY(12px); }
  to { opacity: 1; transform: translateX(-50%) translateY(0); }
}

@keyframes toast-out {
  from { opacity: 1; }
  to { opacity: 0; }
}
```

### Sidebar integration

Modify the sidebar layout (in `apps/web/app/(dashboard)/layout.tsx` or wherever the sidebar nav items are defined) to:

1. Add a small "+" icon button next to the Ideas nav item
2. When clicked, render the `<IdeaQuickCapture>` popover
3. The popover receives `householdId` as a prop

Look at how the sidebar currently renders to find the right integration point. The key files are `apps/web/components/sidebar-nav.tsx` and the dashboard layout that renders it.

---

## 4.5 Link idea detail to edit

On the idea detail page (`/ideas/[ideaId]`), add an "Edit" button in the page header actions that navigates to `/ideas/[ideaId]/edit`.

---

## Constraints and boundaries

- Do NOT modify any existing component outside the Ideas domain (except the minimal sidebar integration for quick capture).
- Do NOT install new dependencies.
- Do NOT create separate CSS files.
- Do NOT use `any` types.
- The quick capture popover must be lightweight — no heavy modal library, no context providers.
- The workbench should handle both create and edit in a single component.
- Clean up any remaining localStorage references from the prototype code.
