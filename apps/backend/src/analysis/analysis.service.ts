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

  // ChatsService에서 전달받은 분석 요청을 AiClient로 전달한다.
  analyzeConversation(requestData: unknown): Promise<unknown> {
    return this.aiClient.analyzeConversation(requestData);
  }
}
