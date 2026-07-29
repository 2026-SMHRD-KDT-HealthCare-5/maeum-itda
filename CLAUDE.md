# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

마음잇다 (Maeum-Itda) — AI 음성/텍스트 감정분석 기반 시니어 정서변화 모니터링 서비스. Voice-first check-in conversations with seniors are transcribed (STT), scored against the Korean geriatric depression scale (SGDS-K, 15 items) combined with a speech-tempo baseline, and surfaced to caregivers as daily/weekly reports with evidence sentences and risk alerts. See [README.md](README.md) for the full product description and [docs/](docs/) for the 기획서/요구사항정의서/화면설계서 plus [docs/마음잇다_결정사항_및_이슈로그.md](docs/마음잇다_결정사항_및_이슈로그.md) which records decisions made verbally that supersede the original docs (e.g. emotion labels are 좋음/보통/나쁨, not the docs' 높음/낮음; backend is NestJS despite the plan doc's "Express" typo; DB is MySQL despite a doc typo saying PostgreSQL). Always check that log before trusting a detail from the PDFs in docs/.

## Repository state

This is a fresh monorepo scaffold — `apps/backend`, `apps/ai-server`, and most `packages/*` currently contain only a `.gitkeep`. `packages/shared-types` has a real `package.json` (empty `src/index.ts` placeholder). `apps/frontend` is scaffolded (Vite + React + TS, FSD structure — see [apps/frontend/CLAUDE.md](apps/frontend/CLAUDE.md)) but its slices are still mostly placeholders. `README.md` and `CONTRIBUTING.md` are written and reflect current state (including TODOs for what's not built yet). Expect to be scaffolding actual app code (NestJS backend, FastAPI ai-server) or filling in frontend placeholders rather than editing mature implementations.

## Monorepo tooling

Package manager is **pnpm**, version-pinned via the root `package.json`'s `packageManager` field (`pnpm@11.17.0`) — Corepack will enforce this automatically, don't install or use a different pnpm version for this repo. Workspace is defined in [pnpm-workspace.yaml](pnpm-workspace.yaml): `apps/*`, `packages/*`. Task runner is **Turborepo** ([turbo.json](turbo.json)).

```bash
pnpm install                 # install all workspace deps
pnpm dev                     # turbo run dev (all packages defining a `dev` script)
pnpm build                   # turbo run build
pnpm lint                    # turbo run lint
pnpm --filter <pkg-name> <script>   # run a script in one workspace package only
```

**`apps/ai-server` isn't a pnpm package yet.** The `apps/*` glob in `pnpm-workspace.yaml` does match its directory, but it has no `package.json` (just `.gitkeep`), so pnpm doesn't register it as a workspace member and `pnpm --filter ai-server ...` will fail. It's a Python/FastAPI project anyway — manage it via its own `venv` and `requirements.txt` (`cd apps/ai-server && python -m venv venv && pip install -r requirements.txt`). Note: if a `package.json` is ever added there (e.g. for tooling), it will silently become a pnpm workspace member via the existing glob.

Note: root devDependencies include eslint (^10.8.0) and prettier (^3.9.6), but no config files exist yet, and no per-package `lint` scripts exist either — `pnpm lint` currently no-ops silently (turbo finds no matching task and exits cleanly with nothing checked). Don't treat a clean `pnpm lint` run as a signal that code is actually lint-clean until this is set up. Intended home for shared config: `packages/config` (folder exists, currently empty).

## Architecture (target, per 기획서)

Four layers: **client (React) → backend API (NestJS) → AI server (FastAPI) → MySQL**, with a separate 알림(notification) server for caregiver alerts. Planned stack:

- **apps/frontend** — TypeScript, React, React Router, TanStack Query. Follows Feature-Sliced Design (FSD) — see [apps/frontend/CLAUDE.md](apps/frontend/CLAUDE.md) for layer rules, the screen-ID/UC mapping, and segment conventions.
- **apps/backend** — TypeScript, Node.js, NestJS
- **apps/ai-server** — Python, FastAPI, OpenAI API (STT → SGDS-K mapping, tempo-baseline scoring, structured-output evidence-sentence extraction). Not yet a pnpm workspace member — see above.
- **packages/shared-types** — types shared across frontend/backend (and the API contract with ai-server). Only workspace package scaffolded so far (has `package.json`, `src/index.ts` is empty).
- **packages/api-client** — typed API client consumed by the frontend. Folder exists (`.gitkeep` only) but not yet scaffolded.
- **packages/config** — shared lint/tsconfig config. Folder exists (`.gitkeep` only) but not yet scaffolded — planned home for the eslint/prettier setup described above.
- **infra** — deployment/infra config. Folder exists (`.gitkeep` only), not yet populated.

Real-time conversation is WebSocket-based (per 기획서 section 3/4): the backend/ai-server pipeline does live STT + sentiment-based follow-up question generation during the call, then post-call runs full SGDS-K matching + tempo analysis to produce the day's 정서지수. REST is used for everything else (auth/login, report queries, notification inbox, dashboard data).

### Mobile-portability guideline (see decision log §4)

Only a web client is being built right now, but the team wants a future Flutter app to be a thin addition later, not a rewrite. When implementing backend/ai-server features, keep the API platform-agnostic:

- Keep REST endpoints documented as an OpenAPI/Swagger spec (NestJS generates this close to for free) so a Dart client can eventually be generated from it instead of hand-written against React's assumptions.
- Keep WebSocket event names and payload shapes pinned as types in `packages/shared-types` rather than left implicit in frontend code — that's the protocol doc a future mobile client would implement against.
- Auth via JWT (bearer tokens), not browser-cookie/session-only mechanisms, so a mobile client can reuse the same auth flow.
- Keep business logic (정서지수 계산, 임계치 판단, 권한 체크, etc.) in the backend/ai-server, not in React components — a second client shouldn't need to reimplement it.

## Git workflow

GitFlow-style, documented in full in [CONTRIBUTING.md](CONTRIBUTING.md):

- `main` — always releasable
- `dev` — integration branch (default base for new work)
- `feat/기능이름` — feature branches, branched from `dev`, merged back via PR

Commit convention (prefix required): `feat`, `fix`, `refactor`, `style`, `chore` — e.g. `git commit -m "feat: 로그인 API 구현"`. After merging `origin/dev` into a feature branch, CONTRIBUTING.md requires verifying the build and functionality still work before pushing.
