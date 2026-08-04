// SENIOR_CONVERSATION_01 (UC-01/02/03) 기준. 실시간 turn 단위 구조 —
// 서버가 WebSocket으로 보내는 실제 payload 모양은 packages/shared-types에
// 타입이 고정되면 여기서 그걸 가져다 쓰도록 바꿀 것 (root CLAUDE.md의
// mobile-portability guideline 참고).
export interface ConversationTurn {
  id: string
  question: string
  answer: string | null
  answeredAt: string | null
  // UC-04에서 같은 LLM 호출의 Structured Output으로 생성, UC-07에서 저장.
  sentimentLabel: string | null
  sentimentNote: string | null
  // UC-07이 turn마다 저장한다는 voice_score. UC-06-2 공식의 일간 집계
  // VoiceScore와 이름이 겹치지만 다른 값으로 보임 — 결정사항 로그 §2 참고.
  voiceScore: number | null
}

export interface Conversation {
  id: string
  seniorId: string
  startedAt: string
  endedAt: string | null
  turns: ConversationTurn[]
}
