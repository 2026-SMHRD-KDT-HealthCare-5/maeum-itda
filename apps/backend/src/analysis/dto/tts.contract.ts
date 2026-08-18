/*
역할: 첫 질문 문장을 FastAPI TTS 전용 API로 보내고 완성 음성을 받는 계약을 정의한다.
전체 흐름: ChatsService → TtsClient → POST FastAPI /tts/synthesize → 검증된 TtsAudioResult
*/
export interface TtsSynthesizeRequest {
  text: string;
}

export interface TtsSynthesizeResponse {
  ttsAudioBase64: string;
  ttsMimeType: string;
}
