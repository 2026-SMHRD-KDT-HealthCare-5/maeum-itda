/*
역할: /ws/chats 연결·종료와 WebSocket 이벤트를 받는 입구다.
전체 흐름: 브라우저 ↔ ChatsGateway → AuthService 또는 ChatsService
 */
import {
  OnGatewayConnection,
  OnGatewayDisconnect,
  WebSocketGateway,
} from '@nestjs/websockets';
import { ChatsService } from './chats.service';
import { AuthService } from '../auth/auth.service';

// 브라우저의 /ws/chats 연결 요청과 텍스트 이벤트·음성 바이너리를 이 Gateway로 전달한다.
// 운영 환경에서는 TLS가 적용된 WSS로 연결한다.
@WebSocketGateway({
  path: '/ws/chats',
})
export class ChatsGateway implements OnGatewayConnection, OnGatewayDisconnect {
  private readonly chatsService: ChatsService;
  private readonly authService: AuthService;

  // NestJS DI 컨테이너가 ChatsService와 AuthService 객체를 생성자에 주입한다.
  constructor(chatsService: ChatsService, authService: AuthService) {
    this.chatsService = chatsService;
    this.authService = authService;
  }

  // WebSocket 연결이 성립되면 NestJS가 자동으로 호출한다.
  handleConnection(): void {
    console.log('WebSocket 연결');
  }

  // WebSocket 연결이 끊어지면 NestJS가 자동으로 호출한다.
  handleDisconnect(): void {
    console.log('WebSocket 연결 종료');
  }
}
