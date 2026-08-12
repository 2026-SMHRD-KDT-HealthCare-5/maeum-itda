# 보호자 화면 최소 기능 요소 채우기 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 보호자(guardian) 화면 중 placeholder 상태로 비어 있던 6개 UI 조각(연결 요청, 알림함, 리포트 날짜 선택, 근거 문장 타임라인, 정서지수 선그래프)에 codex 디자인 작업을 시작할 수 있을 만큼의 최소 기능 HTML 요소를 채운다.

**Architecture:** Feature-Sliced Design(`apps/frontend`) 기존 레이어 규칙을 그대로 따른다. 각 조각은 기존에 이미 실장된 `disconnect-connection`/`edit-basic-info` 등과 동일한 수준으로 — 로컬 mock state로 실제 동작하는 상호작용 + 가벼운 `*.module.css`. 새 API 연동이나 백엔드 변경은 없다.

**Tech Stack:** React 19, TypeScript, react-router-dom v7, CSS Modules. 외부 차트 라이브러리 없이 인라인 SVG로 그래프를 그린다.

## Global Constraints

- FSD 레이어 임포트 규칙: 자기보다 엄격히 하위 레이어만 import(`app > pages > widgets > features > entities > shared`), 같은 레이어의 다른 슬라이스를 옆으로 import하지 않음, 슬라이스 바깥에서는 슬라이스 최상위 barrel(`index.ts`)만 import. (widget → feature import는 이 방향 규칙상 허용됨.) — [apps/frontend/CLAUDE.md](../../../apps/frontend/CLAUDE.md)
- feature/entity 슬라이스는 `ui/model/api/lib` 4개 세그먼트 + 각 세그먼트 barrel + 슬라이스 최상위 barrel을 갖는다. widgets/pages는 `ui/`만 갖는다. — apps/frontend/CLAUDE.md
- `EmotionLevel`은 `'좋음' | '보통' | '나쁨'` 3단계이고, `emotionScore`는 TextScore 단일값이다(`VoiceScore`는 폐기됨) — 결정사항 로그 §1/§2-5. 이 값들을 다루는 코드에서 새로 만들지 말 것.
- **이 저장소 `apps/frontend`에는 아직 테스트 프레임워크가 없다**(vitest/jest/testing-library 미설치, `*.test.*`/`*.spec.*` 파일 0개). 스펙 문서([docs/superpowers/specs/2026-08-11-guardian-screens-minimal-elements-design.md](../specs/2026-08-11-guardian-screens-minimal-elements-design.md))의 "테스트 방법"과 동일하게, 이 계획의 모든 "테스트" 스텝은 `pnpm --filter frontend lint` / `pnpm --filter frontend build`(타입 체크) + dev 서버 수동 브라우저 확인으로 대체한다. 새로 테스트 프레임워크를 들여오지 않는다.
- 커밋 컨벤션은 prefix 필수(`feat`/`fix`/`refactor`/`style`/`chore`) — 이 계획의 모든 태스크는 `feat` 접두사를 쓴다.
- **커밋 전 사용자 승인 필요**([CLAUDE.md](../../../CLAUDE.md) "Claude Code 작업 규칙") — 각 태스크의 "커밋" 스텝을 실행하는 사람/에이전트는 `git commit` 실행 전에 반드시 변경 요약과 커밋 메시지 초안을 사용자에게 보여주고 승인을 받아야 한다. 아래 각 스텝의 커밋 메시지는 초안이며, 그대로 쓸지 여부는 승인 시점에 결정한다.
- 현재 작업 브랜치: `feat/guardian-screen-elements` (dev에서 분기, 이미 생성됨). 새 브랜치를 추가로 만들지 않는다.

---

## Task 1: `entities/notification` — `target`에 `weeklyReport` 추가

**Files:**
- Modify: `apps/frontend/src/entities/notification/model/index.ts`

**Interfaces:**
- Produces: `Notification.target`이 `{ type: 'dailyReport'; reportId: string } | { type: 'weeklyReport'; weekStart: string }` 유니언이 됨 — Task 3이 `target.type`으로 분기해서 사용.

- [ ] **Step 1: `target` 유니언 확장**

`apps/frontend/src/entities/notification/model/index.ts` 전체를 아래로 교체:

```typescript
// GUARDIAN_NOTIFICATION_01 (UC-11) 기준.
// target 스키마는 결정사항 로그 §2에서 아직 미결 — 화면 목업엔 알림 유형이
// 3종 이상(정서지수 하락/안부 대화 미완료/일간 리포트 도착) 보이지만 API
// 명세는 dailyReport 하나만 정의되어 있음. 유형별 target 확장 시 이 타입도
// 갱신해야 함.
// 2026-08-11: Figma 목업에 "주간 리포트 도착" 알림도 있어 weeklyReport를
// 추가했다 — 정서지수 하락/안부 대화 미완료 알림의 target 구조는 여전히 미결.
export interface Notification {
  id: string
  title: string
  content: string
  isRead: boolean
  createdAt: string
  target:
    | { type: 'dailyReport'; reportId: string }
    | { type: 'weeklyReport'; weekStart: string }
}
```

- [ ] **Step 2: 타입 체크로 검증**

Run: `pnpm --filter frontend build`
Expected: 성공 (아직 `target`을 소비하는 코드가 없으므로 에러 없음)

- [ ] **Step 3: Commit**

```bash
git add apps/frontend/src/entities/notification/model/index.ts
git commit -m "feat: notification target에 weeklyReport 타입 추가"
```

---

## Task 2: `features/send-connection-request` + `guardian-connection` 페이지

**Files:**
- Modify: `apps/frontend/src/features/send-connection-request/model/index.ts`
- Modify: `apps/frontend/src/features/send-connection-request/ui/index.tsx`
- Create: `apps/frontend/src/features/send-connection-request/ui/SendConnectionRequestAction.module.css`
- Modify: `apps/frontend/src/pages/guardian-connection/ui/GuardianConnectionPage.tsx`
- Create: `apps/frontend/src/pages/guardian-connection/ui/GuardianConnectionPage.module.css`

**Interfaces:**
- Consumes: 없음 (독립 feature)
- Produces: `SendConnectionRequestAction()` — props 없는 컴포넌트, `GuardianConnectionPage`가 그대로 렌더링.

- [ ] **Step 1: mock 검증 로직 작성**

`apps/frontend/src/features/send-connection-request/model/index.ts` 전체를 아래로 교체:

```typescript
export interface SentConnectionRequest {
  seniorUsername: string
  requestedAt: string
}

// TEMP mock (UC-00-1 실제 연결 요청 API 연동 전): 'notfound'를 입력하면
// 존재하지 않는 아이디로 취급하고, 그 외 값은 전부 성공으로 처리한다.
// apps/backend 연동 시 이 함수를 실제 API 호출로 교체할 것.
export function mockSendConnectionRequest(seniorUsername: string): { ok: boolean } {
  return { ok: seniorUsername.trim().toLowerCase() !== 'notfound' }
}
```

- [ ] **Step 2: 폼 UI 작성**

`apps/frontend/src/features/send-connection-request/ui/index.tsx` 전체를 아래로 교체:

