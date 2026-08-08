import { SelectReportDateAction } from '../../../features/select-report-date'
import { ViewEvidenceSentenceAction } from '../../../features/view-evidence-sentence'
import {
  ConversationSummaryCard,
  EmotionScoreCard,
  RecommendedActionCard,
} from '../../../entities/report'
import { Card } from '../../../shared/ui'
import { ConversationTimeline } from '../../../widgets/conversation-timeline'
import { BottomTabBar, GUARDIAN_TAB_ITEMS } from '../../../widgets/bottom-tab-bar'
import { ReportPeriodTabs } from '../../../widgets/report-period-tabs'
import styles from './GuardianReportPage.module.css'

// GUARDIAN_REPORT_01 (UC-08, UC-09) — 결정사항 로그 §7에서 일간/주간 탭
// 위젯과 "이날의 정서 지수"/"다솔이의 한마디"/"이날의 대화 요약" 카드를
// 추가했다. 실제 API 연결 전이라 이날의 리포트는 페이지 로컬 mock이다.
const mockDailyReport = {
  emotionScore: 93,
  emotionLevel: '좋음' as const,
  comment: '오늘은 어르신의 목소리가 밝고 활기가 느껴졌어요.',
  conversationSummary: '아침 산책과 화분 이야기를 나눴고, 전반적으로 편안한 하루를 보내셨어요.',
  recommendedAction:
    '산책 이야기를 많이 하셨어요. 요즘 즐기시는 산책길을 여쭤보시면 좋아하실 것 같아요.',
}

export function GuardianReportPage() {
  const weekStart = new Date().toISOString().slice(0, 10)

  return (
    <>
      <main className={styles.page}>
        <ReportPeriodTabs active="daily" weekStart={weekStart} />

        <SelectReportDateAction />

        <Card>
          <EmotionScoreCard
            title="이날의 정서 지수"
            score={mockDailyReport.emotionScore}
            level={mockDailyReport.emotionLevel}
            comment={mockDailyReport.comment}
          />
        </Card>

        <ConversationTimeline />
        <ViewEvidenceSentenceAction />

        <Card>
          <ConversationSummaryCard summary={mockDailyReport.conversationSummary} />
        </Card>

        <Card>
          <RecommendedActionCard action={mockDailyReport.recommendedAction} />
        </Card>
      </main>
      <BottomTabBar items={GUARDIAN_TAB_ITEMS} />
    </>
  )
}
