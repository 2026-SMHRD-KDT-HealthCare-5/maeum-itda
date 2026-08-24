# apps/frontend/CLAUDE.md

`apps/frontend`에 한정된 가이드이며, 루트 [CLAUDE.md](../../CLAUDE.md) 및 [AGENTS.md](../../AGENTS.md)와 함께 로드됩니다 — 거기 이미 있는 내용(기술 스택, 모노레포 툴링, WebSocket/REST 구분, 모바일 이식성 가이드라인, 작업 단위 소유권, 화면별 목업 참고 기준(Figma·`docs/screens`))은 반복하지 않습니다. 이 파일은 frontend 내부 코드 구성만 다룹니다.

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
| `splash` | — (화면설계서에 없음, 결정사항 로그 §5의 신규 화면 — 아래 참고) | — |
| `join` | JOIN_01 | UC-00 |
| `login` | LOGIN_01 | UC-00 |
| `senior-home` | SENIOR_HOME_01 | UC-01, UC-13 |
| `senior-connection` | SENIOR_LINK_01 | UC-00-1 |
| `senior-conversation` | SENIOR_CONVERSATION_01 | UC-01, UC-02, UC-03 |
| `senior-daily-record` | — (화면설계서 본문에 화면ID 미배정, Figma '시니어 이전 대화 기록 조회 화면' 기준으로 구현됨 — UC-14/FR-01-09, 아래 참고) | UC-14 |
| `guardian-home` | GUARDIAN_HOME_01 | UC-08 |
| `guardian-connection` | GUARDIAN_LINK_01 | UC-00-1 |
| `guardian-report` | GUARDIAN_REPORT_01 | UC-08, UC-09 |
| `guardian-weekly-report` | — (화면설계서 본문에 화면ID 미배정, Figma '보호자 주간 리포트 조회' 기준으로 구현됨 — UC-15/FR-03-07, `guardian-report`와 탭 위젯 공유, 아래 참고) | UC-15 |
| `guardian-notification` | GUARDIAN_NOTIFICATION_01 | UC-10, UC-11 |
| `senior-my-info` | — (화면설계서 본문에 화면ID 미배정, Figma '시니어 내 정보' 기준으로 구현됨, 아래 참고) | — |
| `guardian-my-info` | — (화면설계서 본문에 화면ID 미배정, Figma '보호자 내 정보' 기준으로 구현됨 — UC-12(알림 설정) 흡수 완료, 아래 참고) | UC-12 |
| `admin` | (관리자 - 데이터 품질 검토) | — |
| `not-found` | — (화면설계서에 없는 유틸리티 화면, 알 수 없는 경로 진입 시 표시) | — |
| `debug-errors` | — (화면설계서에 없는 개발용 디버그 화면) | — |

`join`, `senior-connection`, `guardian-connection`은 2026-08-28 문서 갱신으로 화면설계서에 화면ID(`JOIN_01`, `SENIOR_LINK_01`, `GUARDIAN_LINK_01`)가 새로 부여된 화면입니다. `senior-connection`/`guardian-connection`을 하나로 합친 디렉터리로 두지 않고 역할별로 나눈 것은, 기존 화면들(`senior-home`/`guardian-home`처럼)이 전부 역할별 디렉터리 컨벤션을 따르기 때문입니다. 세 화면 모두 다른 placeholder 화면과 동일한 수준(스캐폴딩, 실제 기능 아님)으로 이미 만들어져 있고 `AppRouter`에도 라우트가 연결되어 있습니다 — 실제 구현 시 새 파일을 추가하지 말고 이 placeholder를 교체하세요. 각 화면의 컴포넌트 상태(hover/disabled/error/empty 등)까지 포함한 상세 디자인은 Figma가 기준입니다 — 화면설계서 본문의 개요 와이어프레임보다는 구체적이지만, AGENTS.md 기준으로 이 역시 **참고용일 뿐 최종 스펙으로 맹신하지 마세요**. `pages/*` 구현 시 최신 요구사항/결정사항/기존 코드/`shared/ui` 컴포넌트와 맞춰 조정하세요(자세한 조정 기준은 AGENTS.md 참고). Figma 내보내기 파일은 `docs/screens/<화면이름>/`에 저장되어 있습니다(메인 PNG는 폴더 바로 아래, hover/disabled/error/empty 등 컴포넌트 상태 세트는 `states/` 서브폴더 — 후자는 참고용일 뿐 강제 사항 아님).

