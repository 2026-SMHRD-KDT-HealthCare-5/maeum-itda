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

- 라우팅은 로그인 후 역할(시니어/보호자)에 따라 분기됩니다. 백엔드 인증이 아직 없어 `features/login-with-credentials`의 `mockResolveRole()`이 아이디에 `guardian` 포함 여부로 역할을 흉내냅니다.
- 나머지 화면/기능별 구현 상태는 [CLAUDE.md](CLAUDE.md)의 "현재 구현 상태" 절 참고.
- Vercel 배포 시 Root Directory는 `apps/frontend`로 설정되어 있습니다. `vercel.json`은 반드시 이 디렉터리 안에 있어야 하며(모노레포 루트나 `infra/`로 옮기면 Vercel이 읽지 않아 배포가 깨집니다), SPA 클라이언트 라우팅 새로고침 404 방지 rewrite 설정을 담고 있습니다.
