// SENIOR_CONVERSATION_01 (UC-01/02/03), UC-14 공통.
// docs/ws-protocol.md 기준 대화는 메시지 행(ChatMessage) 단위다 — "대화
// (conversation)"를 묶는 컨테이너 개념은 없고, 실시간 대화 화면과 이전 대화
// 기록 조회 화면 모두 같은 행 모델을 쓴다. 실제 타입은 packages/shared-types에
// 고정되어 있다(mobile-portability guideline 참고) — 여기서는 그걸 그대로
// 재노출한다.
export type {
  ChatMessage,
  ChatMessageHistoryPage,
  ChatMessageHistoryQuery,
  ChatMessageSpeakerType,
  ChatMessageSttStatus,
} from '../../../shared/types'
