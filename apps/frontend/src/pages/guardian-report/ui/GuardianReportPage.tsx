import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { SelectReportDateAction, toDateKey } from '../../../features/select-report-date'
import {
  ConversationSummaryCard,
  EmotionScoreCard,
  RecommendedActionCard,
} from '../../../entities/report'
import { Card } from '../../../shared/ui'
import daseulGuideImage from '../../../shared/assets/character/character-daseul-guide.png'
import daseulNoDataImage from '../../../shared/assets/character/character-daseul-no-data.png'
import daseulSummaryImage from '../../../shared/assets/character/character-daseul-summary.png'
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
  conversationSummary:
    '어르신은 아침에 동네 공원을 산책하고 집에 돌아와 화분에 물을 주셨다고 말씀하셨어요. 무릎이 조금 불편했지만 쉬고 나니 괜찮아졌고, 오후에는 가족 생각이 나서 사진을 보며 시간을 보내셨다고 해요. 대화 전반에서 차분하고 안정적인 모습을 보이셨습니다.',
  recommendedAction:
    '오늘은 가족을 그리워하는 마음을 여러 번 표현하셨어요. 저녁 무렵 짧게 안부 전화를 드리고, 산책 중 보신 풍경이나 요즘 돌보고 계신 화분에 관해 물어봐 주세요. 무릎이 계속 불편한지도 함께 확인해 주시면 좋겠습니다.',
}

const mockReportsByDate: Record<string, typeof mockDailyReport> = {
  '2026-08-12': mockDailyReport,
}
const datesWithReport = new Set(Object.keys(mockReportsByDate))

export function GuardianReportPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const requestedDate = searchParams.get('date')
  const [selectedDate, setSelectedDate] = useState(() =>
    requestedDate ? new Date(`${requestedDate}T00:00:00`) : new Date(),
  )
  const weekStart = toDateKey(selectedDate)
  const report = mockReportsByDate[toDateKey(selectedDate)]

  function selectDate(date: Date) {
    setSelectedDate(date)
    setSearchParams({ date: toDateKey(date) }, { replace: true })
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  return (
    <>
      <main className={styles.page}>
        <ReportPeriodTabs active="daily" weekStart={weekStart} />

        <SelectReportDateAction
          selectedDate={selectedDate}
          onSelectDate={selectDate}
          datesWithReport={datesWithReport}
        />

        {report ? (
          <>
            <Card className={styles.scoreCard}>
              <EmotionScoreCard
                title="이날의 정서 지수"
                score={report.emotionScore}
                level={report.emotionLevel}
                comment={report.comment}
                variant="dashboard"
              />
            </Card>

            <ConversationTimeline />

            <section className={styles.summarySection} aria-label="이날의 대화 요약">
              <Card className={styles.summaryCard}>
                <ConversationSummaryCard summary={report.conversationSummary} />
              </Card>
              <img className={styles.summaryCharacter} src={daseulSummaryImage} alt="" />
            </section>

            <section className={styles.recommendationSection} aria-label="다슬이의 한마디">
              <img className={styles.recommendationCharacter} src={daseulGuideImage} alt="" />
              <Card className={styles.recommendationCard}>
                <RecommendedActionCard action={report.recommendedAction} variant="report" />
              </Card>
            </section>
          </>
        ) : (
          <section className={styles.emptyState} aria-labelledby="guardian-report-empty-title">
            <img
              className={styles.emptyCharacter}
              src={daseulNoDataImage}
              alt="리포트 기록이 없어 아쉬워하는 다슬"
            />
            <h2 id="guardian-report-empty-title" className={styles.emptyTitle}>
              이날은 확인할 수 있는 리포트가 없어요
            </h2>
            <p className={styles.emptyHint}>
              대화가 진행된 다른 날짜를 선택하면 어르신의 정서 지수와 대화 요약을 확인할 수 있어요.
            </p>
          </section>
        )}
      </main>
      <BottomTabBar items={GUARDIAN_TAB_ITEMS} />
    </>
  )
}
