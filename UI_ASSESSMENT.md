# LifeKeeper UI Assessment — Refactoring Opportunities & Gaps

**Date:** 2026-03-18
**Scope:** `apps/web` — 125+ components, 74+ pages (Next.js 15 / React 18)

---

## Executive Summary

The LifeKeeper web UI is well-architected with domain-based organization, proper use of React Server Components, and a comprehensive CSS custom-property design system. However, the codebase has accumulated duplication across domains, several accessibility gaps, inconsistent error/loading patterns, and oversized components that would benefit from decomposition.

---

## 1. Components Exceeding Single-Responsibility

| Component | Issue | Suggested Refactor |
|---|---|---|
| `asset-profile-workbench.tsx` | Massive form handling custom fields, schedules, metrics, and preset application in a single file | Split into `AssetBasicInfoSection`, `AssetScheduleSection`, `AssetMetricSection`, `AssetPresetPicker` |
| `hobby-session-detail.tsx` | Manages phases, steps, ratings, and activity logs | Extract `SessionPhaseManager`, `SessionStepList`, `SessionRatingForm` |
| `comparative-analytics-workspace.tsx` | Member filtering, series comparison, and multiple chart types in one component | Extract `MemberFilter`, `ComparisonChartPanel` |
| `inventory-editable-row.tsx` | Mixes display, inline editing, and analytics rendering | Separate `InventoryDisplayRow` and `InventoryEditRow` |
| `project-analytics-workspace.tsx` | Dense analytics with multiple toggle states | Extract chart sections into standalone components |

---

## 2. Code Duplication — Extraction Candidates

### 2a. Danger/Confirm Action Pattern (3+ instances)

`asset-danger-actions.tsx`, `hobby-danger-actions.tsx`, and similar confirm-then-delete flows all repeat the same pattern: confirmation dialog → API call → redirect.

**Refactor:** Extract a generic `<ConfirmDestructiveAction>` component accepting `title`, `message`, `onConfirm`, and `variant` props.

### 2b. Compact Preview Components (7 instances)

`compact-field-preview`, `compact-budget-preview`, `compact-metric-preview`, `compact-maintenance-schedule-preview`, `compact-supply-preview`, `compact-phase-preview`, `compact-schedule-preview` all follow the same pill/table layout.

**Refactor:** Create a generic `<CompactPreview items={[{label, value, tone?}]}/>` that all seven can delegate to.

### 2c. Analytics Workspace Shell (3 instances)

`comparative-analytics-workspace`, `compliance-analytics-workspace`, `hobby-analytics-workspace` share the same panel header, tab bar, and loading-state wrapper.

**Refactor:** Extract `<AnalyticsWorkspaceShell tabs={[...]} header={...}>` and have each workspace provide only its domain-specific content.

### 2d. Tab Navigation

`asset-tab-nav.tsx` has inline flex/gap/border styles that are repeated in hobby and project detail pages.

**Refactor:** Create a shared `<TabNav items={[{label, href, active}]}/>` component with CSS classes instead of inline styles.

---

## 3. Accessibility Gaps

### Critical

| Issue | Location | Fix |
|---|---|---|
| No skip-to-main-content link | `app/layout.tsx` | Add a visually-hidden skip link as the first focusable element |
| Lightbox navigation buttons lack `aria-label` | `attachment-lightbox.tsx` | Add `aria-label="Previous image"` / `"Next image"` / `"Close lightbox"` |
| Empty `alt=""` on meaningful images | `hobby-series-detail.tsx`, `hobby-projects-tab.tsx`, `comparative-analytics-workspace.tsx` | Provide descriptive alt text or mark truly decorative images with `role="presentation"` |
| No `role="alert"` for async error messages | Multiple form components | Wrap error messages in `<div role="alert">` for screen-reader announcement |

### Moderate

| Issue | Fix |
|---|---|
| Custom `role="button"` divs may not respond to Enter/Space | Add `onKeyDown` handlers for keyboard activation |
| No focus management when dialogs open/close | Trap focus inside modals; return focus to trigger on close |
| Status chips rely on color alone | Add icon or text prefix (e.g., "Overdue: ...") alongside color |

---

## 4. Error Handling & Loading States

### Current State

- **Inconsistent error display:** Some components show inline alerts, others log to console only, and some silently swallow failures.
- **No standardized error component:** Each domain implements its own error UI.
- **Missing loading skeletons:** Many slower-loading pages lack skeleton placeholders.
- **No optimistic updates:** All mutations wait for server response before updating UI.

### Recommendations

