import { useState } from 'react'
import type { ConversationTurn } from '../../../entities/conversation'
import { DailyConversationList } from '../../../entities/conversation'
import { SelectDailyRecordDateAction } from '../../../features/select-daily-record-date'
import { toDateKey } from '../../../features/select-daily-record-date/model'
import { BottomTabBar, SENIOR_TAB_ITEMS } from '../../../widgets/bottom-tab-bar'
import styles from './SeniorDailyRecordPage.module.css'

// UC-14/FR-01-09 — 결정사항 로그 §5/§7. 실제 API 연결 전이라 날짜별 turn과
// 다솔이의 하루 요약 코멘트는 페이지 로컬 mock 데이터로 둔다.
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
    comment: '저희 이날은 어르신의 하루 일과에 대한 이야기를 나눴었네요!',
  },
}

export function SeniorDailyRecordPage() {
  const [selectedDate, setSelectedDate] = useState(() => new Date('2025-06-12T00:00:00'))
  const datesWithConversation = new Set(Object.keys(mockRecordsByDate))
  const record = mockRecordsByDate[toDateKey(selectedDate)]

  return (
    <>
      <main className={styles.page}>
        <SelectDailyRecordDateAction
          selectedDate={selectedDate}
          onSelectDate={setSelectedDate}
          datesWithConversation={datesWithConversation}
        />

        <div className={styles.content}>
          {record ? (
            <>
              <DailyConversationList turns={record.turns} />
              <div className={styles.summaryCard}>
                <span className={styles.summaryIcon} aria-hidden="true">
                  🐾
                </span>
                <p className={styles.summaryText}>{record.comment}</p>
              </div>
            </>
          ) : (
            <div className={styles.emptyState}>
              <span className={styles.emptyIcon} aria-hidden="true">
                💬
              </span>
              <p className={styles.emptyTitle}>이 날은 다슬이와 대화를 나누지 않았어요.</p>
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
