# apps/frontend/CLAUDE.md

`apps/frontend`에 한정된 가이드이며, 루트 [CLAUDE.md](../../CLAUDE.md) 및 [AGENTS.md](../../AGENTS.md)와 함께 로드됩니다 — 거기 이미 있는 내용(기술 스택, 모노레포 툴링, WebSocket/REST 구분, 모바일 이식성 가이드라인, 작업 단위 소유권, `docs/page-pdf`·`docs/page-html`의 성격)은 반복하지 않습니다. 이 파일은 frontend 내부 코드 구성만 다룹니다.

## 아키텍처: Feature-Sliced Design (FSD)

이 앱은 FSD로 구성되어 있습니다. 코드는 `src/` 아래 다음 레이어 중 하나에 위치합니다:

- `app` — 앱 전역 설정: provider(`AppProviders`), 라우팅 진입점(`AppRouter`), 전역 스타일
- `pages` — 라우트 단위 조합 (화면 ID당 슬라이스 하나, 아래 매핑 참고)
- `widgets` — 여러 features/entities를 조합한 크고 재사용 가능한 UI 블록
- `features` — 사용자에게 보이는 단일 행동 단위 (UC당 슬라이스 하나, 아래 매핑 참고)
- `entities` — 도메인 객체와 그 기본 UI/로직 — "무엇"과 그것을 어떻게 표시/조회하는지, 사용자 행동 자체는 없음
- `shared` — 도메인에 종속되지 않는 재사용 코드: UI kit, API/WebSocket client 연결, config, utils, `packages/shared-types` 재노출

### Import 규칙

각 레이어는 자기보다 엄격하게 하위에 있는 레이어만 import할 수 있습니다(`app` → `pages` → `widgets` → `features` → `entities` → `shared`). 위쪽으로 import하지 말고, 같은 레이어의 서로 다른 슬라이스끼리 옆으로 import하지도 마세요(한 `feature`가 다른 `feature`를 직접 가져다 쓰는 대신 `entities`/`shared`를 거치세요). 옆으로 또는 위로 import해야 할 필요가 생겼다면, 그건 코드가 잘못된 레이어에 있다는 신호이지 import를 추가할 이유가 아닙니다.

`eslint`(`packages/config`의 공유 flat config를 통해, 루트 CLAUDE.md 참고)는 이제 여기서 실제로 동작합니다 — `pnpm --filter frontend lint`로 실행되고, `git commit`도 이걸로 게이트됩니다(`.claude/hooks/lint-before-commit.sh`). 다만 지금까지는 일반적인 TS/React 정합성(typescript-eslint, react-hooks, react-refresh)만 검사합니다 — 레이어 경계 위반(한 `feature`가 다른 `feature`를 옆으로 import하는 것 등)은 아직 규칙으로 잡아내지 못하므로, eslint-plugin-boundaries 설정이 생기기 전까지는 import 규칙을 관례로 지켜주세요. 아래에 나열된 `features/*`, `entities/*` 폴더는 전부 이미 실제로 존재하는 디렉터리입니다(계획만 있는 게 아님) — 이 레이어 구조는 희망사항이 아닙니다.

### 세그먼트 컨벤션 (각 `features/*`, `entities/*` 슬라이스 내부)

모든 feature/entity 슬라이스는 다음 네 개의 세그먼트 폴더를 가지며, 각각 자체 `index.ts`/`index.tsx` barrel을 갖고, 이 네 개를 모두 재노출하는 최상위 `index.ts`도 있습니다 — 다른 레이어는 이 최상위 barrel만 import해야 합니다(`features/x` 바깥에서 `features/x/model/...`를 직접 참조하지 마세요):

- `ui/` — React 컴포넌트
- `model/` — 타입, 상태, hooks — 화면에 보이지 않는 로직
- `api/` — `shared/api` 호출 (REST/WebSocket)
- `lib/` — `model`/`api`에 안 맞는, 슬라이스 내부에서만 쓰는 헬퍼

