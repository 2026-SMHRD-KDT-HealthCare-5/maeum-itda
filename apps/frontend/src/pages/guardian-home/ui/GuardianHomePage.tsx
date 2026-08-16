import { useQuery } from '@tanstack/react-query'
import { daysSinceConnected } from '../../../entities/connection'
import {
  EmotionScoreCard,
  RecommendedActionCard,
  fetchGuardianDashboard,
} from '../../../entities/report'
import { extractApiErrorMessage } from '../../../shared/api'
import { useDelayedPending } from '../../../shared/lib'
import { Button, Card, LoadingSpinner } from '../../../shared/ui'
import daseulGuideImage from '../../../shared/assets/character/character-daseul-guide.png'
import { BottomTabBar, GUARDIAN_TAB_ITEMS } from '../../../widgets/bottom-tab-bar'
import { EmotionTrendChart } from '../../../widgets/emotion-trend-chart'
import styles from './GuardianHomePage.module.css'

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
          <div className={styles.statusMessage} role="alert">
            <p>{extractApiErrorMessage(dashboardQuery.error, '정보를 불러오지 못했어요.')}</p>
            <Button type="button" onClick={() => dashboardQuery.refetch()}>
              다시 시도
            </Button>
          </div>
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
                level={dashboard.latestDailyReport.emotionLevel}
                comment={dashboard.latestDailyReport.conversationSummary}
                variant="dashboard"
              />
            </Card>

            <EmotionTrendChart
              dailyScores={dashboard.recentSevenDays}
              detailsHref="/guardian/report/weekly/2025-06-01"
            />
          </>
        )}
      </main>
      <BottomTabBar items={GUARDIAN_TAB_ITEMS} />
    </>
  )
}