1. **Create `<InlineError message={string}/>` and `<FullPageError />`** — shared components that standardize error presentation across all domains.
2. **Wrap async form submissions** in a shared `useAsyncAction` hook that manages `{loading, error, data}` state uniformly.
3. **Add skeleton loading** to all page-level components that perform async data fetching.
4. **Add retry affordance** to the barcode lookup field's 4-second timeout.

---

## 5. Responsive Design Gaps

### Current Breakpoints

```
1280px — 2-col → 1-col grid
1024px — sidebar → horizontal nav
```

### Missing

| Gap | Impact | Fix |
|---|---|---|
| No breakpoint below 1024px | Mobile phones get desktop-like layouts | Add breakpoints at 768px and 480px |
| Tables lack horizontal scroll wrappers | Data tables overflow on narrow screens | Wrap `<table>` in `overflow-x: auto` container |
| Fixed-width inline styles on skeletons | Skeleton loaders don't resize | Replace `style={{width: 120}}` with responsive CSS classes |
| Attachment lightbox controls | Navigation buttons cramped on small screens | Use larger touch targets (min 44×44px) on mobile |
| Asset label print preview | May overflow on mobile | Add `max-width: 100%` and responsive scaling |

---

## 6. Styling Inconsistencies

### Inline Styles vs. CSS Classes

Multiple components use inline `style={{}}` for layout (`display: grid`, `gap`, `marginTop`) instead of CSS classes. This bypasses the design system and makes density/theme changes harder.

**Recommendation:** Audit inline styles and migrate to CSS utility classes or BEM modifiers. High-priority targets:

- Form grid layouts (`display: "grid"`, `gap: "24px"`)
- Spacing overrides (`marginTop: 16`, `marginBottom: 8`)
- Skeleton dimensions (`width: 120`, `height: 18`)

### Hardcoded Colors

A few components use hex values directly (`#0d9488`, `#f2c66d`) instead of CSS custom properties. These should reference `var(--color-*)` tokens.

### Density System

The density toggle (relaxed/standard/compact) is well-designed but not consistently applied across all components. Some newer components ignore the `--density-*` variables.

---

## 7. Missing UI Capabilities

| Capability | Status | Impact |
|---|---|---|
| **Internationalization (i18n)** | Not implemented — all strings hardcoded in English | Blocks non-English adoption |
| **Dark mode** | CSS custom properties are ready but no theme switcher exists | Common user expectation |
| **Undo/Redo for destructive actions** | No undo support — deletions are immediate | Risk of accidental data loss; toast-based undo would improve UX |
| **Bulk operations** | Inventory has bulk actions; assets and hobbies do not | Inconsistent capability across domains |
| **Drag-and-drop reordering** | Not present for phases, tasks, or collection items | Manual position management via form inputs is cumbersome |
| **Real-time updates** | No WebSocket or SSE integration | Stale data when multiple household members are active |
| **Offline support** | No service worker or local caching strategy | Mobile/field use (garage, yard) is unreliable on poor connections |

---

## 8. Form Validation

### Current Approach

Forms rely on HTML5 native validation (`required`, `type`, `min`, `max`) and server-side validation. There is no client-side validation library.

### Gaps

- **No cross-field validation** (e.g., end date must be after start date)
- **No async validation** (e.g., uniqueness checks)
- **No real-time feedback** — validation only fires on submit
- **Generic browser error messages** — not styled to match the design system

### Recommendation

Adopt a lightweight form validation approach — either integrate Zod schemas (already used on the backend via `@lifekeeper/types`) for client-side validation, or adopt `react-hook-form` + Zod resolver for complex workbench forms.

---

## 9. Type Safety Observations

- Overall TypeScript usage is strong with proper prop typing.
- 14 files contain `@ts-ignore` or `any` — these should be audited and resolved.
- Zod schemas from `@lifekeeper/types` could be reused for client-side form validation to eliminate duplication.

---

## 10. Prioritized Refactoring Roadmap

### Phase 1 — Quick Wins (Low risk, high impact)

1. Extract shared `ConfirmDestructiveAction` component
2. Create unified `InlineError` and loading skeleton components
3. Fix critical accessibility issues (skip link, aria-labels, alt text)
4. Replace inline styles with CSS classes in high-traffic components

### Phase 2 — Component Decomposition (Medium effort)

5. Break down `asset-profile-workbench.tsx` into sub-sections
6. Extract `CompactPreview` generic component
7. Create shared `TabNav` and `AnalyticsWorkspaceShell` components
8. Add missing responsive breakpoints (768px, 480px)

### Phase 3 — Architecture Improvements (Higher effort)

9. Integrate Zod-based client-side form validation
10. Implement i18n infrastructure
11. Add dark mode theme switching
12. Implement toast-based undo for destructive actions
13. Resolve all `@ts-ignore` / `any` type annotations
