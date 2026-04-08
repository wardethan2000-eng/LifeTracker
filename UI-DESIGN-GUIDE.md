# Aegis UI Design Guide

**Version 2.0 — March 2026**
**Status: Active — all new UI work must follow this guide**

This document is the single source of truth for Aegis's UI architecture, layout patterns, component behavior, and visual language. It is written for GitHub Copilot and human developers alike. Every screen, component, and interaction pattern in the web application is covered here.

---

## Table of contents

1. [Design philosophy](#1-design-philosophy)
2. [Layout system](#2-layout-system)
3. [Card system](#3-card-system)
4. [Component library](#4-component-library)
5. [Screen-by-screen specifications](#5-screen-by-screen-specifications)
6. [Color and status language](#6-color-and-status-language)
7. [Spacing and density](#7-spacing-and-density)
8. [Responsive behavior](#8-responsive-behavior)
9. [Implementation phases](#9-implementation-phases)
10. [Navigation architecture](#10-navigation-architecture)
11. [Universal page and overview templates](#11-universal-page-and-overview-templates)
12. [Empty states](#12-empty-states)
13. [Destructive actions and confirmations](#13-destructive-actions-and-confirmations)
14. [Error and loading feedback](#14-error-and-loading-feedback)
15. [Component selection guide](#15-component-selection-guide)

---

## 1. Design philosophy

### Core principles

Aegis is **not a form-filling application.** Users do not want to navigate to a separate "edit" page, fill out a long form, and click Save just to change an asset's location or a project's status. Every piece of data in the system should be editable where it is read — in the same card, in the same panel, without changing pages.

The product manages genuinely complex data: maintenance schedules, multi-field asset profiles, project phases, inventory, household coordination. Handling that complexity well requires two things that must be kept in constant balance:

**Beauty and intuitiveness.** The interface should feel immediate and responsive. A new user should understand how to navigate it without reading documentation. Visual hierarchy guides the eye: important things are prominent, secondary things are accessible but not in the way. Whitespace and restraint matter as much as information density.

**High customizability.** Aegis users configure everything — custom fields, maintenance schedules, metric templates, project phases, reorder rules. The UI must make customization feel frictionless, not bureaucratic. Inline editing, drag-and-drop reordering, and click-to-edit fields are the primary vehicles for customization. Users should feel like they are directly manipulating data, not submitting forms.

**Edit where you read.** This is the single most important UX principle in the product. When a user looks at an asset's purchase details, location, or maintenance schedule, they should be able to click into any value and change it without leaving the screen. Navigating to a separate page to edit a metadata field is always wrong. Forms are appropriate only when creating something new from scratch.

**Progressive disclosure.** Not all information is needed at once. Collapsible cards, expandable sections, and tabbed navigation exist to reveal detail progressively as the user needs it — not to hide information, but to prevent cognitive overload on first view. The overview is clean. The details expand on demand.

**Density without clutter.** Every piece of information earns its screen space. Cards group related fields so users can scan section headers to find what they need. Collapsible cards hide secondary metadata until needed. Inline expand/collapse gives complex editors (schedules, custom fields) the full-width breathing room they require without bloating the parent page.

**Cards are containers, not decorations.** Cards exist to group related fields under a scannable heading. They are thin-bordered containers with tight internal spacing — not standalone decorative boxes with heavy shadows and excessive padding.

### Two disclosure levels

The application uses two levels of information presentation, not two rigid "surface types":

- **Overview / reading level** (dashboard, list pages, entity overview tabs): Optimized for scanning. Shows status, summary stats, recent activity. Nothing here requires a full form to interact with — quick actions are inline.
- **Detail / editing level** (entity detail tabs, settings, creation flows): Shows the full data model. Uses the two-column card layout. Editing is done inline within each card, not by navigating to a separate route.

The only time a dedicated form page is appropriate is on creation flows (e.g., `/assets/new`, `/projects/new`) where the entity does not yet exist and inline editing is not possible.

### What this guide replaces

This guide supersedes the previous `.asset-studio--{mode}` CSS class hierarchy and the flat `workbench-section` pattern. The workbench form internals (field grids, table patterns, input styling) are preserved — they now live inside card containers. The practice of building read-only panels that require navigating to a settings page to edit any value is deprecated.

### Universal domain tool feature requirements

Every primary domain workspace tool (Assets, Projects, Hobbies, Ideas) **must** provide the following tabs and interaction patterns. These are non-negotiable and must be preserved whenever a layout file or tab-nav component is modified.

**Required tab surface matrix:**

| Feature | Pattern | Component |
|---------|---------|-----------|
| Notes / Journal | `EntryTimeline` (`entityType=<domain>`) | Reading surface, single column |
| Canvas | `EntityCanvasList` (`entityType=<domain>`) | Reading surface, single column |
| Comments | `EntityComments` (domain-specific actions) | Reading surface, single column |
| Activity / History | `getHouseholdActivity` filtered by entityId | Reading surface, single column |
| **Inventory** (where applicable) | Linked inventory items panel with add/remove | Mixed surface — server data, client interaction |

**Inventory tab rule:** Assets, Hobbies, and Projects each have an inventory linking feature. This tab **must** be present in their tab navigation. Ideas do not have inventory by default.

### Inline editing on detail/reading panels

**Rule:** Panels that display metadata (purchase details, warranty, location, insurance, etc.) on reading-surface tabs must support inline editing — they must **not** require the user to navigate to a separate settings/edit page to change that data.

**Pattern:**
- Panel renders as a `.panel` section with an "Edit" button (`button--ghost button--xs`) in `.panel__header`.
- Clicking "Edit" replaces the `<dl className="data-list">` read view with a `.workbench-grid` form.
- Form has "Save" and "Cancel" buttons.
- "Save" calls a server action (e.g. `updateAssetFieldAction`) directly from the client component using `useTransition`.
- On success, the panel returns to read mode showing updated values.
- On error, an inline error message is shown below the form.

**Implementation:** Client components that follow this pattern live in `components/asset-details-cards.tsx`. When adding a new inline-editable domain, create analogous card components following the same file/naming pattern.

**Do not** build read-only panels for fields the user will frequently need to change. If it's metadata about the entity, it should be editable inline.

### Interaction model

Aegis supports three inline interaction patterns. Use the right one for the data type:

#### 1. Click-to-edit (field-level)

For critical identity fields displayed prominently in page headers — asset name, manufacturer, model, description — use the `ClickToEdit` component (`apps/web/components/click-to-edit.tsx`). The value renders as styled display text. Clicking anywhere on the value (or tabbing to it) activates an input. Pressing Enter or blurring saves immediately (calls the server action). No separate Save button is shown.

**Reference implementation:** `AssetHeroEditor` (`apps/web/components/asset-hero-editor.tsx`). The asset name, manufacturer, model, and description in the detail page header are all click-to-edit. There is no "Edit Asset" button needed for these core identity fields.

Use click-to-edit when:
- The field is a single value (text, number, date)
- The field is prominent and frequently changed (name, title, status)
- The user expects direct manipulation without a modal

#### 2. Panel-level edit (grouped fields)

For a group of related fields displayed together (purchase details, warranty info, location), use the panel edit button pattern. The panel header has a small "Edit" button (`button--ghost button--xs`). Clicking it switches the `<dl className="data-list">` to a `.workbench-grid` form in-place. Save and Cancel are shown below the form. Saving returns to read mode.

**Reference implementation:** `apps/web/components/asset-details-cards.tsx`

Use panel-level edit when:
- Multiple related fields need to be edited together
- Fields have explicit labels and types (select, date, textarea)
- A grouped commit (Save/Cancel) is appropriate

#### 3. Drag-and-drop reordering

Any ordered list in the product — maintenance schedules, custom field definitions, project phases, tasks, metric templates — must support drag-to-reorder. The user grabs a drag handle (`⠿` icon, `cursor: grab`) on any row and drops it in the new position. Saving order happens immediately on drop via a server action.

Rules:
- Drag handles appear on hover (or are always visible on touch devices)
- Use the `draggable` HTML attribute + `dragstart`/`dragover`/`drop` events, or a lightweight wrapper hook
- The reordered array is sent as `{ orderedIds: string[] }` to the relevant server action
- Animate the drop with a brief transition on the moved row
- Never require a separate "Save Order" button — the drag-drop interaction is the save

CSS: The drag handle cell in a `workbench-table` row uses class `.drag-handle`. The row being dragged gets class `.dragging` (reduced opacity). The drop target row gets class `.drag-over` (top border highlight).

### Text economy

**The UI should never explain itself.** Aegis's users are not confused; they do not need walls of text to use the product. Every string rendered in the interface should be evaluated: is this word necessary? Can the user infer this from context?

#### Labels and placeholders

Prefer placeholder text over labels when the field's purpose is obvious from context. In a `.workbench-grid` inside a "Purchase Details" card, a "Price" label is redundant alongside a `$` input prefix — the placeholder `"0.00"` communicates enough. Reserve explicit labels for fields where the name is not obvious.

Do not repeat the section name in field labels. Inside a "Warranty Info" card, the label is "Expires" not "Warranty Expiry Date." The card heading already provides context.

#### Contextual language

Language should tell the user what is *actionable* and *true right now*, not just what the state is called internally:

| ❌ Avoid | ✅ Use instead | Why |
|----------|----------------|-----|
| Deleted | Recently Deleted | Implies the action is reversible |
| No records found | No schedules yet | Specific to the context, implies they can add one |
| Create new record | Add schedule | Use plain verbs specific to the domain |
| Status: Active | An `active` pill | A pill communicates status without the word "Status:" |
| Error occurred | Couldn't save. Try again. | Tells the user what to do next |
| Loading... | *(skeleton or spinner only)* | Remove the word if a visual already communicates it |
| Settings | Advanced | Better conveys that this tab is for low-frequency power settings |

#### Button labels

Use short, specific verbs. Never use "Submit," "OK," or "Confirm" as standalone labels — attach them to the action: "Save Changes," "Delete Asset," "Archive Project," "Mark Complete."

Destructive confirm buttons must name what they destroy: "Delete Asset," not "Confirm." Ghost/cancel buttons use a single word: "Cancel," "Discard," "Undo."

#### Empty states

Empty state copy follows a strict formula: title (what's missing, 2–5 words) + body (what it does and how to add one, 1 sentence). No more than these two elements unless an action button is warranted. Do not use phrases like "It looks like," "There are currently no," or "You haven't added any yet."

---

## 2. Layout system

### Two-column resource detail layout

All working surfaces (creation, editing, settings) use a two-column layout inspired by Shopify's resource detail pattern.

```
┌─────────────────────────────────────────────────────────┐
│  Page header (title, breadcrumb, primary actions)       │
├───────────────────────────────────┬─────────────────────┤
│                                   │                     │
│  PRIMARY COLUMN (2fr)             │  ASIDE COLUMN (1fr) │
│                                   │                     │
│  Card: Core Identity              │  Card: Status       │
│  Card: Custom Fields (expandable) │  Card: Template     │
│  Card: Schedules (expandable)     │  Card: Purchase ▾   │
│  Card: Usage Metrics (expandable) │  Card: Warranty ▾   │
│                                   │  Card: Location ▾   │
│                                   │  Card: Insurance ▾  │
│                                   │  Card: Condition ▾  │
├───────────────────────────────────┴─────────────────────┤
│  Sticky Save Bar                                        │
└─────────────────────────────────────────────────────────┘
```

**CSS implementation:**

```css
.resource-layout {
  display: grid;
  grid-template-columns: 2fr 1fr;
  gap: 20px;
  align-items: start;
}

.resource-layout__primary {
  display: grid;
  gap: 16px;
}

.resource-layout__aside {
  display: grid;
  gap: 12px;
  position: sticky;
  top: 24px;
}
```

**Rules:**
- Primary column holds content that defines the resource: identity fields, the main data tables (schedules, custom fields, metrics), and any inline editing forms.
- Aside column holds supporting metadata: status badges, template/preset info, purchase details, warranty, location, insurance, condition score, and similar reference data.
- On screens narrower than 768px, the layout collapses to a single column with the aside content stacking below the primary content.

### Single-column full-width layout

Reading surfaces (dashboard, asset list, inventory list, maintenance queue) use a single-column full-width layout. These pages already follow this pattern and do not change.

### Page header pattern

Every page starts with a consistent header:

```
┌─────────────────────────────────────────────────────────┐
│  ← Back to [Parent]                  [Secondary Action] │
│  Category eyebrow                    [Primary Action]   │
│  Page Title                                             │
│  Subtitle / description                                 │
└─────────────────────────────────────────────────────────┘
```

The existing `.page-header` and `.detail-topbar` classes serve this purpose. No changes needed.

---

## 3. Card system

### Card anatomy

Every card follows this structure:

```
┌─────────────────────────────────────────┐
│  Card Header                            │
│  ┌─ Title ─────────── Actions ────────┐ │
│  │  Section Name       [Expand] [Edit]│ │
│  └────────────────────────────────────┘ │
│  Optional summary line (collapsed view) │
├─────────────────────────────────────────┤
│  Card Body                              │
│  (form fields, tables, content)         │
│                                         │
└─────────────────────────────────────────┘
```

**CSS implementation:**

```css
.card {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  overflow: hidden;
}

.card__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 12px 16px;
  border-bottom: 1px solid var(--border);
}

.card__header h3 {
  font-size: 0.9rem;
  font-weight: 600;
  color: var(--ink);
  margin: 0;
}

.card__header-actions {
  display: flex;
  align-items: center;
  gap: 6px;
}

.card__body {
  padding: 16px;
}

.card__body--flush {
  padding: 0;
}

.card__summary {
  padding: 8px 16px;
  font-size: 0.82rem;
  color: var(--ink-muted);
  border-bottom: 1px solid var(--border);
}
```

### Three card behaviors

#### 1. Static card (always visible)

Used for: Core Identity fields, Status badge card, Template/Preset info card.

These cards are always open. Their body content is always visible. They have no collapse or expand controls.

```html
<div class="card">
  <div class="card__header">
    <h3>Core Identity</h3>
  </div>
  <div class="card__body">
    <!-- form fields using workbench-grid -->
  </div>
</div>
```

#### 2. Collapsible card

Used for: Purchase Details, Warranty Info, Location Details, Insurance Details, Condition History, and other metadata cards in the aside column.

These cards collapse to show only their header and a one-line summary. Clicking the header toggles the body open/closed. Default state is collapsed.

**Summary line format examples:**
- Purchase: "Purchased 3/15/2024 · $1,200 · Home Depot"
- Warranty: "Expires 3/2027 · Manufacturer warranty"
- Location: "Garage Bay 2 · Maple House"
- Insurance: "State Farm · Policy #AF-1234"
- Condition: "Score: 8/10 · Last assessed 1/2026"

When no data exists, the summary reads "Not configured" in muted text.

**Component: `CollapsibleCard`**

Props:
- `title: string` — card header text
- `summary: string` — one-line collapsed summary
- `defaultOpen?: boolean` — whether the card starts open (default: false)
- `children: ReactNode` — the card body content

**CSS implementation:**

```css
.card--collapsible .card__header {
  cursor: pointer;
  user-select: none;
}

.card--collapsible .card__header::after {
  content: "";
  width: 8px;
  height: 8px;
  border-right: 1.5px solid var(--ink-muted);
  border-bottom: 1.5px solid var(--ink-muted);
  transform: rotate(45deg);
  transition: transform 200ms ease;
  flex-shrink: 0;
}

.card--collapsible.card--open .card__header::after {
  transform: rotate(-135deg);
}

.card--collapsible .card__collapse-region {
  display: grid;
  grid-template-rows: 0fr;
  transition: grid-template-rows 250ms ease;
}

.card--collapsible.card--open .card__collapse-region {
  grid-template-rows: 1fr;
}

.card--collapsible .card__collapse-inner {
  overflow: hidden;
}
```

#### 3. Expandable card (compact preview + inline expand)

Used for: Maintenance Schedules, Custom Field Definitions, Usage Metrics Configuration, Project Phases + Tasks, Budget Breakdown.

These cards show a compact inline preview and have an expand button in the header that reveals the full editing experience inline in the page flow. The expanded region uses the same `grid-template-rows: 0fr` to `1fr` animation pattern as `CollapsibleCard`, so opening a dense section pushes the content below it down instead of opening a portal overlay.

**Compact preview content:**
- Schedules: "{count} schedules · {overdue} overdue · {due} due soon" + mini-table of next 3-4 upcoming items (name, status chip, next due date)
- Custom Fields: "{count} fields across {sectionCount} sections" + list of section names as pills
- Usage Metrics: "{count} metrics tracked" + mini-table of metric name, current value, unit
- Project Phases: "{count} phases · {complete}% complete" + mini timeline bar
- Budget: "Budget: ${total} · Spent: ${spent} · Remaining: ${remaining}" + top 3 category bars

**Expand button:** A small icon button in the card header. Clicking it toggles the card between collapsed and expanded states inline.

**Component: `ExpandableCard`**

Props:
- `title: string` — card header text
- `previewContent: ReactNode` — what shows inline in the compact card
- `children: ReactNode` — full editing UI shown inline when the card is expanded
- The header toggle button switches between collapsed state (showing `previewContent`) and expanded state (showing `children` inline)

`modalTitle` may still exist in the component type for backward compatibility, but it is not part of the active design system contract.

**Inline expand behavior:**
- Collapsed state shows the compact preview summary in the card body
- Expanded state hides the compact preview and reveals the full `workbench-table` / `workbench-grid` editing UI inline
- Opening and closing animate smoothly using the same row-expansion pattern as `CollapsibleCard`
- No portal, backdrop, focus trap, or Escape-to-close behavior is part of this pattern

**CSS implementation:**

```css
.card--expandable .card__collapse-region {
  display: grid;
  grid-template-rows: 0fr;
  transition: grid-template-rows 250ms ease;
}

.card--expandable.card--open .card__collapse-region {
  grid-template-rows: 1fr;
}

.card--expandable .card__collapse-inner {
  overflow: hidden;
}

.card--expandable.card--open > .card__body {
  display: none;
}
```

---

## 4. Component library

### Existing components (preserved)

These components and their CSS classes remain unchanged. They now live inside card containers:

- **`workbench-grid`**: 3-column CSS grid for form fields inside card bodies. Used for Core Identity, Purchase Details, Warranty, Location, Insurance, and similar field groups.
- **`workbench-table`**: Dense inline table for repeating content (schedules, custom field definitions, metric templates). Used inside expanded inline sections of expandable cards.
- **`workbench-details`**: Accordion (`<details>` element) for sub-sections within a card. Used for grouped custom fields within the Custom Fields card.
- **`workbench-bar`**: Sticky save bar at the bottom of the page. Stays as-is.
- **`workbench-form`**: Top-level form wrapper. Now wraps the entire two-column layout instead of a flat stack of sections.
- **`form-grid`**: 2-column CSS grid for simpler form layouts (used in service providers, inventory creation forms).
- **`data-table`**: Full-width table for reading surfaces (inventory list, maintenance queue, asset list).
- **`schedule-stack`**: Vertical list of schedule cards for the asset detail overview tab.
- **`stat-card` / `stats-row`**: Metric summary cards at the top of reading surfaces.
- **`panel`**: General-purpose container used on reading surfaces. Not used on working surfaces (use `card` instead).

### New components (to build)

| Component | Type | Description |
|-----------|------|-------------|
| `CollapsibleCard` | React client component | Card with animated expand/collapse toggle |
| `ExpandableCard` | React client component | Card with compact preview + inline expand |
| `CardSummaryLine` | React server component | Renders a formatted one-line summary from data |
| `CompactSchedulePreview` | React server component | Mini-table of next 3-4 schedules for expandable card |
| `CompactFieldPreview` | React server component | Section pill list for custom fields expandable card |
| `CompactMetricPreview` | React server component | Mini-table of metrics for expandable card |

`ExpandModal` remains available in the codebase as a utility, but it is not used by the active card system.

---

## 5. Screen-by-screen specifications

### 5.1 Dashboard (`/`)

**Surface type:** Reading
**Layout:** Single column with `dashboard-grid` (main + aside)
**Card behavior:** Draggable, resizable cards powered by `DashboardGrid` (`components/dashboard-grid.tsx`). This component is now the required pattern for all entity overview tabs across the app.

Content:
- Stats row (assets needing attention, due this week, completed this month, unread notifications)
- Due Work table
- Asset overview cards grouped by category
- Quick Actions panel (aside)
- Recent Notifications panel (aside)
- Low Stock Alerts panel (aside)

### 5.2 Asset list (`/assets`)

**Surface type:** Reading
**Layout:** Single column, full width
**Card behavior:** All static panels.

Content:
- Stats row (total assets, overdue, due soon, categories)
- Asset table with status indicators, category grouping, and row-level status chips
- Link to asset detail and asset creation

### 5.3 Asset creation (`/assets/new`)

**Surface type:** Working
**Layout:** Two-column resource detail

**Primary column cards:**

| Card | Behavior | Contents |
|------|----------|----------|
| Core Identity | Static | Name, category selector, template/preset selector, manufacturer, model, serial number, description. Uses `workbench-grid` (3-col). |
| Custom Fields | Expandable | Compact preview shows field count + section names as pills. Expands inline to show the full field definition table with inline editing, add/remove, drag-to-reorder, section management. Uses `workbench-table`. |
| Maintenance Schedules | Expandable | Compact preview shows schedule count from the selected template. Expands inline to show the schedule template table with trigger config editing. Uses `workbench-table`. |
| Usage Metrics | Expandable | Compact preview shows metric count from template. Expands inline to show the metric template table. Uses `workbench-table`. |

**Aside column cards:**

| Card | Behavior | Contents |
|------|----------|----------|
| Save as Template | Static | Checkbox to save configuration as a reusable preset. Template name field appears when checked. |
| Visibility | Static | Dropdown: shared vs personal. |

**Sticky save bar:** "Create Asset" primary button. Back/cancel secondary.

### 5.4 Asset detail (`/assets/[assetId]`)

**Surface type:** Mixed (reading tabs + working tabs)
**Layout:** Tab-based. Each tab has its own layout.

**Tabs and their layouts:**

| Tab | Surface type | Layout |
|-----|-------------|--------|
| Overview | Reading | Uses `DashboardGrid` (`entityType="asset"`, `entityId`=assetId). Cards: `label`, `photos`, `due-work` (inline quick-log per due/overdue schedule — notes + cost + mark-complete in two taps), `recent-maintenance` (inline unscheduled quick-log with title + date + notes + cost), `relationships` (conditional), `transfer-history`, `notes-canvas`, `recent-timeline`. Stats row (`stats-row`) is static above the grid. Layout persisted per asset via `UserLayoutPreference`. Reference: `components/asset-overview-grid.tsx`. |
| Details | Mixed (inline-editable) | Auto-fit grid. Each panel (Purchase Details, Warranty Details, Location Details, Insurance & Disposition) has an **Edit** button that switches the `<dl>` read view to an inline form. Save/Cancel returned to read view. Uses `AssetPurchaseDetailsCard`, `AssetWarrantyDetailsCard`, `AssetLocationDetailsCard`, `AssetInsuranceDetailsCard` client components in `components/asset-details-cards.tsx`. Condition History and Preset Browser remain as server-rendered panels. |
| Usage Metrics | Reading | Single column. Metric cards with entry history and projections. No changes. |
| Maintenance | Working | Two-column resource detail. Primary: Schedules list (expandable card), Maintenance Log panel, Log Maintenance form. Aside: Schedule stats, quick-complete actions. **Note:** The Overview tab's Due Work and Recent Maintenance cards cover the common quick-log case (notes + cost only). Use this tab's full `LogMaintenanceForm` only when parts, usage metrics, or service provider assignment are needed. |
| Inventory | Mixed | Single column. Linked inventory items table with add/remove controls. Server-fetched, client-interactive via `AssetInventoryLinks`. |
| Notes | Reading | Single column. `EntryTimeline` with `entityType="asset"`. |
| Canvas | Reading | Single column. `EntityCanvasList` with `entityType="asset"`. |
| Comments | Reading | Single column. Comment thread with add/edit/delete. No changes. |
| History | Reading | Single column. Activity feed. |
| Settings | Working | Two-column resource detail. Primary: Asset Profile Workbench (the full edit form). Aside: Collapsible cards for Status, Template, Danger Zone. |

**Settings tab — primary column cards:**

| Card | Behavior | Contents |
|------|----------|----------|
| Core Identity | Static | Name, category, manufacturer, model, serial, description, visibility, parent asset, owner. Uses `workbench-grid`. |
| Custom Fields | Expandable | Same as asset creation. Compact preview + inline expand with full field definition editor. |

**Settings tab — aside column cards:**

| Card | Behavior | Default state | Summary format |
|------|----------|---------------|----------------|
| Status | Static | Open | Category badge, visibility badge, archive state |
| Template | Static | Open | Applied preset name + version, source label |
| Purchase Details | Collapsible | Collapsed | "Purchased {date} · {price} · {vendor}" |
| Warranty Info | Collapsible | Collapsed | "Expires {date} · {type}" |
| Location Details | Collapsible | Collapsed | "{property} · {area} · {storage}" |
| Insurance Details | Collapsible | Collapsed | "{provider} · Policy #{number}" |
| Condition | Collapsible | Collapsed | "Score: {n}/10 · Last assessed {date}" |
| Disposition | Collapsible | Collapsed | "{method} · {date}" |
| Danger Zone | Static | Open | Archive/unarchive, soft delete, transfer asset |

### 5.5 Project list (`/projects`)

**Surface type:** Reading
**Layout:** Single column
**Card behavior:** Static panels.

Content:
- Stats row (active projects, total tasks, completion percentage)
- Project cards with status, phase progress, budget summary
- Create Project form (panel)

### 5.6 Project detail (`/projects/[projectId]`)

**Surface type:** Mixed (reading overview + working sections)
**Layout:** Stats row at top, then tabbed or sectioned content below

**Primary sections:**

| Section | Behavior | Contents |
|---------|----------|----------|
| Stats Row | Static | Status, task progress %, phases complete, supply readiness, spend total |
| Project Settings | Expandable card | Compact preview: name, status, dates, budget. Expands inline to show the full project edit form with all fields. |
| Phase Timeline | Expandable card | Compact preview: phase count, active phase name, % complete bar. Expands inline to show the full phase editor with checklist items, tasks, and supply management per phase. |
| Tasks | Expandable card | Compact preview: task count, completed count. Expands inline to show the full task list with assignment, status updates, checklist sub-items. |
| Budget & Expenses | Expandable card | Compact preview: budget total, spent, remaining with category bars. Expands inline to show the budget category editor, expense log table, and add expense form. |
| Supplies | Expandable card | Compact preview: supply line count, procurement %, staging %. Expands inline to show the supply table with procurement tracking and inventory linking. |
| Linked Assets | Static card | Asset link table with add/remove. |
| Linked Inventory | Static card | Project inventory allocation table. |

### 5.7 Inventory (`/inventory`)

**Surface type:** Reading
**Layout:** Single column, full width
**Card behavior:** Static panels.

Content:
- Stats row (tracked items, low stock, out of stock, categories)
- Reorder Watchlist table (low-stock items with supplier links)
- Inventory groups by category, each with a data-table of items
- Add Inventory Item form (inside an InventorySection component with filter controls)

No two-column or collapsible/expandable changes needed — this is a pure reading surface.

### 5.8 Service providers (`/service-providers`)

**Surface type:** Working (light)
**Layout:** Single column (this page is simple enough that two-column is unnecessary)
**Card behavior:** Static panels.

Content:
- Add Provider form (panel with form-grid)
- Provider list table with inline edit/delete actions
- Highlighted row for newly created providers

No layout changes needed. The existing panel pattern works well here because the form is simple (fewer than 10 fields) and there is no aside metadata.

### 5.9 Maintenance queue (`/maintenance`)

**Surface type:** Reading
**Layout:** Single column, full width
**Card behavior:** Static panels.

Content:
- Grouped by status: Overdue, Due Now, Upcoming
- Schedule cards with status chips, trigger summaries, and quick-complete actions
- Links to parent asset detail pages

No layout changes needed.

### 5.10 Activity log (`/activity`)

**Surface type:** Reading
**Layout:** Single column
**Card behavior:** Static panel with activity feed.

No changes needed.

### 5.11 Notifications (`/notifications`)

**Surface type:** Reading
**Layout:** Single column
**Card behavior:** Static notification feed with read/unread state.

No changes needed.

### 5.12 Invitations (`/invitations`)

**Surface type:** Reading + light actions
**Layout:** Single column
**Card behavior:** Static panels.

Content:
- Pending invitations with accept/decline actions
- Send invitation form

No changes needed.

---

## 6. Color and status language

### Status colors

The application uses a consistent color vocabulary. These CSS custom properties are already defined in `globals.css`:

| Purpose | Variable | Hex | Usage |
|---------|----------|-----|-------|
| Danger / Overdue | `--danger` | #dc2626 | Overdue schedules, destructive actions, out-of-stock |
| Warning / Due soon | `--warning` | #d97706 | Items due within the alert window, low stock |
| Success / Current | `--success` | #059669 | All-clear status, completed tasks, sufficient stock |
| Accent / Active | `--accent` | #0d9488 | Primary actions, active tab, focused editing |
| Info / Neutral | `--info` | #2563eb | Informational badges, links, neutral highlights |

### Status chips

Schedule and task statuses render as small pill badges:

```css
.status-chip--overdue { background: var(--danger-bg); color: var(--danger); }
.status-chip--due     { background: var(--warning-bg); color: var(--warning); }
.status-chip--upcoming { background: var(--success-bg); color: var(--success); }
.status-chip--clear   { background: var(--surface-alt); color: var(--ink-muted); }
.status-chip--paused  { background: var(--surface-alt); color: var(--ink-muted); }
```

### Card header status indicators

When a card contains items that need attention, the card header should show a small colored dot or count badge:

```css
.card__header-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 20px;
  height: 20px;
  padding: 0 6px;
  border-radius: 10px;
  font-size: 0.72rem;
  font-weight: 600;
}

.card__header-badge--danger {
  background: var(--danger-bg);
  color: var(--danger);
}

.card__header-badge--warning {
  background: var(--warning-bg);
  color: var(--warning);
}
```

---

## 7. Spacing and density

### Spacing scale

The application uses a 4px base grid, consistent with Shopify's spacing system.

| Token | Value | Usage |
|-------|-------|-------|
| `--space-xs` | 4px | Tightest gaps: between label and input, between status chip and text |
| `--space-sm` | 8px | Field-to-field gaps within a card, table cell padding |
| `--space-md` | 12px | Card-to-card gaps in aside column, section separators within cards |
| `--space-base` | 16px | Card body padding, primary column card-to-card gap |
| `--space-lg` | 20px | Column gap in the two-column layout, page body padding |
| `--space-xl` | 24px | Page-level section gaps, hero card padding |

### Density modes

The existing density toggle system (`html[data-ui-density]`) remains active. The card system respects it:

- **Relaxed:** Card body padding 20px, card-to-card gap 20px, field gaps 10px
- **Default:** Card body padding 16px, card-to-card gap 16px, field gaps 8px
- **Compact:** Card body padding 12px, card-to-card gap 12px, field gaps 6px

### Typography within cards

| Element | Size | Weight | Color |
|---------|------|--------|-------|
| Card header title | 0.9rem | 600 | `--ink` |
| Card summary line | 0.82rem | 400 | `--ink-muted` |
| Field label | 0.75rem | 500 | `--ink-muted` |
| Field input | 0.84rem | 400 | `--ink` |
| Field help text | 0.72rem | 400 | `--ink-muted` |
| Table header | 0.72rem | 600, uppercase | `--ink-muted` |
| Table body | 0.82rem | 400 | `--ink` |
| Expand button icon | 0.82rem | — | `--ink-muted` |

---

## 8. Responsive behavior

### Breakpoint rules

| Breakpoint | Layout change |
|------------|---------------|
| > 1024px | Two-column resource layout: `2fr 1fr` |
| 768px–1024px | Two-column narrows: `1.5fr 1fr`. Aside column gets slightly more relative space. |
| < 768px | Single column. Aside cards stack below primary cards. Expandable cards continue to open inline within the page flow. `workbench-grid` drops from 3 columns to 1. |

### Mobile expandable card behavior

On screens narrower than 768px, expandable cards continue to use the same inline open/close behavior. The compact preview collapses away and the full editing UI renders directly below the card header with the same slide-open animation used on larger screens:

```css
@media (max-width: 768px) {
  .card--expandable .card__collapse-region {
    transition-duration: 220ms;
  }
}
```

### Aside column on mobile

When the layout collapses to single column, aside cards appear after the primary column cards. Collapsible cards remain collapsed by default, so they add minimal scroll depth. The aside section gets a subtle top border to visually separate it from the primary content:

```css
@media (max-width: 768px) {
  .resource-layout {
    grid-template-columns: 1fr;
  }

  .resource-layout__aside {
    position: static;
    border-top: 1px solid var(--border);
    padding-top: 16px;
  }
}
```

---

## 9. Implementation phases

### Phase 1: Foundation components and CSS

**Scope:** Build the three new card components and their CSS. No page refactoring yet.

**Files to create:**
- `apps/web/components/card.tsx` — Static `Card` wrapper component
- `apps/web/components/collapsible-card.tsx` — `CollapsibleCard` client component with `useState` for open/closed, `grid-template-rows` animation
- `apps/web/components/expandable-card.tsx` — `ExpandableCard` client component with compact preview slot and inline expand/collapse toggle

`apps/web/components/expand-modal.tsx` remains in the codebase as an available utility, but it is not part of the active workbench card pattern.

**CSS to add (in `globals.css`):**
- `.card`, `.card__header`, `.card__body`, `.card__body--flush`, `.card__summary` classes
- `.card--collapsible`, `.card--open`, `.card__collapse-region`, `.card__collapse-inner` classes
- `.card--expandable`, `.card__expand-trigger` classes
- `.resource-layout`, `.resource-layout__primary`, `.resource-layout__aside` classes
- Responsive overrides for all card and layout classes at 768px and 1024px breakpoints
- Density mode overrides for card padding and gaps

**CSS to preserve (do not modify):**
- All `workbench-*` classes (workbench-form, workbench-grid, workbench-table, workbench-section, workbench-details, workbench-bar)
- All `panel` and `panel__*` classes (used on reading surfaces)
- All `form-grid`, `field`, `field--full` classes
- All `data-table`, `schedule-stack`, `stat-card`, `stats-row` classes
- All density toggle variable definitions and overrides
- All existing responsive breakpoints

**Acceptance criteria:**
- `CollapsibleCard` smoothly animates open/closed with no content jump
- `ExpandableCard` renders a compact preview inline and smoothly slides open inline on expand click
- All three components respect density mode CSS variables
- All three components collapse to single-column behavior below 768px
- No existing pages break — these components are additive only

### Phase 2: Asset creation workbench refactor

**Scope:** Refactor `/assets/new` (the `AssetProfileWorkbench` component) to use the two-column card layout.

**Changes to `apps/web/components/asset-profile-workbench.tsx`:**
- Wrap the top-level `<form>` content in `resource-layout` grid
- Move Core Identity fields into a static `Card`
- Move Custom Field Definitions section into an `ExpandableCard` with a `CompactFieldPreview`
- Move Schedule Templates section into an `ExpandableCard` with a `CompactSchedulePreview`
- Move Metric Templates section into an `ExpandableCard` with a `CompactMetricPreview`
- Create aside column with: Save as Template card, Visibility card
- Keep the sticky `workbench-bar` outside and below the grid

**Form state management note:** The expanded inline card sections need to read and write the same React state that the parent `AssetProfileWorkbench` manages (fieldDefinitions, scheduleTemplates, metricTemplates). Pass state and setter functions as props to the expanded content. The expandable card does not have its own save action — changes are reflected immediately in the parent state and submitted with the main form's save bar.

**Files to modify:**
- `apps/web/components/asset-profile-workbench.tsx`

**Files to create:**
- `apps/web/components/compact-field-preview.tsx`
- `apps/web/components/compact-schedule-preview.tsx`
- `apps/web/components/compact-metric-preview.tsx`

### Phase 3: Asset detail settings tab refactor

**Scope:** Refactor the Settings tab of `/assets/[assetId]` to use two-column card layout with collapsible aside cards.

**Changes to `apps/web/app/assets/[assetId]/page.tsx` (settings tab render function):**
- Wrap settings content in `resource-layout` grid
- Move the edit form into a static `Card` (Core Identity) + `ExpandableCard` (Custom Fields) in the primary column
- Create aside column with collapsible cards for: Status, Template, Purchase Details, Warranty, Location, Insurance, Condition, Disposition
- Move Danger Zone into a static card at the bottom of the aside column
- Each collapsible card needs a `CardSummaryLine` component that formats data from the asset detail response

**Files to modify:**
- `apps/web/app/assets/[assetId]/page.tsx` (renderSettingsTab function)

**Files to create:**
- `apps/web/components/card-summary-line.tsx` — Utility component for formatting summary strings from asset metadata

### Phase 4: Asset detail maintenance tab refactor

**Scope:** Refactor the Maintenance tab to use an expandable card for the schedules list.

**Changes:**
- Wrap the schedules list in an `ExpandableCard`. Compact preview shows schedule count and status summary. Expands inline to show the full schedule stack with card actions.
- Keep the Add Schedule form and Maintenance Log sections as static cards below the expandable schedules card.
- Create a small aside column with schedule stats (overdue count, due count, next due date).

### Phase 5: Project detail refactor

**Scope:** Refactor `/projects/[projectId]` to use expandable cards for phases, tasks, budget, and supplies.

This is the most complex refactor because the project detail page currently renders everything in a flat `detail-tiles__grid`. Each major section (phases, tasks, budget, supplies) becomes an expandable card with a compact preview and full inline editing region.

**Changes:**
- Replace `detail-tiles__grid` with `resource-layout` two-column grid
- Primary column: Project Settings (expandable), Phase Timeline (expandable), Tasks (expandable), Budget & Expenses (expandable), Supplies (expandable)
- Aside column: Project status card (static), Linked Assets card (static), Linked Inventory card (static)
- Each expandable card gets a domain-specific compact preview component

**Files to create:**
- `apps/web/components/compact-phase-preview.tsx`
- `apps/web/components/compact-task-preview.tsx`
- `apps/web/components/compact-budget-preview.tsx`
- `apps/web/components/compact-supply-preview.tsx`

### Phase 6: Polish and consistency pass

**Scope:** Ensure all working surfaces follow the same patterns. Address edge cases.

Tasks:
- Audit all pages for consistent card usage on working surfaces vs panel usage on reading surfaces
- Ensure all collapsible cards have well-formatted summary lines with graceful "Not configured" fallbacks
- Verify all expandable cards have proper inline open/close state, smooth animation, and keyboard-accessible toggle behavior
- Test all responsive breakpoints — two-column to single-column transitions
- Test all density modes — relaxed, default, compact
- Verify expandable cards work correctly when the parent form has unsaved changes (expanded content should not trigger a navigation warning)
- Verify screen reader announcements for collapsible and expandable state changes

---

## 10. Navigation architecture

### Two tab navigation systems

The web app uses two distinct tab navigation systems. They must never be mixed — use the right one for the right domain.

#### `WorkspaceLayout` (Projects, Hobbies, Ideas)

**File:** `apps/web/components/workspace-layout.tsx`
**Tab style:** `pill` variant (rounded pill tabs with accent background when active)
**When to use:** Any workspace-style domain tool that has its own entity-detail route with multiple tabs.

Props:
- `entityType` — string identifier for the domain (e.g. `"project"`, `"hobby"`, `"idea"`)
- `title` — entity name shown in the `<h1>`
- `status` + `statusVariant` — pill badge shown next to the title (`"success"`, `"warning"`, `"info"`, `"muted"`, `"danger"`)
- `breadcrumbs` — optional parent trail (e.g. sub-project parent path)
- `headerActions` — React node rendered in the page header action area
- `tabs: WorkspaceTab[]` — array of `{ id, label, href, show? }`
- `backHref` + `backLabel` — the back link shown above the title

Active tab detection:
- Root/overview tab: exact pathname match
- All other tabs: `pathname.startsWith(href)`

Status variant mapping by domain:

| Domain | Status → Variant |
|--------|------------------|
| Project | `planning`→`info`, `active`→`success`, `on_hold`→`warning`, `completed`→`muted`, `cancelled`→`danger` |
| Hobby | `active`→`success`, `paused`→`warning`, `archived`→`muted` |
| Idea | `spark`→`warning`, `developing`→`info`, `ready`→`success`; `archivedAt` present → `muted` override |

#### `AssetTabNav` (Assets only)

**File:** `apps/web/components/asset-tab-nav.tsx`
**Tab style:** `underline` variant (tabs rendered inline with underline active indicator)
**When to use:** Assets only. Assets have a unique page header (`detail-topbar` + `detail-hero`) that other domain tools do not use.

The tab list is a `const` array — 12 tabs: Overview, Maintenance, Details, Relationships, Metrics, Costs, Inventory, Notes, Canvas, Comments, History, Advanced. Any new tab added to assets must be added to this array in the correct position.

**Rule:** Never move Assets to `WorkspaceLayout`. Never use `AssetTabNav` for a non-asset domain.

### Sidebar navigation groups

The sidebar (rendered by `SidebarNav`) is structured into fixed groups. When adding a new top-level route, place it in the correct group:

| Group | Routes |
|-------|--------|
| *(ungrouped)* | Dashboard (`/`) |
| Capture | Ideas (`/ideas`), Notes (`/notes`) |
| Manage | Assets (`/assets`), Inventory (`/inventory`), Projects (`/projects`), Hobbies (`/hobbies`), Maintenance (`/maintenance`) |
| Insights | Analytics (`/analytics`), Service Providers (`/service-providers`), Activity (`/activity`) |
| *(ungrouped)* | Trash (`/trash`) |

New domain tools belong in **Manage**. New read-only analytics/reporting tools belong in **Insights**. Do not create a new sidebar group without explicit instruction.

### Tab count and overflow

No domain tool should have more than 15 tabs. If a tool would require more, consolidate related tabs into sub-sections within a single tab (e.g. a combined "Details" tab that partitions content into panels).

Tab labels must be one or two words. Do not use full sentences or explanatory text as tab labels.

---

## 11. Universal page and overview templates

### Domain tool overview page template

Every domain tool overview page (the root tab for Assets, Projects, Hobbies, and Ideas) follows a mandatory top-of-page pattern before its domain-specific content:

```
1. IdeaProvenanceBar  — rendered only if the entity was promoted from an Idea
2. PinnedNotesCard    — rendered only if pinned notes exist for this entity
3. [Domain dashboard] — stats, recent activity, linked entities, etc.
```

**`IdeaProvenanceBar`** (`apps/web/components/idea-provenance-bar.tsx`): Shows the source Idea's name and a link back to it. Render only when `sourceIdeaId !== null` on the entity.

**`PinnedNotesCard`** (`apps/web/components/pinned-notes-card.tsx`): Shows up to 10 pinned journal entries as preview cards. Render only when `pinnedEntries.length > 0`.

Fetching pattern (in the page server component):

```ts
const [entity, sourceIdea, pinnedEntries] = await Promise.all([
  getEntityDetail(entityId),
  getSourceIdea(entityId).catch(() => null),
  getEntries({ entityId, flags: "pinned", limit: 10 }).catch(() => ({ entries: [] }))
]);
```

Never omit these two checks from an overview page. They take near-zero additional render cost when empty.

### Entity overview tabs must use `DashboardGrid`

The root overview tab for every primary domain workspace tool (Assets, Projects, Hobbies, Ideas, and any future domain) **must** render its content sections as `DashboardCardDef[]` passed to `<DashboardGrid>`. Do **not** render a static `<section className="panel">` grid on an overview tab.

```tsx
<DashboardGrid
  entityType="<domain>"  // e.g. "asset", "project", "hobby", "idea"
  entityId={entityId}
  cards={cards}          // DashboardCardDef[]
  defaultLayout={defaultLayout}  // LayoutItem[]
/>
```

- The `stats-row` may remain as a static header rendered above the grid (it is not a draggable card).
- Layout is persisted per entity via `UserLayoutPreference` automatically by `DashboardGrid`.
- Optional cards (e.g. a "relationships" card that only appears when linked data exists) must be included conditionally in both `cards` and `defaultLayout`.
- Reference implementations: `components/asset-overview-grid.tsx` (entity overview) and `components/home-dashboard.tsx` (home dashboard).

### Page header anatomy

All pages that use `WorkspaceLayout` share this header structure (rendered by the component):

```
← Back to [parent list]                [header meta: pill, etc.]
[Status Badge]  Page Title
                [headerActions: buttons]
```

Asset pages use `detail-topbar` + `detail-hero` which renders:

```
← Assets           [Log Maintenance] [Add Component] [Edit Asset] [⋮ menu]
[eyebrow: category]
[inline-editable name]  [meta: serial, visibility, dates, parent, children counts]
[TabNav --underline]
```

The `AssetHeroEditor` allows inline title editing without navigating to settings.

---

## 12. Empty states

### Rule

Every list, table, grid, or collection that can be empty **must** have an explicit empty state. A blank container is never acceptable.

### HTML and CSS pattern

```html
<div class="empty-state">
  <p class="empty-state__icon">🗺️</p>
  <p class="empty-state__title">No canvases yet</p>
  <p class="empty-state__body">Create a canvas to sketch diagrams, floor plans, or visual notes.</p>
  <!-- optional -->
  <div class="empty-state__actions">
    <button class="button button--primary button--sm">Create Canvas</button>
  </div>
</div>
```

### Writing good empty state copy

| Element | Rule | Example |
|---------|------|---------|
| Icon | Single emoji relevant to the content type. No icon libraries. | 📋 for tasks, 🗺️ for canvases, 💬 for comments, 📦 for inventory |
| Title | Short noun phrase describing what's missing. Two to five words. | "No inventory items linked" |
| Body | One sentence: what the feature does and how to start. | "Link consumables and spare parts that belong to or are used with this asset." |
| Action | Optional. Only include if there's a clear starting action. Use `button--primary button--sm`. | "Link Item", "Create Canvas" |

### Empty state in tables

When a `workbench-table` or `data-table` has no rows, render a `<tr>` with a single `<td colspan="N">` containing the empty state div inside it:

```html
<tr class="workbench-table__empty">
  <td colspan="5">
    <div class="empty-state"><p class="empty-state__title">No rows yet</p></div>
  </td>
</tr>
```

### Empty state in panels

Do not use `.empty-state` inside `.panel__body`. Instead use `.panel__empty`:

```html
<div class="panel__empty">No condition assessments recorded yet.</div>
```

`.panel__empty` renders as muted italicized text with appropriate padding. Reserve `.empty-state` for full-section zero-state displays.

---

## 13. Destructive actions and confirmations

### The principle

Any action that destroys or permanently modifies data (hard delete, transfer, merge) requires explicit user confirmation before execution. Reversible disposals (archive, soft-delete to trash) do not require confirmation.

### Hard delete confirmation pattern

Hard deletes always require an explicit confirmation step. Pattern:

1. A `button--danger` or `button--ghost` button triggers a confirmation expansion (not a modal).
2. The confirmation renders inline below the button: a short warning sentence + a `button--danger` "Confirm Delete" + a `button--ghost` "Cancel" side by side.
3. The warning must name what data will be permanently lost, e.g. "This will permanently delete the asset and all its maintenance logs, metrics, and history. This cannot be undone."
4. After deletion, use `redirect()` to the parent list route — never render the deleted entity's page.

### Soft delete / archiving

Archive and trash operations do not need a confirmation dialog. The action button may be `button--ghost` or `button--subtle`. After execution, show a brief success indicator (change button label to "Archived" or similar) and offer an "Undo" action that is visible for 5 seconds.

### Button choices for destructive actions

| Action | Button style |
|--------|--------------|
| Confirm hard delete | `button--danger` |
| Archive / soft delete | `button--ghost` |
| Cancel confirmation | `button--ghost` |
| Transfer (moves ownership) | `button--secondary` |

Never use `button--primary` for destructive actions. The primary button is reserved for the main positive action on a page.

### Danger zone section

Group all destructive actions for an entity into a dedicated "Danger Zone" section at the bottom of the entity's Settings tab. This section should be visually separated (border-top, red-tinted background or red header text) and labeled clearly.

---

## 14. Error and loading feedback

### Server action errors

When a server action (form submit via `useTransition`) fails, render an inline error message **immediately below the form** that triggered it:

```tsx
{error && (
  <p style={{ color: "var(--tone-danger, red)", marginTop: 8, fontSize: "0.85rem" }}>
    {error}
  </p>
)}
```

Never display server action errors as global toasts, modals, or banners. Keep error feedback contextual — next to the form that caused it.

### Form validation errors

Field-level errors render below the individual field, not at the top of the form. Use the same red inline paragraph pattern.

### Loading state during server actions

All client components that call a server action via `useTransition` must:
1. `disabled={isPending}` on every interactive element in the form while the action runs.
2. Change the submit button label: `{isPending ? "Saving…" : "Save"}`, `{isPending ? "Deleting…" : "Delete"}`.
3. Never show a spinner overlay — the button label change is sufficient feedback.

### Page-level loading

Every dynamic route under `(dashboard)/` must have a `loading.tsx` file. It renders while the full route segment loads. Use a simple `.panel` skeleton:

```tsx
export default function Loading() {
  return <div className="panel" style={{ minHeight: 200 }} />;
}
```

### Streaming Suspense page pattern

In addition to `loading.tsx`, every `page.tsx` that fetches data beyond `getMe()` **must** use the streaming Suspense pattern. This provides finer-grained loading — the page shell (header, tabs, nav) renders instantly while heavy API calls stream in asynchronously.

**Structure:**

```tsx
import { Suspense, type JSX } from "react";

// Deferred component — contains all heavy API calls
async function PageContent({ householdId }: { householdId: string }): Promise<JSX.Element> {
  const data = await getHeavyData(householdId);
  return <MyComponent data={data} />;
}

// Page function — thin shell, renders instantly
export default async function MyPage(): Promise<JSX.Element> {
  const me = await getMe(); // cached, fast
  const household = me.households[0];
  if (!household) return <p>No household found.</p>;

  return (
    <>
      <header className="page-header"><h1>My Page</h1></header>
      <Suspense fallback={
        <div className="page-body">
          <div className="panel"><div className="panel__body--padded">
            <p className="note">Loading…</p>
          </div></div>
        </div>
      }>
        <PageContent householdId={household.id} />
      </Suspense>
    </>
  );
}
```

**Key rules:**
- `getMe()` is cached (5-min ISR) and stays in the page function. All other API calls go in the deferred component.
- Pass only primitives (`householdId`, `entityId`, parsed searchParams) as props to the deferred component.
- Fallback content should match the page's visual structure (show the same header, render a skeleton panel where content will appear).
- Pages that only call `getMe()` do not need Suspense.
- Module-level helpers (formatters, constants) stay at module scope, not inside the deferred component.

See `AGENTS.md` → "Streaming Suspense page pattern" for the full specification and edge cases.

### API error fallback

Inside deferred Suspense content components, wrap API calls in try/catch. On `ApiError`, render a fallback panel showing the error message. Do not let API errors propagate to the global Next.js error boundary unless absolutely necessary:

```tsx
async function PageContent({ householdId }: { householdId: string }) {
  try {
    const data = await getHeavyData(householdId);
    return <MyComponent data={data} />;
  } catch (error) {
    if (error instanceof ApiError) {
      return (
        <div className="panel">
          <div className="panel__body--padded">
            <p>Failed to load: {error.message}</p>
          </div>
        </div>
      );
    }
    throw error; // re-throw unexpected errors
  }
}
```

---

## 15. Component selection guide

This quick-reference table answers the question "what should I reach for when building X?"

### Layout

| Scenario | What to use |
|----------|-------------|
| Domain tool entity detail (Projects, Hobbies, Ideas) | `WorkspaceLayout` from `components/workspace-layout.tsx` |
| Asset detail page | `detail-topbar` + `detail-hero` + `AssetTabNav` (existing pattern — do not change) |
| Working surface with metadata aside (creation, settings) | `.resource-layout` CSS grid with `.resource-layout__primary` + `.resource-layout__aside` |
| Reading/browsing surface (list, queue, dashboard) | Single column with `.panel` containers |

### Content containers

| Scenario | What to use |
|----------|-------------|
| Always-visible section on a working surface | `Card` component (`.card`) |
| Metadata that's rarely changed (warranty, location, etc.) in aside column | `CollapsibleCard` (`.card--collapsible`), defaults closed |
| Dense editor with many rows (schedules, custom fields, tasks) | `ExpandableCard` (`.card--expandable`) with compact preview |
| Content panel on a reading surface | `.panel` > `.panel__header` + `.panel__body--padded` |
| Inline-editable metadata panel | `.panel` + Edit button → `.workbench-grid` form → `dl.data-list` (see `asset-details-cards.tsx`) |

### Forms

| Scenario | What to use |
|----------|-------------|
| Multi-field form inside a card body | `.workbench-grid` (3-col CSS grid auto-fit) |
| Simpler form, fewer than 6 fields | `.form-grid` (2-col) |
| Repeating rows of editable data | `.workbench-table` |
| Radio button group in a form | `.workbench-radio-group` + `.workbench-radio` |
| Sticky save bar at bottom of page | `.workbench-bar` |

### Data display

| Scenario | What to use |
|----------|-------------|
| Key-value metadata (read-only) | `dl.data-list` with `<dt>` label + `<dd>` value |
| Tabular data in a reading surface | `.data-table` |
| Key-value in an overview/summary area | `.kv-grid` |
| Status badge inline in text or headers | `.pill` + variant class |
| Count badge on a card header | `.card__header-badge` + `--danger` or `--warning` |

### Navigation

| Scenario | What to use |
|----------|-------------|
| Entity detail tab navigation (Projects, Hobbies, Ideas) | `WorkspaceLayout` (renders `TabNav --pill` internally) |
| Entity detail tab navigation (Assets) | `AssetTabNav` (renders `TabNav --underline` internally) |
| Custom tab-like navigation with data-analytics flavor | `TabNav` with `variant="analytics"` |

### Generic shared components

| Component | File | Use for |
|-----------|------|---------|
| `EntityCanvasList` | `components/entity-canvas-list.tsx` | Canvas tab on any domain tool |
| `EntityComments` | `components/entity-comments.tsx` | Comments tab on any domain tool |
| `EntryTimeline` | `components/entry-system/` | Notes/Journal tab on any domain tool |
| `AssetInventoryLinks` | `components/asset-inventory-links.tsx` | Inventory tab on Assets |
| `HobbyLinksManager` | `components/hobby-links-manager.tsx` | Inventory tab on Hobbies |
| `IdeaProvenanceBar` | `components/idea-provenance-bar.tsx` | Overview page of any promoted entity |
| `PinnedNotesCard` | `components/pinned-notes-card.tsx` | Overview page of any entity |

---

## Appendix A: File reference

| File | Purpose | Guide section |
|------|---------|---------------|
| `apps/web/app/globals.css` | All CSS — card classes, layout classes, inline expand classes, density overrides, responsive breakpoints | Sections 2, 3, 7, 8 |
| `apps/web/components/card.tsx` | Static card wrapper | Section 3 |
| `apps/web/components/collapsible-card.tsx` | Collapsible card with animated toggle | Section 3 |
| `apps/web/components/expandable-card.tsx` | Expandable card with compact preview + inline expand | Section 3 |
| `apps/web/components/expand-modal.tsx` | Modal utility retained in codebase but not used by the active card system | Section 3 |
| `apps/web/components/asset-profile-workbench.tsx` | Asset creation/edit form — refactored to use card layout | Section 5.3, 5.4 |
| `apps/web/app/assets/[assetId]/page.tsx` | Asset detail page — settings and maintenance tabs refactored | Section 5.4 |
| `apps/web/app/projects/[projectId]/page.tsx` | Project detail page — refactored to expandable cards | Section 5.6 |

## Appendix B: CSS class hierarchy

```
Reading surfaces:
  .panel > .panel__header + .panel__body
  .stats-row > .stat-card
  .data-table (inside .panel__body)
  .schedule-stack > .schedule-card

Working surfaces:
  .resource-layout > .resource-layout__primary + .resource-layout__aside
    .card > .card__header + .card__body
    .card--collapsible > .card__header + .card__summary + .card__collapse-region
    .card--expandable > .card__header + .card__body (compact preview)
    .card--expandable > .card__collapse-region > .card__collapse-inner
      Inside card bodies:
        .workbench-grid (3-col field layout)
        .workbench-table (repeating content table)
        .workbench-details (accordion sub-sections)
        .form-grid (2-col simpler field layout)
  .workbench-bar (sticky save bar, outside the grid)
```

## Appendix C: Decision log

| Decision | Rationale |
|----------|-----------|
| Cards replace flat workbench sections on working surfaces | Flat sections lacked visual boundaries, making it hard to scan for specific field groups. Cards provide scannable section headers. |
| Two-column layout (2fr / 1fr) on working surfaces | Reduces vertical scroll by pushing metadata to a persistent aside column. Matches Shopify's proven resource detail pattern. |
| Collapsible for metadata cards, expandable for table-heavy cards | Metadata (purchase, warranty, etc.) only needs vertical space. Table editors (schedules, fields) need horizontal space that the aside column cannot provide. |
| Collapsible cards default to collapsed | Metadata is reference data — users set it once and rarely revisit. Keeping it collapsed reduces visual noise on the working surface. |
| Expandable cards share parent form state | Avoids duplicating state management. The expanded inline region is a view into the same data, not a separate editing session. |
| Reading surfaces keep the existing panel pattern | Panels work well for browsing/scanning content. No reason to change what already works. |
| Workbench CSS classes are preserved inside cards | Avoids rewriting battle-tested form layout code. Cards are a container layer above the existing workbench internals. |
