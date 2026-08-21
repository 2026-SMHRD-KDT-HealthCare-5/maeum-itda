/*
역할: /ws/chats 연결·종료 감지와 수신 메시지 전달
연결 객체: ChatAuthHandler, ChatStartHandler, AudioMetadataHandler
전체 흐름: 브라우저 → ChatsGateway → 이벤트별 Handler
*/
import {
  OnGatewayConnection,
  OnGatewayDisconnect,
  WebSocketGateway,
} from '@nestjs/websockets';
import type WebSocket from 'ws';
import type { RawData } from 'ws';
import { AccessTokenPayload } from '../auth/auth.service';
import { ChatAuthHandler } from './handlers/chat-auth.handler';
import { ChatStartHandler } from './handlers/chat-start.handler';
import { AudioMetadataHandler } from './handlers/audio-metadata.handler';
import { rawDataToString, sendWsError, sendWsEvent } from './ws-event';
import { ChatConnectionStateService } from './chat-connection-state.service';
import { AudioBinaryHandler } from './handlers/audio-binary.handler';
import { ChatEndHandler } from './handlers/chat-end.handler';
import { ChatInactivityService } from './chat-inactivity.service';
import { LastTurnRecalcTimerService } from './last-turn-recalc-timer.service';
import { QuestionDeliveryService } from './question-delivery.service';
import {
  ClientWsEventParseError,
  parseAuthenticatedClientEvent,
} from './client-ws-event';

export const WS_AUTH_TIMEOUT_MS = 5_000;

type ConnectionPhase = 'WAITING_FOR_AUTH' | 'AUTHENTICATING' | 'AUTHENTICATED';

interface PendingClientMessage {
  data: RawData;
  isBinary: boolean;
}

interface ClientConnectionContext {
  phase: ConnectionPhase;
  authenticatedUser?: AccessTokenPayload;
  authTimeout: NodeJS.Timeout;
  pendingMessages: PendingClientMessage[];
}

// WebSocket 연결 경로: ws://서버주소/ws/chats
// 운영 배포에서 HTTPS/TLS가 적용되면 같은 경로를 wss://로 사용
@WebSocketGateway({
  path: '/ws/chats',
})
export class ChatsGateway implements OnGatewayConnection, OnGatewayDisconnect {
  private readonly chatAuthHandler: ChatAuthHandler; // 첫 메시지 JWT 인증 처리 객체
  private readonly chatStartHandler: ChatStartHandler; // 인증 후 대화 시작 처리 객체
  private readonly chatEndHandler: ChatEndHandler; // 시니어 수동 대화 종료 처리 객체
  private readonly audioMetadataHandler: AudioMetadataHandler; // 음성 메타데이터 처리 객체
  private readonly audioBinaryHandler: AudioBinaryHandler; // 음성 바이너리 처리 객체
  private readonly chatConnectionStateService: ChatConnectionStateService; // 연결별 현재 질문 관리 객체
  private readonly chatInactivityService: ChatInactivityService; // 무응답 안내·자동 종료 타이머 객체
  private readonly lastTurnRecalcTimerService: LastTurnRecalcTimerService; // 마지막 대화 후 정서지수 재계산 타이머 객체
  private readonly questionDeliveryService: QuestionDeliveryService; // 질문 텍스트·TTS 스트리밍 토큰 전달 객체
  private readonly connectionContexts = new WeakMap<
    WebSocket,
    ClientConnectionContext
  >(); // 인증 단계와 인증 중 도착한 메시지를 연결별로 관리

  // NestJS DI 컨테이너가 인증 Handler와 대화 시작 Handler 객체를 생성자에 주입
  constructor(
    chatAuthHandler: ChatAuthHandler,
    chatStartHandler: ChatStartHandler,
    chatEndHandler: ChatEndHandler,
    audioMetadataHandler: AudioMetadataHandler,
    audioBinaryHandler: AudioBinaryHandler,
    chatConnectionStateService: ChatConnectionStateService,
    chatInactivityService: ChatInactivityService,
    lastTurnRecalcTimerService: LastTurnRecalcTimerService,
    questionDeliveryService: QuestionDeliveryService,
  ) {
    this.chatAuthHandler = chatAuthHandler;
    this.chatStartHandler = chatStartHandler;
    this.chatEndHandler = chatEndHandler;
    this.audioMetadataHandler = audioMetadataHandler;
    this.audioBinaryHandler = audioBinaryHandler;
    this.chatConnectionStateService = chatConnectionStateService;
    this.chatInactivityService = chatInactivityService;
    this.lastTurnRecalcTimerService = lastTurnRecalcTimerService;
    this.questionDeliveryService = questionDeliveryService;
  }

  // 역할: WebSocket 연결 성립 후 첫 인증 메시지 수신 대기
  // 다음 호출: ChatAuthHandler.authenticate()
  handleConnection(client: WebSocket): void {
    const authTimeout = setTimeout(() => {
      this.connectionContexts.delete(client);
      client.close(1008, 'WebSocket authentication timeout');
    }, WS_AUTH_TIMEOUT_MS);
    this.connectionContexts.set(client, {
      phase: 'WAITING_FOR_AUTH',
      authTimeout,
      pendingMessages: [],
    });

    // 연결 직후부터 listener 하나를 유지해 비동기 JWT 검증 중 들어온 후속 메시지도 잃지 않는다.
    client.on('message', (data: RawData, isBinary: boolean) => {
      void this.handleClientMessage(client, data, isBinary);
    });
  }

