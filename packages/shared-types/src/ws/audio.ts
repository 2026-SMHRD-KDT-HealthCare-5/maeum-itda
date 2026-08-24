/*
역할: 시니어 음성 metadata와 접수 ACK payload를 공유한다.
연결 흐름: audio:metadata → binary frame → NestJS DB 저장 → audio:ack
말하는 중 부분 전사: audio:pcm → NestJS → FastAPI live STT → audio:partial
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

// 발화 중 PCM16 LE mono(24kHz) 청크. NestJS가 FastAPI /analysis/stt/live 로 중계한다.
export interface AudioPcmPayload {
  questionMessageId: number
  generationId: string
  pcmBase64: string
}

// 답변 메시지는 분석 성공 전까지 서버에 저장되지 않는다(결정사항: 분석 실패
// 시 DB에 흔적을 남기지 않는다) — ack는 바이너리 수신 확인일 뿐 아직 실제
// 메시지가 존재한다는 뜻이 아니라 messageId를 담지 않는다.
export interface AudioAckPayload {
  audioTransferId: string
}

// 말하는 동안 gpt-live-transcribe가 낸 누적 부분 전사. DB에 저장하지 않으며
// 프론트 임시 말풍선용이다. 확정 텍스트는 여전히 audio:transcript 로 온다.
export interface AudioPartialPayload {
  questionMessageId: number
  content: string
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

// 질문별 TTS를 실제로 합성된 오디오가 아니라, 그걸 스트리밍으로 받아올 경로로
// 전달한다(2026-08-21부터 — 전체 오디오를 base64로 실어보내면 합성이 끝나야만
// 전송이 시작돼 TTFB가 늦어진다). streamPath는 API_BASE_URL을 붙이면 바로 요청
// 가능한 상대 경로(쿼리에 단기 전용 토큰 포함, 예: "/chats/tts-stream?messageId=
// 101&token=...")이며, 프론트는 이 경로를 그대로 <audio src>에 사용한다.
// messageId로 ai:question과 연결한다.
export interface TtsTransferPayload {
  ttsTransferId: string
  messageId: number
  streamPath: string
}
