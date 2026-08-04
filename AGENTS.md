# Repository Guidelines

## Project Structure

This pnpm/Turborepo monorepo contains a React + Vite client in `apps/frontend` and a NestJS service in `apps/backend`. Frontend code follows Feature-Sliced Design: `app → pages → widgets → features → entities → shared`. Import only from lower layers and through each slice's top-level `index.ts`. Shared contracts live in `packages/shared-types`, lint configuration in `packages/config`, requirements and draft designs in `docs`, and deployment resources in `infra`.

## Commands

Use pnpm 11 from the repository root:

- `pnpm dev` starts workspace development tasks through Turbo.
- `pnpm build` and `pnpm lint` verify all workspaces.
- `pnpm --filter frontend lint` checks frontend TypeScript and React rules.
- `pnpm --filter frontend build` runs `tsc -b` and creates the Vite build.
- `pnpm --filter backend test` runs Jest unit tests.
- `pnpm --filter backend test:e2e` runs Supertest e2e tests.
- `pnpm --filter backend test:cov` creates backend coverage.

## Style and Testing

Use TypeScript with 2-space indentation and ESLint/Prettier formatting. React components use `PascalCase.tsx`; variables and functions use `camelCase`; slice directories use kebab-case. Frontend styles use colocated `*.module.css`. Global variables and base styles are in `apps/frontend/src/index.css`; reuse `shared/ui` and existing tokens first. NestJS files use `.module.ts`, `.service.ts`, and `.controller.ts` suffixes. Shell scripts retain LF endings.

Backend unit tests are `*.spec.ts`; e2e tests are `apps/backend/test/*.e2e-spec.ts`. No frontend test runner or coverage target is configured. For UI changes, run filtered frontend lint and build, then manually check affected routes at mobile and desktop sizes.

## UI Ownership and Workflow

Claude Code primarily implements feature behavior, API/Query integration, validation, and state transitions. Codex owns UI drafts and refinement: semantic markup, CSS Modules, visual hierarchy, responsiveness, accessibility, and consistent state presentation. Work on one screen or one clear problem at a time, and do not edit the same file concurrently.

Before UI handoff, identify state, events, API/Query connections, disabled conditions, and logic to preserve. UI work must not invent data or alter API contracts, authentication, sessions, routing, or state management. Report the reason and impact before touching functional files. Do not install UI libraries or broadly refactor unrelated screens.

Treat `docs/page-pdf` and locally available, gitignored `docs/page-html` as draft layout references, not final specifications. Reconcile them with current requirements, decisions, working code, shared components, senior accessibility, and the service's warm but trustworthy healthcare tone. Use the Dasol character only for welcome, guidance, feedback, empty states, or restrained emotional emphasis.

UI work is complete when behavior is preserved, the diff is scoped, shared components are reused, loading/error/empty/disabled and keyboard-focus states are reviewed where applicable, and frontend lint/build pass. Report changed files, verification, and unresolved dependencies.

## Platform Scope

The current MVP is a responsive web app. Do not add PWA manifests, service workers, Push API code, native bridges, or app-specific UI unless explicitly requested; notifications currently use the in-app REST-backed inbox. PWA support and a possible Flutter client are later phases. Keep REST/WebSocket contracts platform-neutral and defined in shared types so future clients can reuse the backend, but do not build speculative abstractions for them now.

## Commits and Pull Requests

Use concise Conventional Commit prefixes observed in history: `feat:`, `fix:`, `refactor:`, `style:`, `docs:`, or `chore:`. Branch from `dev` (for example, `feat/login-form`) and open PRs back to `dev`. Include a summary, linked requirement or issue, verification commands, and before/after screenshots for UI changes.

## Security

Never commit credentials or `.env` files. Backend database settings use `DB_HOST`, `DB_PORT`, `DB_USERNAME`, `DB_PASSWORD`, and `DB_DATABASE`; frontend endpoints use `VITE_API_BASE_URL` and `VITE_WS_BASE_URL`.
