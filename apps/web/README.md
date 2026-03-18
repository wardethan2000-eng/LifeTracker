# Web App

This workspace now contains the initial Next.js scaffold for the LifeKeeper web interface.

## Current scope

- App Router-based Next.js shell
- Static responsive dashboard prototype
- Asset-first layout with due work emphasized inside asset cards
- Equal-entry affordances for manual asset creation and preset-based setup
- Category-aware structure for vehicles, home, yard, and equipment

## Run locally

1. Install workspace dependencies from the repository root with `pnpm install`.
2. Start the web app with `pnpm --filter @lifekeeper/web dev`.
3. Open the local Next.js URL shown in the terminal.

## Next steps

- Connect the dashboard shell to real API-backed asset, schedule, and log data.
- Add asset detail routes and category-specific layouts.
- Replace placeholder actions with real create, log, and filter flows.

## Phase 2 Verification Checklist

Use this checklist after structural UI refactors that should preserve existing behavior.

### Asset Profile Workbench

1. Open the asset create screen and confirm Core Identity, Custom Fields, Usage Metrics, Maintenance Schedules, and the aside column render in the same order as before.
2. Change the asset category and confirm the template selector label, available templates, and preset-driven fields update correctly.
3. Expand Custom Fields and verify:
	- section filtering still works
	- adding a suggested field still populates the table
	- creating a new section still allows adding fields into that section
	- editing and removing field definitions still updates the preview and hidden JSON payloads
4. Expand Usage Metrics and verify enabling or disabling a metric still updates the table state and summary preview.
5. Expand Maintenance Schedules and verify disabling a metric still disables schedules that depend on that metric.
6. Submit both create and edit flows and confirm the saved asset data matches the form state.

### Hobby Session Detail

1. Open a hobby session with pipeline lifecycle mode and confirm the phase indicator and advance action still work.
2. Open a hobby session with binary lifecycle mode and confirm Active and Completed toggles still update status correctly.
3. Toggle several session steps and confirm progress count, progress bar, and completed timestamps still update correctly.
4. Change the session rating and confirm the selected star state and saved rating still match.
5. Verify the activity log section still loads entries and deep links resolve to the correct session anchors.

### Shared Preview Components

1. Confirm compact previews still render correctly for fields, metrics, schedules, budgets, phases, supplies, tasks, and maintenance schedules.
2. Check empty states and overflow messages for each preview type.
3. Verify muted and danger tones still render with the expected styling.

### Shared Navigation

1. Open the asset detail layout and verify tab highlighting still follows the active route.
2. Open the hobby detail page and confirm the section tabs still switch between views correctly.
3. Open the project detail page and confirm the Overview and Entries tab states still match the selected view.

### Analytics Workspaces

1. Open the comparative, compliance, and hobby analytics surfaces and confirm tab switching still works.
2. Verify loading states still render inside the analytics shell instead of replacing the whole page.
3. Confirm no chart or table content shifted unexpectedly after the shell extraction.

### Responsive Checks

1. At widths below 768px, verify workbench layouts, analytics grids, action rows, and tab bars collapse without overlap.
2. At widths below 480px, verify primary actions remain reachable, tables scroll horizontally when needed, and pill or analytics tabs remain usable.
3. Spot-check asset create, hobby session detail, project detail, and analytics pages on both breakpoints.