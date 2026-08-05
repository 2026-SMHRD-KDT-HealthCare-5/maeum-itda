import { RecordVoiceAnswerAction } from '../../../features/record-voice-answer'
import { ConversationHistoryList } from '../../../entities/conversation'

// SENIOR_CONVERSATION_01 (UC-01, UC-02, UC-03)
// 이전 대화 이력 무한 스크롤은 결정사항 로그 §5 참고.
export function SeniorConversationPage() {
  return (
    <main>
      <h1>안부 대화</h1>
      <RecordVoiceAnswerAction />
      <ConversationHistoryList />
    </main>
  )
}
