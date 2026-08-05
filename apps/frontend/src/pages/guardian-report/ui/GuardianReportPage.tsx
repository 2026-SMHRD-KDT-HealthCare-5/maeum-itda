import { Link } from 'react-router-dom'
import { SelectReportDateAction } from '../../../features/select-report-date'
import { ViewEvidenceSentenceAction } from '../../../features/view-evidence-sentence'
import { ConversationTimeline } from '../../../widgets/conversation-timeline'
import { BottomTabBar, GUARDIAN_TAB_ITEMS } from '../../../widgets/bottom-tab-bar'

// GUARDIAN_REPORT_01 (UC-08, UC-09)
export function GuardianReportPage() {
  return (
    <main>
      <h1>리포트</h1>
      <SelectReportDateAction />
      <ConversationTimeline />
      <ViewEvidenceSentenceAction />
      {/* 화면ID 미배정(신규, 결정사항 로그 §5) — GUARDIAN_HOME_01 확장 vs 별도 화면 결정 전까지 임시 링크 */}
      <p>
        <Link to="/guardian/report/weekly">주간 리포트 상세 보기</Link>
      </p>
      <BottomTabBar items={GUARDIAN_TAB_ITEMS} />
    </main>
  )
}
