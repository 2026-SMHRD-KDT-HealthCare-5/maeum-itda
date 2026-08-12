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
  private readonly authenticatedClients: WeakMap<WebSocket, AccessTokenPayload>; // 연결별 인증 사용자 정보

  // NestJS DI 컨테이너가 인증 Handler와 대화 시작 Handler 객체를 생성자에 주입
  constructor(
    chatAuthHandler: ChatAuthHandler,
    chatStartHandler: ChatStartHandler,
    chatEndHandler: ChatEndHandler,
    audioMetadataHandler: AudioMetadataHandler,
    audioBinaryHandler: AudioBinaryHandler,
    chatConnectionStateService: ChatConnectionStateService,
    private readonly chatInactivityService?: ChatInactivityService,
  ) {
    this.chatAuthHandler = chatAuthHandler;
    this.chatStartHandler = chatStartHandler;
    this.chatEndHandler = chatEndHandler;
    this.audioMetadataHandler = audioMetadataHandler;
    this.audioBinaryHandler = audioBinaryHandler;
    this.chatConnectionStateService = chatConnectionStateService;
    this.authenticatedClients = new WeakMap<WebSocket, AccessTokenPayload>();
  }

  // 역할: WebSocket 연결 성립 후 첫 인증 메시지 수신 대기
  // 다음 호출: ChatAuthHandler.authenticate()
  handleConnection(client: WebSocket): void {
    client.once('message', (data: RawData, isBinary: boolean) => {
      void this.authenticateConnection(client, data, isBinary);
    });
  }

  // 역할: WebSocket 연결 종료 시 연결별 인증정보 제거
  handleDisconnect(client: WebSocket): void {
    this.authenticatedClients.delete(client);
    this.audioMetadataHandler.clearClient(client);
    this.audioBinaryHandler.clearClient(client);
    this.chatConnectionStateService.clearClient(client);
    this.chatInactivityService?.clearClient(client);
  }

  // 역할: 인증 Handler 결과를 연결에 보관하고 이후 메시지 수신 등록
  // 연결 객체: ChatAuthHandler, ChatStartHandler
  // 다음 호출: 인증 성공 → ChatStartHandler.handleChatStart()
  private async authenticateConnection(
    client: WebSocket,
    data: RawData,
    isBinary: boolean,
  ): Promise<void> {
    const authenticatedUser = await this.chatAuthHandler.authenticate(
      client,
      data,
      isBinary,
    );

    // 인증 실패 시 Handler가 오류 전송과 연결 종료를 완료하므로 수신 등록 중단
    if (authenticatedUser === null) return;

    this.authenticatedClients.set(client, authenticatedUser);

    // 서버가 재시작되지 않은 단기 재접속에서는 마지막 현재 질문을 새 연결에 다시 전달한다.
    const restored = this.chatConnectionStateService.restoreClient?.(
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
      this.chatInactivityService?.startWaitingForAnswer(client);
    }

    // 인증 이후 수신하는 JSON·바이너리 메시지를 이벤트 분배 메서드에 전달
    client.on('message', (messageData: RawData, messageIsBinary: boolean) => {
      this.routeAuthenticatedMessage(
        client,
        authenticatedUser,
        messageData,
        messageIsBinary,
      );
    });
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
      const parsedEvent: unknown = JSON.parse(rawDataToString(data));
      if (
        typeof parsedEvent !== 'object' ||
        parsedEvent === null ||
        !('event' in parsedEvent) ||
        typeof parsedEvent.event !== 'string'
      ) {
        throw new Error('이벤트 이름이 없습니다.');
      }

      if (parsedEvent.event === 'chat:start') {
        void this.chatStartHandler.handleChatStart(
          client,
          authenticatedUser,
          data,
          false,
        );
        return;
      }

      if (parsedEvent.event === 'audio:metadata') {
        const accepted = this.audioMetadataHandler.handleAudioMetadata(
          client,
          authenticatedUser,
          data,
          false,
        );
        if (accepted) this.chatInactivityService?.markAnswerStarted(client);
        return;
      }

      if (parsedEvent.event === 'chat:end') {
        this.chatEndHandler.handleChatEnd(client, data, false);
        return;
      }

      throw new Error('지원하지 않는 이벤트입니다.');
    } catch {
      sendWsError(client, {
        code: 'INVALID_EVENT',
        message: '요청한 WebSocket 이벤트를 처리할 수 없습니다.',
        requestEvent: 'unknown',
        retryable: false,
      });
    }
  }
}
