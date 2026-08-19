/*
역할: Handler가 전달한 대화 요청의 업무 처리 순서 관리
연결 객체: ConversationMessageRepository, AnalysisService
전체 흐름: ChatStartHandler → ChatsService → ConversationMessageRepository/AnalysisService
*/
import { Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { AnalysisService } from '../analysis/analysis.service';
import type { TtsAudioResult } from '../analysis/dto/audio-analysis.contract';
import { TtsClient } from '../analysis/tts.client';
import { toSeoulTodayDate } from '../reports/lib/report-schedule-date';
import { SpeakerType } from './entities/conversation-message.entity';
import { ConversationMessageRepository } from './repositories/conversation-message.repository';

const INITIAL_AI_QUESTION = '오늘 하루는 어땠나요?'; // 대화 시작 시 사용하는 최초 고정 질문

// ChatsService가 ChatStartHandler에 반환하는 최초 질문 결과 형식
export interface StartedChat {
  messageId: number;
  generationId: string;
  content: string;
  ttsAudio: TtsAudioResult | null;
}

@Injectable()
export class ChatsService {
  private readonly logger = new Logger(ChatsService.name);
  private readonly conversationMessageRepository: ConversationMessageRepository; // 대화 메시지 DB 처리 객체
  private readonly analysisService: AnalysisService;
  private readonly ttsClient: TtsClient;

  // NestJS DI 컨테이너가 AnalysisService와 ConversationMessageRepository 객체를 주입
  constructor(
    conversationMessageRepository: ConversationMessageRepository,
    analysisService: AnalysisService,
    ttsClient: TtsClient,
  ) {
    this.conversationMessageRepository = conversationMessageRepository;
    this.analysisService = analysisService;
    this.ttsClient = ttsClient;
  }

  // 역할: 오늘 이미 오간 대화가 있으면 고정 첫 질문으로 되돌리지 않고 DB 기준으로
  // 이어간다 — 마지막 메시지가 AI 질문이면 그 질문을 그대로 다시 쓰고, 시니어
  // 답변이면(주로 chat:end 중 처리 중이던 답변만 저장되고 다음 질문은 저장되지
  // 않은 경우) 그 문맥을 이어갈 새 질문을 생성한다. 오늘 메시지가 아예 없으면
  // 기존처럼 고정 질문으로 새로 시작한다.
  // 연결 객체: ConversationMessageRepository, AnalysisService
  // 다음 호출: (필요시) saveInitialAiQuestion() → ChatStartHandler.handleChatStart()
  async startChat(seniorId: number): Promise<StartedChat> {
    // 현재 AI 질문 단위를 구분하며 DB 메시지 ID와는 별도로 사용
    const generationId = randomUUID();
    const reportDate = toSeoulTodayDate(new Date());

    const lastMessage =
      await this.conversationMessageRepository.findLastMessageForToday(
        seniorId,
        reportDate,
      );

    // 마지막 메시지가 AI 질문(아직 답변받지 못한 질문)이면 새로 만들지 않고
    // 그대로 재사용한다 — DB MESSAGE_ID도 그대로 유지한다.
    if (lastMessage?.speakerType === SpeakerType.AI) {
      const content = lastMessage.content ?? INITIAL_AI_QUESTION;
      const ttsAudio = await this.synthesizeInitialQuestion(content);
      return {
        messageId: lastMessage.messageId,
        generationId,
        content,
        ttsAudio,
      };
    }

    const content =
      lastMessage?.speakerType === SpeakerType.SENIOR
        ? await this.generateResumeContent(seniorId, reportDate)
        : INITIAL_AI_QUESTION;

    // 실제 Entity 생성과 INSERT는 Repository 객체에 요청
    const savedQuestion =
      await this.conversationMessageRepository.saveInitialAiQuestion(
        seniorId,
        content,
      );

    // DB MESSAGE_ID를 AI 질문임이 드러나는 WS 필드명으로 Handler에 전달
    const savedContent = savedQuestion.content ?? content;
    const ttsAudio = await this.synthesizeInitialQuestion(savedContent);

    return {
      messageId: savedQuestion.messageId,
      generationId,
      content: savedContent,
      ttsAudio,
    };
  }

  // [완료] FastAPI 미설정·LLM 호출 실패 모두 고정 질문으로 안전하게 대체한다 —
  // 이어가기 질문 생성 실패가 대화 시작 자체를 막으면 안 된다.
  private async generateResumeContent(
    seniorId: number,
    reportDate: string,
  ): Promise<string> {
    if (!this.analysisService.isFastApiConfigured()) {
      return INITIAL_AI_QUESTION;
    }
    try {
      const { question } =
        await this.analysisService.generateContinuationQuestion(
          seniorId,
          reportDate,
        );
      return question;
    } catch (error: unknown) {
      this.logger.warn(
        `대화 이어가기 질문 생성 실패, 고정 질문으로 대체: ${error instanceof Error ? error.message : String(error)}`,
      );
      return INITIAL_AI_QUESTION;
    }
  }

  // [완료] TTS 장애가 대화 시작을 막지 않도록 실패 시 텍스트 질문만 반환한다.
  private async synthesizeInitialQuestion(
    content: string,
  ): Promise<TtsAudioResult | null> {
    try {
      return await this.ttsClient.synthesize(content);
    } catch (error: unknown) {
      this.logger.warn(
        `첫 질문 TTS 생성 실패, 텍스트 질문으로 대체: ${error instanceof Error ? error.message : String(error)}`,
      );
      return null;
    }
  }
}