`pages/admin`은 의도적으로 비워둔 상태입니다 (`.gitkeep`만 있음) — 결정사항 로그 §1에서 관리자 화면을 MVP 범위에서 명시적으로 제외했고, `AppRouter`에도 관리자 라우트나 역할 분기가 전혀 없습니다(`senior`/`guardian`만 있음). 결정사항 로그를 먼저 확인하지 않고 임의로 추가하지 마세요.

**`splash`는 화면설계서에 화면ID/상세 목업이 아직 없는 화면입니다** (결정사항 로그 §5). 다른 placeholder와 동일한 수준으로 스캐폴딩만 해뒀고 `AppRouter`에도 라우트가 연결되어 있습니다. UC/FR 자체가 아직 없고 목적(단순 브랜딩 vs 인증 복원 대기)도 미정이라 자동 리다이렉트를 넣지 않았습니다.

`senior-daily-record`(UC-14)와 `guardian-weekly-report`(UC-15)는 화면설계서에 화면ID가 없지만 Figma 목업 기준으로 구현됐습니다(결정사항 로그 §7). `guardian-weekly-report`는 `guardian-report`와 `widgets/report-period-tabs`를 공유해 탭으로 전환되며, 라우트(`/guardian/report/weekly/:weekStart`)는 분리된 채로 유지됩니다 — 페이지 병합 여부는 아직 미결. `senior-daily-record`는 `features/select-daily-record-date`(날짜 네비게이션 + 캘린더 모달)와 `entities/conversation`의 `DailyConversationList`, 요약 카드로 구성되며, 날짜별 turn과 요약 코멘트는 아직 페이지 로컬 mock입니다.

**`senior-my-info` / `guardian-my-info`는 Figma 목업 기준으로 구현됐습니다(결정사항 로그 §7).** 두 화면 모두 `features/edit-basic-info`(기본 정보 편집)와 `features/disconnect-connection`(연결 끊기)를 공유하고, `senior-my-info`는 `features/set-checkin-reminder`, `guardian-my-info`는 `features/set-notification-threshold`(UC-12)를 추가로 갖습니다. `guardian-notification-settings` 페이지/라우트(`/guardian/notification-settings`)는 이 흡수로 삭제됐습니다. 시니어/보호자/연결 데이터는 아직 각 페이지의 로컬 mock 상태입니다.

## UC → `features/*` 매핑 (요구사항정의서)

| `features/*` | UC | 유스케이스 이름 |
|---|---|---|
| `login-with-credentials` | UC-00 | 로그인 및 역할별 진입 |
| `send-connection-request` / `respond-connection-request` / `disconnect-connection` | UC-00-1 | 보호자 → 시니어 연결 요청·승인·해제 |
| `start-conversation` | UC-01 | 실시간 안부 대화 시작 |
| `record-voice-answer` | UC-02 | 음성 통화 진행 및 답변 |
| `select-report-date` | UC-08 | 일간/주간 정서 리포트 조회 (날짜 선택) |
| `view-evidence-sentence` | UC-09 | 위험 발화 근거 문장 확인 |
| `mark-notification-read` | UC-10, UC-11 | 알림함 목록 조회 및 읽음 처리 (정서지수 하락 알림 수신 포함) |
| `set-notification-threshold` | UC-12 | 알림 받을 정서지수 임계치 설정 |
| `view-attendance-calendar` | UC-13 | 시니어 홈화면 출석 캘린더 조회 |
| `select-daily-record-date` | UC-14 | 이전 대화 기록 조회 날짜 선택(캘린더 모달) |
| `select-report-week` | UC-15 | 보호자 주간 리포트 조회 주차 선택(캘린더 모달) |
| `edit-basic-info` | — (UC 미배정) | 기본 정보 편집 (시니어/보호자 내 정보 화면 공용) |
| `set-checkin-reminder` | — (UC 미배정) | 안부 알림 시간 설정 (시니어 내 정보 전용) |

`disconnect-connection`·`select-daily-record-date`·`select-report-week`·`edit-basic-info`·`set-checkin-reminder`는 결정사항 로그 §7의 Figma 화면 감사에서 새로 추가된 feature입니다. `edit-basic-info`/`set-checkin-reminder`는 화면설계서에 UC가 배정되지 않은 `senior-my-info`/`guardian-my-info` 화면 소속이라 대응하는 UC 자체가 없습니다.

