# 마음잇다 (Maeum-Itda)

AI · 음성/텍스트 감정분석 기반 시니어 정서변화 모니터링 서비스

## 프로젝트 소개

독거·원거리 시니어의 정서 위기를 조기에 발견하고, 근거 있는 리포트로 보호자에게 전달하는 서비스입니다.

- **AI 안부대화**: 음성 우선(Voice-first) 대화로 하루 일과·수면·식사·기분 상태를 자연스럽게 수집합니다.
- **정서지수 분석 엔진**: STT 변환 텍스트를 한국형 노인우울척도(SGDS-K) 15문항에 매핑하고, 발화 속도(Tempo)를 개인 베이스라인과 비교해 정서지수를 산출합니다.
- **보호자 리포트 및 알림**: 일간/주간 리포트(위험도 추이 그래프 + 근거 문장)를 제공하고, 임계치 초과 시 행동 제안과 함께 알림을 발송합니다.

### 팀 정보 (팀명: 마음잇다)

| 이름 | 역할 |
|---|---|
| 박해성 (팀장) | Front-end, PM |
| 김동희 | Data Modeling, Docs |
| 김재부 | Data Modeling, AI |
| 정현우 | Back-end, DB |

기획 배경, 상세 요구사항, 화면설계 등은 [docs/](docs/) 폴더의 기획서·요구사항정의서·화면설계서 및 [결정사항 및 이슈로그](docs/마음잇다_결정사항_및_이슈로그.md)를 참고하세요. **PDF 문서와 결정사항 로그 내용이 다를 경우, 로그가 최신 확정 사항이니 로그를 우선합니다** (예: 정서 상태 라벨은 좋음/보통/나쁨 3단계, 백엔드는 NestJS, DB는 MySQL).

## 기술 스택

| 영역 | 기술 |
|---|---|
| Front-end | TypeScript, React, React Router, TanStack Query |
| Back-end | TypeScript, Node.js, NestJS |
| AI / Data Pipeline | Python, FastAPI, Whisper(faster-whisper, STT), LLM(꼬리질문·감성분석·TTS, 벤더 미정, OpenAI API 가정) |
| Database | MySQL |
| 기타 | Git, GitHub, VS Code, pnpm, Turborepo |

시스템은 클라이언트 - 백엔드 API 서버 - AI 서버 - MySQL DB - 알림 서버의 4계층 구조로 구성됩니다. 시니어와의 실시간 안부 대화는 WebSocket 기반이며, 로그인/리포트 조회/알림함 등은 REST API로 처리합니다.

## 폴더 구조

```
maeum-itda/
├── apps/
│   ├── frontend/       # React 기반 웹 클라이언트 (Vite + FSD 구조, 라우팅·eslint 포함 스캐폴딩 완료)
│   ├── backend/        # NestJS 기반 API 서버 (기본 스캐폴딩 및 Turborepo 연결 완료)
│   └── ai-server/       # FastAPI 기반 AI/감정분석 서버, Python (TODO: 초기 세팅 예정)
├── packages/
│   ├── shared-types/    # 서비스 전반에서 공유하는 타입 정의 (package.json 존재, 내용은 비어있음)
│   ├── api-client/       # 프론트-백엔드 간 API 클라이언트 (TODO: 초기 세팅 예정)
│   └── config/           # 공통 설정(lint, tsconfig 등) (공유 ESLint config 스캐폴딩 완료, apps/frontend가 사용 중)
├── infra/                # 배포/인프라 관련 설정 (TODO: 초기 세팅 예정)
└── docs/                 # 기획서, 요구사항정의서, 화면설계서 등 프로젝트 문서
```

> `apps/ai-server`, `packages/api-client`, `infra`는 아직 폴더/자리만 있고 실제 코드는 채워지지 않았습니다. `apps/frontend`는 FSD 구조 스캐폴딩(라우팅, eslint 포함)이, `apps/backend`는 NestJS 기본 스캐폴딩과 pnpm/Turborepo 연결이, `packages/config`는 공유 ESLint config가 각각 완료된 상태입니다.
>
> ⚠️ **`apps/ai-server`는 아직 pnpm이 인식하는 패키지가 아닙니다.** `package.json`이 없어 `pnpm --filter ai-server ...`가 동작하지 않으며, Python(FastAPI) 프로젝트이므로 의존성은 pnpm이 아닌 별도 가상환경(`venv`)과 `requirements.txt`로 관리할 예정입니다.

## 시작하기

패키지 매니저는 **pnpm**으로 고정되어 있습니다 (`package.json`의 `packageManager` 필드로 버전까지 pin됨). Corepack이 활성화되어 있다면 별도 설치 없이 지정된 버전이 자동으로 사용됩니다.

```bash
# 1. 저장소 클론
git clone <repository-url>
cd maeum-itda

# 2. Corepack 활성화 (최초 1회, Node.js 16.9+ 내장)
corepack enable

# 3. 워크스페이스 전체 의존성 설치 (apps/frontend, apps/backend, packages/* 포함)
pnpm install
```

```bash
# frontend(Vite) 개발 서버 실행
pnpm --filter frontend dev

# backend(NestJS) 개발 서버 실행
pnpm --filter backend dev

# ai-server(FastAPI)는 pnpm 워크스페이스 밖이므로 별도 실행
# cd apps/ai-server && python -m venv venv && pip install -r requirements.txt
# TODO: 실행 명령어(uvicorn 등) 확정 후 추가

# TODO: 환경 변수(.env) 설정 가이드 추가
```

> 참고: `apps/frontend`(공유 `packages/config` ESLint 사용)와 `apps/backend`(자체 ESLint 설정 사용)에는 각각 `lint` 스크립트가 구성되어 있어, 루트의 `pnpm lint` 실행 시 두 앱의 코드가 검사됩니다. 아직 스캐폴딩되지 않은 앱은 검사 대상에 포함되지 않습니다.

브랜치 전략 및 커밋 컨벤션은 [CONTRIBUTING.md](CONTRIBUTING.md)를 참고하세요.
