/*
역할: 프론트와 NestJS가 공통으로 사용할 WebSocket envelope와 식별자 규칙을 정의한다.
연결 흐름: 브라우저 이벤트 생성·수신 ↔ NestJS ChatsGateway·Handler
주의: requestId는 MVP에서 사용하지 않으며 사용자 ID는 JWT에서 확인하므로 payload에 포함하지 않는다.
*/
export interface WsEvent<TEvent extends string, TPayload> {
  event: TEvent
  payload: TPayload
  ts: string
}

export type AudioEndType = 'auto' | 'manual'

export type ClientWsRequestEvent =
  'unknown' | 'auth' | 'chat:start' | 'chat:end' | 'audio:metadata' | 'audio:binary'

export type WsErrorCode =
  | 'INVALID_EVENT'
  | 'INTERNAL_ERROR'
  | 'AUDIO_METADATA_PENDING'
  | 'QUESTION_MISMATCH'
  | 'INVALID_AUDIO_METADATA'
  | 'AUDIO_METADATA_MISSING'
  | 'AUDIO_BINARY_TIMEOUT'
  | 'DUPLICATE_AUDIO_TRANSFER'
  | 'EMPTY_AUDIO_BINARY'
  | 'AUDIO_TOO_LARGE'
  | 'AUDIO_SAVE_FAILED'
  | 'AUDIO_ANALYSIS_FAILED'
  | 'CHAT_ALREADY_STARTED'
  | 'ANSWER_SEGMENT_LIMIT_EXCEEDED'
  | 'ANSWER_AUDIO_SIZE_LIMIT_EXCEEDED'

export interface WsErrorPayload {
  code: WsErrorCode
  message: string
  requestEvent: ClientWsRequestEvent
  retryable: boolean
}
