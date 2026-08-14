# Repository Guidelines

## Project Structure

This pnpm/Turborepo monorepo contains a React + Vite client in `apps/frontend` and a NestJS service in `apps/backend`. Frontend code follows Feature-Sliced Design: `app → pages → widgets → features → entities → shared`. Import only from lower layers and through each slice's top-level `index.ts`. Shared contracts live in `packages/shared-types`, lint configuration in `packages/config`, requirements and draft designs in `docs`, and deployment resources in `infra`.

## Commands

Use pnpm 11 from the repository root:

- `pnpm dev` starts workspace development tasks through Turbo.
- `pnpm build` and `pnpm lint` verify all workspaces.
- `pnpm format` formats frontend and shared-type source files with the root Prettier configuration.
- `pnpm format:check` verifies frontend and shared-type formatting without modifying files. Backend formatting remains managed by `pnpm --filter backend format` and `apps/backend/.prettierrc`.
- `pnpm --filter frontend lint` checks frontend TypeScript and React rules.
- `pnpm --filter frontend build` runs `tsc -b` and creates the Vite build.
- `pnpm --filter backend test` runs Jest unit tests.
- `pnpm --filter backend test:e2e` runs Supertest e2e tests.
- `pnpm --filter backend test:cov` creates backend coverage.

## Style and Testing

Use TypeScript with 2-space indentation and the root Prettier configuration. Format changed supported files before verification and run `pnpm format:check` before committing; ESLint does not format code. React components use `PascalCase.tsx`; variables and functions use `camelCase`; slice directories use kebab-case. Frontend styles use colocated `*.module.css`. Global variables and base styles are in `apps/frontend/src/index.css`; reuse `shared/ui` and existing tokens first. NestJS files use `.module.ts`, `.service.ts`, and `.controller.ts` suffixes. Shell scripts retain LF endings.

When adding a new file or making a substantial behavioral change, add or update concise comments that explain the file's role, connected components/tables, overall data or call flow, major method responsibilities, important next calls, and any intentionally incomplete integration. Inspect nearby files first and follow their established comment style and terminology. Keep comments synchronized with behavior. Do not narrate obvious syntax or add comments to every line; comments should explain architecture, business intent, non-obvious constraints, state transitions, or temporary limitations that cannot be understood clearly from names and types alone.

Backend unit tests are `*.spec.ts`; e2e tests are `apps/backend/test/*.e2e-spec.ts`. No frontend test runner or coverage target is configured. For UI changes, run filtered frontend lint and build, then manually check affected routes at mobile and desktop sizes.

## Task Ownership and Workflow

Claude Code and Codex may both implement feature behavior and UI. Assign each screen or clearly scoped task to one tool at a time; do not edit the same files concurrently. The primary tool should complete the requested behavior, UI, validation, and relevant verification. A second tool may review or refine the result afterward, but should preserve working behavior and avoid rewriting it without a concrete reason.

Before starting any new screen or feature, verify the Git context before editing files: run `git branch --show-current` and `git status --short`, confirm the work starts from `dev`, and create or switch to a dedicated feature branch. Do not rely on conversation context or a previous task's branch state. If the worktree already contains changes, identify their owner and scope first; preserve them and move them safely to the intended branch before implementation.

Before continuing another tool's work, inspect the current diff and identify state, events, API/Query connections, disabled conditions, and logic to preserve. UI work must not invent data or alter API contracts, authentication, sessions, routing, or state management. Report the reason and impact before expanding scope or changing functional contracts. Do not install UI libraries or broadly refactor unrelated screens.

Do not choose, move, rename, or repurpose image assets without the user's explicit direction. When the user provides a specific image or filename pattern for a UI location or state, use only that identified asset and preserve its path and filename unless the user separately approves an asset move or rename.

All actual conversation chat bubbles should show a small timestamp in `오전/오후 h:mm` format using the `Asia/Seoul` timezone. Align Dasol/question timestamps to the left and senior/answer timestamps to the right. Reuse the shared conversation bubble renderer rather than creating screen-specific timestamp markup; non-conversation guidance bubbles do not need timestamps.

