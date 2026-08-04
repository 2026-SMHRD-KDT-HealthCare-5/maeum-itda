# CLAUDE.md

이 파일은 이 저장소의 코드 작업 시 Claude Code(claude.ai/code)에게 제공하는 가이드입니다.

## Project

마음잇다 (Maeum-Itda) — AI 음성/텍스트 감정분석 기반 시니어 정서변화 모니터링 서비스. 시니어와의 음성 우선(Voice-first) 안부 대화를 STT로 텍스트 변환하고, 한국형 노인우울척도(SGDS-K)·불안척도(GAD-7)·사회적 고립척도(LSNS-6) 3개 척도의 실시간 채점과 음성 톤·피치 기반 비언어적 지표 분석을 결합해 정서지수를 산출한 뒤, 근거 문장과 위험 알림이 담긴 일간/주간 리포트로 보호자에게 제공합니다. 전체 제품 설명은 [README.md](README.md)를, 기획서/요구사항정의서/화면설계서는 [docs/](docs/)를 참고하세요. 그리고 [docs/마음잇다_결정사항_및_이슈로그.md](docs/마음잇다_결정사항_및_이슈로그.md)에는 구두로 결정되어 원본 문서 내용을 대체하는 사항들이 기록되어 있습니다 (예: 정서 상태 라벨은 문서상 높음/낮음이 아니라 좋음/보통/나쁨이다; 백엔드는 기획 문서의 오탈자 "Express"가 아니라 NestJS이다; DB는 문서의 오탈자 PostgreSQL이 아니라 MySQL이다). docs/의 PDF 내용을 그대로 믿기 전에 항상 이 로그를 먼저 확인하세요.

## Repository state

이 저장소는 초기 모노레포 스캐폴딩 단계입니다. `apps/frontend`는 Vite + React + TypeScript와 FSD 구조로 구성되어 있고(자세한 내용은 [apps/frontend/CLAUDE.md](apps/frontend/CLAUDE.md) 참고), 각 기능은 대부분 placeholder 상태입니다. `apps/backend`는 pnpm 워크스페이스와 Turborepo에 연결된 NestJS 기본 애플리케이션과 기능별 모듈 구조가 구성되어 있습니다. `apps/ai-server`와 일부 `packages/*`는 아직 placeholder 상태이며, `packages/shared-types`는 `package.json`과 빈 `src/index.ts`를 갖춘 패키지 스캐폴딩 상태입니다.

## Monorepo tooling

패키지 매니저는 **pnpm**이며, 루트 `package.json`의 `packageManager` 필드(`pnpm@11.17.0`)로 버전이 고정되어 있습니다 — Corepack이 이를 자동으로 강제하므로, 이 저장소에서는 다른 버전의 pnpm을 설치하거나 사용하지 마세요. 워크스페이스는 [pnpm-workspace.yaml](pnpm-workspace.yaml)에 정의되어 있습니다: `apps/*`, `packages/*`. 태스크 러너는 **Turborepo**입니다 ([turbo.json](turbo.json)).

```bash
pnpm install                 # 전체 워크스페이스 의존성 설치
pnpm dev                     # turbo run dev (dev 스크립트가 정의된 모든 패키지 대상)
pnpm build                   # turbo run build
pnpm lint                    # turbo run lint
pnpm --filter <pkg-name> <script>   # 특정 워크스페이스 패키지 하나에서만 스크립트 실행
```

**`apps/ai-server`는 아직 pnpm 패키지가 아닙니다.** `pnpm-workspace.yaml`의 `apps/*` glob 패턴은 이 디렉터리와도 매칭되지만, `package.json`이 없어서(`.gitkeep`만 있음) pnpm이 워크스페이스 멤버로 인식하지 않으며 `pnpm --filter ai-server ...`는 실패합니다. 어차피 Python/FastAPI 프로젝트이므로 자체 `venv`와 `requirements.txt`로 관리하세요 (`cd apps/ai-server && python -m venv venv && pip install -r requirements.txt`). 참고: 나중에 이 디렉터리에 `package.json`이 추가되면(예: 툴링 목적) 기존 glob 패턴 때문에 자동으로 pnpm 워크스페이스 멤버가 되어버립니다.

`packages/config`에는 실제로 동작하는 공유 ESLint flat config(`@maeum-itda/config`, `./eslint.js`에서 export)가 있습니다 — TS + React 규칙 세트(typescript-eslint recommended, react-hooks, react-refresh, eslint-config-prettier)이며 `apps/frontend/eslint.config.js`가 이를 그대로 가져다 씁니다. **`packages/config`는 자체 `typescript` devDependency를 `~6.0.2`로 고정하고 있습니다** — typescript-eslint@8.x가 루트의 TypeScript 7.x에 대해 강하게 에러를 내기 때문입니다(`typescript-eslint does not support TS 7.0`). 이 pin을 제거하거나 `apps/frontend`가 쓰는 버전과 어긋나게 두지 마세요. `apps/backend`는 자체 ESLint/Prettier 설정과 lint 스크립트를 사용합니다. 따라서 `pnpm lint`(`turbo run lint`)는 frontend와 backend에서 실제로 실행되며 위반 사항이 있으면 실패합니다. `apps/ai-server`는 아직 lint 대상이 아닙니다. FSD 레이어 경계 강제(apps/frontend/CLAUDE.md의 import 규칙 참고)는 아직 공유 config에 반영되어 있지 않습니다.

## Architecture (target, per 기획서)

