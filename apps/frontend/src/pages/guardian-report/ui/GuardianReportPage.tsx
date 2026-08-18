import { keepPreviousData, useQuery } from '@tanstack/react-query'
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

  // 캘린더 모달에서 실제로 보고 있는 달 — selectedDate와 별개다. 모달 안에서
  // 다른 달로 넘겨도 이 값이 갱신되어야 그 달의 리포트 보유 여부를 가져온다.
  const [calendarMonth, setCalendarMonth] = useState(
    () => new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1),
  )
  const calendarQuery = useQuery({
    queryKey: ['report-calendar', calendarMonth.getFullYear(), calendarMonth.getMonth()],
    queryFn: () => fetchReportCalendar(calendarMonth.getFullYear(), calendarMonth.getMonth() + 1),
  })
  const dailyReportQuery = useQuery({
    queryKey: ['daily-report', dateKey],
    queryFn: () => fetchDailyReport(dateKey),
    retry: (failureCount, error) => !isNotFoundError(error) && failureCount < 2,
    placeholderData: keepPreviousData,
  })

  // isPending 대신 isFetching을 봐야 한다: placeholderData(keepPreviousData) 덕에
  // 날짜를 넘겨도 이전 날짜 데이터가 즉시 남아있어 isPending은 계속 false다 —
  // 그 상태에서 fetch 진행 중임을 알려주려면 isFetching이 필요하다.
  const showSpinner = useDelayedPending(dailyReportQuery.isFetching)
  // isPlaceholderData인 동안의 data는 "새 날짜의 값"이 아니라 아직 남아있는
  // 이전 날짜 값이다 — 그대로 report로 노출하면 다른 날짜 카드가 잠깐 보였다
  // 사라지는 것처럼 보인다. fetch가 끝나 진짜 이 날짜의 값(성공/404)으로
  // 확정되기 전까지는 report를 비워 스피너만 보이게 한다.
  const report = dailyReportQuery.isPlaceholderData ? undefined : dailyReportQuery.data
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
          onVisibleMonthChange={setCalendarMonth}
        />

        {showSpinner && (
          <div className={styles.loadingState}>
            <LoadingSpinner label="리포트를 불러오고 있어요" />
          </div>
        )}

        {dailyReportQuery.isError && !reportMissing && (
          <div className={styles.statusMessage} role="alert">
            <p>{extractApiErrorMessage(dailyReportQuery.error, '리포트를 불러오지 못했어요.')}</p>
            <Button type="button" onClick={() => dailyReportQuery.refetch()}>
              다시 시도
            </Button>
          </div>
        )}

        {report && (
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

        {reportMissing && (
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
