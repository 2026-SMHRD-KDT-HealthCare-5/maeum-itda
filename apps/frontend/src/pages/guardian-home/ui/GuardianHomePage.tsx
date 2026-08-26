import { useQuery } from '@tanstack/react-query'
import { FiBarChart2, FiBell, FiChevronRight, FiFileText, FiMessageCircle } from 'react-icons/fi'
import { useNavigate } from 'react-router-dom'
import {
  CONNECTION_QUERY_KEY,
  daysSinceConnected,
  fetchMyConnection,
} from '../../../entities/connection'
import {
  EmotionScoreCard,
  RecommendedActionCard,
  fetchGuardianDashboard,
} from '../../../entities/report'
import { useSession } from '../../../entities/user'
import { extractApiErrorMessage, isNotFoundError } from '../../../shared/api'
import { useDelayedPending } from '../../../shared/lib'
import { Button, Card, ErrorState, LoadingSpinner } from '../../../shared/ui'
import daseulGuideImage from '../../../shared/assets/character/character-daseul-guide.webp'
import daseulLinkImage from '../../../shared/assets/character/character-daseul-link.png'
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

// GUARDIAN_HOME_01 (UC-08) — GET /connections/me로 연결 여부를 먼저 확인해
// 미연결 보호자에게는 즉시 연결 CTA를 보여주고, 연결된 경우에만 상대적으로 무거운
// GET /guardian/dashboard를 호출해 정서 지수·다슬이의 한마디·추이를 조합한다.
export function GuardianHomePage() {
  const { session } = useSession()
  const navigate = useNavigate()
  const connectionQuery = useQuery({
    queryKey: CONNECTION_QUERY_KEY,
    queryFn: fetchMyConnection,
  })
  const hasConnectedSenior = connectionQuery.data?.status === 'CONNECTED'
  const dashboardQuery = useQuery({
    queryKey: ['guardian-dashboard'],
    queryFn: fetchGuardianDashboard,
    enabled: hasConnectedSenior,
  })
  const isPagePending =
    connectionQuery.isPending || (hasConnectedSenior && dashboardQuery.isPending)
  const showSpinner = useDelayedPending(isPagePending, { delay: 120, minDuration: 250 })
  const dashboard = dashboardQuery.data
  const hasNoConnectedSenior =
    connectionQuery.isSuccess &&
    (!hasConnectedSenior || (dashboardQuery.isError && isNotFoundError(dashboardQuery.error)))
  const pageError = connectionQuery.error ?? dashboardQuery.error

  return (
    <>
      <main className={styles.page}>
        {showSpinner && <LoadingSpinner overlay label="오늘의 소식을 불러오고 있어요" />}

        {!showSpinner && pageError && !hasNoConnectedSenior && (
          <ErrorState
            message={extractApiErrorMessage(pageError, '정보를 불러오지 못했어요.')}
            onRetry={() => {
              if (connectionQuery.isError) void connectionQuery.refetch()
              else void dashboardQuery.refetch()
            }}
            isRetrying={connectionQuery.isFetching || dashboardQuery.isFetching}
          />
        )}

        {!showSpinner && hasNoConnectedSenior && (
          <div className={styles.emptyHome}>
            <header className={styles.emptyGreeting}>
              <h1>{session?.name ?? '보호자'}님, 반가워요</h1>
              <p>소중한 분과 연결하고 안부를 살펴보세요</p>
            </header>

            <section className={styles.connectionStage} aria-labelledby="empty-connection-title">
              <div className={styles.connectionCharacter}>
                <img src={daseulLinkImage} alt="하트 모양 연결 고리를 이어 붙이는 다슬이" />
              </div>
              <Card className={styles.connectionCard}>
                <div className={styles.connectionCopy}>
                  <h2 id="empty-connection-title">소중한 분과 아직 연결되지 않았어요</h2>
                  <p>
                    시니어 아이디로 연결 요청을 보내고
                    <br />
                    수락 후 매일의 안부를 함께 살펴보세요.
                  </p>
                </div>
                <Button type="button" onClick={() => navigate('/guardian/connection')}>
                  <span>시니어 연결하기</span>
                  <FiChevronRight aria-hidden="true" />
                </Button>
                <p className={styles.connectionHint}>연결 요청은 시니어가 수락하면 완료돼요</p>
              </Card>
            </section>

            <section className={styles.benefits} aria-labelledby="connection-benefits-title">
              <h2 id="connection-benefits-title">연결하면 이용할 수 있어요</h2>
              <Card className={styles.benefitCard}>
                <div className={styles.benefitItem}>
                  <span className={styles.benefitIcon}>
                    <FiFileText aria-hidden="true" />
                  </span>
                  <strong>매일 정서 리포트</strong>
                  <p>대화로 살핀 하루 정서를 확인해요</p>
                </div>
                <div className={styles.benefitItem}>
                  <span className={styles.benefitIcon}>
                    <FiBarChart2 aria-hidden="true" />
                  </span>
                  <strong>주간 변화 추이</strong>
                  <p>일주일의 정서 흐름을 한눈에 봐요</p>
                </div>
                <div className={styles.benefitItem}>
                  <span className={styles.benefitIcon}>
                    <FiMessageCircle aria-hidden="true" />
                  </span>
                  <strong>다슬이의 한마디</strong>
                  <p>오늘 필요한 돌봄 행동을 제안해요</p>
                </div>
                <div className={styles.benefitItem}>
                  <span className={styles.benefitIcon}>
                    <FiBell aria-hidden="true" />
                  </span>
                  <strong>중요 알림</strong>
                  <p>정서 하락과 새 리포트를 알려드려요</p>
                </div>
              </Card>
            </section>
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
