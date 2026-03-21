# LifeKeeper — Ideas Feature Phase 6: Polish, Migration, and Cleanup

This document covers final polish, the localStorage-to-API migration helper, accessibility, responsive behavior, and cleanup of prototype code.

**Prerequisites:** Phases 1-5 must be complete.

**Execution model:** This prompt is designed for GitHub Copilot Agent mode. Read the entire document before writing any code. All changes must be additive and non-breaking.

---

## 6.1 localStorage migration helper

Users who used the prototype may have ideas stored in `localStorage` under the key `lifekeeper_ideas`. These should not be silently lost.

### Migration component

Create `apps/web/components/idea-local-migration.tsx` — a **client component**.

**Behavior:**
1. On mount, check `localStorage` for the `lifekeeper_ideas` key
2. If ideas exist and have not been migrated (check a separate `lifekeeper_ideas_migrated` flag):
   - Show a banner at the top of the Ideas list page:
     ```
     ┌──────────────────────────────────────────────────────────────┐
     │  You have {N} ideas saved locally from before the upgrade.  │
     │  [Import to your account]    [Dismiss]                      │
     │  These will be created as new Spark-stage ideas.             │
     └──────────────────────────────────────────────────────────────┘
     ```
3. On "Import to your account":
   - Iterate through the localStorage ideas
   - For each, call `createIdeaAction` with:
     - `title` from the stored idea
     - `description` from the stored idea
     - `materials` from the stored idea (map to API format with generated IDs)
     - `steps` from the stored `tasks` array (map `label` → step with generated ID, `done: false`)
     - `promotionTarget` from the stored `escalateTo` field (if "project", "asset", or "hobby")
     - `stage: "spark"`
   - Show progress: "Importing 3/5..."
   - On completion, set `lifekeeper_ideas_migrated = "true"` in localStorage
   - Show success: "All ideas imported!"
   - Refresh the idea list

4. On "Dismiss":
   - Set `lifekeeper_ideas_migrated = "true"` in localStorage
   - Hide the banner
   - The localStorage data is preserved but the banner won't show again

### Integration

Render `<IdeaLocalMigration householdId={householdId} />` at the top of the Ideas list page, before the filter controls and idea list/board.

### CSS

```css
.migration-banner {
  padding: 12px 16px;
  background: color-mix(in srgb, var(--info) 8%, transparent);
  border: 1px solid color-mix(in srgb, var(--info) 20%, transparent);
  border-radius: var(--radius-lg);
  margin-bottom: 16px;
  font-size: 0.84rem;
  color: var(--ink);
}

.migration-banner__actions {
  display: flex;
  gap: 8px;
  margin-top: 8px;
}

.migration-banner__progress {
  font-size: 0.78rem;
  color: var(--ink-muted);
  margin-top: 6px;
}
```

---

## 6.2 Accessibility audit

Review all components created in Phases 2-5 and ensure they meet accessibility standards:

### Board view (`idea-list.tsx`)

- Each board column should have `role="list"` and each card `role="listitem"`
- Draggable cards: add `aria-grabbed` and `aria-dropeffect` attributes during drag operations
- Each card should be focusable via keyboard (`tabIndex={0}`)
- Add keyboard stage-move: when a card is focused, pressing `←` / `→` arrow keys (or a keyboard shortcut) should offer to move the card to the adjacent column. Use a dropdown triggered by a keyboard shortcut rather than auto-moving, to prevent accidental changes.
- Column headers should use `<h2>` or `<h3>` (not just styled divs)

### Notes log (`idea-notes-log.tsx`)

- The "Add" button should have `aria-label="Add note"`
- The delete button on each note should have `aria-label="Remove note from [date]"`
- The textarea should have `aria-label="New note text"`
- After adding a note, announce to screen readers: use `aria-live="polite"` on the notes list container

### Links card (`idea-links-card.tsx`)

- Link anchors should have `rel="noopener noreferrer"` and `target="_blank"`
- Delete buttons: `aria-label="Remove link [label]"`

### Steps checklist (`idea-steps-card.tsx`)

- Checkboxes: proper `<label>` association with the checkbox input
- Step list: `role="list"` on the container
- Drag reorder: `aria-label="Reorder step [label]"` on drag handle

### Quick capture popover (`idea-quick-capture.tsx`)

- Focus trap: when open, Tab cycles within the popover. Focus returns to the trigger button on close.
- `role="dialog"` and `aria-modal="true"` on the popover
- `aria-label="Quick capture an idea"` on the popover
- Escape key closes the popover

### Promotion form (`idea-promotion-card.tsx`)

- Target options should use `role="radiogroup"` with `role="radio"` on each option
- `aria-checked` on the selected option
- Keyboard: arrow keys move between options, Enter/Space selects

### Stage selector (`idea-status-card.tsx`)

- `role="radiogroup"` on the container
- `role="radio"` and `aria-checked` on each segment
- Keyboard: arrow keys move selection

---

## 6.3 Responsive behavior

Verify and fix these responsive issues across all idea pages:

### Ideas list page (board view) — below 768px

- Board columns should stack vertically (already handled by CSS in Phase 2)
- Each column should show its header with a count
- Cards should be full-width

