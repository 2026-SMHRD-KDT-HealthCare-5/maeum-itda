/*
역할: Handler가 전달한 대화 요청의 업무 처리 순서 관리
연결 객체: ConversationMessageRepository, AnalysisService
전체 흐름: ChatStartHandler → ChatsService → ConversationMessageRepository 또는 AnalysisService
*/
import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { AnalysisService } from '../analysis/analysis.service';
import { ConversationMessageRepository } from './repositories/conversation-message.repository';

const INITIAL_AI_QUESTION = '오늘 하루는 어땠나요?'; // 대화 시작 시 사용하는 최초 고정 질문

// ChatsService가 ChatStartHandler에 반환하는 최초 질문 결과 형식
export interface StartedChat {
  messageId: number;
  generationId: string;
  content: string;
}

@Injectable()
export class ChatsService {
  private readonly analysisService: AnalysisService; // 이후 시니어 답변을 FastAPI로 전달할 객체
  private readonly conversationMessageRepository: ConversationMessageRepository; // 대화 메시지 DB 처리 객체

  // NestJS DI 컨테이너가 AnalysisService와 ConversationMessageRepository 객체를 주입
  constructor(
    analysisService: AnalysisService,
    conversationMessageRepository: ConversationMessageRepository,
  ) {
    this.analysisService = analysisService;
    this.conversationMessageRepository = conversationMessageRepository;
  }

  // 역할: generationId 발급과 최초 고정 질문 저장 순서 관리
  // 연결 객체: ConversationMessageRepository
  // 다음 호출: saveInitialAiQuestion() → ChatStartHandler.handleChatStart()
  async startChat(seniorId: number): Promise<StartedChat> {
    // 현재 AI 질문 단위를 구분하며 DB 메시지 ID와는 별도로 사용
    const generationId = randomUUID();

    // 실제 Entity 생성과 INSERT는 Repository 객체에 요청
    const savedQuestion =
      await this.conversationMessageRepository.saveInitialAiQuestion(
        seniorId,
        INITIAL_AI_QUESTION,
      );

    // DB MESSAGE_ID를 AI 질문임이 드러나는 WS 필드명으로 Handler에 전달
    return {
      messageId: savedQuestion.messageId,
      generationId,
      content: savedQuestion.content ?? INITIAL_AI_QUESTION,
    };
  }
}
