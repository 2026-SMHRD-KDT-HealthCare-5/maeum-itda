# CLAUDE.md

이 파일은 이 저장소의 코드 작업 시 Claude Code(claude.ai/code)에게 제공하는 가이드입니다. 저장소 공통 작업 원칙(구조, 커맨드, 스타일, 작업 단위 소유권, 커밋·PR 규칙, 보안)은 [AGENTS.md](AGENTS.md)에 있습니다 — 거기 있는 내용은 여기서 반복하지 않습니다.

## Project

마음잇다 (Maeum-Itda) — AI 음성/텍스트 감정분석 기반 시니어 정서변화 모니터링 서비스. 시니어와의 음성 우선(Voice-first) 안부 대화를 STT로 텍스트 변환하고, 한국형 노인우울척도(SGDS-K)·불안척도(GAD-7)·사회적 고립척도(LSNS-6) 3개 척도의 실시간 채점 결과(위험 응답 비율 기반)로 정서지수(TextScore 단일값)를 산출합니다. 음성 톤·피치 기반 비언어적 지표는 별도로 점수화하지 않고 실시간 감성분석의 입력 재료로만 사용합니다. 산출된 정서지수는 근거 문장과 위험 알림이 담긴 일간/주간 리포트로 보호자에게 제공됩니다. 전체 제품 설명은 [README.md](README.md)를, 기획서/요구사항정의서/화면설계서는 [docs/](docs/)를 참고하세요. 그리고 [docs/마음잇다_결정사항_및_이슈로그.md](docs/마음잇다_결정사항_및_이슈로그.md)에는 구두로 결정되어 원본 문서 내용을 대체하는 사항들이 기록되어 있습니다 (예: 정서 상태 라벨은 문서상 높음/낮음이 아니라 좋음/보통/나쁨이다; 백엔드는 기획 문서의 오탈자 "Express"가 아니라 NestJS이다; DB는 문서의 오탈자 PostgreSQL이 아니라 MySQL이다). docs/의 PDF 내용을 그대로 믿기 전에 항상 이 로그를 먼저 확인하세요.

## Repository state

이 저장소는 초기 스캐폴딩 단계를 지나 데모(2026-08-21)를 완료하고 실사용 하드닝 단계에 들어선 상태입니다. `apps/frontend`는 Vite + React + TypeScript와 FSD 구조로 구성되어 있고(자세한 내용은 [apps/frontend/CLAUDE.md](apps/frontend/CLAUDE.md) 참고), 로그인·회원가입·연결 요청·안부 대화·리포트 조회·알림함·웹 푸시·내 정보 관리까지 핵심 화면 대부분이 실제 API/WebSocket 연동으로 동작합니다 — 출석 캘린더의 실데이터 연동, `entities/senior`/`entities/guardian`의 UI/API 채우기 등 일부만 아직 남아 있습니다. `apps/backend`는 pnpm 워크스페이스와 Turborepo에 연결된 NestJS 애플리케이션이며, `src/` 아래 `auth`/`users`/`chats`/`analysis`/`reports`/`notifications`/`connections`/`guardian-dashboard`/`profile-settings` 모듈에 실시간 대화 WebSocket 게이트웨이, 과거 메시지 cursor 조회, 웹 푸시 발송 등 실제 로직이 구현되어 있습니다. AI 서버가 만들어내는 TTS 오디오는 2026-08-21부로 base64 일괄 전달에서 실시간 스트리밍으로 바뀌었습니다 — `tts:audio` WS 이벤트는 오디오 바이트 대신 짧은 인증 토큰이 붙은 스트리밍 URL(`GET /chats/tts-stream`)만 실어 보내고, 프론트가 그 URL로 별도 HTTP 요청을 열어 FastAPI의 실시간 스트림을 그대로 재생합니다(자세한 계약은 `docs/ws-protocol.md` §4.2/§6.4 참고). 문항 커버리지(`pendingScaleItems`)/최근 N일 리포트 요약(`prevSessionSummary`)/오늘 대화 전체(`conversationTurns`)도 `AnalysisContextRepository`가 DB에서 조회해 AI 서버 호출 시 실어 보냅니다 — 전부 종단간 연동 완료(현재 진행 상황과 남은 작업은 `docs/sprint-plan.md` 참고). `apps/ai-server`는 FastAPI 기반으로 STT(OpenAI)·꼬리질문 생성 및 SGDS-K/GAD-7/LSNS-6 실시간 채점·TTS(Typecast)까지 한 턴 파이프라인이 실제 API 호출로 동작합니다(`.env`의 `SCALE_ANALYSIS_MODE`/`STT_CORRECTION_MODE`/`DAILY_SUMMARY_MODE`를 `model`로 설정해야 실제 LLM 호출을 쓰며, 기본값 `test`는 여전히 고정 목업만 반환합니다). `packages/api-client`는 더 이상 placeholder가 아니며 백엔드 OpenAPI 스펙 기반으로 생성된 실제 클라이언트가 들어있습니다. `infra`는 아직 placeholder 상태입니다. `packages/shared-types`는 더 이상 비어있지 않습니다 — `ChatMessage`(대화 메시지 한 건)와 cursor pagination(`ChatMessageHistoryQuery`/`Page`), `/ws/chats` 이벤트 계약(`ws/` 서브폴더의 `auth`/`chat`/`audio`/`server-events`) 등 실제 타입이 정의되어 있습니다 — 예전 `ConversationTurn`(질문/답변 쌍 모델)은 삭제됐으니 새 코드에서 참조하지 마세요.

