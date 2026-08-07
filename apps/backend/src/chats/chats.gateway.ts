/*
역할: /ws/chats 연결·종료 감지와 수신 메시지 전달
연결 객체: ChatAuthHandler, ChatStartHandler
전체 흐름: 브라우저 → ChatsGateway → ChatAuthHandler(JWT인증)→ ChatStartHandler(대화시작)
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

// WebSocket 연결 경로: ws://서버주소/ws/chats
// 운영 배포에서 HTTPS/TLS가 적용되면 같은 경로를 wss://로 사용
@WebSocketGateway({
  path: '/ws/chats',
})
export class ChatsGateway implements OnGatewayConnection, OnGatewayDisconnect {
  private readonly chatAuthHandler: ChatAuthHandler; // 첫 메시지 JWT 인증 처리 객체
  private readonly chatStartHandler: ChatStartHandler; // 인증 후 대화 시작 처리 객체
  private readonly authenticatedClients: WeakMap<WebSocket, AccessTokenPayload>; // 연결별 인증 사용자 정보

  // NestJS DI 컨테이너가 인증 Handler와 대화 시작 Handler 객체를 생성자에 주입
  constructor(
    chatAuthHandler: ChatAuthHandler,
    chatStartHandler: ChatStartHandler,
  ) {
    this.chatAuthHandler = chatAuthHandler;
    this.chatStartHandler = chatStartHandler;
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

    // 인증 이후 수신하는 chat:start 이벤트를 대화 시작 Handler에 전달
    client.on('message', (messageData: RawData, messageIsBinary: boolean) => {
      void this.chatStartHandler.handleChatStart(
        client,
        authenticatedUser,
        messageData,
        messageIsBinary,
      );
    });
  }
}
