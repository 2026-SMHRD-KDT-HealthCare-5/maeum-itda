# 마음잇다 Backend

Node.js 기반 TypeScript·NestJS 백엔드입니다. REST API와 WebSocket을 통해 프론트엔드, FastAPI AI 서버, MySQL을 연결합니다.

## 개발환경

- Node.js
- TypeScript
- NestJS
- pnpm
- Turborepo

패키지 매니저는 루트 `package.json`에 지정된 `pnpm@11.17.0`을 사용합니다. npm이나 yarn으로 별도 잠금 파일을 만들지 않습니다.

## 최초 설정

의존성은 백엔드 폴더가 아니라 저장소 루트에서 한 번에 설치합니다.

```bash
cd ../..
corepack enable
pnpm install
```

`pnpm --version` 결과가 `11.17.0`인지 확인합니다.

## 실행

저장소 루트에서 실행하는 방식을 권장합니다.

```bash
# 개발 서버
pnpm --filter backend dev

# 디버그 모드
pnpm --filter backend start:debug

# 빌드
pnpm --filter backend build

# 단위 테스트
pnpm --filter backend test

# E2E 테스트
pnpm --filter backend test:e2e

# 린트
pnpm --filter backend lint
```

백엔드 폴더 안에서는 다음과 같이 실행할 수도 있습니다.

```bash
cd apps/backend
pnpm dev
```

기본 서버 주소는 `http://localhost:3000`입니다.

## 패키지 추가

백엔드 전용 패키지는 저장소 루트에서 필터를 지정해 설치합니다.

```bash
pnpm --filter backend add <package-name>
pnpm --filter backend add -D <package-name>
```

## 개발 원칙

- 실시간 안부 대화는 WebSocket으로 처리합니다.
- 로그인, 리포트, 알림 등은 REST API로 처리합니다.
- WebSocket 이벤트와 공통 응답 타입은 `packages/shared-types`에서 관리합니다.
- 인증은 JWT Bearer Token 방식을 사용합니다.
- REST API는 Swagger/OpenAPI로 문서화합니다.
- 최신 업무 규칙은 `docs/마음잇다_결정사항_및_이슈로그.md`를 우선합니다.
- Git 작업은 루트 `CONTRIBUTING.md`의 브랜치 및 커밋 규칙을 따릅니다.

현재는 NestJS 기본 스캐폴딩과 pnpm/Turborepo 연결까지 완료된 상태입니다. MySQL, 환경변수, Swagger, WebSocket, JWT, AI 서버 연동은 기능 구현 과정에서 추가합니다.