UC-03 (STT 변환), UC-04 (꼬리질문 생성), UC-06-1/UC-06-2/UC-06-3/UC-06-4 (SGDS-K·GAD-7·LSNS-6 채점, 정서지수 산출, 음성 톤·피치 분석, 일간 대화 요약·AI 추천 행동 제안 생성), UC-07 (데이터 저장)은 전부 `시스템/AI 엔진` 액터의 UC입니다 — 여기가 아니라 `apps/backend`/`apps/ai-server`에서 일어나는 일이라, 의도적으로 대응하는 `features/*` 슬라이스를 만들지 않았습니다. **구 UC-14(대화 빈도 기반 캐릭터 환경 꾸미기)는 요구사항정의서에서 삭제됐지만, `UC-14`라는 ID 자체는 최신 요구사항정의서에서 전혀 다른 기능인 "시니어 일간 기록 조회"(FR-01-09)로 재배정됐습니다** — 그 구현 대상은 위 표의 `pages/senior-daily-record`이니 혼동하지 마세요(캐릭터/꾸미기 관련 슬라이스는 여전히 만들지 않습니다). UC-15("보호자 주간 리포트 상세 조회", FR-03-07)는 `pages/guardian-weekly-report`가 구현 대상입니다. UC-14/UC-15 둘 다 지금은 페이지에 직접 구현할 예정이라 별도 `features/*` 슬라이스가 없습니다 — 화면 설계가 나와서 상호작용이 구체화되면 필요 시 분리하세요. UC-10(정서지수 하락 알림 수신)은 별도 화면/슬라이스가 아니라 UC-11(알림함)에 흡수됩니다 — `mark-notification-read` 목록에 정서지수 하락 알림도 다른 알림 유형과 동일하게 표시될 뿐입니다. 웹 푸시 알림(실제 push 발송)은 2026-08-11 팀 결정(결정사항 로그 §1, `docs/sprint-plan.md`)으로 이번 스프린트부터 MVP 필수 범위에 포함됩니다 — 알림함(REST 조회)에 더해 PWA 매니페스트, Service Worker, Push API(구독 등록·실제 발송) 작업을 `docs/sprint-plan.md` 일정대로 진행하세요.

## 다른 도구가 이어서 작업할 때 보고할 것

AGENTS.md의 "Task Ownership and Workflow"에 작업 소유권과 후속 검토 원칙이 정리되어 있습니다 — 그 내용은 여기서 반복하지 않습니다. 다른 도구가 이어서 작업한다면 state, events, API/Query 연결, 비활성화 조건, 보존할 logic과 함께 **로딩/오류/빈 상태를 어떻게 처리하는지**를 보고하세요(예: `isPending`일 때 표시할 값, 오류 메시지 위치, 빈 배열/`null` 판단 기준). 후속 도구가 기능 계약을 추측하거나 다시 만들지 않을 정도로 구체적으로 작성하세요.

## 현재 구현 상태

로그인부터 대화, 리포트, 알림/웹 푸시, 내 정보까지 핵심 화면 대부분이 실제 REST/WebSocket 연동으로 동작합니다. 각 페이지는 자체 `entities/*` API(`useQuery`/`useMutation`)로 데이터를 들고 있고, `features/*`는 대부분 그 페이지에 조합되는 순수 표현 컴포넌트입니다 — 그래서 많은 feature 슬라이스가 `ui/`만 실제 코드고 `api/model/lib`는 한 줄짜리 stub인 채로 남아있는데, 이는 placeholder가 아니라 "쿼리 상태는 페이지가 들고, feature는 UI만 담당"하는 의도된 설계입니다. `entities/senior`/`entities/guardian`은 예외로 `model`의 타입 정의만 있고 `ui/api/lib`가 실제로 placeholder입니다(향후 필요해지면 채우세요).

