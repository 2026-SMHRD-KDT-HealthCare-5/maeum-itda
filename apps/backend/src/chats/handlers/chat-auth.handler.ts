/*
역할: WebSocket 연결 후 첫 auth 이벤트 검증과 JWT 인증 처리
연결 객체: AuthService, WebSocket 연결 객체
전체 흐름: ChatsGateway → ChatAuthHandler → AuthService → JwtService → auth:success 또는 auth:error
*/
import { Injectable } from '@nestjs/common';
import type WebSocket from 'ws';
import type { RawData } from 'ws';
import { AccessTokenPayload, AuthService } from '../../auth/auth.service';
import { UserRole } from '../../users/entities/user.entity';
import { rawDataToString, sendWsEvent } from '../ws-event';

// 프론트가 WebSocket 연결 후 첫 메시지로 보내는 JWT 인증 형식
interface AuthEvent {
  event: 'auth';
  payload: {
    accessToken: string;
  };
  ts: string;
}

@Injectable()
export class ChatAuthHandler {
  private readonly authService: AuthService; // JWT 검증 업무 객체

  // NestJS DI 컨테이너가 AuthService 객체를 생성자에 주입
  constructor(authService: AuthService) {
    this.authService = authService;
  }

  // 역할: auth 이벤트에서 Access Token을 꺼내 시니어 사용자 인증
  // 연결 객체: AuthService, WebSocket 연결 객체
  // 다음 호출: AuthService.verifyAccessToken() → auth:success 또는 auth:error
  async authenticate(
    client: WebSocket,
    data: RawData,
    isBinary: boolean,
  ): Promise<AccessTokenPayload | null> {
    try {
      if (isBinary) {
        throw new Error('인증 이벤트는 JSON 형식이어야 합니다.');
      }

      const authEvent = this.parseAuthEvent(rawDataToString(data));
      const authenticatedUser = await this.authService.verifyAccessToken(
        authEvent.payload.accessToken,
      );

      // 시니어 전용 대화 경로이므로 SENIOR 역할만 연결 허용
      if (authenticatedUser.role !== UserRole.SENIOR) {
        throw new Error('시니어 계정만 대화에 연결할 수 있습니다.');
      }

      this.handleAuthSuccess(client, authenticatedUser);
      return authenticatedUser;
    } catch {
      this.handleAuthError(client);
      return null;
    }
  }

  // 역할: JWT와 사용자 역할 검증 성공 결과 전송
  // 연결 객체: WebSocket 연결 객체, 인증된 사용자 정보
  // 다음 호출: ChatsGateway가 사용자 정보 보관 → chat:start 수신 대기
  private handleAuthSuccess(
    client: WebSocket,
    authenticatedUser: AccessTokenPayload,
  ): void {
    sendWsEvent(client, 'auth:success', {
      userId: authenticatedUser.sub,
      role: authenticatedUser.role,
    });
  }

  // 역할: JWT 또는 사용자 역할 검증 실패 결과 전송과 연결 종료
  // 연결 객체: WebSocket 연결 객체
  // 다음 호출: auth:error 전송 → 정책 위반 코드 1008로 연결 종료
  private handleAuthError(client: WebSocket): void {
    sendWsEvent(client, 'auth:error', {
      message: '유효하지 않거나 만료된 인증정보입니다.',
    });
    client.close(1008, 'WebSocket authentication failed');
  }

  // 역할: 수신 문자열을 JSON으로 변환하고 auth 이벤트 필수값 확인
  // 다음 호출: 검증 성공 → AuthService.verifyAccessToken()
  private parseAuthEvent(message: string): AuthEvent {
    const parsedMessage: unknown = JSON.parse(message);

    if (
      typeof parsedMessage !== 'object' ||
      parsedMessage === null ||
      !('event' in parsedMessage) ||
      parsedMessage.event !== 'auth' ||
      !('payload' in parsedMessage) ||
      typeof parsedMessage.payload !== 'object' ||
      parsedMessage.payload === null ||
      !('accessToken' in parsedMessage.payload) ||
      typeof parsedMessage.payload.accessToken !== 'string' ||
      parsedMessage.payload.accessToken.length === 0 ||
      !('ts' in parsedMessage) ||
      typeof parsedMessage.ts !== 'string' ||
      parsedMessage.ts.length === 0
    ) {
      throw new Error('유효하지 않은 WebSocket 인증 이벤트입니다.');
    }

    return {
      event: 'auth',
      payload: { accessToken: parsedMessage.payload.accessToken },
      ts: parsedMessage.ts,
    };
  }
}