## Monorepo tooling

패키지 매니저는 **pnpm**이며, 루트 `package.json`의 `packageManager` 필드(`pnpm@11.17.0`)로 버전이 고정되어 있습니다 — Corepack이 이를 자동으로 강제하므로, 이 저장소에서는 다른 버전의 pnpm을 설치하거나 사용하지 마세요. 워크스페이스는 [pnpm-workspace.yaml](pnpm-workspace.yaml)에 정의되어 있습니다: `apps/*`, `packages/*`. 태스크 러너는 **Turborepo**입니다 ([turbo.json](turbo.json)).

```bash
pnpm install                 # 전체 워크스페이스 의존성 설치
pnpm dev                     # turbo run dev (dev 스크립트가 정의된 모든 패키지 대상)
pnpm build                   # turbo run build
pnpm lint                    # turbo run lint
pnpm --filter <pkg-name> <script>   # 특정 워크스페이스 패키지 하나에서만 스크립트 실행
```

**`apps/ai-server`는 아직 pnpm 패키지가 아닙니다.** `pnpm-workspace.yaml`의 `apps/*` glob 패턴은 이 디렉터리와도 매칭되지만, `package.json`이 없어서 pnpm이 워크스페이스 멤버로 인식하지 않으며 `pnpm --filter ai-server ...`는 실패합니다(디렉터리 자체는 `README.md`/`requirements.txt`/`app/`/`tests/`/`scripts/` 등으로 이미 꽉 찬 실제 FastAPI 프로젝트입니다 — pnpm 관점에서만 비멤버라는 뜻입니다). 어차피 Python/FastAPI 프로젝트이므로 자체 `venv`와 `requirements.txt`로 관리하세요 (`cd apps/ai-server && python -m venv venv && pip install -r requirements.txt`). 참고: 나중에 이 디렉터리에 `package.json`이 추가되면(예: 툴링 목적) 기존 glob 패턴 때문에 자동으로 pnpm 워크스페이스 멤버가 되어버립니다.

