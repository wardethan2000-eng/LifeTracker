# LifeKeeper UI Design Guide

**Version 1.0 — March 2026**
**Status: Active — all new UI work must follow this guide**

This document is the single source of truth for LifeKeeper's UI architecture, layout patterns, component behavior, and visual language. It is written for GitHub Copilot and human developers alike. Every screen, component, and interaction pattern in the web application is covered here.

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

---

## 1. Design philosophy

### Core principles

LifeKeeper is a data-dense application that manages complex maintenance schedules, multi-field asset profiles, project phases, inventory tracking, and household coordination. The UI must balance two competing needs: information density (users need to see and edit a lot of data) and approachability (users should never feel overwhelmed or lost).

The design system draws from Shopify's admin patterns — specifically their resource detail layout, card-based content grouping, collapsible sections, and expand-to-modal editing — adapted to LifeKeeper's domain-specific needs.

**Density without clutter.** Every piece of information earns its screen space. Cards group related fields so users can scan section headers to find what they need. Collapsible cards hide secondary metadata until needed. Expand-to-modal gives complex editors (schedules, custom fields) the full-width breathing room they require without bloating the parent page.

**Two surface types.** The application has two fundamentally different surface types, and each gets a different UI treatment:

- **Reading surfaces** (dashboard, asset list, project list, inventory list, maintenance queue): Card-based browsing layouts optimized for scanning. These use the existing panel/card patterns with stat rows, data tables, and status indicators.
- **Working surfaces** (asset creation, asset editing, project creation, project detail/settings, service provider management): Dense form-based layouts using the two-column card system described in this guide.

**Cards are containers, not decorations.** Cards exist to group related fields under a scannable heading. They are thin-bordered containers with tight internal spacing — not standalone decorative boxes with heavy shadows and excessive padding. A card's job is to answer the question "where do I find the fields for X?" at a glance.

### What this guide replaces

This guide supersedes the previous `.asset-studio--{mode}` CSS class hierarchy and the flat `workbench-section` pattern. The workbench form internals (field grids, table patterns, input styling) are preserved — they now live inside card containers arranged in a two-column layout.

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

#### 3. Expandable card (compact preview + expand to modal)

Used for: Maintenance Schedules, Custom Field Definitions, Usage Metrics Configuration, Project Phases + Tasks, Budget Breakdown.

These cards show a compact inline preview and have an expand button in the header that opens a full-width modal for the complete editing experience.

**Compact preview content:**
- Schedules: "{count} schedules · {overdue} overdue · {due} due soon" + mini-table of next 3-4 upcoming items (name, status chip, next due date)
- Custom Fields: "{count} fields across {sectionCount} sections" + list of section names as pills
- Usage Metrics: "{count} metrics tracked" + mini-table of metric name, current value, unit
- Project Phases: "{count} phases · {complete}% complete" + mini timeline bar
- Budget: "Budget: ${total} · Spent: ${spent} · Remaining: ${remaining}" + top 3 category bars

**Expand button:** A small icon button in the card header (⤢ or a maximize icon). Clicking it opens the modal.

**Component: `ExpandableCard`**

Props:
- `title: string` — card header text
- `previewContent: ReactNode` — what shows inline in the compact card
- `modalTitle: string` — title shown in the modal header
- `children: ReactNode` — full editing UI shown inside the modal
- `onSave?: () => void` — optional save callback from within the modal

**Modal behavior:**
- Opens as a portal rendered to `document.body`
- Covers the viewport with a semi-transparent backdrop (rgba(0,0,0,0.4))
- Modal panel is max-width 960px, centered, with 24px padding, white background, rounded corners
- Header bar with title and close (X) button
- Body scrolls independently if content overflows
- Pressing Escape or clicking backdrop closes the modal
- The modal receives the complete workbench-table / workbench-form editing UI — the same content that currently lives inline on the page, just with more room

**CSS implementation:**

```css
.expand-modal-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.4);
  z-index: 100;
  display: flex;
  align-items: flex-start;
  justify-content: center;
  padding: 40px 24px;
  overflow-y: auto;
}

.expand-modal {
  background: var(--surface);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-md);
  width: 100%;
  max-width: 960px;
  max-height: calc(100vh - 80px);
  display: grid;
  grid-template-rows: auto 1fr;
  overflow: hidden;
}

.expand-modal__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 20px;
  border-bottom: 1px solid var(--border);
}

.expand-modal__header h2 {
  font-size: 1.1rem;
  font-weight: 600;
  margin: 0;
}

.expand-modal__body {
  padding: 20px;
  overflow-y: auto;
}
```

