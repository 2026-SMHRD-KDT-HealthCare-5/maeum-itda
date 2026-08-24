import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  DailyConversationList,
  fetchConversationCalendar,
  fetchConversationHistoryByDate,
  type ChatMessage,
} from '../../../entities/conversation'
import { SelectDailyRecordDateAction } from '../../../features/select-daily-record-date'
import { toDateKey } from '../../../features/select-daily-record-date/model'
import { extractApiErrorMessage } from '../../../shared/api'
import { useDelayedPending } from '../../../shared/lib'
import { Button, LoadingSpinner } from '../../../shared/ui'
import { BottomTabBar, SENIOR_TAB_ITEMS } from '../../../widgets/bottom-tab-bar'
import daseulNoDataImage from '../../../shared/assets/character/character-daseul-no-data.webp'
import styles from './SeniorDailyRecordPage.module.css'

// UC-14/FR-01-09 — GET /chats/messages?date=, /chats/calendar 실연동. 백엔드가
// 날짜별 "요약" 문구를 별도로 만들어주지 않아(UC-06-4는 보호자용 일간 요약만
// 생성) 예전 mock에 있던 "요약해 드릴게요" 카드는 실제 데이터가 없어 뺐다.
export function SeniorDailyRecordPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const [selectedDate, setSelectedDate] = useState(() => {
    const dateParam = searchParams.get('date')
    if (dateParam && /^\d{4}-\d{2}-\d{2}$/.test(dateParam)) {
      const date = new Date(`${dateParam}T00:00:00`)
      if (!Number.isNaN(date.getTime()) && toDateKey(date) === dateParam) return date
    }
    return new Date()
  })
  const dateKey = toDateKey(selectedDate)

  const calendarQuery = useQuery({
    queryKey: ['conversation-calendar', selectedDate.getFullYear(), selectedDate.getMonth()],
    queryFn: () =>
      fetchConversationCalendar(selectedDate.getFullYear(), selectedDate.getMonth() + 1),
  })
  const messagesQuery = useQuery({
    queryKey: ['conversation-history', dateKey],
    queryFn: () => fetchConversationHistoryByDate(dateKey),
  })

  // isPending만 보면 날짜를 넘길 때마다(새 쿼리 키라 매번 isPending이 다시 true)
  // 화면이 비었다가 말풍선이 새로 뜨는 것처럼 보인다 — 직전 날짜의 결과(빈
  // 목록이었어도)를 그대로 기억해뒀다가 새 날짜 fetch가 끝나기 전까진 그걸
  // 계속 보여준다. useEffect 대신 렌더 중 state 조정 패턴(react.dev 권장)을
  // 쓴다 — resolvedDateKey가 dateKey와 달라졌을 때만 갱신해 무한 렌더를 막는다.
  const [resolvedDateKey, setResolvedDateKey] = useState<string | null>(null)
  const [resolvedMessages, setResolvedMessages] = useState<ChatMessage[] | null>(null)
  // 선택한 날짜의 확정 결과가 없을 때만 로딩을 표시한다. 캐시된 날짜의
  // 백그라운드 재검증은 기존 화면을 유지하되, 새 날짜에 이전 기록을 노출하지 않는다.
  const showSpinner = useDelayedPending(messagesQuery.isFetching && resolvedDateKey !== dateKey)

  if (resolvedDateKey !== dateKey && messagesQuery.isSuccess) {
    setResolvedDateKey(dateKey)
    setResolvedMessages(messagesQuery.data)
  }

  const messages = resolvedDateKey === dateKey ? resolvedMessages : null

  function selectDate(date: Date) {
    setSelectedDate(date)
    setSearchParams({ date: toDateKey(date) }, { replace: true })
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  return (
    <>
      <main className={styles.page}>
        <SelectDailyRecordDateAction
          selectedDate={selectedDate}
          onSelectDate={selectDate}
          datesWithConversation={calendarQuery.data ?? new Set()}
        />

        <div className={styles.content}>
          {showSpinner && (
            <div className={styles.loadingState}>
              <LoadingSpinner label="대화 기록을 불러오고 있어요" />
            </div>
          )}

          {messagesQuery.isError && (
            <div className={styles.statusMessage} role="alert">
              <p>{extractApiErrorMessage(messagesQuery.error, '대화 기록을 불러오지 못했어요.')}</p>
              <Button type="button" onClick={() => messagesQuery.refetch()}>
                다시 시도
              </Button>
            </div>
          )}

          {messages && messages.length > 0 && <DailyConversationList messages={messages} />}

          {messages && messages.length === 0 && (
            <div className={styles.emptyState}>
              <img
                className={styles.emptyCharacter}
                src={daseulNoDataImage}
                alt="대화 기록이 없어 아쉬워하는 다슬"
              />
              <p className={styles.emptyTitle}>이 날은 다슬이와 대화를 나누지 않았어요</p>
              <p className={styles.emptyHint}>
                다른 날의 대화 기록을 확인하시려면 상단의 날짜를 눌러 선택해 주세요.
              </p>
            </div>
          )}
        </div>
      </main>
      <BottomTabBar items={SENIOR_TAB_ITEMS} />
    </>
  )
}
