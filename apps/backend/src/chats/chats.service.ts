/*
역할: Handler가 전달한 대화 요청의 업무 처리 순서 관리
연결 객체: ConversationMessageRepository
전체 흐름: ChatStartHandler → ChatsService → ConversationMessageRepository
*/
import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { ConversationMessageRepository } from './repositories/conversation-message.repository';
import { SpeakerType } from './entities/conversation-message.entity';
import {
  formatSeoulDate,
  toSeoulBusinessDayUtcRange,
} from '../reports/lib/seoul-business-date';

const INITIAL_AI_QUESTION = '오늘 하루는 어땠나요?'; // 대화 시작 시 사용하는 최초 고정 질문

// ChatsService가 ChatStartHandler에 반환하는 최초 질문 결과 형식. TTS는 여기 없다 —
// [2026-08-21] 텍스트 전달 후 QuestionDeliveryService.deliverTtsToken()이 별도로
// 스트리밍 경로를 발급해 전달한다(TTS 준비를 기다리지 않고 곧바로 질문을 보내기 위함).
export interface StartedChat {
  messageId: number;
  generationId: string;
  content: string;
}

@Injectable()
export class ChatsService {
  private readonly conversationMessageRepository: ConversationMessageRepository; // 대화 메시지 DB 처리 객체

  // NestJS DI 컨테이너가 ConversationMessageRepository 객체를 주입
  constructor(conversationMessageRepository: ConversationMessageRepository) {
    this.conversationMessageRepository = conversationMessageRepository;
  }

  // 역할: 오늘 마지막 메시지가 아직 답변되지 않은 AI 질문이면 그대로 재사용하고,
  // 아니면(오늘 대화가 없거나 마지막이 시니어 답변이면) 새 질문을 발급한다.
  // 서버 재시작으로 ChatConnectionStateService의 메모리 상태가 사라진 뒤 같은 날
  // 재접속해도 DB로 직접 확인하므로 대화가 처음부터 다시 시작되지 않는다.
  // 연결 객체: ConversationMessageRepository
  // 다음 호출: ChatStartHandler.handleChatStart()
  async startChat(seniorId: number): Promise<StartedChat> {
    const { start, end } = toSeoulBusinessDayUtcRange(
      formatSeoulDate(new Date()),
    );
    const latestToday =
      await this.conversationMessageRepository.findLatestMessageToday(
        seniorId,
        start,
        end,
      );

    if (latestToday !== null && latestToday.speakerType === SpeakerType.AI) {
      // generationId는 DB에 저장되지 않는 휘발성 값이라 재접속마다 새로 발급한다 —
      // 새 WebSocket 연결이라 이전 값과 충돌할 대상 자체가 없다.
      return {
        messageId: latestToday.messageId,
        generationId: randomUUID(),
        content: latestToday.content ?? INITIAL_AI_QUESTION,
      };
    }

    // 현재 AI 질문 단위를 구분하며 DB 메시지 ID와는 별도로 사용
    const generationId = randomUUID();

    // 실제 Entity 생성과 INSERT는 Repository 객체에 요청
    const savedQuestion =
      await this.conversationMessageRepository.saveInitialAiQuestion(
        seniorId,
        INITIAL_AI_QUESTION,
      );

    return {
      messageId: savedQuestion.messageId,
      generationId,
      content: savedQuestion.content ?? INITIAL_AI_QUESTION,
    };
  }
}
