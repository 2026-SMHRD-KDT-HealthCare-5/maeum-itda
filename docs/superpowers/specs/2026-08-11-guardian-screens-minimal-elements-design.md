# 보호자 화면 최소 기능 요소 채우기 — Design

## 배경

codex로 보호자 관련 화면들의 디자인을 화면별로 적용하기 전에, 각 화면이 기능 구현을 위한 최소한의 HTML 요소(버튼/입력/목록 등 실제 DOM 구조)를 갖추고 있는지 먼저 확인하고, 빠진 부분을 채워 넣는다. 시니어 관련 화면은 이번 작업 범위에서 코드를 고치지 않고 확인만 한다.

## 조사 결과

### 시니어 화면 (확인만, 변경 없음)

`senior-home`, `senior-connection`, `senior-conversation`, `senior-daily-record`, `senior-my-info` 5개 화면과 그 안에서 쓰는 feature(`start-conversation`, `record-voice-answer`, `respond-connection-request`, `view-attendance-calendar`, `select-daily-record-date`, `edit-basic-info`, `disconnect-connection`, `set-checkin-reminder`)를 모두 읽었다. 전부 실제 버튼/입력/목록/이미지 등 마크업이 갖춰져 있고, 기능 구현을 위한 최소 요소 기준으로 빠진 부분이 없다.

부수적으로 발견한 문서 오류: [apps/frontend/CLAUDE.md](../../../apps/frontend/CLAUDE.md)에는 `respond-connection-request`가 여전히 한 줄짜리 placeholder라고 적혀 있으나, 실제로는 `RespondConnectionRequestAction.module.css`까지 갖춘 완성된 구현이다. 이 작업 범위에서는 코드 수정이 없으므로 문서 정정은 이번 변경에 포함하지 않고, 실제 구현 작업(코드 변경)이 있을 때 함께 정정한다.

### 보호자 화면 — 빠진 조각 6곳

`guardian-home`, `guardian-connection`, `guardian-my-info`, `guardian-notification`, `guardian-report`, `guardian-weekly-report` 6개 화면을 모두 읽었다. `guardian-my-info`는 `edit-basic-info`/`disconnect-connection`/`set-notification-threshold`가 전부 실제 구현이라 빠진 게 없다. 나머지 화면들에서 아래 6개 조각이 `<div>...placeholder</div>` 한 줄짜리 상태로 비어 있다:

| 위치 | 조각 | 쓰이는 화면 |
|---|---|---|
| `features/send-connection-request` | 어르신 연결 요청 (UC-00-1) | guardian-connection |
| `features/mark-notification-read` | 알림함 (UC-10, UC-11) | guardian-notification |
| `features/select-report-date` | 리포트 날짜 선택 (UC-08) | guardian-report |
| `widgets/conversation-timeline` | 근거 문장 타임라인 (UC-09) | guardian-report |
| `features/view-evidence-sentence` | 근거 문장 확인 (UC-09) | guardian-report |
| `widgets/emotion-trend-chart` | 주간 정서지수 선그래프 (UC-08) | guardian-home, guardian-weekly-report |

Figma 컴포넌트 세트(`docs/screens/보호자 알림함`, `보호자 일간 리포트 조회`, `보호자 주간 리포트 조회`, `보호자 대시보드`, `시니어 및 보호자 연결 화면`)를 근거로 각 조각의 실제 모양과 상호작용을 확인했다.

## 결정 사항

- **구현 깊이**: 기존에 이미 실장된 feature들(`edit-basic-info`, `disconnect-connection` 등)과 동일한 수준 — 로컬 mock state로 실제 동작하는 상호작용(입력→검증→결과, 클릭→상태 변경). Figma 컴포넌트 세트의 필터/그룹핑 같은 부가 디테일은 반영하지 않는다.
- **CSS**: 각 조각에 가벼운 `*.module.css`를 둔다(flex/gap 등 기본 레이아웃 수준). 세밀한 비주얼 디자인은 이후 codex 작업 대상이므로 만들지 않는다.
- **`emotion-trend-chart`**: 외부 차트 라이브러리 없이 인라인 SVG로 실제 라인그래프를 그린다(좌표는 직접 계산).
- **`Notification.target`**: 현재 `'dailyReport'` 하나뿐인데 Figma에는 "주간 리포트 보기" 알림도 있으므로, `entities/notification`의 `target` 유니언에 `{ type: 'weeklyReport'; weekStart: string }`를 추가한다.

## 조각별 설계

### 1. `features/send-connection-request` (guardian-connection, UC-00-1)

- `model`: `type RequestStatus = 'idle' | 'error' | 'pending'` 로컬 state. mock 검증 함수(특정 문자열만 "존재하지 않음" 처리, 나머지는 성공)로 실제 API 연결 전 동작을 흉내낸다.
- `ui`: "어르신 아이디" 라벨 + `input`(빈 값이면 제출 버튼 disabled) + 버튼 "요청". 실패 시 입력 아래 에러 텍스트("해당 아이디로 등록된 어르신을 찾을 수 없어요."). 성공 시 아래에 "보낸 요청" 섹션이 나타나 카드(아이디, 요청일) + "요청 취소" 버튼을 보여주고, 취소하면 `idle`로 되돌아간다.
- 기존 `entities/connection`의 `Connection`/`ConnectionStatus`(`'pending'`)를 그대로 재사용, 새 엔티티 타입은 만들지 않는다.

### 2. `entities/notification` 확장 + `features/mark-notification-read` (guardian-notification, UC-10/UC-11)

