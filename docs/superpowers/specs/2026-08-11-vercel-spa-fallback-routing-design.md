# Vercel SPA Fallback Routing — Design

## 문제

배포된 도메인(Vercel)에서 시니어/보호자 화면 등 하위 경로(예: `/senior/my-info`)에 있는 상태로 새로고침하면 404 Not Found가 발생한다.

## 원인

`apps/frontend`는 `react-router-dom`의 `BrowserRouter`를 사용한다([AppProviders.tsx](../../../apps/frontend/src/app/providers/AppProviders.tsx)). `BrowserRouter`는 실제 URL 경로(`/senior/my-info` 등)를 사용하며, 라우팅은 클라이언트(브라우저) 안에서 React Router가 처리한다.

새로고침이나 직접 URL 접근 시에는 브라우저가 해당 경로로 서버(Vercel)에 직접 HTTP 요청을 보낸다. 하지만 정적 빌드 산출물(`dist/`)에는 `/senior/my-info`라는 실제 파일이 없고 `index.html` 하나만 있으므로, Vercel이 이 요청에 매칭되는 파일을 찾지 못해 404를 반환한다.

현재 저장소에는 이를 처리할 `vercel.json`이 어디에도 없다(`infra/`는 `.gitkeep`만 있는 placeholder 상태). Vercel 프로젝트의 Root Directory는 `apps/frontend`로 설정되어 있음을 확인했다.

## 해결 방안

`apps/frontend/vercel.json`을 새로 추가하여, 정적 파일에 매칭되지 않는 모든 경로 요청을 `index.html`로 rewrite한다:

```json
{
  "rewrites": [
    { "source": "/(.*)", "destination": "/index.html" }
  ]
}
```

Vercel은 rewrite 규칙을 적용하기 전에 파일 시스템(빌드 산출물)에서 요청 경로와 일치하는 정적 파일이 있는지 먼저 확인한다. 따라서 JS/CSS/이미지 등 실제 존재하는 정적 자산 요청은 영향을 받지 않고 그대로 서빙되며, 매칭되는 파일이 없는 경로(즉 클라이언트 라우트)만 `index.html`로 rewrite되어 React Router가 브라우저에서 정상적으로 처리한다.

`AppRouter`에 이미 있는 "알 수 없는 경로 → `/login`으로 리다이렉트" 로직은 그대로 동작하므로, 이 변경으로 새로 생기는 데드엔드는 없다.

## 범위

- 변경 파일: `apps/frontend/vercel.json` (신규)
- 코드/라우터/백엔드/CI 변경 없음 — 호스팅 설정 전용 수정
- 적용을 위해 Vercel 재배포 필요

## 테스트 방법

1. `apps/frontend/vercel.json` 추가 후 Vercel에 재배포
2. 배포된 도메인에서 `/senior/my-info` 등 하위 경로로 직접 접속 → 정상 렌더링 확인
3. 해당 경로에서 새로고침(F5) → 정상 렌더링(404 없음) 확인
4. 정적 자산(JS/CSS) 요청이 여전히 정상적으로 캐시/서빙되는지 확인 (rewrite로 인한 우회가 없어야 함)
