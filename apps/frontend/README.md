# 마음잇다 Frontend

Vite + React + TypeScript 기반 웹 클라이언트입니다. Feature-Sliced Design(FSD)으로 구성되어 있으며, 레이어 규칙·화면ID/UC 매핑·현재 구현 상태는 [CLAUDE.md](CLAUDE.md)를 참고하세요.

## 개발환경

- TypeScript
- React, React Router, TanStack Query
- Vite
- pnpm, Turborepo

패키지 매니저는 루트 `package.json`에 지정된 `pnpm@11.17.0`을 사용합니다. npm이나 yarn으로 별도 잠금 파일을 만들지 않습니다.

## 최초 설정

의존성은 이 폴더가 아니라 저장소 루트에서 한 번에 설치합니다.

```bash
cd ../..
corepack enable
pnpm install
```

## 실행

저장소 루트에서 실행하는 방식을 권장합니다.

```bash
pnpm --filter frontend dev       # 개발 서버 (http://localhost:5173)
pnpm --filter frontend build     # 프로덕션 빌드 (tsc -b && vite build)
pnpm --filter frontend lint      # eslint (packages/config의 공유 설정 사용)
```

## 참고

- 라우팅은 로그인 후 역할(시니어/보호자)에 따라 분기됩니다. 로그인은 더 이상 mock이 아닙니다 — `entities/user`의 `login()`이 실제 `POST /auth/login`을 호출하고, 세션은 `localStorage`에 저장돼 새로고침 시 `GET /users/me`로 복원됩니다. 계정별 최초 로그인 뒤에는 `/onboarding/permissions`에서 알림 브라우저 권한만 미리 확인하며, 마이크 권한은 실제 안부 대화 시작 시 요청합니다.
- PWA manifest와 Service Worker가 등록되어 홈 화면 설치와 실제 Web Push 수신을 지원합니다. 시니어·보호자 내 정보의 알림 토글은 브라우저 `PushSubscription`을 백엔드와 동기화합니다.
- 나머지 화면/기능별 구현 상태는 [CLAUDE.md](CLAUDE.md)의 "현재 구현 상태" 절 참고.
- Vercel 배포 시 Root Directory는 `apps/frontend`로 설정되어 있습니다. `vercel.json`은 반드시 이 디렉터리 안에 있어야 하며(모노레포 루트나 `infra/`로 옮기면 Vercel이 읽지 않아 배포가 깨집니다), SPA 클라이언트 라우팅 새로고침 404 방지 rewrite 설정을 담고 있습니다.
