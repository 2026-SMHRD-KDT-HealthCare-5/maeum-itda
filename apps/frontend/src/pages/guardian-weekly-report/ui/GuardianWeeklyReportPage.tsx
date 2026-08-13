import { useParams } from 'react-router-dom'
import {
  RecommendedActionCard,
  WeeklyDailySummaryList,
  WeeklyStatsCards,
  type WeeklyReport,
} from '../../../entities/report'
import { SelectReportWeekAction } from '../../../features/select-report-week'
import daseulGuideImage from '../../../shared/assets/character/character-daseul-guide.png'
import daseulNoDataImage from '../../../shared/assets/character/character-daseul-no-data.png'
import { Card } from '../../../shared/ui'
import { BottomTabBar, GUARDIAN_TAB_ITEMS } from '../../../widgets/bottom-tab-bar'
import { EmotionTrendChart } from '../../../widgets/emotion-trend-chart'
import { ReportPeriodTabs } from '../../../widgets/report-period-tabs'
import styles from './GuardianWeeklyReportPage.module.css'

// 주간 리포트는 한 주가 끝난 뒤 일요일 자정에만 생성되므로 진행 중인
// 8/10~8/16 주간은 fixture에 넣지 않는다. 실제 API 연결 시 이 맵을 주간
// 리포트 query 결과로 교체하고 아래 렌더링 구조는 그대로 유지한다.
const mockWeeklyReports: Record<string, WeeklyReport> = {
  '2026-08-03': {
    weekStart: '2026-08-03',
    seniorId: 'mock-senior',
    averageScore: 71,
    maxScore: 86,
    minScore: 55,
    recommendedAction:
      '이번 주는 전반적으로 안정적이었어요. 주말에 즐거웠던 이야기를 다시 나누며 다음 산책 계획을 함께 세워보세요.',
    dailyScores: [
      {
        date: '2026-08-03',
        emotionScore: 68,
        emotionLevel: '보통',
        comment: '잠을 설쳤다고 말씀하셨어요',
      },
      {
        date: '2026-08-04',
        emotionScore: 74,
        emotionLevel: '좋음',
        comment: '화분에 새잎이 났어요',
      },
      {
        date: '2026-08-05',
        emotionScore: 79,
        emotionLevel: '좋음',
        comment: '이웃과 즐겁게 대화하셨어요',
      },
      {
        date: '2026-08-06',
        emotionScore: 55,
        emotionLevel: '보통',
        comment: '조금 피곤한 하루였어요',
      },
      { date: '2026-08-07', emotionScore: null, emotionLevel: null, comment: null },
      {
        date: '2026-08-08',
        emotionScore: 64,
        emotionLevel: '보통',
        comment: '집에서 편안히 쉬셨어요',
      },
      {
        date: '2026-08-09',
        emotionScore: 86,
        emotionLevel: '좋음',
        comment: '가족과 통화해 기분이 밝았어요',
      },
    ],
  },
}
const weeksWithReport = new Set(Object.keys(mockWeeklyReports))

export function GuardianWeeklyReportPage() {
  const { weekStart } = useParams<{ weekStart: string }>()
  const selectedWeekStart = weekStart ?? '2026-08-10'
  const report = mockWeeklyReports[selectedWeekStart] ?? null

  return (
    <>
      <main className={styles.page}>
        <ReportPeriodTabs active="weekly" weekStart={selectedWeekStart} />

        <SelectReportWeekAction weekStart={selectedWeekStart} weeksWithReport={weeksWithReport} />

        {report ? (
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
        ) : (
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