```tsx
import { useState } from 'react'
import { mockSendConnectionRequest, type SentConnectionRequest } from '../model'
import styles from './SendConnectionRequestAction.module.css'

// GUARDIAN_LINK_01 (UC-00-1) — 어르신 아이디로 연결 요청을 보내는 폼.
// 실제 연결 요청 API 연동 전이라 mockSendConnectionRequest로 성공/실패를
// 흉내낸다.
export function SendConnectionRequestAction() {
  const [seniorUsername, setSeniorUsername] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [sentRequest, setSentRequest] = useState<SentConnectionRequest | null>(null)

  function handleSubmit() {
    const trimmed = seniorUsername.trim()
    if (!trimmed) return

    const result = mockSendConnectionRequest(trimmed)
    if (!result.ok) {
      setError('해당 아이디로 등록된 어르신을 찾을 수 없어요.')
      return
    }

    setError(null)
    setSentRequest({ seniorUsername: trimmed, requestedAt: new Date().toISOString() })
  }

  function handleCancel() {
    setSentRequest(null)
    setSeniorUsername('')
  }

  return (
    <div>
      <div className={styles.card}>
        <h2 className={styles.title}>어르신 아이디</h2>
        <div className={styles.row}>
          <input
            className={styles.input}
            value={seniorUsername}
            onChange={(event) => {
              setSeniorUsername(event.target.value)
              setError(null)
            }}
            placeholder="아이디를 입력하세요"
            aria-label="어르신 아이디"
          />
          <button
            type="button"
            className={styles.submitButton}
            onClick={handleSubmit}
            disabled={!seniorUsername.trim()}
          >
            요청
          </button>
        </div>
        <p className={styles.hint}>어르신이 가입 시 등록한 아이디로 찾을 수 있어요.</p>
      </div>

      {error && <p className={styles.error}>{error}</p>}

      {sentRequest && (
        <div className={styles.sentCard}>
          <h3 className={styles.sentTitle}>보낸 요청</h3>
          <div className={styles.sentRow}>
            <div>
              <p className={styles.sentUsername}>{sentRequest.seniorUsername}</p>
              <p className={styles.sentDate}>
                {new Date(sentRequest.requestedAt).toLocaleDateString('ko-KR')} 요청
              </p>
            </div>
            <button type="button" className={styles.cancelButton} onClick={handleCancel}>
              요청 취소
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 3: CSS 작성**

`apps/frontend/src/features/send-connection-request/ui/SendConnectionRequestAction.module.css` 신규 생성:

```css
.card {
  border-radius: 16px;
  background: var(--bg);
  border: 1px solid var(--border);
  padding: 16px;
}

.title {
  margin: 0 0 10px;
  color: var(--text-h);
  font-size: 15px;
  font-weight: 700;
}

.row {
  display: flex;
  gap: 8px;
}

.input {
  flex: 1;
  min-height: 44px;
  border: 1px solid var(--border);
  border-radius: 10px;
  padding: 0 12px;
  font-size: 15px;
  color: var(--text-h);
}

.input:focus-visible {
  outline: 2px solid var(--primary);
  outline-offset: 1px;
}

.submitButton {
  min-height: 44px;
  padding: 0 18px;
  border: none;
  border-radius: 10px;
  background: var(--primary-tint);
  color: var(--primary);
  font-weight: 700;
  font-size: 14px;
  cursor: pointer;
}

.submitButton:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.hint {
  margin: 10px 0 0;
  color: var(--text);
  font-size: 12px;
}

.error {
  margin: 10px 0 0;
  color: var(--danger);
  font-size: 13px;
}

.sentCard {
  margin-top: 16px;
}

.sentTitle {
  margin: 0 0 8px;
  color: var(--text-h);
  font-size: 14px;
  font-weight: 700;
}

.sentRow {
  display: flex;
  align-items: center;
  justify-content: space-between;
  border-radius: 14px;
  background: var(--code-bg);
  padding: 12px 14px;
}

.sentUsername {
  margin: 0;
  color: var(--text-h);
  font-weight: 700;
  font-size: 15px;
}

.sentDate {
  margin: 2px 0 0;
  color: var(--text);
  font-size: 12px;
}

.cancelButton {
  min-height: 36px;
  padding: 0 12px;
  border: none;
  border-radius: 999px;
  background: var(--danger-bg);
  color: var(--danger);
  font-weight: 700;
  font-size: 13px;
  cursor: pointer;
}
```

- [ ] **Step 4: 페이지에 레이아웃 추가**

`apps/frontend/src/pages/guardian-connection/ui/GuardianConnectionPage.tsx` 전체를 아래로 교체:

```tsx
import { SendConnectionRequestAction } from '../../../features/send-connection-request'
import { BottomTabBar, GUARDIAN_TAB_ITEMS } from '../../../widgets/bottom-tab-bar'
import styles from './GuardianConnectionPage.module.css'

// GUARDIAN_LINK_01 (UC-00-1)
export function GuardianConnectionPage() {
  return (
    <>
      <main className={styles.page}>
        <h1 className={styles.title}>시니어 연결</h1>
        <p className={styles.description}>
          한 분의 어르신과만 연결할 수 있어요. 요청을 수락하시면 정서 리포트를 받아볼 수 있어요.
        </p>
        <SendConnectionRequestAction />
      </main>
      <BottomTabBar items={GUARDIAN_TAB_ITEMS} />
    </>
  )
}
```

`apps/frontend/src/pages/guardian-connection/ui/GuardianConnectionPage.module.css` 신규 생성:

```css
.page {
  padding: 20px 20px 100px;
  display: grid;
  gap: 6px;
}

.title {
  margin: 0;
  color: var(--text-h);
  font-size: 20px;
  font-weight: 800;
}

.description {
  margin: 0 0 14px;
  color: var(--text);
  font-size: 13px;
  line-height: 1.4;
}
```

- [ ] **Step 5: lint 확인**

Run: `pnpm --filter frontend lint`
Expected: 통과

- [ ] **Step 6: 브라우저 수동 확인**

`pnpm --filter frontend dev` 실행 후:
1. `guardian`이 포함된 아이디로 로그인(`mockResolveRole` 기준 보호자로 진입) → `/guardian/connection`으로 이동
2. 입력창에 `notfound` 입력 후 "요청" 클릭 → "해당 아이디로 등록된 어르신을 찾을 수 없어요." 문구 표시 확인
3. 입력창에 `soonja_k` 입력 후 "요청" 클릭 → "보낸 요청" 카드에 아이디/요청일/"요청 취소" 버튼 표시 확인
4. "요청 취소" 클릭 → 카드 사라지고 입력창 비워짐 확인

- [ ] **Step 7: Commit**

```bash
git add apps/frontend/src/features/send-connection-request apps/frontend/src/pages/guardian-connection
git commit -m "feat: 보호자 연결 요청 폼 구현"
```

---

## Task 3: `features/mark-notification-read` + `guardian-notification` 페이지

**Files:**
- Modify: `apps/frontend/src/features/mark-notification-read/model/index.ts`
- Modify: `apps/frontend/src/features/mark-notification-read/ui/index.tsx`
- Create: `apps/frontend/src/features/mark-notification-read/ui/MarkNotificationReadAction.module.css`
- Modify: `apps/frontend/src/pages/guardian-notification/ui/GuardianNotificationPage.tsx`
- Create: `apps/frontend/src/pages/guardian-notification/ui/GuardianNotificationPage.module.css`

**Interfaces:**
- Consumes: `Notification`(`entities/notification`, Task 1에서 `target` 확장됨)
- Produces: `MarkNotificationReadAction()` — props 없는 컴포넌트.

- [ ] **Step 1: mock 데이터 + 헬퍼 작성**

`apps/frontend/src/features/mark-notification-read/model/index.ts` 전체를 아래로 교체:

```typescript
import type { Notification } from '../../../entities/notification'

