import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { useParams } from 'react-router-dom'
import {
  RecommendedActionCard,
  WeeklyDailySummaryList,
  WeeklyStatsCards,
  fetchReportCalendar,
  fetchWeeklyReport,
} from '../../../entities/report'
import { SelectReportWeekAction } from '../../../features/select-report-week'
import daseulGuideImage from '../../../shared/assets/character/character-daseul-guide.png'
import daseulNoDataImage from '../../../shared/assets/character/character-daseul-no-data.png'
import { extractApiErrorMessage, isNotFoundError } from '../../../shared/api'
import { useDelayedPending } from '../../../shared/lib'
import { Button, Card, LoadingSpinner } from '../../../shared/ui'
import { BottomTabBar, GUARDIAN_TAB_ITEMS } from '../../../widgets/bottom-tab-bar'
import { EmotionTrendChart } from '../../../widgets/emotion-trend-chart'
import { ReportPeriodTabs } from '../../../widgets/report-period-tabs'
import styles from './GuardianWeeklyReportPage.module.css'

export function GuardianWeeklyReportPage() {
  const { weekStart } = useParams<{ weekStart: string }>()
  const selectedWeekStart = weekStart ?? '2026-08-10'
  const [year, month] = selectedWeekStart.split('-').map(Number)

  const calendarQuery = useQuery({
    queryKey: ['report-calendar', year, month - 1],
    queryFn: () => fetchReportCalendar(year, month),
  })
  const weeklyReportQuery = useQuery({
    queryKey: ['weekly-report', selectedWeekStart],
    queryFn: () => fetchWeeklyReport(selectedWeekStart),
    retry: (failureCount, error) => !isNotFoundError(error) && failureCount < 2,
    placeholderData: keepPreviousData,
  })

  // isPending 대신 isFetching — placeholderData(keepPreviousData)로 주가 바뀌어도
  // isPending은 계속 false다.
  const showSpinner = useDelayedPending(weeklyReportQuery.isFetching)
  // isPlaceholderData인 동안 data는 이전 주 값이다 — 그대로 노출하면 다른 주
  // 카드가 잠깐 보였다 사라지는 것처럼 보이므로, fetch가 끝나 이 주 값으로
  // 확정되기 전까지는 비워서 스피너만 보이게 한다.
  const report = weeklyReportQuery.isPlaceholderData ? undefined : weeklyReportQuery.data
  const reportMissing = weeklyReportQuery.isError && isNotFoundError(weeklyReportQuery.error)

  return (
    <>
      <main className={styles.page}>
        <ReportPeriodTabs active="weekly" weekStart={selectedWeekStart} />

        <SelectReportWeekAction
          weekStart={selectedWeekStart}
          weeksWithReport={calendarQuery.data?.weekStartsWithWeeklyReport ?? new Set()}
        />

        {showSpinner && (
          <div className={styles.loadingState}>
            <LoadingSpinner label="리포트를 불러오고 있어요" />
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
            <section className={styles.trendSection} aria-label="주간 정서 지수와 요약 통계">
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

            <section className={styles.recommendationSection} aria-label="다슬이의 한마디">
              <img className={styles.recommendationCharacter} src={daseulGuideImage} alt="" />
              <Card className={styles.recommendationCard}>
                <RecommendedActionCard action={report.recommendedAction} variant="report" />
              </Card>
            </section>

            <section className={styles.dailySection} aria-labelledby="weekly-daily-summary-title">
              <div className={styles.sectionHeader}>
                <h2 id="weekly-daily-summary-title">일별 요약</h2>
                <p>카드를 탭하면 일간 리포트로 이동해요</p>
              </div>
              <WeeklyDailySummaryList dailyScores={report.dailyScores} />
            </section>
          </>
        )}

        {reportMissing && (
          <section className={styles.emptyState} aria-labelledby="weekly-report-empty-title">
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