`widgets/*`와 `pages/*`는 `ui/` 세그먼트만 갖습니다 (이들은 조합만 할 뿐, 자체 model/api를 갖지 않습니다).

## 화면 ID → `pages/*` 매핑 (화면설계서)

| `pages/*` | 화면 ID | 관련 UC |
|---|---|---|
| `join` | JOIN_01 | UC-00 |
| `login` | LOGIN_01 | UC-00 |
| `senior-home` | SENIOR_HOME_01 | UC-01, UC-13 |
| `senior-connection` | SENIOR_LINK_01 | UC-00-1 |
| `senior-conversation` | SENIOR_CONVERSATION_01 | UC-01, UC-02, UC-03 |
| `guardian-home` | GUARDIAN_HOME_01 | UC-08 |
| `guardian-connection` | GUARDIAN_LINK_01 | UC-00-1 |
| `guardian-report` | GUARDIAN_REPORT_01 | UC-08, UC-09 |
| `guardian-notification` | GUARDIAN_NOTIFICATION_01 | UC-10, UC-11 |
| `guardian-notification-settings` | — (화면설계서 본문에 화면ID 미배정, `docs/page-pdf/보호자 알림 설정.pdf` 참고) | UC-12 |
| `senior-my-info` | — (메뉴 트리에만 존재, 아래 참고) | — |
| `guardian-my-info` | — (메뉴 트리에만 존재, 아래 참고) | — |
| `admin` | (관리자 - 데이터 품질 검토) | — |

`join`, `senior-connection`, `guardian-connection`, `guardian-notification-settings`는 2026-08-28 문서 갱신으로 화면설계서에 새로 추가된 화면입니다. `senior-connection`/`guardian-connection`을 하나로 합친 디렉터리로 두지 않고 역할별로 나눈 것은, 기존 화면들(`senior-home`/`guardian-home`처럼)이 전부 역할별 디렉터리 컨벤션을 따르기 때문입니다. 네 화면 모두 다른 placeholder 화면과 동일한 수준(스캐폴딩, 실제 기능 아님)으로 이미 만들어져 있고 `AppRouter`에도 라우트가 연결되어 있습니다 — 실제 구현 시 새 파일을 추가하지 말고 이 placeholder를 교체하세요. 각 화면의 컴포넌트 상태(hover/disabled/error/empty 등)까지 포함한 상세 목업은 `docs/page-pdf/<화면이름>.pdf`에 화면이름 그대로 저장되어 있습니다 — 화면설계서 본문의 개요 와이어프레임보다는 구체적이지만, AGENTS.md 기준으로 이 파일도 **참고용 초안일 뿐 최종 디자인은 아닙니다**. `pages/*` 구현 시 최신 요구사항/결정사항/기존 코드/`shared/ui` 컴포넌트와 맞춰 조정하세요(자세한 조정 기준은 AGENTS.md 참고). `docs/page-html/<화면이름>.html`도 같은 화면의 인터랙티브 버전이지만 용량이 커서 `.gitignore` 처리되어 있습니다 — 로컬에 있으면 추가로 참고해도 되지만, git으로 공유되는 소스는 아니므로 다른 사람 환경에는 없을 수 있습니다.

`pages/admin`은 의도적으로 비워둔 상태입니다 (`.gitkeep`만 있음) — 결정사항 로그 §1에서 관리자 화면을 MVP 범위에서 명시적으로 제외했고, `AppRouter`에도 관리자 라우트나 역할 분기가 전혀 없습니다(`senior`/`guardian`만 있음). 결정사항 로그를 먼저 확인하지 않고 임의로 추가하지 마세요.

