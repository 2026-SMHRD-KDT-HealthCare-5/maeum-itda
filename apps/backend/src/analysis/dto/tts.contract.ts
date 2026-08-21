/*
역할: 질문 텍스트를 FastAPI TTS 전용 API로 보내는 요청 계약을 정의한다.
전체 흐름: ChatsService/TtsStreamController → TtsClient → POST FastAPI /tts/synthesize(/stream)
*/
export interface TtsSynthesizeRequest {
  text: string;
}
