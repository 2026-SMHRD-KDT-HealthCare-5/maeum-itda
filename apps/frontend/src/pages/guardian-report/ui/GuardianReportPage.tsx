import { SelectReportDateAction } from '../../../features/select-report-date'
import { ViewEvidenceSentenceAction } from '../../../features/view-evidence-sentence'
import { ConversationTimeline } from '../../../widgets/conversation-timeline'

// GUARDIAN_REPORT_01 (UC-08, UC-09)
export function GuardianReportPage() {
  return (
    <main>
      <h1>리포트</h1>
      <SelectReportDateAction />
      <ConversationTimeline />
      <ViewEvidenceSentenceAction />
    </main>
  )
}
