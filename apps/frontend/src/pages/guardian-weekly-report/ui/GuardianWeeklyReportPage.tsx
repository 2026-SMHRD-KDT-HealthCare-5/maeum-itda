import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { useParams } from 'react-router-dom'
import {
  RecommendedActionCard,
  WeeklyDailySummaryList,
  WeeklyStatsCards,
  fetchReportCalendar,
  fetchWeeklyReport,
  type WeeklyReport,
} from '../../../entities/report'
import { SelectReportWeekAction } from '../../../features/select-report-week'
import daseulGuideImage from '../../../shared/assets/character/character-daseul-guide.webp'
import daseulNoDataImage from '../../../shared/assets/character/character-daseul-no-data.webp'
import { extractApiErrorMessage, isNotFoundError } from '../../../shared/api'
import { useDelayedPending } from '../../../shared/lib'
import { Button, Card, Skeleton } from '../../../shared/ui'
import { BottomTabBar, GUARDIAN_TAB_ITEMS } from '../../../widgets/bottom-tab-bar'
import { EmotionTrendChart } from '../../../widgets/emotion-trend-chart'
import { ReportPeriodTabs } from '../../../widgets/report-period-tabs'
import styles from './GuardianWeeklyReportPage.module.css'

export function GuardianWeeklyReportPage() {
  const { weekStart } = useParams<{ weekStart: string }>()
  const selectedWeekStart = weekStart ?? '2026-08-10'

  // 캘린더 모달에서 실제로 보고 있는 달 — selectedWeekStart와 별개다. 모달
  // 안에서 다른 달로 넘겨도 이 값이 갱신되어야 그 달의 주간 리포트 보유
  // 여부를 가져온다.
  const [calendarMonth, setCalendarMonth] = useState(() => {
    const [initialYear, initialMonth] = selectedWeekStart.split('-').map(Number)
    return new Date(Date.UTC(initialYear, initialMonth - 1, 1))
  })
  const calendarQuery = useQuery({
    queryKey: ['report-calendar', calendarMonth.getUTCFullYear(), calendarMonth.getUTCMonth()],
    queryFn: () =>
      fetchReportCalendar(calendarMonth.getUTCFullYear(), calendarMonth.getUTCMonth() + 1),
  })
  const weeklyReportQuery = useQuery({
    queryKey: ['weekly-report', selectedWeekStart],
    queryFn: () => fetchWeeklyReport(selectedWeekStart),
    retry: (failureCount, error) => !isNotFoundError(error) && failureCount < 2,
  })

  // react-query의 placeholderData(keepPreviousData)는 "이전 성공 데이터"만 이어줄 뿐
  // "이전 주도 리포트가 없었다(404)"는 상태는 안 이어준다 — 그래서 데이터 없는 주에서
  // 데이터 없는 주로 넘어갈 때도 fetch 도중 화면이 비었다 돌아오며 깜빡였다.
  // 성공/404 둘 다 확정 결과로 기억해뒀다가 새 주 fetch가 끝나기 전까진 그대로
  // 보여준다. useEffect 대신 렌더 중 state 조정 패턴(react.dev 권장)을 쓴다 —
  // resolvedWeekStart가 selectedWeekStart와 달라졌을 때만 갱신해 무한 렌더를 막는다.
  const [resolvedWeekStart, setResolvedWeekStart] = useState<string | null>(null)
  // 선택한 주의 성공/빈 결과가 아직 확정되지 않았을 때만 로딩을 표시한다.
  // 이미 캐시된 현재 주를 재검증할 때는 기존 리포트를 그대로 유지한다.
  const showSpinner = useDelayedPending(
    weeklyReportQuery.isFetching && resolvedWeekStart !== selectedWeekStart,
  )
  const [resolvedView, setResolvedView] = useState<
    { kind: 'found'; report: WeeklyReport } | { kind: 'missing' } | null
  >(null)
  const queryReportMissing = weeklyReportQuery.isError && isNotFoundError(weeklyReportQuery.error)

  if (resolvedWeekStart !== selectedWeekStart && weeklyReportQuery.isSuccess) {
    setResolvedWeekStart(selectedWeekStart)
    setResolvedView({ kind: 'found', report: weeklyReportQuery.data })
  } else if (resolvedWeekStart !== selectedWeekStart && queryReportMissing) {
    setResolvedWeekStart(selectedWeekStart)
    setResolvedView({ kind: 'missing' })
  }

  const report =
    resolvedWeekStart === selectedWeekStart && resolvedView?.kind === 'found'
      ? resolvedView.report
      : null
  const reportMissing = resolvedWeekStart === selectedWeekStart && resolvedView?.kind === 'missing'

  return (
    <>
      <main className={styles.page}>
        <ReportPeriodTabs active="weekly" weekStart={selectedWeekStart} />

        <SelectReportWeekAction
          weekStart={selectedWeekStart}
          weeksWithReport={calendarQuery.data?.weekStartsWithWeeklyReport ?? new Set()}
          onVisibleMonthChange={setCalendarMonth}
        />

        {showSpinner && (
          <div className={styles.loadingState} role="status" aria-live="polite">
            <span className={styles.loadingLabel}>리포트를 불러오고 있어요</span>
            <Skeleton className={styles.trendSkeleton} />
            <Skeleton className={styles.recommendationSkeleton} />
            <Skeleton className={styles.listSkeleton} />
          </div>
        )}

        {weeklyReportQuery.isError && !reportMissing && (
          <div className={styles.statusMessage} role="alert">
            <p>{extractApiErrorMessage(weeklyReportQuery.error, '리포트를 불러오지 못했어요.')}</p>
            <Button type="button" onClick={() => weeklyReportQuery.refetch()}>
              다시 시도
            </Button>
          </div>
        )}

        {report && (
          <>
            <section
              className={styles.trendSection}
              aria-label="주간 정서 지수와 요약 통계"
              key={`trend-${selectedWeekStart}`}
            >
              <EmotionTrendChart
                dailyScores={report.dailyScores}
                highlightToday={false}
                title="주간 정서 지수"
              />
              <div className={styles.statsPanel}>
                <WeeklyStatsCards
                  averageScore={report.averageScore}
                  maxScore={report.maxScore}
                  minScore={report.minScore}
                />
              </div>
            </section>

            <section
              className={styles.recommendationSection}
              aria-label="다슬이의 한마디"
              key={`recommendation-${selectedWeekStart}`}
            >
              <img className={styles.recommendationCharacter} src={daseulGuideImage} alt="" />
              <Card className={styles.recommendationCard}>
                <RecommendedActionCard action={report.recommendedAction} variant="report" />
              </Card>
            </section>

            <section
              className={styles.dailySection}
              aria-labelledby="weekly-daily-summary-title"
              key={`daily-${selectedWeekStart}`}
            >
              <div className={styles.sectionHeader}>
                <h2 id="weekly-daily-summary-title">일별 요약</h2>
                <p>카드를 탭하면 일간 리포트로 이동해요</p>
              </div>
              <WeeklyDailySummaryList dailyScores={report.dailyScores} />
            </section>
          </>
        )}

        {reportMissing && (
          <section
            className={styles.emptyState}
            aria-labelledby="weekly-report-empty-title"
            key={`weekly-empty-${selectedWeekStart}`}
          >
            <img
              className={styles.emptyCharacter}
              src={daseulNoDataImage}
              alt="리포트 기록이 없어 아쉬워하는 다슬"
            />
            <h2 id="weekly-report-empty-title" className={styles.emptyTitle}>
              이 주에는 확인할 수 있는 리포트가 없어요
            </h2>
            <p className={styles.emptyHint}>
              대화가 진행된 다른 주를 선택하면 어르신의 정서 흐름과 일별 요약을 확인할 수 있어요.
            </p>
          </section>
        )}
      </main>
      <BottomTabBar items={GUARDIAN_TAB_ITEMS} />
    </>
  )
}