**`senior-my-info` / `guardian-my-info`는 실제 스펙이 없습니다.** 화면설계서의 메뉴구성에는 시니어 화면과 보호자 화면 양쪽 모두에 "내 정보"라는 항목이 있지만, 그 문서의 다른 모든 화면과 달리 화면 ID도, UC도, 목업 페이지도 없습니다 — 메뉴 트리 안의 이름 하나뿐입니다. 그래서 두 페이지 모두 제목 + 로그인된 `userId` + 실제로 동작하는 로그아웃 버튼(`entities/user`의 `logout()`에 연결)만 있고, 각 역할의 다른 화면들과 동일한 `BottomTabBar`로 감싸져 있습니다. "내 정보"에 대한 실제 화면 ID/목업이 생기는 즉시 제대로 다시 만드세요 — 지금 내용은 네비게이션용 placeholder 이상으로 취급하지 마세요.

## UC → `features/*` 매핑 (요구사항정의서)

| `features/*` | UC | 유스케이스 이름 |
|---|---|---|
| `login-with-credentials` | UC-00 | 로그인 및 역할별 진입 |
| `send-connection-request` / `respond-connection-request` | UC-00-1 | 보호자 → 시니어 연결 요청 및 승인 |
| `start-conversation` | UC-01 | 실시간 안부 대화 시작 |
| `record-voice-answer` | UC-02 | 음성 통화 진행 및 답변 |
| `select-report-date` | UC-08 | 일간/주간 정서 리포트 조회 (날짜 선택) |
| `view-evidence-sentence` | UC-09 | 위험 발화 근거 문장 확인 |
| `mark-notification-read` | UC-10, UC-11 | 알림함 목록 조회 및 읽음 처리 (정서지수 하락 알림 수신 포함) |
| `set-notification-threshold` | UC-12 | 알림 받을 정서지수 임계치 설정 |
| `view-attendance-calendar` | UC-13 | 시니어 홈화면 출석 캘린더 조회 |

UC-03 (STT 변환), UC-04 (꼬리질문 생성), UC-06-1/UC-06-2/UC-06-3/UC-06-4 (SGDS-K·GAD-7·LSNS-6 채점, 정서지수 산출, 음성 톤·피치 분석, 일간 대화 요약·AI 추천 행동 제안 생성), UC-07 (데이터 저장)은 전부 `시스템/AI 엔진` 액터의 UC입니다 — 여기가 아니라 `apps/backend`/`apps/ai-server`에서 일어나는 일이라, 의도적으로 대응하는 `features/*` 슬라이스를 만들지 않았습니다. UC-14(대화 빈도 기반 캐릭터 환경 꾸미기)는 요구사항정의서 재수정판에서 문서 자체에서 삭제됐습니다 — 예전엔 "문서엔 있지만 팀이 스코프 제외"였는데 이제는 존재하지도 않는 UC이니, 어쨌든 대응 슬라이스를 만들지 마세요. UC-10(정서지수 하락 알림 수신)은 별도 화면/슬라이스가 아니라 UC-11(알림함)에 흡수됩니다 — `mark-notification-read` 목록에 정서지수 하락 알림도 다른 알림 유형과 동일하게 표시될 뿐입니다. 웹 푸시 알림(실제 push 발송)은 MVP 범위가 아니며, 이 프로젝트를 먼저 웹앱으로 완성한 뒤 PWA를 적용하는 시점에 별도로 구현할 계획입니다 — 지금은 알림함(REST 조회)만으로 충분하고, Service Worker/Push API 관련 코드를 미리 만들지 마세요.

## 다른 도구가 이어서 작업할 때 보고할 것

AGENTS.md의 "Task Ownership and Workflow"에 작업 소유권과 후속 검토 원칙이 정리되어 있습니다 — 그 내용은 여기서 반복하지 않습니다. 다른 도구가 이어서 작업한다면 state, events, API/Query 연결, 비활성화 조건, 보존할 logic과 함께 **로딩/오류/빈 상태를 어떻게 처리하는지**를 보고하세요(예: `isPending`일 때 표시할 값, 오류 메시지 위치, 빈 배열/`null` 판단 기준). 후속 도구가 기능 계약을 추측하거나 다시 만들지 않을 정도로 구체적으로 작성하세요.