`docs/page-pdf` and `docs/page-html` (the old draft per-screen mockups) were retired on 2026-08-08 — the team finalized per-screen designs in Figma instead, so Figma is now the design reference for screens, not those folders. Figma exports will land in `docs/screens/` as they become available; until then, fall back to 화면설계서's overview wireframes and the decision log. Treat whatever design reference you use (Figma, `docs/screens/`, 화면설계서) as something to reconcile with current requirements, decisions, working code, shared components, senior accessibility, and the service's warm but trustworthy healthcare tone — not a final spec to copy blindly. Use the Dasol character only for welcome, guidance, feedback, empty states, or restrained emotional emphasis. Do not use a penguin mascot anywhere in new or reconciled UI — some guardian-facing mockups (e.g. `GUARDIAN_HOME_01`, `GUARDIAN_REPORT_01`) still show a penguin illustration from an earlier design pass; treat it as stale and drop it when implementing or revising those screens.

UI work is complete when behavior is preserved, the diff is scoped, shared components are reused, loading/error/empty/disabled and keyboard-focus states are reviewed where applicable, and frontend lint/build pass. Report changed files, verification, and unresolved dependencies.

When the user asks for an ongoing working preference with phrases such as "앞으로 이렇게 해줘" or "다음부터는 이렇게 해줘", apply it in the current conversation and determine whether it should persist across future sessions and tools. If it is a repository-wide workflow, verification rule, coding convention, or other durable team practice, ask whether the user wants it added to `AGENTS.md`. Do not change repository governance for a one-off preference or without the user's approval.

## Platform Scope

The current MVP is a responsive web app now being extended with a PWA shell and real web push notifications, per the 2026-08-11 team decision (see `docs/마음잇다_결정사항_및_이슈로그.md` §1 "웹 푸시 알림" and `docs/sprint-plan.md`). PWA manifest, service worker, and Push API code (VAPID keys, `PushSubscription` storage, actual push delivery on risk alerts) are explicitly in scope for this sprint — build them to the scope and schedule in `docs/sprint-plan.md` rather than speculatively. Do not add native bridges or app-specific UI beyond that PWA scope unless explicitly requested; a possible Flutter client remains a later phase. Keep REST/WebSocket contracts platform-neutral and defined in shared types so future clients can reuse the backend, but do not build speculative abstractions beyond what the sprint plan calls for.

## Commits and Pull Requests

Use concise Conventional Commit prefixes observed in history: `feat:`, `fix:`, `refactor:`, `style:`, `docs:`, or `chore:`. Branch from `dev` (for example, `feat/login-form`) and open PRs back to `dev`. Include a summary, linked requirement or issue, verification commands, and before/after screenshots for UI changes.

`git commit` is gated by a real pre-commit hook — `husky` (`.husky/pre-commit`) runs `npx lint-staged`, which applies Prettier/ESLint (per the `lint-staged` field in root `package.json`) to staged files only and auto-fixes what it can before the commit proceeds. This runs for every contributor and tool alike (a teammate committing from their terminal, another agent, Claude Code), not just Claude Code — it isn't a Claude-specific check. `pnpm format:check`/`pnpm lint` still exist for auditing the whole repo on demand, but you don't need to run them yourself before every commit; the hook already covers whatever you're about to commit.

When the user says they want to commit or asks for a commit, do not immediately run `git commit`. First inspect the current branch, worktree, and diff; separate user-owned changes from agent-made changes; group the diff into coherent commits; format changed supported files; and run `pnpm format:check` plus verification appropriate to the changed scope. If the work is directly on `dev`, point out the branch rule and propose a suitable feature branch. Present the proposed branch name and Conventional Commit split to the user, then create the branch and commits only after the user approves that plan. After committing, report the commit hashes, included changes, and verification results.

## Security

Never commit credentials or `.env` files. Backend database settings use `DB_HOST`, `DB_PORT`, `DB_USERNAME`, `DB_PASSWORD`, and `DB_DATABASE`; frontend endpoints use `VITE_API_BASE_URL` and `VITE_WS_BASE_URL`.
