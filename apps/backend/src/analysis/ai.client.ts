/*
역할: NestJS와 FastAPI 사이의 REST API 통신을 담당한다.
전체 흐름: AnalysisService → AiClient → FastAPI(STT·척도 채점·acoustic 특징·감성분석·질문·TTS)
*/
import { Injectable } from '@nestjs/common';

@Injectable()
export class AiClient {
  // AnalysisService가 호출할 FastAPI 분석 요청 메서드의 자리표시자다.
  // API 계약 확정 후 unknown 타입과 오류를 실제 HTTP 요청·응답 처리로 교체한다.
  analyzeConversation(_requestData: unknown): Promise<unknown> {
    return Promise.reject(
      new Error('FastAPI 분석 API가 아직 연결되지 않았습니다.'),
    );
  }
}
