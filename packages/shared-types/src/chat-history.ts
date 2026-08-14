/*
역할: 과거 대화 메시지 REST 조회(`GET /chats/messages`) 계약을 공유한다.
연결 흐름: 프론트 → ChatsController → ChatsService → ConversationMessageRepository
주의: seniorId는 JWT에서 서버가 확인하므로 요청 계약에 포함하지 않는다(docs/ws-protocol.md §8).
*/
export type ChatMessageSpeakerType = 'AI' | 'SENIOR'

export type ChatMessageSttStatus =
  'NOT_REQUIRED' | 'WAITING' | 'PROCESSING' | 'COMPLETED' | 'FAILED'

// 대화 메시지 한 건 — 실시간 대화 화면과 이전 대화 기록 조회 화면이 동일하게
// 이 행 단위 모델을 쓴다. content가 null이면 아직 STT 결과가 없는 시니어
// 답변(sttStatus가 WAITING/PROCESSING/FAILED)이다.
export interface ChatMessage {
  messageId: number
  speakerType: ChatMessageSpeakerType
  content: string | null
  sttStatus: ChatMessageSttStatus
  createdAt: string
}

export interface ChatMessageHistoryQuery {
  cursor?: number
  limit?: number
}

export interface ChatMessageHistoryPage {
  messages: ChatMessage[]
  nextCursor: number | null
}
