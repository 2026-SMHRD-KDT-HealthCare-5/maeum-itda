/**
 * 역할: NestJS와 FastAPI 사이의 REST API 통신을 담당한다.
 * 전체 흐름: AnalysisService → AiClient → FastAPI(STT·척도 채점·acoustic 특징·감성분석·질문·TTS)
 */
import { Injectable } from '@nestjs/common';

@Injectable()
export class AiClient {
  // FastAPI 연동 메서드 구현 시 HTTP Client를 이용한
  // STT·척도 채점·acoustic 특징·감성분석·질문·TTS REST API 호출이 이 위치에 추가된다.
  // 원본 음성은 분석 완료 후 저장하지 않고 즉시 폐기한다.
}
