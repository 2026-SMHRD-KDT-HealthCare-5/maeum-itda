import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import type { ConversationTurn } from '../../../entities/conversation'
import { DailyConversationList } from '../../../entities/conversation'
import { SelectDailyRecordDateAction } from '../../../features/select-daily-record-date'
import { toDateKey } from '../../../features/select-daily-record-date/model'
import { BottomTabBar, SENIOR_TAB_ITEMS } from '../../../widgets/bottom-tab-bar'
import daseulNoDataImage from '../../../shared/assets/character/character-daseul-no-data.png'
import daseulSummaryImage from '../../../shared/assets/character/character-daseul-summary.png'
import styles from './SeniorDailyRecordPage.module.css'

// UC-14/FR-01-09 — 결정사항 로그 §5/§7. 실제 API 연결 전이라 날짜별 turn과
// 다슬이의 하루 요약 코멘트는 페이지 로컬 mock 데이터로 둔다.
const mockRecordsByDate: Record<string, { turns: ConversationTurn[]; comment: string }> = {
  '2025-06-12': {
    turns: [
      {
        id: 'turn-1',
        seniorId: 'senior-1',
        createdAt: '2025-06-12T00:30:00.000Z',
        question: '어르신, 오늘 아침은 잘 보내셨어요?',
        answer: '응, 아침을 먹고 화분에 물도 줬어.',
        answeredAt: '2025-06-12T00:31:00.000Z',
        sentimentLabel: null,
        sentimentNote: null,
      },
      {
        id: 'turn-2',
        seniorId: 'senior-1',
        createdAt: '2025-06-12T00:32:00.000Z',
        question: '화분을 돌보셨군요. 어떤 꽃을 키우고 계세요?',
        answer: '분홍색 제라늄인데 요즘 꽃이 많이 피었어.',
        answeredAt: '2025-06-12T00:33:00.000Z',
        sentimentLabel: null,
        sentimentNote: null,
      },
    ],
    comment:
      '저희 이날은 어르신의 하루 일과에 대한 이야기를 나눴었네요! 아침도 드시고, 키우고 계시는 분홍색 제라늄엔 꽃이 많이 피었댔어요.',
  },
}

export function SeniorDailyRecordPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const [selectedDate, setSelectedDate] = useState(() => {
    const dateParam = searchParams.get('date')
    if (dateParam && /^\d{4}-\d{2}-\d{2}$/.test(dateParam)) {
      const date = new Date(`${dateParam}T00:00:00`)
      if (!Number.isNaN(date.getTime()) && toDateKey(date) === dateParam) return date
    }
    return new Date('2025-06-12T00:00:00')
  })
  const [isSummaryExpanded, setIsSummaryExpanded] = useState(false)
  const datesWithConversation = new Set(Object.keys(mockRecordsByDate))
  const record = mockRecordsByDate[toDateKey(selectedDate)]

  function selectDate(date: Date) {
    setSelectedDate(date)
    setIsSummaryExpanded(false)
    setSearchParams({ date: toDateKey(date) }, { replace: true })
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  return (
    <>
      <main className={styles.page}>
        <SelectDailyRecordDateAction
          selectedDate={selectedDate}
          onSelectDate={selectDate}
          datesWithConversation={datesWithConversation}
        />

        <div className={styles.content}>
          {record ? (
            <>
              <section className={styles.summary} aria-labelledby="daily-summary-title">
                <div className={styles.summaryCard}>
                  <p className={styles.summaryLabel}>요약해 드릴게요!</p>
                  <h2
                    id="daily-summary-title"
                    className={`${styles.summaryText} ${
                      isSummaryExpanded ? styles.summaryTextExpanded : ''
                    }`}
                  >
                    {record.comment}
                  </h2>
                  <button
                    type="button"
                    className={styles.summaryToggle}
                    aria-expanded={isSummaryExpanded}
                    aria-controls="daily-summary-title"
                    onClick={() => setIsSummaryExpanded((current) => !current)}
                  >
                    {isSummaryExpanded ? '접기' : '더보기'}
                  </button>
                </div>
                <img
                  className={styles.summaryCharacter}
                  src={daseulSummaryImage}
                  alt="지난 대화를 요약해 주는 다슬"
                />
              </section>
              <DailyConversationList turns={record.turns} />
            </>
          ) : (
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
