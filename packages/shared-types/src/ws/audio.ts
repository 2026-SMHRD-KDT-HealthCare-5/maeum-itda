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

// 답변 묶음(질문별 첫 답변 + 추가 답변) 분석이 끝나 STT(LLM 교정 포함) 결과가
// 확정된 시점에 ai:question과 같은 타이밍(그 직전)으로 보낸다 — 다음 질문이
// 없는 경우(예: 이미 다음 질문을 보낸 뒤 늦게 도착한 답변)에도 이 이벤트는
// 보낸다, 결정사항 로그 §0 "STT 결과는... 다음 질문 생성 시점에 함께 전달".
export interface AudioTranscriptPayload {
  transcripts: Array<{ messageId: number; content: string }>
}

// TTS는 MVP 구현 범위 밖이지만 향후 시니어 음성과 구분할 전송 ID 이름만 확정한다.
export interface TtsTransferPayload {
  ttsTransferId: string
  messageId: number
}
