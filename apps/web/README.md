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