4계층 구조입니다: **클라이언트(React) → 백엔드 API(NestJS) → AI 서버(FastAPI) → MySQL**, 그리고 보호자 알림(notification)을 위한 별도의 서버가 있습니다. 계획된 스택은 다음과 같습니다:

- **apps/frontend** — TypeScript, React, React Router, TanStack Query. Feature-Sliced Design(FSD)을 따릅니다 — 레이어 규칙, 화면ID/UC 매핑, 세그먼트 컨벤션은 [apps/frontend/CLAUDE.md](apps/frontend/CLAUDE.md)를 참고하세요.
- **apps/backend** — TypeScript, Node.js, NestJS
- **apps/ai-server** — Python, FastAPI, OpenAI API (STT → SGDS-K 매핑, tempo 베이스라인 스코어링, structured output 기반 근거 문장 추출). 아직 pnpm 워크스페이스 멤버가 아님 — 위 내용 참고.
- **packages/shared-types** — frontend/backend 사이에서 공유하는 타입(그리고 ai-server와의 API 계약). 지금까지 스캐폴딩된 유일한 워크스페이스 패키지입니다 (`package.json`은 있고 `src/index.ts`는 비어있음).
- **packages/api-client** — frontend가 사용할 타입이 있는 API client. 폴더는 존재하지만(`.gitkeep`만 있음) 아직 스캐폴딩되지 않았습니다.
- **packages/config** — 공유 lint config (`@maeum-itda/config`). `apps/frontend`가 사용하는 실제 ESLint flat config가 있습니다(위 Monorepo tooling 참고); 공유 tsconfig는 아직 없습니다.
- **infra** — 배포/인프라 설정. 폴더는 존재하지만(`.gitkeep`만 있음) 아직 채워지지 않았습니다.

실시간 대화는 WebSocket 기반입니다(기획서 3/4장 기준): 통화 중에는 backend/ai-server 파이프라인이 실시간 STT와 감성 기반 꼬리 질문 생성을 수행하고, 통화 종료 후에는 전체 SGDS-K 매칭과 tempo 분석을 수행해 그날의 정서지수를 산출합니다. 그 외 나머지(로그인 인증, 리포트 조회, 알림함, 대시보드 데이터)는 REST로 처리합니다. 알림 전달은 MVP에서 알림함(REST 조회)만으로 이루어지며, 실제 웹 푸시(Service Worker/Push API)는 MVP 이후 PWA를 적용하는 시점에 별도로 추가할 계획입니다 — 지금 백엔드/알림 서버에 푸시 발송 인프라를 미리 만들지 마세요.

### Mobile-portability guideline (결정사항 로그 §4 참고)

지금은 웹 클라이언트만 만들고 있지만, 팀은 나중에 Flutter 앱을 추가할 때 전면 재작성이 아니라 가벼운 추가만으로 끝내고 싶어합니다. backend/ai-server 기능을 구현할 때는 API를 플랫폼에 종속되지 않게 유지하세요:

- REST 엔드포인트는 OpenAPI/Swagger 스펙으로 문서화해두세요 (NestJS는 이걸 거의 공짜로 만들어줍니다) — 나중에 React의 가정에 맞춰 손으로 짜는 대신, 이 스펙을 기반으로 Dart 클라이언트를 생성할 수 있게요.
- WebSocket 이벤트 이름과 payload 구조는 frontend 코드 안에 암묵적으로 남겨두지 말고 `packages/shared-types`에 타입으로 고정해두세요 — 이게 곧 나중에 모바일 클라이언트가 구현할 프로토콜 문서가 됩니다.
- 인증은 브라우저 쿠키/세션 전용 방식이 아니라 JWT(bearer 토큰) 방식으로 하세요 — 그래야 모바일 클라이언트도 같은 인증 흐름을 재사용할 수 있습니다.
- 비즈니스 로직(정서지수 계산, 임계치 판단, 권한 체크 등)은 React 컴포넌트가 아니라 backend/ai-server에 두세요 — 두 번째 클라이언트가 이를 다시 구현할 필요가 없어야 합니다.

## Git workflow

GitFlow 방식이며, 전체 내용은 [CONTRIBUTING.md](CONTRIBUTING.md)에 문서화되어 있습니다:

- `main` — 언제나 배포 가능한 상태
- `dev` — 통합 브랜치 (새 작업의 기본 베이스)
- `feat/기능이름` — 기능 브랜치, `dev`에서 분기하여 PR로 다시 병합

커밋 컨벤션(prefix 필수): `feat`, `fix`, `refactor`, `style`, `chore` — 예: `git commit -m "feat: 로그인 API 구현"`. `origin/dev`를 feature 브랜치에 병합한 후에는, CONTRIBUTING.md에 따라 push 전에 빌드와 기능이 정상 동작하는지 반드시 확인해야 합니다.

### Claude Code 작업 규칙

- **새 작업 시작 전 브랜치 확인**: 현재 브랜치가 `dev`인 상태에서 새로운 작업/기능 구현을 시작하려는 의도가 보이면, 코드를 작성하기 전에 먼저 현재 브랜치가 `dev`인지 확인하세요. 그런 다음 GitFlow 규칙(`feat/기능이름`)에 맞는 feature 브랜치 이름을 2~3개 후보로 추천하고, 사용자의 확정을 받은 뒤에만 그 브랜치를 생성하세요.
- **커밋 전 승인**: 작업을 마쳤다고 바로 커밋하지 마세요. 항상 변경 요약과 Conventional Commits 형식의 커밋 메시지 초안을 먼저 보여주고, 사용자가 승인한 뒤에만 커밋하세요.
