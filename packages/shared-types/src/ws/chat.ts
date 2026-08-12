/*
역할: 대화 시작과 AI 질문 이벤트의 payload를 공유한다.
확정 사항: chat:started는 빈 payload이고 generationId는 질문 생성 작업 단위로 ai:question에만 포함한다.
*/
export type ChatStartedPayload = Record<string, never>

export interface AiQuestionPayload {
  messageId: number
  generationId: string
  content: string
}

export interface ChatRestoredPayload {
  questionMessageId: number
  generationId: string
}

export interface ChatIdleWarningPayload {
  message: string
  remainingSeconds: number
}

export type ChatEndReason = 'USER_REQUESTED' | 'INACTIVITY_TIMEOUT'

export interface ChatEndedPayload {
  reason: ChatEndReason
  endedAt: string
}