- **로그인/세션 — 완전히 실제 연동입니다.** `login-with-credentials`는 더 이상 mock이 아닙니다 — `entities/user`의 `login()`이 `POST /auth/login`을 호출하고, `register-account`도 `POST /auth/check-login-id`/`POST /auth/signup`을 거쳐 같은 `login()`을 재사용합니다. `AuthResult`/`Session`의 `accessToken`은 이제 항상 실제 JWT 문자열입니다(더 이상 `string | null`이 아님). **세션은 `localStorage`(`entities/user/ui/SessionProvider.tsx`, 키 `maeum-itda:accessToken`)에 저장되고 새로고침 시 `GET /users/me`로 복원됩니다** — 더 이상 메모리 전용 React context가 아닙니다.
- `entities/*`는 대부분 `api/index.ts`가 `packages/api-client`의 `apiClient.*`를 실제로 호출합니다: `entities/connection`(`GET/POST/DELETE /connections/me` 등 연결 요청·수락·거절·해제), `entities/notification`(`GET /notifications`, `PATCH .../read`), `entities/report`(`GET /reports/daily`·`/reports/weekly`·`/reports/calendar`, `GET /guardian/dashboard`), `entities/conversation`(`GET /chats/messages` cursor 조회, 날짜별 조회, 캘린더 조회). §7에서 추가된 필드: `EvidenceSentence.sentimentLabel`, `WeeklyReport.maxScore`/`minScore`/`dailyScores[].comment`, `Senior.username`/`phone`/`checkinReminder`, `ConnectionStatus`의 `'disconnected'`와 `Connection.connectedAt`. **`voice_score`/`VoiceScore`는 §2-5에 따라 폐기됐으니 새로 추가하지 마세요** — `emotionScore`는 TextScore 단일값입니다. `entities/connection`(UC-00-1)은 시니어·보호자 어느 쪽에도 속하지 않는 관계라서 별도 엔티티로 분리했습니다. **`entities/conversation`은 apps/backend의 실제 `/ws/chats`·`GET /chats/messages` 계약(docs/ws-protocol.md)에 맞춰 재작성됐습니다** — 예전 `ConversationTurn`(질문/답변 쌍) 모델은 삭제됐고, `packages/shared-types`의 `ChatMessage`(메시지 행 하나: `messageId`/`speakerType`/`content`/`sttStatus`/`createdAt`) 기준입니다. `ConversationHistoryList`/`DailyConversationList` 모두 `messages: ChatMessage[]`를 prop으로 받아 렌더링하는 실제 컴포넌트이고, `content === null`인 메시지(시니어 답변이 아직 STT 전)는 "답변을 보내드렸어요" placeholder로 표시합니다. `pages/senior-daily-record`는 `fetchConversationHistoryByDate`/`fetchConversationCalendar`를 실제로 호출합니다 — 더 이상 페이지 로컬 mock이 아닙니다.
- `features/*`는 실제 UI가 아예 없는(진짜 한 줄짜리) 슬라이스가 이제 거의 없습니다. `send-connection-request`/`respond-connection-request`/`mark-notification-read`/`select-report-date`/`view-evidence-sentence`/`select-report-week`도 전부 실제 UI(67~188줄)를 갖고 있고 각각의 소유 페이지(`guardian-connection`/`senior-connection`/`guardian-notification`/`guardian-report`/`conversation-timeline` 경유/`guardian-weekly-report`)가 실제 API를 호출해 데이터를 넘깁니다. `view-attendance-calendar`는 캘린더 UI·월 이동·날짜 클릭 이동은 실제로 동작하지만, 출석 여부 표시는 아직 날짜별 실데이터 연동 전입니다. **`record-voice-answer`는 실제로 동작합니다** — `model/`의 `useRecordVoiceAnswer` 훅이 AI 질문 도착 시 `getUserMedia`로 마이크 권한을 받아 `MediaRecorder`로 녹음을 시작하고, `lib/`의 `createSilenceWatcher`(Web Audio API 기반 RMS 묵음 감지)로 발화 중 3초 묵음 시 자동 종료하거나 사용자가 "지금 답변 마치기"를 눌러 수동 종료하면(`endType: 'auto' | 'manual'`) `api/`의 `sendVoiceAnswer`를 거쳐 `shared/api`의 `ChatSocket`으로 전송합니다. 답변 메시지는 분석이 성공해 실제 transcript가 확정된 시점에만 `audio:transcript`로 도착하며(결정사항: 분석 실패 시 DB에도, 화면에도 아무 흔적을 남기지 않는다), 이때 처음 `ChatMessage`로 대화 목록에 추가됩니다 — `audio:ack`는 바이너리 접수 확인일 뿐 말풍선을 만들지 않습니다. 분석이 실패하면 `error`(`AUDIO_ANALYSIS_FAILED`) 배너로만 안내하고 같은 질문에 대한 녹음을 곧바로 다시 엽니다.
- `widgets/*` 4개(`bottom-tab-bar`, `report-period-tabs`, `emotion-trend-chart`, `conversation-timeline`) 모두 실제로 동작합니다 — `bottom-tab-bar`는 page가 넘겨주는 tab item을 그대로 렌더링하며 각 역할의 `SENIOR_TAB_ITEMS`/`GUARDIAN_TAB_ITEMS` 상수도 함께 export합니다(page 안에서 tab 목록을 직접 만들지 말 것), `report-period-tabs`는 `guardian-report`/`guardian-weekly-report`가 공유하는 일간/주간 탭 pill, `emotion-trend-chart`는 Recharts 선그래프(실제 렌더링 경로에는 `fetchGuardianDashboard`의 실데이터만 쓰이고, prop 미전달 시의 `defaultMockScores` fallback은 프로덕션 경로에서 쓰이지 않음), `conversation-timeline`은 위험 강조가 있는 근거 문장 접기/펼치기 목록입니다.
- `shared/api`에 실제 `ChatSocket` 클래스(`wsClient.ts`)가 있습니다 — `/ws/chats`의 envelope(`event`/`payload`/`ts`) 프로토콜을 구현하고, `auth`/`chat:start`/`chat:end`/`audio:metadata`+바이너리 전송과 `auth:success`/`auth:error`/`ai:question`/`audio:ack`/`chat:idle-warning`/`chat:ended`/`chat:restored`/`error` 수신을 타입 이벤트 리스너(`on`/`off`)로 제공합니다. `docs/ws-protocol.md`가 계약 기준입니다. **TTS 재생은 실제 HTTP 스트리밍입니다(2026-08-21, base64 전체 전달 방식에서 전환)** — 백엔드는 오디오 바이트 자체를 WS로 보내지 않고, `tts:audio` 이벤트에 짧은 전용 JWT가 붙은 `streamPath`(`GET /chats/tts-stream`)만 실어 보냅니다. `pages/senior-conversation`이 이 URL을 `ai:question`과 짝지어(질문 텍스트가 항상 TTS보다 먼저 도착하도록 순서가 보장돼 있어 별도 대기 로직이 필요 없음) `features/record-voice-answer`의 `useRecordVoiceAnswer`에 넘기면, 재생 자체는 `shared/lib`의 `playTtsAudioStream`이 `<audio src={streamUrl}>`로 점진 재생합니다(MediaSource Extensions는 iOS Safari 호환성 문제로 쓰지 않음).
- 라우팅(`app/routes`)은 실제로 동작합니다: `/login`, `/join`, `/senior`, `/senior/conversation`, `/senior/connection`, `/senior/daily-record`, `/senior/my-info`, `/guardian`, `/guardian/report`, `/guardian/report/weekly/:weekStart`, `/guardian/notifications`, `/guardian/connection`, `/guardian/my-info` 각각이 `entities/user`의 세션/역할을 확인하는 `ProtectedRoute`로 보호되며(`/login`, `/join`은 로그인 전 화면이라 예외), 알 수 없는 경로는 `/login`으로 리다이렉트됩니다. `/`는 `SplashPage`이며 아직 자동 리다이렉트가 없습니다(위 표 참고). `/guardian/notification-settings`는 결정사항 로그 §7에서 `guardian-my-info`로 흡수되며 삭제됐습니다. **`/senior/conversation`(`SeniorConversationPage`)은 실제 `ChatSocket`으로 `/ws/chats`에 연결합니다** — 로그인이 이제 실제 API이므로 로그인한 시니어는 실제 `session.accessToken`(JWT)으로 정상 연결됩니다. `session.accessToken`이 없는 경우(로그인 전 상태로 직접 진입 등, 통상 `ProtectedRoute`가 막음)에만 "로그인 정보가 없어 대화를 시작할 수 없어요" 안내를 보여줍니다.

실제 화면을 구현할 때는 별도 파일을 새로 추가하지 말고 해당 placeholder를 그 자리에서 교체하세요 — 폴더 구조와 barrel export는 이미 있어야 할 자리에 있습니다.