  // 역할: WebSocket 연결 종료 시 연결별 인증정보 제거
  handleDisconnect(client: WebSocket): void {
    const context = this.connectionContexts.get(client);
    if (context !== undefined) clearTimeout(context.authTimeout);
    this.connectionContexts.delete(client);
    this.audioMetadataHandler.clearClient(client);
    this.audioBinaryHandler.clearClient(client);
    this.chatConnectionStateService.clearClient(client);
    this.chatInactivityService.clearClient(client);
  }

  private async handleClientMessage(
    client: WebSocket,
    data: RawData,
    isBinary: boolean,
  ): Promise<void> {
    const context = this.connectionContexts.get(client);
    if (context === undefined) return;

    if (context.phase === 'WAITING_FOR_AUTH') {
      context.phase = 'AUTHENTICATING';
      await this.authenticateConnection(client, context, data, isBinary);
      return;
    }

    if (context.phase === 'AUTHENTICATING') {
      context.pendingMessages.push({ data, isBinary });
      return;
    }

    if (context.authenticatedUser !== undefined) {
      this.routeAuthenticatedMessage(
        client,
        context.authenticatedUser,
        data,
        isBinary,
      );
    }
  }

  // 역할: 인증 Handler 결과를 연결에 보관하고 이후 메시지 수신 등록
  // 연결 객체: ChatAuthHandler, ChatStartHandler
  // 다음 호출: 인증 성공 → ChatStartHandler.handleChatStart()
  private async authenticateConnection(
    client: WebSocket,
    context: ClientConnectionContext,
    data: RawData,
    isBinary: boolean,
  ): Promise<void> {
    const authenticatedUser = await this.chatAuthHandler.authenticate(
      client,
      data,
      isBinary,
    );

    // 인증 실패 시 Handler가 오류 전송과 연결 종료를 완료하므로 수신 등록 중단
    if (authenticatedUser === null) {
      clearTimeout(context.authTimeout);
      this.connectionContexts.delete(client);
      return;
    }

    // 인증 timeout이나 disconnect가 먼저 연결을 정리했다면 늦게 끝난 JWT 결과를 적용하지 않는다.
    if (this.connectionContexts.get(client) !== context) return;

    clearTimeout(context.authTimeout);
    context.phase = 'AUTHENTICATED';
    context.authenticatedUser = authenticatedUser;

    // 서버가 재시작되지 않은 단기 재접속에서는 마지막 현재 질문을 새 연결에 다시 전달한다.
    const restored = this.chatConnectionStateService.restoreClient(
      client,
      authenticatedUser.sub,
    );
    if (restored !== undefined) {
      sendWsEvent(client, 'chat:restored', {
        questionMessageId: restored.questionMessageId,
        generationId: restored.generationId,
      });
      sendWsEvent(client, 'ai:question', {
        messageId: restored.questionMessageId,
        generationId: restored.generationId,
        content: restored.content,
      });
      void this.questionDeliveryService.deliverTtsToken(
        client,
        restored.questionMessageId,
        authenticatedUser.sub,
      );
      this.chatInactivityService.startWaitingForAnswer(client);
      this.lastTurnRecalcTimerService.arm(authenticatedUser.sub);
    }

    // JWT 검증 중 도착한 메시지를 수신 순서대로 처리한다.
    const pendingMessages = context.pendingMessages.splice(0);
    for (const pending of pendingMessages) {
      this.routeAuthenticatedMessage(
        client,
        authenticatedUser,
        pending.data,
        pending.isBinary,
      );
    }
  }

  // 역할: 인증 이후 JSON 이벤트 이름을 확인하고 담당 Handler로 전달
  // 연결 객체: ChatStartHandler, AudioMetadataHandler
  // 다음 호출: chat:start 또는 audio:metadata Handler
  private routeAuthenticatedMessage(
    client: WebSocket,
    authenticatedUser: AccessTokenPayload,
    data: RawData,
    isBinary: boolean,
  ): void {
    if (isBinary) {
      void this.audioBinaryHandler.handleAudioBinary(client, data);
      return;
    }

    try {
      const parsedEvent = parseAuthenticatedClientEvent(rawDataToString(data));

      if (parsedEvent.event === 'chat:start') {
        void this.chatStartHandler.handleChatStart(
          client,
          authenticatedUser,
          parsedEvent,
        );
        return;
      }

      if (parsedEvent.event === 'audio:metadata') {
        const accepted = this.audioMetadataHandler.handleAudioMetadata(
          client,
          authenticatedUser,
          parsedEvent,
        );
        if (accepted) this.chatInactivityService.markAnswerStarted(client);
        return;
      }

      if (parsedEvent.event === 'chat:end') {
        this.chatEndHandler.handleChatEnd(client, parsedEvent);
        return;
      }
    } catch (error: unknown) {
      const parseError =
        error instanceof ClientWsEventParseError ? error : undefined;
      sendWsError(client, {
        code: parseError?.code ?? 'INVALID_EVENT',
        message: '요청한 WebSocket 이벤트를 처리할 수 없습니다.',
        requestEvent: parseError?.requestEvent ?? 'unknown',
        retryable: false,
      });
    }
  }
}
