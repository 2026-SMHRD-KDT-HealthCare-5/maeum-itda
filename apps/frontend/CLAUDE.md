# apps/frontend/CLAUDE.md

Scoped guidance for `apps/frontend`, loaded alongside the root [CLAUDE.md](../../CLAUDE.md) — don't repeat what's already there (tech stack, monorepo tooling, WebSocket/REST split, mobile-portability guideline). This file only covers the frontend's internal code organization.

## Architecture: Feature-Sliced Design (FSD)

This app is organized with FSD. Code lives under `src/` in one of these layers:

- `app` — app-wide setup: providers (`AppProviders`), routing entry (`AppRouter`), global styles
- `pages` — route-level compositions (one slice per screen ID, see mapping below)
- `widgets` — large reusable UI blocks composed of multiple features/entities
- `features` — a single user-facing action (one slice per UC, see mapping below)
- `entities` — domain objects and their basic UI/logic — the "thing" and how to display/fetch it, no user-facing behavior
- `shared` — reusable, domain-agnostic code: UI kit, API/WebSocket client wiring, config, utils, re-exported `packages/shared-types`

### Import rule

Each layer may only import from layers strictly below it (`app` → `pages` → `widgets` → `features` → `entities` → `shared`). Never import upward, and never import sideways between two slices of the same layer (one `feature` reaching directly into another `feature` — go through `entities`/`shared` instead). Needing a sideways or upward import is a signal the code is in the wrong layer, not a reason to add one.

Enforcement isn't wired up yet (`packages/config`, the shared lint config, is still empty — see root CLAUDE.md). Until an eslint boundaries rule exists, follow this by convention. Every `features/*` and `entities/*` folder listed below already exists as a real directory (not just a plan) — the layering isn't aspirational.

### Segment convention (inside each `features/*` and `entities/*` slice)

Every feature and entity slice has these four segment folders, each with its own `index.ts`/`index.tsx` barrel, plus a top-level `index.ts` that re-exports all four — that top-level barrel is the only thing other layers should import from (never reach into `features/x/model/...` directly from outside `features/x`):

- `ui/` — the React component(s)
- `model/` — types, state, hooks — the non-visual logic
- `api/` — calls to `shared/api` (REST/WebSocket)
- `lib/` — slice-local helpers that don't fit `model`/`api`

`widgets/*` and `pages/*` only get a `ui/` segment (they compose, they don't hold their own model/api).

## Screen ID → `pages/*` mapping (화면설계서)

| `pages/*` | 화면 ID | 관련 UC |
|---|---|---|
| `login` | LOGIN_01 | UC-00 |
| `senior-home` | SENIOR_HOME_01 | UC-01 |
| `senior-conversation` | SENIOR_CONVERSATION_01 | UC-01, UC-02, UC-03 |
| `guardian-home` | GUARDIAN_HOME_01 | UC-08 |
| `guardian-report` | GUARDIAN_REPORT_01 | UC-08, UC-09 |
| `guardian-notification` | GUARDIAN_NOTIFICATION_01 | UC-11 |
| `senior-my-info` | — (menu-tree only, see below) | — |
| `guardian-my-info` | — (menu-tree only, see below) | — |
| `admin` | (관리자 - 데이터 품질 검토) | — |

`pages/admin` is intentionally empty (just `.gitkeep`) — 결정사항 로그 §1 explicitly excludes the admin screen from MVP scope, and `AppRouter` has no admin route or role branch at all (only `senior`/`guardian`). Don't add one without checking the decision log first.

**`senior-my-info` / `guardian-my-info` have no real spec.** 화면설계서's 메뉴구성 lists a "내 정보" leaf under both 시니어 화면 and 보호자 화면, but unlike every other screen in that document it has no 화면 ID, no UC, and no mockup page — it's a name in the menu tree and nothing else. Both pages are therefore just a heading + the logged-in `userId` + a working 로그아웃 button (wired to `entities/user`'s `logout()`), wrapped in the same `BottomTabBar` as their role's other screens. Rebuild them for real the moment an actual 화면 ID/mockup exists for "내 정보" — don't treat the current content as anything more than a nav placeholder.

## UC → `features/*` mapping (요구사항정의서)

| `features/*` | UC | 유스케이스 이름 |
|---|---|---|
| `login-with-credentials` | UC-00 | 로그인 및 역할별 진입 |
| `start-conversation` | UC-01 | 실시간 안부 대화 시작 |
| `record-voice-answer` | UC-02 | 음성 통화 진행 및 답변 |
| `select-report-date` | UC-08 | 일간/주간 정서 리포트 조회 (날짜 선택) |
| `view-evidence-sentence` | UC-09 | 위험 발화 근거 문장 확인 |
| `mark-notification-read` | UC-11 | 알림함 목록 조회 및 읽음 처리 |

UC-03 (STT 변환), UC-05 (발화 속도 분석), UC-06-1/UC-06-2 (SGDS-K 채점/정서지수 산출), UC-07 (데이터 저장) are all `시스템/AI 엔진` actor UCs — they happen in `apps/backend`/`apps/ai-server`, not here, so there's deliberately no matching `features/*` slice for them.

## Current implementation state

Everything under `src/` right now is scaffolding, not real functionality:

- `entities/*` have real TypeScript types in `model/` (grounded in the screen descriptions + 결정사항 로그, with comments pointing at open questions — e.g. `entities/report`'s `emotionScore: number | null` and `entities/notification`'s `target` shape are both still unresolved per 결정사항 로그 §1/§2), but `ui/api/lib` are placeholder stubs.
- `features/*` are placeholder stubs across all four segments, **except** `login-with-credentials`, which has a working mock: `mockResolveRole()` in its `model/` fakes what UC-00's real auth would return (an id containing `guardian` logs in as a guardian, anything else as senior), so the routing skeleton is actually exercisable via `pnpm --filter frontend dev`. Replace that whole function with a real API call the moment `apps/backend` exposes a login endpoint — don't extend the string-matching hack.
- `widgets/*` are placeholder stubs except `bottom-tab-bar`, which is real (renders whatever tab items the page passes in) and also exports the `SENIOR_TAB_ITEMS`/`GUARDIAN_TAB_ITEMS` constants every page for that role should pass in — don't hand-roll a tab list in a page, import the constant.
- Routing (`app/routes`) is real: `/login`, `/senior`, `/senior/conversation`, `/senior/my-info`, `/guardian`, `/guardian/report`, `/guardian/notifications`, `/guardian/my-info`, each guarded by `ProtectedRoute` checking `entities/user`'s session/role, unknown paths redirect to `/login`.
- Session state (`entities/user`) is an in-memory React context — it resets on page refresh. There's no persistence (localStorage/cookies) yet.

When implementing a real screen, replace the relevant placeholder(s) in place rather than adding parallel files — the folder structure and barrel exports are already where they should be.
