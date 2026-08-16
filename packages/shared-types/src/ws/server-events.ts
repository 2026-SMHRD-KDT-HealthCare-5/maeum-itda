/*
역할: NestJS가 브라우저로 전송할 수 있는 WebSocket 이벤트와 payload의 대응 관계를 고정한다.
연결 흐름: NestJS sendWsEvent() → ServerWsEventMap 타입 검사 → WebSocket JSON 전송
주의: 이 맵은 런타임 검증기가 아니라 서버 구현의 이벤트명·필수 필드 오류를 컴파일 단계에서 차단한다.
*/
import type { AudioAckPayload, AudioTranscriptPayload, TtsTransferPayload } from './audio'
import type { AuthErrorPayload, AuthSuccessPayload } from './auth'
import type {
  AiQuestionPayload,
  ChatEndedPayload,
  ChatIdleWarningPayload,
  ChatRestoredPayload,
  ChatStartedPayload,
} from './chat'
import type { WsErrorPayload } from './common'

export interface ServerWsEventMap {
  'auth:success': AuthSuccessPayload
  'auth:error': AuthErrorPayload
  'chat:started': ChatStartedPayload
  'chat:restored': ChatRestoredPayload
  'chat:idle-warning': ChatIdleWarningPayload
  'chat:ended': ChatEndedPayload
  'ai:question': AiQuestionPayload
  'audio:ack': AudioAckPayload
  'audio:transcript': AudioTranscriptPayload
  'tts:audio': TtsTransferPayload
  error: WsErrorPayload
}

export type ServerWsEventName = keyof ServerWsEventMap
