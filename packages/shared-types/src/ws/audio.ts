/*
역할: 시니어 음성 metadata와 접수 ACK payload를 공유한다.
연결 흐름: audio:metadata → binary frame → NestJS DB 저장 → audio:ack
*/
import type { AudioEndType } from './common'

export interface AudioMetadataPayload {
  audioTransferId: string
  questionMessageId: number
  generationId: string
  mimeType: string
  capturedAt: string
  endType: AudioEndType
}

export interface AudioAckPayload {
  audioTransferId: string
  messageId: number
}

// TTS는 MVP 구현 범위 밖이지만 향후 시니어 음성과 구분할 전송 ID 이름만 확정한다.
export interface TtsTransferPayload {
  ttsTransferId: string
  messageId: number
}
