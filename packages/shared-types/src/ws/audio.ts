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

// 답변 메시지는 분석 성공 전까지 서버에 저장되지 않는다(결정사항: 분석 실패
// 시 DB에 흔적을 남기지 않는다) — ack는 바이너리 수신 확인일 뿐 아직 실제
// 메시지가 존재한다는 뜻이 아니라 messageId를 담지 않는다.
export interface AudioAckPayload {
  audioTransferId: string
}

// 답변 묶음(질문별 첫 답변 + 추가 답변) 분석이 끝나 STT(LLM 교정 포함) 결과가
// 확정된 시점에 ai:question과 같은 타이밍(그 직전)으로 보낸다 — 다음 질문이
// 없는 경우(예: 이미 다음 질문을 보낸 뒤 늦게 도착한 답변)에도 이 이벤트는
// 보낸다, 결정사항 로그 §0 "STT 결과는... 다음 질문 생성 시점에 함께 전달".
// 여기 담긴 messageId는 분석이 성공해 실제로 저장된 메시지의 ID다 — 분석
// 자체가 실패하면(예: 무음 녹음) 아무 메시지도 저장되지 않으므로 이 이벤트도
// 보내지 않는다(프론트는 error 이벤트의 AUDIO_ANALYSIS_FAILED로 실패를 안다).
export interface AudioTranscriptPayload {
  transcripts: Array<{ messageId: number; content: string }>
}

// 질문별 완성 TTS를 Base64로 전달한다. messageId로 ai:question과 연결한다.
export interface TtsTransferPayload {
  ttsTransferId: string
  messageId: number
  base64: string
  mimeType: string
}
