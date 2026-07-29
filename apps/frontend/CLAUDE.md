# apps/frontend/CLAUDE.md

Scoped guidance for `apps/frontend`, loaded alongside the root [CLAUDE.md](../../CLAUDE.md) — don't repeat what's already there (tech stack, monorepo tooling, WebSocket/REST split, mobile-portability guideline). This file only covers the frontend's internal code organization.

## Architecture: Feature-Sliced Design (FSD)

This app is organized with FSD. Code lives under `src/` in one of these layers:

- `app` — app-wide setup: providers, routing entry, global styles, global state setup
- `pages` — route-level compositions (one slice per route/screen)
- `widgets` — large reusable UI blocks composed of multiple features/entities (e.g. a report card combining an emotion-score chart + evidence sentences)
- `features` — a single user-facing action (e.g. "start voice check-in", "acknowledge alert")
- `entities` — domain objects and their basic UI/logic (e.g. `senior`, `emotionReport`, `alert`) — the "thing" and how to display/fetch it, no user-facing behavior
- `shared` — reusable, domain-agnostic code: UI kit, API client wiring (via `packages/api-client`), utils, config

### Import rule

Each layer may only import from layers strictly below it in the list above (`app` → `pages` → `widgets` → `features` → `entities` → `shared`). Never import upward, and never import sideways between two slices of the same layer (one `feature` reaching directly into another `feature` — go through `entities`/`shared` instead, or move the shared logic down a layer). Needing a sideways or upward import is a signal the code is in the wrong layer, not a reason to add one.

Enforcement isn't set up yet (`packages/config`, the shared lint config, is still empty — see root CLAUDE.md). Until an eslint boundaries rule exists, follow this by convention.

## Current state

`apps/frontend` is still an empty scaffold — no `src/` layers exist yet. When scaffolding the app for the first time, set up `src/app`, `src/pages`, `src/widgets`, `src/features`, `src/entities`, `src/shared` per the above instead of a default CRA/Vite template structure.
