import { useParams } from 'react-router-dom'
import {
  RecommendedActionCard,
  WeeklyDailySummaryList,
  WeeklyStatsCards,
} from '../../../entities/report'
import { Card } from '../../../shared/ui'
import { BottomTabBar, GUARDIAN_TAB_ITEMS } from '../../../widgets/bottom-tab-bar'
import { EmotionTrendChart } from '../../../widgets/emotion-trend-chart'
import { ReportPeriodTabs } from '../../../widgets/report-period-tabs'
import styles from './GuardianWeeklyReportPage.module.css'

// 화면ID 미배정(신규, 결정사항 로그 §5) — §6/§7에 따라 guardian-report와
// 탭 위젯을 공유한다. weekStart의 정확한 의미(주 시작 요일, 서비스 기준
// 시간대)는 여전히 미정 — entities/report의 WeeklyReport 타입과 함께 다시
// 정리할 것. 실제 API 연결 전이라 주간 리포트는 페이지 로컬 mock이다.
const mockWeeklyReport = {
  averageScore: 78,
  maxScore: 93,
  minScore: 48,
  recommendedAction:
    '이번 주는 평소보다 조금 지치신 날이 있었어요. 통화하실 때 편하게 쉬셨는지 여쭤보시면 좋을 것 같아요.',
  dailyScores: [
    {
      date: '2025-06-30',
      emotionScore: 72,
      emotionLevel: '좋음' as const,
      comment: '산책과 화분 이야기',
    },
    {
      date: '2025-07-01',
      emotionScore: 48,
      emotionLevel: '보통' as const,
      comment: '피로감을 표현하셨어요',
    },
    {
      date: '2025-07-02',
      emotionScore: 93,
      emotionLevel: '좋음' as const,
      comment: '동네 모임에 다녀오심',
    },
    { date: '2025-07-03', emotionScore: null, emotionLevel: null, comment: null },
    {
      date: '2025-07-04',
      emotionScore: 81,
      emotionLevel: '좋음' as const,
      comment: '손주와 통화하심',
    },
    {
      date: '2025-07-05',
      emotionScore: 88,
      emotionLevel: '좋음' as const,
      comment: '날씨가 좋아 기분이 밝음',
    },
    { date: '2025-07-06', emotionScore: 76, emotionLevel: '좋음' as const, comment: '평온한 하루' },
  ],
}

export function GuardianWeeklyReportPage() {
  const { weekStart } = useParams<{ weekStart: string }>()

  return (
    <>
      <main className={styles.page}>
        <ReportPeriodTabs
          active="weekly"
          weekStart={weekStart ?? new Date().toISOString().slice(0, 10)}
        />

        <EmotionTrendChart />

        <Card>
          <WeeklyStatsCards
            averageScore={mockWeeklyReport.averageScore}
            maxScore={mockWeeklyReport.maxScore}
            minScore={mockWeeklyReport.minScore}
          />
        </Card>

        <Card>
          <RecommendedActionCard action={mockWeeklyReport.recommendedAction} />
        </Card>

        <Card>
          <WeeklyDailySummaryList dailyScores={mockWeeklyReport.dailyScores} />
        </Card>
      </main>
      <BottomTabBar items={GUARDIAN_TAB_ITEMS} />
    </>
  )
}