// TEMP mock (UC-10/UC-11 실제 알림 API 연동 전) — 오늘/이전 그룹핑을 화면에서
// 확인할 수 있도록 오늘 기준 상대 날짜로 createdAt을 만든다.
function daysAgoIso(days: number): string {
  const date = new Date()
  date.setDate(date.getDate() - days)
  return date.toISOString()
}

export const mockNotifications: Notification[] = [
  {
    id: 'noti-1',
    title: '정서지수 하락 감지',
    content: '어르신의 오늘 정서지수가 38점으로 임계치(50)보다 낮아요.',
    isRead: false,
    createdAt: daysAgoIso(0),
    target: { type: 'dailyReport', reportId: 'report-today' },
  },
  {
    id: 'noti-2',
    title: '주간 리포트가 도착했어요',
    content: '이번 주 대화 5건이 분석되었어요.',
    isRead: false,
    createdAt: daysAgoIso(0),
    target: { type: 'weeklyReport', weekStart: '2025-06-30' },
  },
  {
    id: 'noti-3',
    title: '정서지수 하락 감지',
    content: '어르신의 어제 정서지수가 42점으로 임계치(50)보다 낮았어요.',
    isRead: true,
    createdAt: daysAgoIso(1),
    target: { type: 'dailyReport', reportId: 'report-yesterday' },
  },
  {
    id: 'noti-4',
    title: '주간 리포트가 도착했어요',
    content: '지난 주 대화 7건이 분석되었어요.',
    isRead: true,
    createdAt: daysAgoIso(7),
    target: { type: 'weeklyReport', weekStart: '2025-06-23' },
  },
]

export function groupByDay(notifications: Notification[]): {
  today: Notification[]
  earlier: Notification[]
} {
  const today = new Date()
  const isToday = (iso: string) => {
    const date = new Date(iso)
    return (
      date.getFullYear() === today.getFullYear() &&
      date.getMonth() === today.getMonth() &&
      date.getDate() === today.getDate()
    )
  }

  return {
    today: notifications.filter((notification) => isToday(notification.createdAt)),
    earlier: notifications.filter((notification) => !isToday(notification.createdAt)),
  }
}

export function reportLinkPath(target: Notification['target']): { label: string; to: string } {
  if (target.type === 'weeklyReport') {
    return { label: '주간 리포트 보기', to: `/guardian/report/weekly/${target.weekStart}` }
  }
  return { label: '일간 리포트 보기', to: '/guardian/report' }
}
```

- [ ] **Step 2: 목록 UI 작성**

`apps/frontend/src/features/mark-notification-read/ui/index.tsx` 전체를 아래로 교체:

```tsx
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { Notification } from '../../../entities/notification'
import { groupByDay, mockNotifications, reportLinkPath } from '../model'
import styles from './MarkNotificationReadAction.module.css'