- `entities/notification/model`의 `target` 유니언에 `{ type: 'weeklyReport'; weekStart: string }` 추가.
- `mark-notification-read`의 `model`에 mock 알림 5~6건을 두고 `createdAt` 날짜를 오늘/이전으로 그룹핑.
- `ui`: 상단 "모두 읽음" 버튼(전체 `isRead = true`로 갱신). 그룹 라벨("오늘"/"이전") 아래 각 알림 항목: 아이콘(경고 유형은 빨강, 리포트 유형은 초록), 안읽음이면 표시되는 dot, 제목/본문/날짜, 우측에 "일간 리포트 보기 ›" 또는 "주간 리포트 보기 ›" 링크. 항목 클릭 시 읽음 처리 + `target.type`에 따라 `/guardian/report` 또는 `/guardian/report/weekly/:weekStart`로 이동.
- 알림이 하나도 없을 때는 빈 상태 문구를 보여준다.

### 3. `features/select-report-date` (guardian-report, UC-08)

- 이미 존재하는 `features/select-daily-record-date`와 동일한 패턴(전날/다음날 화살표 버튼 + 날짜 pill 버튼 → 캘린더 모달)을 그대로 미러링한다. 코드는 공유하지 않고 이 feature 안에 자체 `model`/`lib`로 복제한다(각 feature가 자기 세그먼트를 갖는 기존 컨벤션 유지, 조기 추상화 방지).
- `GuardianReportPage`의 하드코딩된 `weekStart` 상수를 실제 `selectedDate` state로 교체해 날짜 이동이 실제로 동작하게 한다. 단, mock 일간 리포트 데이터 자체는 날짜와 무관하게 고정값이다 — 이는 다른 페이지의 로컬 mock 한계와 동일한 수준이며 실제 API 연결 시 해소된다.

### 4. `widgets/conversation-timeline` + `features/view-evidence-sentence` (guardian-report, UC-09)

- `conversation-timeline`(widget)이 "정서 지수 산출 근거 (대화 내용)" 접이식 헤더(chevron 아이콘, `aria-expanded`, 기본 닫힘)와 mock `EvidenceSentence[]` 목록을 소유한다. 목록이 비어 있으면 "대화 기록이 없어요" 같은 빈 상태를 보여준다.
- 목록의 각 행 렌더링은 `features/view-evidence-sentence`에 위임한다(widget → feature import는 FSD 레이어 규칙상 허용되는 방향).
- `view-evidence-sentence`(feature)는 한 개의 `EvidenceSentence`를 받아 질문/답변 텍스트와 `sentimentLabel`(긍정/보통/부정) 색상 pill을 렌더링하고, `isRiskEvidence`가 true면 행 전체에 위험 강조(연한 배경색 + 관련 `aria-label`)를 적용한다.

### 5. `widgets/emotion-trend-chart` (guardian-home, guardian-weekly-report, UC-08)

- props로 `dailyScores: Array<{ date: string; emotionScore: number | null }>`를 받고, 넘겨주지 않으면 내부 기본 mock 7일치를 사용한다(guardian-home처럼 별도 주간 데이터가 없는 화면에서도 단독으로 렌더링 가능해야 하므로).
- 인라인 SVG: y축 그리드(0/25/50/75/100), x축 날짜 라벨(마지막 라벨은 "오늘"), 50점 기준 점선, 각 데이터 포인트의 원형 마커와 이를 잇는 꺾은선. `emotionScore`가 `null`인 날은 선을 끊는다(해당 구간만 이어지지 않음). 마지막 포인트에는 점수를 보여주는 배지를 붙인다.
- 클릭이나 hover 인터랙션은 없다(Figma 목업상 정적 그래프).

## 변경 파일 범위

- 신규/수정: `features/send-connection-request/{model,ui}`, `entities/notification/model`, `features/mark-notification-read/{model,ui}`, `features/select-report-date/{model,lib,ui}`, `widgets/conversation-timeline/ui`, `features/view-evidence-sentence/{model,ui}`, `widgets/emotion-trend-chart/{model,ui}`
- 페이지 쪽 수정: `GuardianConnectionPage`, `GuardianNotificationPage`, `GuardianReportPage`(날짜 state 추가), `GuardianHomePage`/`GuardianWeeklyReportPage`(차트에 props 전달, 필요 시)
- 시니어 화면, `guardian-my-info` 관련 코드는 변경하지 않는다.
- 백엔드/AI 서버/공유 타입(`packages/shared-types`) 변경 없음 — `Notification.target` 확장은 프론트엔드 로컬 엔티티(`entities/notification`)에만 존재하는 타입이라 영향 없다.

## 테스트 방법

1. `pnpm --filter frontend lint` 통과 확인
2. dev 서버로 각 화면을 직접 열어 확인:
   - guardian-connection: 성공/실패 아이디 둘 다 입력해보고 에러 문구·보낸 요청 카드·취소 버튼 동작 확인
   - guardian-notification: "모두 읽음" 버튼과 개별 항목 클릭 시 읽음 처리 및 일간/주간 리포트로 라우팅되는지 확인
   - guardian-report: 날짜 화살표/캘린더 모달로 날짜 이동, "정서 지수 산출 근거" 펼치기/접기, 위험 근거 항목의 강조 표시 확인
   - guardian-home, guardian-weekly-report: 선그래프가 mock 데이터로 정상 렌더링되고 데이터 없는 날에 선이 끊기는지 확인
3. 시니어 화면은 코드 변경이 없으므로 재확인 불필요