`packages/config`에는 실제로 동작하는 공유 ESLint flat config(`@maeum-itda/config`, `./eslint.js`에서 export)가 있습니다 — TS + React 규칙 세트(typescript-eslint recommended, react-hooks, react-refresh, eslint-config-prettier)이며 `apps/frontend/eslint.config.js`가 이를 그대로 가져다 씁니다. **`packages/config`는 자체 `typescript` devDependency를 `~6.0.2`로 고정하고 있습니다** — typescript-eslint@8.x가 루트의 TypeScript 7.x에 대해 강하게 에러를 내기 때문입니다(`typescript-eslint does not support TS 7.0`). 이 pin을 제거하거나 `apps/frontend`가 쓰는 버전과 어긋나게 두지 마세요. `apps/backend`는 자체 ESLint/Prettier 설정과 lint 스크립트를 사용합니다. 따라서 `pnpm lint`(`turbo run lint`)는 frontend와 backend에서 실제로 실행되며 위반 사항이 있으면 실패합니다. `apps/ai-server`는 아직 lint 대상이 아닙니다. FSD 레이어 경계 강제(apps/frontend/CLAUDE.md의 import 규칙 참고)는 아직 공유 config에 반영되어 있지 않습니다.

## Architecture (target, per 기획서/요구사항정의서 — 상충 시 [결정사항 로그](docs/마음잇다_결정사항_및_이슈로그.md) 우선)

4계층 구조입니다: **클라이언트(React) → 백엔드 API(NestJS) → AI 서버(FastAPI) → MySQL**, 그리고 보호자 알림(notification)을 위한 별도의 서버가 있습니다. 계획된 스택은 다음과 같습니다:

- **apps/frontend** — TypeScript, React, React Router, TanStack Query. Feature-Sliced Design(FSD)을 따릅니다 — 레이어 규칙, 화면ID/UC 매핑, 세그먼트 컨벤션은 [apps/frontend/CLAUDE.md](apps/frontend/CLAUDE.md)를 참고하세요.
- **apps/backend** — TypeScript, Node.js, NestJS
- **apps/ai-server** — Python, FastAPI. STT는 OpenAI API를 우선 사용하고 키 무효·쿼터 소진 시에만 로컬 Whisper(faster-whisper, GPU 없으면 CPU로 동작)로 폴백하며, TTS는 Typecast(Typecast Streaming API)로 벤더가 확정되어 있습니다. **감성분석(sentiment)은 2026-08-21부로 별도 모델이 아니라 LLM이 직접 담당합니다(결정사항 로그 §8, KLUE/Kresnik 5감정 모델 폐기)** — 꼬리질문 생성과 같은 LLM 호출(`llm.py`)이 STT 텍스트와 `app/services/audio_features.py`가 numpy만으로 뽑은 가벼운 음성 지표(발화길이·평균음량·무음비율·피치변동폭 근사치)를 함께 참고해 `sentimentLabel`(POSITIVE/NEUTRAL/NEGATIVE)까지 Structured Output으로 반환합니다(STT 교정 `corrected_transcript`·SGDS-K/GAD-7/LSNS-6 척도 채점·꼬리질문 생성도 같은 호출). SGDS-K·GAD-7·LSNS-6 3개 척도 매칭 결과만으로 정서지수(TextScore)를 산출하며, 음성 지표는 별도 점수화하지 않고 이 LLM 감성 판단의 입력 재료로만 사용합니다(자세한 내용은 [docs/마음잇다_결정사항_및_이슈로그.md](docs/마음잇다_결정사항_및_이슈로그.md) 참고). STT·감성판단·척도 채점·꼬리질문 생성·TTS까지 한 턴 파이프라인이 실제 API 호출로 동작하며(`.env`의 모드 플래그를 `model`로 설정해야 함, 위 Repository state 참고), 일간 대화 요약(UC-06-4, `POST /reports/daily-summary`)도 구현되어 있습니다. 아직 pnpm 워크스페이스 멤버가 아님 — 위 내용 참고.
- **packages/shared-types** — frontend/backend 사이에서 공유하는 타입(그리고 ai-server와의 API 계약). `src/index.ts`에 `ChatMessage`(메시지 한 건), cursor pagination 타입(`ChatMessageHistoryQuery`/`Page`), `/ws/chats` WebSocket 이벤트 타입(`ws/` 서브폴더)이 정의되어 있습니다. 예전 `ConversationTurn`/`Conversation` 컨테이너 모델은 삭제됐습니다.
- **packages/api-client** — frontend가 사용할 타입이 있는 API client. `apps/backend`의 OpenAPI 스펙에서 `swagger-typescript-api`로 생성된 실제 클라이언트(`src/api-client.ts`)가 들어있습니다 — placeholder가 아닙니다. 단, `@ApiProperty` 타입 힌트가 없는 일부 DTO 필드는 `object | null`로 생성되는 알려진 한계가 있어 호출부에서 캐스팅이 필요할 수 있습니다.
- **packages/config** — 공유 lint config (`@maeum-itda/config`). `apps/frontend`가 사용하는 실제 ESLint flat config가 있습니다(위 Monorepo tooling 참고); 공유 tsconfig는 아직 없습니다.
- **infra** — 배포/인프라 설정. 폴더는 존재하지만(`.gitkeep`만 있음) 아직 채워지지 않았습니다.

