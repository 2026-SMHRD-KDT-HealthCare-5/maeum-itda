// SENIOR_CONVERSATION_01 (UC-01/02/03) 기준. 실시간 turn 단위 구조 —
// 서버가 WebSocket으로 보내는 실제 payload 모양은 packages/shared-types에
// 타입이 고정되면 여기서 그걸 가져다 쓰도록 바꿀 것 (root CLAUDE.md의
// mobile-portability guideline 참고).
export interface ConversationTurn {
  id: string
  question: string
  answer: string | null
  answeredAt: string | null
}

export interface Conversation {
  id: string
  seniorId: string
  startedAt: string
  endedAt: string | null
  turns: ConversationTurn[]
}
