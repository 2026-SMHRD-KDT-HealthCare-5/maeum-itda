import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { SelectReportDateAction, toDateKey } from '../../../features/select-report-date'
import {
  ConversationSummaryCard,
  EmotionScoreCard,
  RecommendedActionCard,
  fetchDailyReport,
  fetchReportCalendar,
} from '../../../entities/report'
import { extractApiErrorMessage, isNotFoundError } from '../../../shared/api'
import { useDelayedPending } from '../../../shared/lib'
import { Button, Card, LoadingSpinner } from '../../../shared/ui'
import daseulGuideImage from '../../../shared/assets/character/character-daseul-guide.png'
import daseulNoDataImage from '../../../shared/assets/character/character-daseul-no-data.png'
import daseulSummaryImage from '../../../shared/assets/character/character-daseul-summary.png'
import { ConversationTimeline } from '../../../widgets/conversation-timeline'
import { BottomTabBar, GUARDIAN_TAB_ITEMS } from '../../../widgets/bottom-tab-bar'
import { ReportPeriodTabs } from '../../../widgets/report-period-tabs'
import styles from './GuardianReportPage.module.css'

// GUARDIAN_REPORT_01 (UC-08, UC-09) — 결정사항 로그 §7에서 일간/주간 탭
// 위젯과 "이날의 정서 지수"/"다슬이의 한마디"/"이날의 대화 요약" 카드를
// 추가했다. GET /reports/daily, /reports/calendar 실연동.
export function GuardianReportPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const requestedDate = searchParams.get('date')
  const [selectedDate, setSelectedDate] = useState(() =>
    requestedDate ? new Date(`${requestedDate}T00:00:00`) : new Date(),
  )
  const dateKey = toDateKey(selectedDate)

  const calendarQuery = useQuery({
    queryKey: ['report-calendar', selectedDate.getFullYear(), selectedDate.getMonth()],
    queryFn: () => fetchReportCalendar(selectedDate.getFullYear(), selectedDate.getMonth() + 1),
  })
  const dailyReportQuery = useQuery({
    queryKey: ['daily-report', dateKey],
    queryFn: () => fetchDailyReport(dateKey),
    retry: (failureCount, error) => !isNotFoundError(error) && failureCount < 2,
  })

  const showSpinner = useDelayedPending(dailyReportQuery.isPending)
  const report = dailyReportQuery.data
  const reportMissing = dailyReportQuery.isError && isNotFoundError(dailyReportQuery.error)

  function selectDate(date: Date) {
    setSelectedDate(date)
    setSearchParams({ date: toDateKey(date) }, { replace: true })
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  return (
    <>
      <main className={styles.page}>
        <ReportPeriodTabs active="daily" weekStart={dateKey} />

        <SelectReportDateAction
          selectedDate={selectedDate}
          onSelectDate={selectDate}
          datesWithReport={calendarQuery.data?.datesWithDailyReport ?? new Set()}
        />

        {showSpinner && <LoadingSpinner overlay label="리포트를 불러오고 있어요" />}

        {!showSpinner && dailyReportQuery.isError && !reportMissing && (
          <div className={styles.statusMessage} role="alert">
            <p>{extractApiErrorMessage(dailyReportQuery.error, '리포트를 불러오지 못했어요.')}</p>
            <Button type="button" onClick={() => dailyReportQuery.refetch()}>
              다시 시도
            </Button>
          </div>
        )}

        {!showSpinner && report && (
          <>
            <Card className={styles.scoreCard}>
              <EmotionScoreCard
                title="이날의 정서 지수"
                score={report.emotionScore}
                level={report.emotionLevel}
                comment={report.conversationSummary}
                variant="dashboard"
              />
            </Card>

            <ConversationTimeline evidences={report.evidenceSentences} />

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
        )}

        {!showSpinner && reportMissing && (
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
