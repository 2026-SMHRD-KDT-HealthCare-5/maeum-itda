/*
역할: 인증 후 chat:start 이벤트 검증과 AI 질문 전송 — 새 질문 고정 생성 여부는
ChatsService가 오늘 DB 마지막 메시지 기준으로 판단한다(재진입 시 이어가기 포함).
연결 객체: ChatsService, WebSocket 연결 객체, 인증된 사용자 정보
전체 흐름: ChatsGateway → ChatStartHandler → ChatsService → ConversationMessageRepository → chat:started → ai:question
*/
import { Injectable } from '@nestjs/common';
import type WebSocket from 'ws';
import type { AccessTokenPayload } from '../../auth/auth.service';
import { EmotionIndexRecalcTriggerService } from '../../reports/emotion-index-recalc-trigger.service';
import { ChatsService, type StartedChat } from '../chats.service';
import { sendWsError, sendWsEvent } from '../ws-event';
import { ChatConnectionStateService } from '../chat-connection-state.service';
import { ChatInactivityService } from '../chat-inactivity.service';
import { LastTurnRecalcTimerService } from '../last-turn-recalc-timer.service';
import type { ChatStartEvent } from '../client-ws-event';
import { QuestionDeliveryService } from '../question-delivery.service';

@Injectable()
export class ChatStartHandler {
  private readonly chatsService: ChatsService; // 최초 질문 생성·저장 업무 객체
  private readonly chatConnectionStateService: ChatConnectionStateService; // 연결별 현재 질문 관리 객체
  private readonly chatInactivityService: ChatInactivityService;
  private readonly recalcTriggerService: EmotionIndexRecalcTriggerService;
  private readonly lastTurnRecalcTimerService: LastTurnRecalcTimerService;
  private readonly questionDeliveryService: QuestionDeliveryService;

  // NestJS DI 컨테이너가 ChatsService 객체를 생성자에 주입
  constructor(
    chatsService: ChatsService,
    chatConnectionStateService: ChatConnectionStateService,
    chatInactivityService: ChatInactivityService,
    recalcTriggerService: EmotionIndexRecalcTriggerService,
    lastTurnRecalcTimerService: LastTurnRecalcTimerService,
    questionDeliveryService: QuestionDeliveryService,
  ) {
    this.chatsService = chatsService;
    this.chatConnectionStateService = chatConnectionStateService;
    this.chatInactivityService = chatInactivityService;
    this.recalcTriggerService = recalcTriggerService;
    this.lastTurnRecalcTimerService = lastTurnRecalcTimerService;
    this.questionDeliveryService = questionDeliveryService;
  }

  // 역할: chat:start 검증 후 최초 고정 질문 생성 요청과 결과 전송
  // 연결 객체: ChatsService, 인증된 시니어 정보
  // 다음 호출: ChatsService.startChat() → chat:started → ai:question
  async handleChatStart(
    client: WebSocket,
    authenticatedUser: AccessTokenPayload,
    event: ChatStartEvent,
  ): Promise<void> {
    void event;

    // 활성 질문이 남아 있거나 이미 chat:start 처리가 진행 중이면 중복 시작
    // 요청으로 판단한다. isStarting 체크는 아래 markStarting과 함께 동기적으로
    // 이뤄져야 한다 — 그 사이에 await가 끼면 짧은 간격으로 도착한 두 번째
    // chat:start가 같은 틈을 통과해 질문이 두 번 생성될 수 있다.
    if (
      this.chatConnectionStateService.getCurrentQuestion(client) !==
        undefined ||
      this.chatConnectionStateService.isStarting(client)
    ) {
      sendWsError(client, {
        code: 'CHAT_ALREADY_STARTED',
        message: '이미 진행 중인 대화가 있습니다.',
        requestEvent: 'chat:start',
        retryable: false,
      });
      return;
    }
    this.chatConnectionStateService.markStarting(client);

    try {
      const startedChat = await this.chatsService.startChat(
        authenticatedUser.sub,
      );

      // 이후 audio:metadata가 현재 질문의 답변인지 확인할 식별정보 보관
      this.chatConnectionStateService.setCurrentQuestion(
        client,
        startedChat,
        authenticatedUser.sub,
      );

      // [완료] 첫 대화와 재대화를 구분하지 않고 대화 시작 시 오늘 리포트를 갱신한다.
      // 같은 날짜의 기존 리포트는 덮어쓰는 멱등 처리이므로 첫 대화에서도 안전하다.
      this.recalcTriggerService.recalcToday(authenticatedUser.sub);
      this.lastTurnRecalcTimerService.arm(authenticatedUser.sub);

      // DB 저장이 끝난 경우에만 시작 완료와 AI 질문을 순서대로 전송
      this.handleChatStarted(client);
      this.handleAiQuestion(client, startedChat);
      this.chatInactivityService.startWaitingForAnswer(client);
    } catch {
      sendWsError(client, {
        code: 'INTERNAL_ERROR',
        message: '대화를 시작하는 중 서버 오류가 발생했습니다.',
        requestEvent: 'chat:start',
        retryable: true,
      });
    } finally {
      this.chatConnectionStateService.clearStarting(client);
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
    const { ttsAudio, ...question } = startedChat;
    this.questionDeliveryService.deliver(client, question, ttsAudio);
  }
}
