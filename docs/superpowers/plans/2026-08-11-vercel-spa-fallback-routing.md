# Vercel SPA Fallback Routing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 배포된 도메인(Vercel)에서 `/senior/my-info` 같은 클라이언트 라우트를 새로고침하면 404가 뜨는 문제를, Vercel rewrite 설정 하나로 고친다.

**Architecture:** `apps/frontend`(Vercel Root Directory)에 `vercel.json`을 신규 추가해, 정적 파일에 매칭되지 않는 모든 요청을 `/index.html`로 rewrite한다. 코드/라우터/백엔드 변경은 없다.

**Tech Stack:** Vercel 정적 호스팅 설정(JSON), Vite + React + `react-router-dom`(`BrowserRouter`, 기존 코드 변경 없음).

## Global Constraints

- 변경 파일은 `apps/frontend/vercel.json` 신규 추가 하나뿐이다 — 스펙(`docs/superpowers/specs/2026-08-11-vercel-spa-fallback-routing-design.md`) 기준.
- 코드/라우터/백엔드/CI 변경 없음.
- 브랜치는 `fix/spa-refresh-404`(이미 `dev`에서 분기됨, 설계 문서 커밋 `6aa11ca` 존재).
- 자동화 테스트로 실제 Vercel 404 재현/해소를 검증할 수 없다 — JSON 유효성은 로컬에서 검증하고, 실제 라우팅 동작은 Vercel 재배포 후 수동으로 검증한다(스펙의 "테스트 방법" 절 그대로 따른다).

---

### Task 1: `apps/frontend/vercel.json` 추가

**Files:**
- Create: `apps/frontend/vercel.json`

**Interfaces:**
- Consumes: 없음 (신규 독립 설정 파일)
- Produces: Vercel이 배포 시 읽는 rewrite 규칙. 이후 작업(수동 배포 검증)이 이 파일의 존재와 내용에 의존한다.

- [ ] **Step 1: `vercel.json` 작성**

`apps/frontend/vercel.json`:

```json
{
  "rewrites": [
    { "source": "/(.*)", "destination": "/index.html" }
  ]
}
```

- [ ] **Step 2: JSON 유효성 검증**

Run: `node -e "JSON.parse(require('fs').readFileSync('apps/frontend/vercel.json','utf8')); console.log('valid json')"`
Expected: `valid json` 출력, 에러 없음.

- [ ] **Step 3: 커밋**

```bash
git add apps/frontend/vercel.json
git commit -m "fix: Vercel 배포 시 SPA 라우트 새로고침 404 방지 rewrite 설정 추가"
```

---

### Task 2: 배포 후 수동 검증

**Files:**
- 변경 없음 (검증 전용 태스크)

**Interfaces:**
- Consumes: Task 1에서 추가한 `apps/frontend/vercel.json`
- Produces: 없음 (최종 확인)

- [ ] **Step 1: 브랜치 push 및 Vercel 재배포 확인**

```bash
git push -u origin fix/spa-refresh-404
```

Vercel이 해당 브랜치에 대해 Preview 배포를 자동 생성하는지 확인한다(프로젝트 설정에 따라 다를 수 있음 — 자동 배포가 없으면 Vercel 대시보드에서 수동으로 배포 트리거).

- [ ] **Step 2: 하위 경로 직접 접속 확인**

Preview 배포 URL에서 `/senior/my-info` 등 하위 경로로 직접 접속(주소창에 URL 입력) → 정상 렌더링되는지 확인한다(로그인 상태가 아니면 `/login`으로 리다이렉트되는 것도 정상 — 404만 아니면 됨).

- [ ] **Step 3: 새로고침(F5) 확인**

같은 하위 경로에서 새로고침 → 404 없이 정상 렌더링되는지 확인한다. 이것이 이번 수정의 핵심 재현/해소 시나리오다.

- [ ] **Step 4: 정적 자산 서빙 확인**

브라우저 개발자 도구 Network 탭에서 JS/CSS 번들 요청이 200으로 정상 응답되는지 확인한다(rewrite가 정적 자산까지 잘못 가로채지 않는지 확인).

- [ ] **Step 5: PR 생성**

Task 1 커밋 + 위 수동 검증 결과를 CONTRIBUTING.md 기준 PR 설명(테스트 방법 포함)에 남기고 `dev`로 PR을 올린다. (PR 생성 자체는 사용자 승인 후 진행.)