---

## 4. Component library

### Existing components (preserved)

These components and their CSS classes remain unchanged. They now live inside card containers:

- **`workbench-grid`**: 3-column CSS grid for form fields inside card bodies. Used for Core Identity, Purchase Details, Warranty, Location, Insurance, and similar field groups.
- **`workbench-table`**: Dense inline table for repeating content (schedules, custom field definitions, metric templates). Used inside expandable card modals.
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
| `ExpandableCard` | React client component | Card with compact preview + expand-to-modal |
| `ExpandModal` | React client component | Portal-based modal overlay for focused editing |
| `CardSummaryLine` | React server component | Renders a formatted one-line summary from data |
| `CompactSchedulePreview` | React server component | Mini-table of next 3-4 schedules for expandable card |
| `CompactFieldPreview` | React server component | Section pill list for custom fields expandable card |
| `CompactMetricPreview` | React server component | Mini-table of metrics for expandable card |

---

## 5. Screen-by-screen specifications

### 5.1 Dashboard (`/`)

**Surface type:** Reading
**Layout:** Single column with `dashboard-grid` (main + aside)
**Card behavior:** All static. No changes to current implementation.

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
| Custom Fields | Expandable | Compact preview shows field count + section names as pills. Modal contains the full field definition table with inline editing, add/remove, drag-to-reorder, section management. Uses `workbench-table`. |
| Maintenance Schedules | Expandable | Compact preview shows schedule count from the selected template. Modal contains the schedule template table with trigger config editing. Uses `workbench-table`. |
| Usage Metrics | Expandable | Compact preview shows metric count from template. Modal contains metric template table. Uses `workbench-table`. |

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
| Overview | Reading | Single column. Hero card, Due Work panel, Recent Maintenance panel, Transfer History panel. No changes. |
| Structured Details | Reading | Single column. KV grid of custom field values grouped by section. Preset browser. No changes. |
| Usage Metrics | Reading | Single column. Metric cards with entry history and projections. No changes. |
| Maintenance | Working | Two-column resource detail. Primary: Schedules list (expandable card), Maintenance Log panel, Log Maintenance form. Aside: Schedule stats, quick-complete actions. |
| Comments | Reading | Single column. Comment thread with add/edit/delete. No changes. |
| Settings | Working | Two-column resource detail. Primary: Asset Profile Workbench (the full edit form). Aside: Collapsible cards for Purchase, Warranty, Location, Insurance, Condition, Disposition. Danger zone (archive, delete, transfer). |

**Settings tab — primary column cards:**

| Card | Behavior | Contents |
|------|----------|----------|
| Core Identity | Static | Name, category, manufacturer, model, serial, description, visibility, parent asset, owner. Uses `workbench-grid`. |
| Custom Fields | Expandable | Same as asset creation. Compact preview + modal with full field definition editor. |

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
| Project Settings | Expandable card | Compact preview: name, status, dates, budget. Modal: full project edit form with all fields. |
| Phase Timeline | Expandable card | Compact preview: phase count, active phase name, % complete bar. Modal: full phase editor with checklist items, tasks, and supply management per phase. |
| Tasks | Expandable card | Compact preview: task count, completed count. Modal: full task list with assignment, status updates, checklist sub-items. |
| Budget & Expenses | Expandable card | Compact preview: budget total, spent, remaining with category bars. Modal: budget category editor, expense log table, add expense form. |
| Supplies | Expandable card | Compact preview: supply line count, procurement %, staging %. Modal: supply table with procurement tracking, inventory linking. |
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
| < 768px | Single column. Aside cards stack below primary cards. Expandable card modals become full-screen overlays instead of centered panels. `workbench-grid` drops from 3 columns to 1. |

### Mobile modal behavior

On screens narrower than 768px, the expand modal becomes a full-screen overlay:

```css
@media (max-width: 768px) {
  .expand-modal-backdrop {
    padding: 0;
  }

  .expand-modal {
    max-width: 100%;
    max-height: 100vh;
    border-radius: 0;
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
- `apps/web/components/expandable-card.tsx` — `ExpandableCard` client component with compact preview slot and modal trigger
- `apps/web/components/expand-modal.tsx` — `ExpandModal` client component using `createPortal`, escape key handler, backdrop click handler, focus trap

**CSS to add (in `globals.css`):**
- `.card`, `.card__header`, `.card__body`, `.card__body--flush`, `.card__summary` classes
- `.card--collapsible`, `.card--open`, `.card__collapse-region`, `.card__collapse-inner` classes
- `.card--expandable`, `.card__expand-trigger` classes
- `.expand-modal-backdrop`, `.expand-modal`, `.expand-modal__header`, `.expand-modal__body` classes
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
- `ExpandableCard` renders a compact preview inline and opens a modal on expand click
- `ExpandModal` traps focus, closes on Escape and backdrop click, scrolls body content independently
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

**Form state management note:** The expandable card modals need to read and write the same React state that the parent `AssetProfileWorkbench` manages (fieldDefinitions, scheduleTemplates, metricTemplates). Pass state and setter functions as props to the modal content. The modal does not have its own save action — changes are reflected immediately in the parent state and submitted with the main form's save bar.

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
- Wrap the schedules list in an `ExpandableCard`. Compact preview shows schedule count and status summary. Modal shows the full schedule stack with card actions.
- Keep the Add Schedule form and Maintenance Log sections as static cards below the expandable schedules card.
- Create a small aside column with schedule stats (overdue count, due count, next due date).

### Phase 5: Project detail refactor

**Scope:** Refactor `/projects/[projectId]` to use expandable cards for phases, tasks, budget, and supplies.

This is the most complex refactor because the project detail page currently renders everything in a flat `detail-tiles__grid`. Each major section (phases, tasks, budget, supplies) becomes an expandable card with a compact preview and full editing modal.

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
- Verify all expandable card modals have proper focus management and keyboard navigation
- Test all responsive breakpoints — two-column to single-column transitions
- Test all density modes — relaxed, default, compact
- Verify the expand modal works correctly when the parent form has unsaved changes (modal content should not trigger a navigation warning)
- Add subtle entry animations to modal open (opacity + translateY transition, 200ms)
- Verify screen reader announcements for collapsible state changes and modal open/close

---

## Appendix A: File reference

| File | Purpose | Guide section |
|------|---------|---------------|
| `apps/web/app/globals.css` | All CSS — card classes, layout classes, modal classes, density overrides, responsive breakpoints | Sections 2, 3, 7, 8 |
| `apps/web/components/card.tsx` | Static card wrapper | Section 3 |
| `apps/web/components/collapsible-card.tsx` | Collapsible card with animated toggle | Section 3 |
| `apps/web/components/expandable-card.tsx` | Expandable card with compact preview + modal | Section 3 |
| `apps/web/components/expand-modal.tsx` | Portal-based modal overlay | Section 3 |
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
      Inside card bodies:
        .workbench-grid (3-col field layout)
        .workbench-table (repeating content table)
        .workbench-details (accordion sub-sections)
        .form-grid (2-col simpler field layout)
  .workbench-bar (sticky save bar, outside the grid)
  .expand-modal-backdrop > .expand-modal > .expand-modal__header + .expand-modal__body
```

## Appendix C: Decision log

| Decision | Rationale |
|----------|-----------|
| Cards replace flat workbench sections on working surfaces | Flat sections lacked visual boundaries, making it hard to scan for specific field groups. Cards provide scannable section headers. |
| Two-column layout (2fr / 1fr) on working surfaces | Reduces vertical scroll by pushing metadata to a persistent aside column. Matches Shopify's proven resource detail pattern. |
| Collapsible for metadata cards, expandable for table-heavy cards | Metadata (purchase, warranty, etc.) only needs vertical space. Table editors (schedules, fields) need horizontal space that the aside column cannot provide. |
| Collapsible cards default to collapsed | Metadata is reference data — users set it once and rarely revisit. Keeping it collapsed reduces visual noise on the working surface. |
| Expandable card modals share parent form state | Avoids duplicating state management. The modal is a view into the same data, not a separate editing session. |
| Reading surfaces keep the existing panel pattern | Panels work well for browsing/scanning content. No reason to change what already works. |
| Workbench CSS classes are preserved inside cards | Avoids rewriting battle-tested form layout code. Cards are a container layer above the existing workbench internals. |