// GUARDIAN_NOTIFICATION_01 (UC-10, UC-11)
export function MarkNotificationReadAction() {
  const [notifications, setNotifications] = useState<Notification[]>(mockNotifications)
  const navigate = useNavigate()

  function markAllRead() {
    setNotifications((current) => current.map((notification) => ({ ...notification, isRead: true })))
  }

  function openNotification(notification: Notification) {
    setNotifications((current) =>
      current.map((item) => (item.id === notification.id ? { ...item, isRead: true } : item)),
    )
    navigate(reportLinkPath(notification.target).to)
  }

  if (notifications.length === 0) {
    return <p className={styles.empty}>아직 도착한 알림이 없어요.</p>
  }

  const { today, earlier } = groupByDay(notifications)

  return (
    <div>
      <div className={styles.header}>
        <button type="button" className={styles.markAllButton} onClick={markAllRead}>
          모두 읽음
        </button>
      </div>

      {today.length > 0 && (
        <section>
          <h2 className={styles.groupLabel}>오늘</h2>
          <ul className={styles.list}>
            {today.map((notification) => (
              <NotificationRow key={notification.id} notification={notification} onOpen={openNotification} />
            ))}
          </ul>
        </section>
      )}

      {earlier.length > 0 && (
        <section>
          <h2 className={styles.groupLabel}>이전</h2>
          <ul className={styles.list}>
            {earlier.map((notification) => (
              <NotificationRow key={notification.id} notification={notification} onOpen={openNotification} />
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}

function NotificationRow({
  notification,
  onOpen,
}: {
  notification: Notification
  onOpen: (notification: Notification) => void
}) {
  const isWarning = notification.title.includes('하락')
  const link = reportLinkPath(notification.target)

  return (
    <li>
      <button
        type="button"
        className={[styles.item, isWarning ? styles.itemWarning : '', !notification.isRead ? styles.itemUnread : '']
          .filter(Boolean)
          .join(' ')}
        onClick={() => onOpen(notification)}
      >
        <span className={[styles.icon, isWarning ? styles.iconWarning : styles.iconReport].join(' ')} aria-hidden="true">
          {isWarning ? '!' : '☰'}
        </span>
        <span className={styles.body}>
          <span className={styles.titleRow}>
            <strong>{notification.title}</strong>
            {!notification.isRead && <span className={styles.dot} aria-hidden="true" />}
          </span>
          <span className={styles.content}>{notification.content}</span>
          <span className={styles.footer}>
            <span className={styles.date}>{new Date(notification.createdAt).toLocaleString('ko-KR')}</span>
            <span className={styles.link}>{link.label} ›</span>
          </span>
        </span>
      </button>
    </li>
  )
}
```

- [ ] **Step 3: CSS 작성**

`apps/frontend/src/features/mark-notification-read/ui/MarkNotificationReadAction.module.css` 신규 생성:

```css
.header {
  display: flex;
  justify-content: flex-end;
  margin-bottom: 8px;
}

.markAllButton {
  border: none;
  border-radius: 999px;
  background: var(--code-bg);
  padding: 8px 14px;
  color: var(--text-h);
  font-weight: 700;
  font-size: 13px;
  cursor: pointer;
}

.groupLabel {
  margin: 16px 0 8px;
  color: var(--text);
  font-size: 13px;
  font-weight: 700;
}

.list {
  display: grid;
  gap: 8px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.item {
  display: flex;
  gap: 12px;
  width: 100%;
  border: none;
  border-radius: 14px;
  background: var(--code-bg);
  padding: 12px 14px;
  text-align: left;
  cursor: pointer;
}

.itemWarning {
  background: var(--danger-bg);
}

.itemUnread {
  box-shadow: inset 0 0 0 1px var(--border);
}

.icon {
  display: grid;
  flex-shrink: 0;
  width: 32px;
  height: 32px;
  place-items: center;
  border-radius: 50%;
  font-weight: 800;
}

.iconWarning {
  background: var(--danger);
  color: #fff;
}

.iconReport {
  background: var(--primary-tint);
  color: var(--primary);
}

.body {
  display: grid;
  gap: 4px;
  flex: 1;
  min-width: 0;
}

.titleRow {
  display: flex;
  align-items: center;
  gap: 6px;
  color: var(--text-h);
  font-size: 14px;
}

.dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--danger);
}

.content {
  color: var(--text);
  font-size: 13px;
  line-height: 1.4;
}

.footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: 2px;
}

.date {
  color: var(--text);
  font-size: 11px;
}

.link {
  color: var(--primary);
  font-weight: 700;
  font-size: 12px;
}

.empty {
  margin: 40px 0 0;
  color: var(--text);
  font-size: 14px;
  text-align: center;
}
```

- [ ] **Step 4: 페이지에 레이아웃 추가**

`apps/frontend/src/pages/guardian-notification/ui/GuardianNotificationPage.tsx` 전체를 아래로 교체:

```tsx
import { MarkNotificationReadAction } from '../../../features/mark-notification-read'
import { BottomTabBar, GUARDIAN_TAB_ITEMS } from '../../../widgets/bottom-tab-bar'
import styles from './GuardianNotificationPage.module.css'

// GUARDIAN_NOTIFICATION_01 (UC-11)
export function GuardianNotificationPage() {
  return (
    <>
      <main className={styles.page}>
        <h1 className={styles.title}>알림</h1>
        <MarkNotificationReadAction />
      </main>
      <BottomTabBar items={GUARDIAN_TAB_ITEMS} />
    </>
  )
}
```

`apps/frontend/src/pages/guardian-notification/ui/GuardianNotificationPage.module.css` 신규 생성:

```css
.page {
  padding: 20px 20px 100px;
  display: grid;
  gap: 4px;
}

.title {
  margin: 0;
  color: var(--text-h);
  font-size: 20px;
  font-weight: 800;
}
```

- [ ] **Step 5: lint 확인**

Run: `pnpm --filter frontend lint`
Expected: 통과

- [ ] **Step 6: 브라우저 수동 확인**

1. `/guardian/notifications` 열기 → "오늘"/"이전" 그룹, 안읽음 항목에 dot 표시 확인
2. "모두 읽음" 클릭 → 모든 dot 사라짐 확인
3. "정서지수 하락 감지" 항목 클릭 → `/guardian/report`로 이동 확인
4. "주간 리포트가 도착했어요" 항목 클릭 → `/guardian/report/weekly/2025-06-30`(또는 해당 weekStart)로 이동 확인

- [ ] **Step 7: Commit**

```bash
git add apps/frontend/src/features/mark-notification-read apps/frontend/src/pages/guardian-notification
git commit -m "feat: 보호자 알림함 목록/읽음 처리 구현"
```

---

## Task 4: `features/select-report-date` + `guardian-report` 날짜 네비게이션

**Files:**
- Modify: `apps/frontend/src/features/select-report-date/model/index.ts`
- Modify: `apps/frontend/src/features/select-report-date/lib/index.ts`
- Modify: `apps/frontend/src/features/select-report-date/ui/index.tsx`
- Create: `apps/frontend/src/features/select-report-date/ui/SelectReportDateAction.module.css`
- Modify: `apps/frontend/src/pages/guardian-report/ui/GuardianReportPage.tsx`

**Interfaces:**
- Produces: `SelectReportDateAction({ selectedDate: Date; onSelectDate: (date: Date) => void })`.

- [ ] **Step 1: model 주석 갱신 (실제 로직 없음, ui가 직접 관리)**

`apps/frontend/src/features/select-report-date/model/index.ts` 전체를 아래로 교체:

```typescript
// UC-08: 날짜 네비게이션의 로컬 state는 ui/index.tsx가 직접 관리한다(다른
// 화면의 캘린더 모달과 동일한 패턴). 이 파일은 실제 리포트 날짜 조회 API가
// 붙을 때 로딩/에러 상태를 둘 자리다.
export {}
```

- [ ] **Step 2: 날짜 포맷 헬퍼 작성**

`apps/frontend/src/features/select-report-date/lib/index.ts` 전체를 아래로 교체:

```typescript
const weekDays = ['일', '월', '화', '수', '목', '금', '토']

export function toDateKey(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function formatKoreanDate(date: Date): string {
  return `${date.getFullYear()}년 ${date.getMonth() + 1}월 ${date.getDate()}일 (${weekDays[date.getDay()]})`
}

export function isSameDate(left: Date, right: Date): boolean {
  return (
    left.getFullYear() === right.getFullYear() &&
    left.getMonth() === right.getMonth() &&
    left.getDate() === right.getDate()
  )
}

export function getCalendarDates(year: number, month: number): Date[] {
  const firstDate = new Date(year, month, 1)
  const lastDate = new Date(year, month + 1, 0)
  const startDate = new Date(year, month, 1 - firstDate.getDay())
  const endOffset = 6 - lastDate.getDay()
  const endDate = new Date(year, month, lastDate.getDate() + endOffset)
  const dates: Date[] = []

  for (const date = new Date(startDate); date <= endDate; date.setDate(date.getDate() + 1)) {
    dates.push(new Date(date))
  }

  return dates
}
```

- [ ] **Step 3: 날짜 네비게이션 + 캘린더 모달 UI 작성**

`apps/frontend/src/features/select-report-date/ui/index.tsx` 전체를 아래로 교체:

```tsx
import { useEffect, useState } from 'react'
import { formatKoreanDate, getCalendarDates, isSameDate, toDateKey } from '../lib'
import styles from './SelectReportDateAction.module.css'

const weekDays = ['일', '월', '화', '수', '목', '금', '토']

interface SelectReportDateActionProps {
  selectedDate: Date
  onSelectDate: (date: Date) => void
}

// GUARDIAN_REPORT_01 (UC-08) — 일간 리포트 날짜 네비게이션 + 캘린더 모달.
// features/select-daily-record-date와 같은 패턴을 이 feature 안에 자체
// 구현으로 복제했다(보호자 리포트는 대화-기록-있음 표시가 필요 없어 그
// 하이라이트 로직은 뺐다).
export function SelectReportDateAction({ selectedDate, onSelectDate }: SelectReportDateActionProps) {
  const [isCalendarOpen, setIsCalendarOpen] = useState(false)
  const [visibleMonth, setVisibleMonth] = useState(
    () => new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1),
  )

  function moveDay(offset: number) {
    const next = new Date(selectedDate)
    next.setDate(next.getDate() + offset)
    onSelectDate(next)
  }

  function moveMonth(offset: number) {
    setVisibleMonth((current) => new Date(current.getFullYear(), current.getMonth() + offset, 1))
  }

  function openCalendar() {
    setVisibleMonth(new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1))
    setIsCalendarOpen(true)
  }

  const year = visibleMonth.getFullYear()
  const month = visibleMonth.getMonth()
  const calendarDates = getCalendarDates(year, month)

  useEffect(() => {
    if (!isCalendarOpen) return

    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setIsCalendarOpen(false)
    }
    document.addEventListener('keydown', closeOnEscape)
    return () => document.removeEventListener('keydown', closeOnEscape)
  }, [isCalendarOpen])

  return (
    <>
      <div className={styles.pill}>
        <button type="button" className={styles.arrowButton} onClick={() => moveDay(-1)} aria-label="전날 리포트 보기">
          ‹
        </button>
        <button type="button" className={styles.dateButton} onClick={openCalendar}>
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <rect x="4" y="5" width="16" height="16" rx="3" />
            <path d="M4 9.5h16M8 3v3.5M16 3v3.5" />
          </svg>
          {formatKoreanDate(selectedDate)}
        </button>
        <button type="button" className={styles.arrowButton} onClick={() => moveDay(1)} aria-label="다음날 리포트 보기">
          ›
        </button>
      </div>

      {isCalendarOpen && (
        <div className={styles.modalOverlay} onClick={() => setIsCalendarOpen(false)}>
          <div
            className={styles.modal}
            role="dialog"
            aria-modal="true"
            aria-label="리포트 날짜 선택"
            onClick={(event) => event.stopPropagation()}
          >
            <div className={styles.monthNav}>
              <button type="button" onClick={() => moveMonth(-1)} aria-label="이전 달">
                ‹
              </button>
              <strong>
                {year}년 {month + 1}월
              </strong>
              <button type="button" onClick={() => moveMonth(1)} aria-label="다음 달">
                ›
              </button>
            </div>

            <div className={styles.calendar}>
              {weekDays.map((day) => (
                <span className={styles.weekDay} key={day}>
                  {day}
                </span>
              ))}
              {calendarDates.map((date) => {
                const isSelected = isSameDate(date, selectedDate)
                const isOutsideMonth = date.getMonth() !== month

                return (
                  <button
                    type="button"
                    key={toDateKey(date)}
                    className={[styles.dateCell, isOutsideMonth ? styles.outsideMonth : '', isSelected ? styles.selected : '']
                      .filter(Boolean)
                      .join(' ')}
                    aria-label={`${date.getFullYear()}년 ${date.getMonth() + 1}월 ${date.getDate()}일`}
                    aria-pressed={isSelected}
                    onClick={() => {
                      onSelectDate(date)
                      setIsCalendarOpen(false)
                    }}
                  >
                    {date.getDate()}
                  </button>
                )
              })}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
```

- [ ] **Step 4: CSS 작성**

`apps/frontend/src/features/select-report-date/ui/SelectReportDateAction.module.css` 신규 생성:

```css
.pill {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 4px 0 8px;
}

.arrowButton {
  display: grid;
  width: 40px;
  height: 40px;
  padding: 0;
  place-items: center;
  border: none;
  border-radius: 50%;
  background: transparent;
  color: var(--primary);
  font-size: 26px;
  line-height: 1;
  cursor: pointer;
}

.arrowButton:hover {
  background: #e7f1ec;
}

.dateButton {
  display: flex;
  align-items: center;
  gap: 6px;
  min-height: 44px;
  border: 0;
  border-radius: 999px;
  background: #e9f2ed;
  padding: 8px 16px;
  color: #2d4138;
  font-weight: 800;
  font-size: 15px;
  cursor: pointer;
}

.dateButton svg {
  width: 17px;
  height: 17px;
  fill: none;
  stroke: currentColor;
  stroke-width: 1.8;
  stroke-linecap: round;
  stroke-linejoin: round;
}

.modalOverlay {
  position: fixed;
  inset: 0;
  z-index: 40;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
  background: rgba(38, 48, 43, 0.48);
  backdrop-filter: blur(3px);
}

.modal {
  width: min(390px, 100%);
  padding: 24px 20px 22px;
  border-radius: 28px;
  background: var(--bg);
  box-shadow: 0 24px 60px rgba(24, 35, 29, 0.24);
}

.monthNav {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 18px;
}

.monthNav button {
  display: grid;
  width: 44px;
  height: 44px;
  place-items: center;
  border: none;
  border-radius: 50%;
  background: transparent;
  color: var(--primary);
  font-size: 27px;
  cursor: pointer;
}

.monthNav strong {
  color: #2e4138;
  font-size: 20px;
}

.calendar {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: 7px 4px;
  text-align: center;
}

.weekDay {
  padding-bottom: 6px;
  color: #84908a;
  font-size: 14px;
  font-weight: 700;
}

.dateCell {
  position: relative;
  display: grid;
  place-items: center;
  aspect-ratio: 1;
  border: none;
  border-radius: 50%;
  background: none;
  color: var(--text-h);
  width: 40px;
  max-width: 100%;
  justify-self: center;
  font-size: 15px;
  cursor: pointer;
}

.dateCell:hover {
  background: #edf4f0;
}

.outsideMonth {
  color: var(--border);
}

.selected {
  background: var(--primary);
  color: #fff;
  font-weight: 700;
}
```

- [ ] **Step 5: `GuardianReportPage`에 날짜 state 연결**

`apps/frontend/src/pages/guardian-report/ui/GuardianReportPage.tsx` 전체를 아래로 교체:

```tsx
import { useState } from 'react'
import { SelectReportDateAction } from '../../../features/select-report-date'
import { ViewEvidenceSentenceAction } from '../../../features/view-evidence-sentence'
import {
  ConversationSummaryCard,
  EmotionScoreCard,
  RecommendedActionCard,
} from '../../../entities/report'
import { Card } from '../../../shared/ui'
import { ConversationTimeline } from '../../../widgets/conversation-timeline'
import { BottomTabBar, GUARDIAN_TAB_ITEMS } from '../../../widgets/bottom-tab-bar'
import { ReportPeriodTabs } from '../../../widgets/report-period-tabs'
import styles from './GuardianReportPage.module.css'

// GUARDIAN_REPORT_01 (UC-08, UC-09) — 결정사항 로그 §7에서 일간/주간 탭
// 위젯과 "이날의 정서 지수"/"다슬이의 한마디"/"이날의 대화 요약" 카드를
// 추가했다. 실제 API 연결 전이라 이날의 리포트는 페이지 로컬 mock이다.
const mockDailyReport = {
  emotionScore: 93,
  emotionLevel: '좋음' as const,
  comment: '오늘은 어르신의 목소리가 밝고 활기가 느껴졌어요.',
  conversationSummary: '아침 산책과 화분 이야기를 나눴고, 전반적으로 편안한 하루를 보내셨어요.',
  recommendedAction:
    '산책 이야기를 많이 하셨어요. 요즘 즐기시는 산책길을 여쭤보시면 좋아하실 것 같아요.',
}

export function GuardianReportPage() {
  const weekStart = new Date().toISOString().slice(0, 10)
  const [selectedDate, setSelectedDate] = useState(new Date('2025-07-08T00:00:00'))

  return (
    <>
      <main className={styles.page}>
        <ReportPeriodTabs active="daily" weekStart={weekStart} />

        <SelectReportDateAction selectedDate={selectedDate} onSelectDate={setSelectedDate} />

        <Card>
          <EmotionScoreCard
            title="이날의 정서 지수"
            score={mockDailyReport.emotionScore}
            level={mockDailyReport.emotionLevel}
            comment={mockDailyReport.comment}
          />
        </Card>

        <ConversationTimeline />
        <ViewEvidenceSentenceAction />

        <Card>
          <ConversationSummaryCard summary={mockDailyReport.conversationSummary} />
        </Card>

        <Card>
          <RecommendedActionCard action={mockDailyReport.recommendedAction} />
        </Card>
      </main>
      <BottomTabBar items={GUARDIAN_TAB_ITEMS} />
    </>
  )
}
```

(주의: 이 스텝에서는 `ViewEvidenceSentenceAction` 직접 렌더링을 아직 그대로 둔다 — Task 5에서 `ConversationTimeline`이 이를 내부로 흡수하면서 제거한다.)

- [ ] **Step 6: lint 확인**

Run: `pnpm --filter frontend lint`
Expected: 통과

- [ ] **Step 7: 브라우저 수동 확인**

1. `/guardian/report` 열기 → 날짜 pill에 "2025년 7월 8일 (화)" 표시 확인
2. ‹/› 클릭 → 전날/다음날로 이동(pill 텍스트 갱신) 확인
3. pill 클릭 → 캘린더 모달 오픈, 다른 날짜 클릭 → 모달 닫히고 pill 갱신 확인

- [ ] **Step 8: Commit**

```bash
git add apps/frontend/src/features/select-report-date apps/frontend/src/pages/guardian-report/ui/GuardianReportPage.tsx
git commit -m "feat: 보호자 리포트 날짜 선택 기능 구현"
```

---

## Task 5: `widgets/conversation-timeline` + `features/view-evidence-sentence`

**Files:**
- Modify: `apps/frontend/src/features/view-evidence-sentence/ui/index.tsx`
- Create: `apps/frontend/src/features/view-evidence-sentence/ui/ViewEvidenceSentenceAction.module.css`
- Modify: `apps/frontend/src/widgets/conversation-timeline/ui/index.tsx`
- Create: `apps/frontend/src/widgets/conversation-timeline/ui/ConversationTimeline.module.css`
- Modify: `apps/frontend/src/pages/guardian-report/ui/GuardianReportPage.tsx`

**Interfaces:**
- Consumes: `EvidenceSentence`(`entities/report`, 이미 정의됨: `{ question, answer, isRiskEvidence, sentimentLabel }`)
- Produces: `ViewEvidenceSentenceAction({ sentence: EvidenceSentence })` — `ConversationTimeline`이 목록 각 행에서 호출.

- [ ] **Step 1: 근거 문장 한 행 렌더링 컴포넌트 작성**

`apps/frontend/src/features/view-evidence-sentence/ui/index.tsx` 전체를 아래로 교체:

```tsx
import type { EvidenceSentence } from '../../../entities/report'
import styles from './ViewEvidenceSentenceAction.module.css'

const sentimentClassName: Record<'긍정' | '보통' | '부정', string> = {
  긍정: styles.sentimentPositive,
  보통: styles.sentimentNeutral,
  부정: styles.sentimentNegative,
}

// GUARDIAN_REPORT_01 (UC-09) — 근거 문장 한 건(질문/답변 + 감정 배지)을
// 렌더링한다. isRiskEvidence면 행 전체에 위험 강조를 준다. 목록 컨테이너와
// 접기/펼치기는 widgets/conversation-timeline이 소유한다.
export function ViewEvidenceSentenceAction({ sentence }: { sentence: EvidenceSentence }) {
  return (
    <li
      className={[styles.row, sentence.isRiskEvidence ? styles.risk : ''].filter(Boolean).join(' ')}
      aria-label={sentence.isRiskEvidence ? '위험 근거 문장' : undefined}
    >
      <p className={styles.qa}>
        <span className={styles.qLabel}>Q</span> {sentence.question}
      </p>
      <p className={styles.qa}>
        <span className={styles.aLabel}>A</span> {sentence.answer}
      </p>
      {sentence.sentimentLabel && (
        <span className={[styles.pill, sentimentClassName[sentence.sentimentLabel]].join(' ')}>
          {sentence.sentimentLabel}
        </span>
      )}
    </li>
  )
}
```

- [ ] **Step 2: CSS 작성**

`apps/frontend/src/features/view-evidence-sentence/ui/ViewEvidenceSentenceAction.module.css` 신규 생성:

```css
.row {
  position: relative;
  display: grid;
  gap: 4px;
  padding: 10px 12px;
  border-radius: 12px;
}

.risk {
  background: var(--danger-bg);
}

.qa {
  margin: 0;
  color: var(--text-h);
  font-size: 13px;
  line-height: 1.5;
}

.qLabel,
.aLabel {
  font-weight: 800;
  color: var(--text);
}

.pill {
  justify-self: end;
  padding: 2px 10px;
  border-radius: 999px;
  font-size: 12px;
  font-weight: 700;
}

.sentimentPositive {
  background: var(--primary-tint);
  color: var(--primary);
}

.sentimentNeutral {
  background: #fff4e0;
  color: #b9770e;
}

.sentimentNegative {
  background: var(--danger-bg);
  color: var(--danger);
}
```

- [ ] **Step 3: 접이식 타임라인 컨테이너 작성**

`apps/frontend/src/widgets/conversation-timeline/ui/index.tsx` 전체를 아래로 교체:

```tsx
import { useState } from 'react'
import { ViewEvidenceSentenceAction } from '../../../features/view-evidence-sentence'
import type { EvidenceSentence } from '../../../entities/report'
import styles from './ConversationTimeline.module.css'

const mockEvidenceSentences: EvidenceSentence[] = [
  {
    question: '오늘 기분은 어떠세요?',
    answer: '조금 외롭네요. 가족들이 보고 싶어요.',
    isRiskEvidence: true,
    sentimentLabel: '부정',
  },
  {
    question: '무릎은 괜찮으세요?',
    answer: '무릎이 조금 아파요. 오래 걷기는 힘들어요.',
    isRiskEvidence: true,
    sentimentLabel: '부정',
  },
  {
    question: '점심은 맛있게 드셨나요?',
    answer: '네, 잘 먹었어요. 된장찌개가 맛있었어요.',
    isRiskEvidence: false,
    sentimentLabel: '보통',
  },
]

// GUARDIAN_REPORT_01 (UC-09) — "정서 지수 산출 근거 (대화 내용)" 접이식
// 섹션. 목록 행 렌더링은 features/view-evidence-sentence에 위임한다.
export function ConversationTimeline() {
  const [isExpanded, setIsExpanded] = useState(false)

  return (
    <div className={styles.section}>
      <button
        type="button"
        className={styles.header}
        aria-expanded={isExpanded}
        aria-controls="conversation-timeline-list"
        onClick={() => setIsExpanded((current) => !current)}
      >
        정서 지수 산출 근거 (대화 내용)
        <svg
          className={[styles.chevron, isExpanded ? styles.chevronOpen : ''].join(' ')}
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>

      {isExpanded &&
        (mockEvidenceSentences.length === 0 ? (
          <p className={styles.empty}>이날은 어르신과 나눈 대화가 없어요.</p>
        ) : (
          <ul id="conversation-timeline-list" className={styles.list}>
            {mockEvidenceSentences.map((sentence) => (
              <ViewEvidenceSentenceAction key={sentence.question} sentence={sentence} />
            ))}
          </ul>
        ))}
    </div>
  )
}
```

- [ ] **Step 4: CSS 작성**

`apps/frontend/src/widgets/conversation-timeline/ui/ConversationTimeline.module.css` 신규 생성:

```css
.section {
  border-radius: 16px;
  background: var(--bg);
  border: 1px solid var(--border);
  overflow: hidden;
}

.header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  border: none;
  background: none;
  padding: 14px 16px;
  color: var(--text-h);
  font-weight: 700;
  font-size: 14px;
  cursor: pointer;
}

.chevron {
  width: 18px;
  height: 18px;
  fill: none;
  stroke: currentColor;
  stroke-width: 2;
  stroke-linecap: round;
  stroke-linejoin: round;
  transition: transform 0.15s ease;
}

.chevronOpen {
  transform: rotate(180deg);
}

.list {
  display: grid;
  gap: 6px;
  margin: 0;
  padding: 0 12px 12px;
  list-style: none;
}

.empty {
  margin: 0;
  padding: 0 16px 16px;
  color: var(--text);
  font-size: 13px;
}
```

- [ ] **Step 5: `GuardianReportPage`에서 중복 렌더링 제거**

`apps/frontend/src/pages/guardian-report/ui/GuardianReportPage.tsx`에서 `ViewEvidenceSentenceAction` import와 `<ViewEvidenceSentenceAction />` 직접 렌더링 라인을 제거한다(이제 `ConversationTimeline`이 내부에서 렌더링한다). 파일 전체를 아래로 교체:

```tsx
import { useState } from 'react'
import { SelectReportDateAction } from '../../../features/select-report-date'
import {
  ConversationSummaryCard,
  EmotionScoreCard,
  RecommendedActionCard,
} from '../../../entities/report'
import { Card } from '../../../shared/ui'
import { ConversationTimeline } from '../../../widgets/conversation-timeline'
import { BottomTabBar, GUARDIAN_TAB_ITEMS } from '../../../widgets/bottom-tab-bar'
import { ReportPeriodTabs } from '../../../widgets/report-period-tabs'
import styles from './GuardianReportPage.module.css'

// GUARDIAN_REPORT_01 (UC-08, UC-09) — 결정사항 로그 §7에서 일간/주간 탭
// 위젯과 "이날의 정서 지수"/"다슬이의 한마디"/"이날의 대화 요약" 카드를
// 추가했다. 실제 API 연결 전이라 이날의 리포트는 페이지 로컬 mock이다.
const mockDailyReport = {
  emotionScore: 93,
  emotionLevel: '좋음' as const,
  comment: '오늘은 어르신의 목소리가 밝고 활기가 느껴졌어요.',
  conversationSummary: '아침 산책과 화분 이야기를 나눴고, 전반적으로 편안한 하루를 보내셨어요.',
  recommendedAction:
    '산책 이야기를 많이 하셨어요. 요즘 즐기시는 산책길을 여쭤보시면 좋아하실 것 같아요.',
}

export function GuardianReportPage() {
  const weekStart = new Date().toISOString().slice(0, 10)
  const [selectedDate, setSelectedDate] = useState(new Date('2025-07-08T00:00:00'))

  return (
    <>
      <main className={styles.page}>
        <ReportPeriodTabs active="daily" weekStart={weekStart} />

        <SelectReportDateAction selectedDate={selectedDate} onSelectDate={setSelectedDate} />

        <Card>
          <EmotionScoreCard
            title="이날의 정서 지수"
            score={mockDailyReport.emotionScore}
            level={mockDailyReport.emotionLevel}
            comment={mockDailyReport.comment}
          />
        </Card>

        <ConversationTimeline />

        <Card>
          <ConversationSummaryCard summary={mockDailyReport.conversationSummary} />
        </Card>

        <Card>
          <RecommendedActionCard action={mockDailyReport.recommendedAction} />
        </Card>
      </main>
      <BottomTabBar items={GUARDIAN_TAB_ITEMS} />
    </>
  )
}
```

- [ ] **Step 6: lint 확인**

Run: `pnpm --filter frontend lint`
Expected: 통과

- [ ] **Step 7: 브라우저 수동 확인**

1. `/guardian/report` 열기 → "정서 지수 산출 근거 (대화 내용)" 헤더 클릭 → 목록 펼쳐짐(3개 행) 확인
2. 첫 두 행("오늘 기분은...", "무릎은...")에 연분홍 위험 강조 배경 + "부정" 배지 확인
3. 세 번째 행은 강조 없이 "보통" 배지만 확인
4. 헤더 다시 클릭 → 접힘 확인

- [ ] **Step 8: Commit**

```bash
git add apps/frontend/src/features/view-evidence-sentence apps/frontend/src/widgets/conversation-timeline apps/frontend/src/pages/guardian-report/ui/GuardianReportPage.tsx
git commit -m "feat: 근거 문장 타임라인과 위험 강조 표시 구현"
```

---

## Task 6: `widgets/emotion-trend-chart`

**Files:**
- Modify: `apps/frontend/src/widgets/emotion-trend-chart/ui/index.tsx`
- Create: `apps/frontend/src/widgets/emotion-trend-chart/ui/EmotionTrendChart.module.css`
- Modify: `apps/frontend/src/pages/guardian-weekly-report/ui/GuardianWeeklyReportPage.tsx`

**Interfaces:**
- Produces: `EmotionTrendChart({ dailyScores?: Array<{ date: string; emotionScore: number | null }> })` — `guardian-home`은 props 없이(내부 기본 mock) 렌더링, `guardian-weekly-report`는 `mockWeeklyReport.dailyScores`를 넘긴다.

- [ ] **Step 1: 인라인 SVG 선그래프 작성**

`apps/frontend/src/widgets/emotion-trend-chart/ui/index.tsx` 전체를 아래로 교체:

```tsx
import styles from './EmotionTrendChart.module.css'

interface DailyScorePoint {
  date: string
  emotionScore: number | null
}

const defaultMockScores: DailyScorePoint[] = [
  { date: '2025-06-01', emotionScore: 53 },
  { date: '2025-06-02', emotionScore: 82 },
  { date: '2025-06-03', emotionScore: null },
  { date: '2025-06-04', emotionScore: 41 },
  { date: '2025-06-05', emotionScore: 65 },
  { date: '2025-06-06', emotionScore: 52 },
  { date: '2025-06-07', emotionScore: 93 },
]

const CHART_WIDTH = 280
const CHART_HEIGHT = 140
const THRESHOLD_SCORE = 50

function scoreToY(score: number): number {
  return CHART_HEIGHT - (score / 100) * CHART_HEIGHT
}

function pointX(index: number, count: number): number {
  if (count <= 1) return 0
  return (index / (count - 1)) * CHART_WIDTH
}

// GUARDIAN_HOME_01 / 보호자 주간 리포트 (UC-08) 공유 — 최근 7일 정서지수
// 선그래프. 외부 차트 라이브러리 없이 인라인 SVG로 그린다. dailyScores를
// 넘기지 않으면 단독 렌더링(guardian-home)을 위한 기본 mock을 쓴다.
export function EmotionTrendChart({ dailyScores = defaultMockScores }: { dailyScores?: DailyScorePoint[] }) {
  const count = dailyScores.length
  const points = dailyScores.map((day, index) =>
    day.emotionScore === null ? null : { x: pointX(index, count), y: scoreToY(day.emotionScore) },
  )

  const segments: Array<Array<{ x: number; y: number }>> = []
  let current: Array<{ x: number; y: number }> = []
  for (const point of points) {
    if (point) {
      current.push(point)
    } else if (current.length > 0) {
      segments.push(current)
      current = []
    }
  }
  if (current.length > 0) segments.push(current)

  const lastPointIndex = points.reduce((last, point, index) => (point ? index : last), -1)

  return (
    <div className={styles.chart}>
      <h2 className={styles.title}>최근 7일 정서 지수</h2>
      <svg className={styles.svg} viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`} role="img" aria-label="최근 7일 정서 지수 추이">
        {[0, 25, 50, 75, 100].map((tick) => (
          <line key={tick} className={styles.gridLine} x1={0} x2={CHART_WIDTH} y1={scoreToY(tick)} y2={scoreToY(tick)} />
        ))}
        <line
          className={styles.thresholdLine}
          x1={0}
          x2={CHART_WIDTH}
          y1={scoreToY(THRESHOLD_SCORE)}
          y2={scoreToY(THRESHOLD_SCORE)}
        />
        {segments.map((segment, index) => (
          <polyline key={index} className={styles.line} points={segment.map((point) => `${point.x},${point.y}`).join(' ')} />
        ))}
        {points.map(
          (point, index) =>
            point && (
              <circle
                key={index}
                className={index === lastPointIndex ? styles.pointLast : styles.point}
                cx={point.x}
                cy={point.y}
                r={index === lastPointIndex ? 5 : 4}
              />
            ),
        )}
      </svg>
      <div className={styles.labels}>
        {dailyScores.map((day, index) => (
          <span key={day.date} className={styles.dayLabel}>
            {index === dailyScores.length - 1 ? '오늘' : day.date.slice(5).replace('-', '/')}
          </span>
        ))}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: CSS 작성**

`apps/frontend/src/widgets/emotion-trend-chart/ui/EmotionTrendChart.module.css` 신규 생성:

```css
.chart {
  border-radius: 16px;
  background: var(--bg);
  border: 1px solid var(--border);
  padding: 16px;
}

.title {
  margin: 0 0 10px;
  color: var(--text-h);
  font-size: 15px;
  font-weight: 700;
}

.svg {
  width: 100%;
  height: auto;
  overflow: visible;
}

.gridLine {
  stroke: var(--border);
  stroke-width: 1;
}

.thresholdLine {
  stroke: var(--danger);
  stroke-width: 1;
  stroke-dasharray: 4 4;
}

.line {
  fill: none;
  stroke: var(--primary);
  stroke-width: 2.5;
  stroke-linecap: round;
  stroke-linejoin: round;
}

.point {
  fill: var(--bg);
  stroke: var(--primary);
  stroke-width: 2;
}

.pointLast {
  fill: var(--primary);
  stroke: var(--bg);
  stroke-width: 2;
}

.labels {
  display: flex;
  justify-content: space-between;
  margin-top: 6px;
}

.dayLabel {
  color: var(--text);
  font-size: 11px;
}
```

`guardian-home`은 이미 `<EmotionTrendChart />`를 props 없이 렌더링 중이므로 [apps/frontend/src/pages/guardian-home/ui/GuardianHomePage.tsx](../../../apps/frontend/src/pages/guardian-home/ui/GuardianHomePage.tsx) 수정은 필요 없다(내부 기본 mock으로 단독 렌더링됨).

- [ ] **Step 3: `guardian-weekly-report`에 실제 주간 데이터 전달**

`apps/frontend/src/pages/guardian-weekly-report/ui/GuardianWeeklyReportPage.tsx`에서 `<EmotionTrendChart />` 줄만 아래로 교체:

```tsx
        <EmotionTrendChart dailyScores={mockWeeklyReport.dailyScores} />
```

(기존 `<EmotionTrendChart />` 한 줄을 위 줄로 바꾸는 것 외 다른 변경 없음 — import·나머지 JSX는 그대로 둔다.)

- [ ] **Step 4: lint 확인**

Run: `pnpm --filter frontend lint`
Expected: 통과

- [ ] **Step 5: 브라우저 수동 확인**

1. `/guardian` 열기 → "최근 7일 정서 지수" 카드에 선그래프(7개 포인트, 50점 기준 점선, 마지막 포인트 강조) 렌더링 확인, 6/3(세 번째 포인트)에서 선이 끊기는지 확인
2. `/guardian/report/weekly/2025-07-08`(또는 아무 weekStart) 열기 → 같은 그래프가 `mockWeeklyReport.dailyScores` 기준으로 렌더링되는지 확인(7/3에 해당하는 지점이 `emotionScore: null`이라 끊김 확인)

- [ ] **Step 6: Commit**

```bash
git add apps/frontend/src/widgets/emotion-trend-chart apps/frontend/src/pages/guardian-weekly-report/ui/GuardianWeeklyReportPage.tsx
git commit -m "feat: 주간 정서지수 선그래프 구현"
```

---

## Task 7: 전체 회귀 확인

**Files:** 없음(검증 전용 태스크)

- [ ] **Step 1: 전체 빌드**

Run: `pnpm --filter frontend build`
Expected: 성공 (타입 에러 없음)

- [ ] **Step 2: 전체 lint**

Run: `pnpm --filter frontend lint`
Expected: 통과

- [ ] **Step 3: 6개 화면 전체 재확인**

`pnpm --filter frontend dev`로 아래를 다시 한 번 순서대로 클릭 확인 (Task 2~6 각각의 확인 항목을 반복하지 말고, 화면 전환이 서로 깨지지 않는지만 빠르게 훑는다):

1. `/guardian` (홈) → 선그래프 렌더링
2. `/guardian/connection` → 연결 요청 폼
3. `/guardian/report` → 날짜 이동 + 근거 문장 펼치기
4. `/guardian/report/weekly/2025-07-08` → 탭 전환으로 진입, 선그래프 렌더링
5. `/guardian/notifications` → 목록 + 읽음 처리
6. `/guardian/my-info` → 기존 실장 화면이 이번 변경으로 깨지지 않았는지만 확인(변경 없음)

- [ ] **Step 4: 남은 변경 사항 확인**

Run: `git status`
Expected: 커밋되지 않은 변경 없음(Task 1~6에서 전부 커밋됨)

이 태스크는 커밋을 만들지 않는다 — 문제를 발견하면 해당 Task로 돌아가 수정 후 그 Task의 커밋을 다시 만든다.
