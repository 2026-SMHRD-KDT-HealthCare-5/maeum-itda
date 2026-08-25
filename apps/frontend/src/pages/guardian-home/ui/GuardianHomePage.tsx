import { useQuery } from '@tanstack/react-query'
import { daysSinceConnected } from '../../../entities/connection'
import {
  EmotionScoreCard,
  RecommendedActionCard,
  fetchGuardianDashboard,
} from '../../../entities/report'
import { extractApiErrorMessage } from '../../../shared/api'
import { useDelayedPending } from '../../../shared/lib'
import { Card, ErrorState, LoadingSpinner } from '../../../shared/ui'
import daseulGuideImage from '../../../shared/assets/character/character-daseul-guide.webp'
import { BottomTabBar, GUARDIAN_TAB_ITEMS } from '../../../widgets/bottom-tab-bar'
import { EmotionTrendChart } from '../../../widgets/emotion-trend-chart'
import styles from './GuardianHomePage.module.css'

// 대시보드의 최근 7일은 전날까지의 이동 구간이라 두 주에 걸칠 수 있다.
// 첫 날짜가 속한 월요일을 사용해, 카드에서 이미 완료된 주간 리포트로 이어지게 한다.
function toWeeklyReportHref(firstDate: string | undefined): string {
  if (!firstDate) return '/guardian/report'

  const date = new Date(`${firstDate}T00:00:00Z`)
  if (Number.isNaN(date.getTime())) return '/guardian/report'

  const day = date.getUTCDay()
  date.setUTCDate(date.getUTCDate() + (day === 0 ? -6 : 1 - day))
  return `/guardian/report/weekly/${date.toISOString().slice(0, 10)}`
}

// GUARDIAN_HOME_01 (UC-08) — 결정사항 로그 §7에서 "오늘의 정서 지수"/"다슬이의
// 한마디" 카드를 추가했다. GET /guardian/dashboard 실연동.
export function GuardianHomePage() {
  const dashboardQuery = useQuery({
    queryKey: ['guardian-dashboard'],
    queryFn: fetchGuardianDashboard,
  })
  const showSpinner = useDelayedPending(dashboardQuery.isPending)
  const dashboard = dashboardQuery.data

  return (
    <>
      <main className={styles.page}>
        {showSpinner && <LoadingSpinner overlay label="오늘의 소식을 불러오고 있어요" />}

        {!showSpinner && dashboardQuery.isError && (
          <ErrorState
            message={extractApiErrorMessage(dashboardQuery.error, '정보를 불러오지 못했어요.')}
            onRetry={() => void dashboardQuery.refetch()}
            isRetrying={dashboardQuery.isFetching}
          />
        )}

        {!showSpinner && dashboard && (
          <>
            <header className={styles.greeting}>
              <h1>{dashboard.guardianName}님 안녕하세요.</h1>
              <p>
                {dashboard.seniorName} 어르신과 함께한 지{' '}
                {daysSinceConnected(dashboard.seniorConnectedAt)}일 되었어요!
              </p>
            </header>

            <section className={styles.recommendation} aria-label="다슬이의 한마디">
              <img className={styles.guideCharacter} src={daseulGuideImage} alt="" />
              <Card className={styles.recommendationCard}>
                <RecommendedActionCard action={dashboard.dasolMessage} variant="dashboard" />
              </Card>
            </section>

            <Card className={styles.scoreCard}>
              <EmotionScoreCard
                detailsHref="/guardian/report"
                title="오늘의 정서 지수"
                score={dashboard.latestDailyReport.emotionScore}
                variant="dashboard"
              />
            </Card>

            <EmotionTrendChart
              dailyScores={dashboard.recentSevenDays}
              detailsHref={toWeeklyReportHref(dashboard.recentSevenDays[0]?.date)}
            />
          </>
        )}
      </main>
      <BottomTabBar items={GUARDIAN_TAB_ITEMS} />
    </>
  )
}
