/*
역할: 인증 후 chat:start 이벤트 검증과 최초 AI 질문 전송
연결 객체: ChatsService, WebSocket 연결 객체, 인증된 사용자 정보
전체 흐름: ChatsGateway → ChatStartHandler → ChatsService → ConversationMessageRepository → chat:started → ai:question
*/
import { Injectable } from '@nestjs/common';
import type WebSocket from 'ws';
import type { RawData } from 'ws';
import type { AccessTokenPayload } from '../../auth/auth.service';
import { ChatsService, type StartedChat } from '../chats.service';
import { sendWsEvent } from '../ws-event';

// 프론트가 인증 성공 후 보내는 대화 시작 요청 형식
interface ChatStartEvent {
  event: 'chat:start';
  payload: Record<string, never>;
  ts: string;
}

@Injectable()
export class ChatStartHandler {
  private readonly chatsService: ChatsService; // 최초 질문 생성·저장 업무 객체

  // NestJS DI 컨테이너가 ChatsService 객체를 생성자에 주입
  constructor(chatsService: ChatsService) {
    this.chatsService = chatsService;
  }

  // 역할: chat:start 검증 후 최초 고정 질문 생성 요청과 결과 전송
  // 연결 객체: ChatsService, 인증된 시니어 정보
  // 다음 호출: ChatsService.startChat() → chat:started → ai:question
  async handleChatStart(
    client: WebSocket,
    authenticatedUser: AccessTokenPayload,
    data: RawData,
    isBinary: boolean,
  ): Promise<void> {
    try {
      if (isBinary) {
        throw new Error('chat:start는 JSON 형식이어야 합니다.');
      }
      this.parseChatStartEvent(data.toString());
    } catch {
      sendWsEvent(client, 'error', {
        code: 'INVALID_EVENT',
        message: '요청한 WebSocket 이벤트를 처리할 수 없습니다.',
      });
      return;
    }

    try {
      const startedChat = await this.chatsService.startChat(
        authenticatedUser.sub,
      );

      // DB 저장이 끝난 경우에만 시작 완료와 AI 질문을 순서대로 전송
      this.handleChatStarted(client);
      this.handleAiQuestion(client, startedChat);
    } catch {
      sendWsEvent(client, 'error', {
        code: 'INTERNAL_ERROR',
        message: '대화를 시작하는 중 서버 오류가 발생했습니다.',
      });
    }
  }

  // 역할: 최초 질문 저장이 완료된 대화 시작 결과 전송
  // 연결 객체: WebSocket 연결 객체
  // 다음 호출: chat:started 전송 → handleAiQuestion()
  private handleChatStarted(client: WebSocket): void {
    sendWsEvent(client, 'chat:started', {});
  }

  // 역할: DB에 저장된 최초 AI 질문 정보 전송
  // 연결 객체: WebSocket 연결 객체, ChatsService 반환 결과
  // 다음 호출: ai:question 전송 → 프론트 질문 출력
  private handleAiQuestion(client: WebSocket, startedChat: StartedChat): void {
    sendWsEvent(client, 'ai:question', startedChat);
  }

  // 역할: chat:start 이벤트 이름, 빈 payload, 전송 시각 확인
  // 다음 호출: 검증 성공 → ChatsService.startChat()
  private parseChatStartEvent(message: string): ChatStartEvent {
    const parsedEvent: unknown = JSON.parse(message);

    if (
      typeof parsedEvent !== 'object' ||
      parsedEvent === null ||
      !('event' in parsedEvent) ||
      parsedEvent.event !== 'chat:start' ||
      !('payload' in parsedEvent) ||
      typeof parsedEvent.payload !== 'object' ||
      parsedEvent.payload === null ||
      Object.keys(parsedEvent.payload).length !== 0 ||
      !('ts' in parsedEvent) ||
      typeof parsedEvent.ts !== 'string' ||
      parsedEvent.ts.length === 0
    ) {
      throw new Error('유효하지 않은 chat:start 이벤트입니다.');
    }

    return { event: 'chat:start', payload: {}, ts: parsedEvent.ts };
  }
}