### Ideas list page (table view) — below 768px

- The table should become scrollable horizontally, or
- Less important columns (link count, material count) should hide on mobile via `display: none` in a media query

Add to `globals.css`:

```css
@media (max-width: 768px) {
  .idea-table .col-links,
  .idea-table .col-materials {
    display: none;
  }
}
```

### Idea detail page — below 768px

- The two-column `resource-layout` already collapses to single-column (UI Design Guide handles this)
- Full-width cards (materials, steps) should remain full-width
- The aside cards should stack below the primary cards

### Quick capture popover — below 768px

- On mobile, the popover should become a full-width panel anchored to the bottom of the screen (bottom sheet pattern):

```css
@media (max-width: 768px) {
  .quick-capture-popover {
    position: fixed;
    bottom: 0;
    left: 0;
    right: 0;
    width: 100%;
    border-radius: var(--radius-lg) var(--radius-lg) 0 0;
    animation: popover-in-mobile 200ms ease;
  }

  @keyframes popover-in-mobile {
    from {
      opacity: 0;
      transform: translateY(100%);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }
}
```

---

## 6.4 Empty states

Ensure all empty states have helpful, action-oriented messaging:

| Component | Empty state message |
|-----------|-------------------|
| Board view (no ideas at all) | "No ideas yet. Capture your first spark to get started." + [New Idea] button |
| Board column (e.g., no "Ready" ideas) | "No ideas at this stage yet." (small muted text, no button) |
| Table view (no ideas) | Same as board |
| Notes log (no notes) | "No notes yet. Build context for this idea over time." |
| Links card (no links) | "No links saved. Bookmark useful references as you find them." |
| Materials card (no items) | "No materials listed. Add items you might need." |
| Steps card (no steps) | "No steps defined. Break this idea into rough actions." |
| Dashboard ideas panel (no ideas) | "No ideas captured yet." + [Quick Capture] link |

---

## 6.5 Prototype cleanup

After migration support is in place, clean up residual prototype patterns:

1. **Remove the `STORAGE_KEY` constant** from `idea-list.tsx` and `idea-workbench.tsx` — all localStorage access should now be isolated in `idea-local-migration.tsx`.

2. **Remove the `StoredIdea` type** from both files — the real `Idea` and `IdeaSummary` types from `@lifekeeper/types` replace it.

3. **Remove the `saveIdea()` function** from `idea-workbench.tsx` — replaced by API calls.

4. **Remove the `escalateLabels` and `escalateHrefs` maps** from `idea-list.tsx` — the promotion target now lives on the idea object and is handled by the promotion card.

5. Verify that no component still reads from or writes to `localStorage` for idea data (except the migration helper).

---

## 6.6 Final integration checklist

Before considering the Ideas feature complete, verify:

- [ ] **Schema**: `Idea` model exists in Prisma with all fields, enums, and indexes
- [ ] **Types**: All Zod schemas and TypeScript types exist in `packages/types`
- [ ] **API routes**: All 12 endpoints work (list, create, get, update, delete, add note, remove note, add link, remove link, move stage, promote, demote)
- [ ] **Serializers**: `toIdeaResponse` and `toIdeaSummaryResponse` produce correct output
- [ ] **Activity log**: All mutating operations log activity
- [ ] **Search index**: Ideas are indexed and searchable via the global search
- [ ] **Web API client**: All methods in `api.ts` work
- [ ] **Server actions**: All actions in `actions.ts` work with revalidation
- [ ] **Ideas list page**: Board and table views render correctly with filtering
- [ ] **Board drag-and-drop**: Cards can be dragged between columns to change stage
- [ ] **Idea detail page**: All cards render and interact correctly (description, notes, links, materials, steps, status, promotion, provenance)
- [ ] **Create page**: New ideas are created via the API with all fields
- [ ] **Edit page**: Existing ideas can be edited via the workbench
- [ ] **Quick capture**: Popover creates spark-stage ideas without navigation
- [ ] **Promotion**: Ideas can be promoted to projects, assets, or hobbies with data carryover
- [ ] **Demotion**: Projects, assets, and hobbies can be demoted back to ideas
- [ ] **Provenance**: Promoted ideas show links to created entities; created entities show links back to source ideas
- [ ] **Dashboard**: Ideas panel shows stage counts and recent ideas
- [ ] **Sidebar**: Ideas nav item works, quick capture button works
- [ ] **Migration**: localStorage prototype data can be imported
- [ ] **Accessibility**: All ARIA roles, labels, and keyboard interactions are correct
- [ ] **Responsive**: All pages work correctly at 768px and below
- [ ] **Empty states**: All components have helpful empty-state messaging
- [ ] **Seed data**: Sample ideas exist in the dev database
- [ ] **No regressions**: Existing project, asset, hobby, and inventory functionality is unchanged

---

## Constraints and boundaries

- Do NOT modify existing feature behavior.
- Do NOT install new dependencies.
- Do NOT create separate CSS files.
- Do NOT use `any` types.
- The migration helper is a courtesy feature — it should fail gracefully if localStorage data is malformed.
- If any checklist item fails, fix it before moving on.
