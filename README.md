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

기획 배경, 상세 요구사항, 화면설계 등은 [docs/](docs/) 폴더의 기획서·요구사항정의서·화면설계서 및 [결정사항 및 이슈로그](docs/마음잇다_결정사항_및_이슈로그.md)를 참고하세요.

## 기술 스택

| 영역 | 기술 |
|---|---|
| Front-end | TypeScript, React, React Router, TanStack Query |
| Back-end | TypeScript, Node.js, NestJS |
| AI / Data Pipeline | Python, FastAPI, OpenAI API |
| Database | MySQL |
| 기타 | Git, GitHub, VS Code |

시스템은 클라이언트 - 백엔드 API 서버 - AI 서버 - MySQL DB - 알림 서버의 4계층 구조로 구성됩니다.

## 폴더 구조

```
maeum-itda/
├── apps/
│   ├── frontend/       # React 기반 웹 클라이언트 (TODO: 초기 세팅 예정)
│   ├── backend/        # NestJS 기반 API 서버 (TODO: 초기 세팅 예정)
│   └── ai-server/       # FastAPI 기반 AI/감정분석 서버 (TODO: 초기 세팅 예정)
├── packages/
│   ├── shared-types/    # 서비스 전반에서 공유하는 타입 정의 (TODO: 초기 세팅 예정)
│   ├── api-client/       # 프론트-백엔드 간 API 클라이언트 (TODO: 초기 세팅 예정)
│   └── config/           # 공통 설정(lint, tsconfig 등) (TODO: 초기 세팅 예정)
├── infra/                # 배포/인프라 관련 설정 (TODO: 초기 세팅 예정)
└── docs/                 # 기획서, 요구사항정의서, 화면설계서 등 프로젝트 문서
```

> 현재 각 서브폴더는 구조만 생성된 상태이며, 실제 코드는 아직 채워지지 않았습니다.

## 시작하기

> ⚠️ 각 앱/패키지가 아직 비어있어 아래 실행 명령어는 초기 세팅 완료 후 채워질 예정입니다.

```bash
# TODO: 저장소 클론
git clone <repository-url>
cd maeum-itda

# TODO: 패키지 매니저 및 워크스페이스 설정 (pnpm workspace 등) 확정 후 의존성 설치 명령어 추가
# pnpm install

# TODO: frontend 개발 서버 실행 명령어 추가 (apps/frontend)

# TODO: backend(NestJS) 개발 서버 실행 명령어 추가 (apps/backend)

# TODO: ai-server(FastAPI) 개발 서버 실행 명령어 추가 (apps/ai-server)

# TODO: 환경 변수(.env) 설정 가이드 추가
```

브랜치 전략 및 커밋 컨벤션은 [CONTRIBUTING.md](CONTRIBUTING.md)를 참고하세요.
