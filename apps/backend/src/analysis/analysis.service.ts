/*
역할: FastAPI로 보낼 AI 요청을 준비하고 응답을 검증·가공한다.
전체 흐름: ChatsService → AnalysisService → AiClient
 */
import { Injectable } from '@nestjs/common';
import { AiClient } from './ai.client';

@Injectable()
export class AnalysisService {
  private readonly aiClient: AiClient;

  // NestJS DI 컨테이너가 AiClient 객체를 생성자에 주입한다.
  constructor(aiClient: AiClient) {
    this.aiClient = aiClient;
  }

  // 분석 메서드 구현 시 요청 데이터를 가공하고
  // this.aiClient의 FastAPI 요청 메서드를 호출하는 로직이 이 위치에 추가된다.
}