실시간 대화는 WebSocket 기반입니다: 응답(turn) 하나가 들어올 때마다 STT 변환 → 그 텍스트와 음성 지표를 입력 삼아 같은 LLM 호출에서 감성분석·SGDS-K/GAD-7/LSNS-6 실시간 채점(UC-06-1)·꼬리 질문 생성(UC-04)이 즉시 일어납니다(감성분석은 2026-08-21부로 별도 모델이 아니라 이 LLM 호출이 직접 담당 — 위 apps/ai-server 항목, 결정사항 로그 §8 참고). 대화가 하나 끝날 때마다(또는 같은 날 재접속 시) 그 시점까지 해당 날짜에 귀속된 모든 turn을 다시 모아 정서지수(TextScore 단일값, UC-06-2)를 산출·갱신합니다 — `Conversation`처럼 여러 turn을 묶는 컨테이너 개념은 없으며, 음성 지표는 별도 점수화되지 않고 감성분석의 입력 재료로만 쓰입니다(자세한 내용은 [결정사항 로그](docs/마음잇다_결정사항_및_이슈로그.md) 참고). 그 외 나머지(로그인 인증, 리포트 조회, 알림함, 대시보드 데이터)는 REST로 처리합니다. 알림 전달은 알림함(REST 조회)에 더해, 2026-08-11 팀 결정(docs/마음잇다_결정사항_및_이슈로그.md §1 "웹 푸시 알림" 행, docs/sprint-plan.md)으로 이번 스프린트부터 실제 웹 푸시(Service Worker/Push API, VAPID 키, `PushSubscription` 저장, 위험 알림 실제 발송)도 MVP 필수 범위에 포함됩니다 — 백엔드/프론트엔드 모두 docs/sprint-plan.md에 정리된 일정대로 푸시 발송 인프라를 구현하세요.

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

커밋 컨벤션(prefix 필수): `feat`, `fix`, `refactor`, `style`, `docs`, `chore` — 예: `git commit -m "feat: 로그인 API 구현"`. `origin/dev`를 feature 브랜치에 병합한 후에는, CONTRIBUTING.md에 따라 push 전에 빌드와 기능이 정상 동작하는지 반드시 확인해야 합니다.

### Claude Code 작업 규칙

- **새 작업 시작 전 브랜치 확인**: 현재 브랜치가 `dev`인 상태에서 새로운 작업/기능 구현을 시작하려는 의도가 보이면, 코드를 작성하기 전에 먼저 현재 브랜치가 `dev`인지 확인하세요. 그런 다음 GitFlow 규칙(`feat/기능이름`)에 맞는 feature 브랜치 이름을 2~3개 후보로 추천하고, 사용자의 확정을 받은 뒤에만 그 브랜치를 생성하세요.
- **커밋 전 승인**: 작업을 마쳤다고 바로 커밋하지 마세요. 항상 변경 요약과 Conventional Commits 형식의 커밋 메시지 초안을 먼저 보여주고, 사용자가 승인한 뒤에만 커밋하세요.