## 현재 구현 상태

지금 `src/` 아래에 있는 모든 것은 스캐폴딩이지, 실제 기능이 아닙니다:

- `entities/*`는 `model/`에 실제 TypeScript 타입이 있습니다(화면 설명 + 결정사항 로그에 근거하며, 미해결 사항은 주석으로 표시 — 예를 들어 `entities/report`의 `emotionScore: number | null`과 `entities/notification`의 `target` 구조는 결정사항 로그 §2 기준으로 아직 미해결입니다), 다만 `ui/api/lib`는 placeholder 껍데기입니다. `entities/conversation`의 `ConversationTurn.sentimentLabel`/`sentimentNote`와 `entities/report`의 `DailyReport.conversationSummary`/`recommendedAction`은 요구사항정의서 최종본(UC-04/UC-06-4/UC-07)에 맞춰 추가된 필드입니다. `voice_score`/`VoiceScore`(음성 점수 수치화)는 한때 검토됐다가 결정사항 로그 §2-5에 따라 완전히 폐기됐으니 새로 추가하지 마세요 — `emotionScore`는 TextScore 단일값입니다. `entities/connection`(UC-00-1 연결 상태: `pending`/`accepted`/`rejected`/`expired`)은 이번에 새로 추가된 entity로, 시니어·보호자 어느 한쪽에도 속하지 않는 둘 사이의 관계라서 별도로 뺐습니다 — `entities/senior`의 `connectedGuardianId`, `entities/guardian`의 `connectedSeniorId`는 각 역할 쪽에서 보는 최소 참조 필드일 뿐, 연결 요청 자체의 상태는 여기서 다룹니다.
- `features/*`는 네 세그먼트 전부 placeholder 껍데기입니다, **단** `login-with-credentials`는 예외로 실제로 동작하는 목업이 있습니다: `model/`의 `mockResolveRole()`이 UC-00의 실제 인증이 반환할 값을 흉내내며(아이디에 `guardian`이 포함되면 보호자로, 그 외엔 시니어로 로그인), 이 덕분에 라우팅 뼈대를 `pnpm --filter frontend dev`로 실제로 동작해볼 수 있습니다. `apps/backend`가 로그인 엔드포인트를 제공하는 즉시 이 함수 전체를 실제 API 호출로 교체하세요 — 이 문자열 매칭 임시방편을 확장하지 마세요.
- `widgets/*`는 placeholder 껍데기입니다, `bottom-tab-bar`는 예외로 실제로 동작하며(page가 넘겨주는 tab item을 그대로 렌더링) 각 역할의 모든 page가 넘겨야 할 `SENIOR_TAB_ITEMS`/`GUARDIAN_TAB_ITEMS` 상수도 함께 export합니다 — page 안에서 tab 목록을 직접 만들지 말고 이 상수를 import하세요.
- 라우팅(`app/routes`)은 실제로 동작합니다: `/login`, `/join`, `/senior`, `/senior/conversation`, `/senior/connection`, `/senior/my-info`, `/guardian`, `/guardian/report`, `/guardian/notifications`, `/guardian/notification-settings`, `/guardian/connection`, `/guardian/my-info` 각각이 `entities/user`의 세션/역할을 확인하는 `ProtectedRoute`로 보호되며(`/login`, `/join`은 로그인 전 화면이라 예외), 알 수 없는 경로는 `/login`으로 리다이렉트됩니다.
- 세션 상태(`entities/user`)는 메모리에만 있는 React context입니다 — 새로고침하면 초기화됩니다. 아직 localStorage/cookies 같은 영속화는 없습니다.

실제 화면을 구현할 때는 별도 파일을 새로 추가하지 말고 해당 placeholder를 그 자리에서 교체하세요 — 폴더 구조와 barrel export는 이미 있어야 할 자리에 있습니다.
