import type WebSocket from 'ws';
import type { AuthService } from '../../auth/auth.service';
import { UserRole } from '../../users/entities/user.entity';
import { ChatAuthHandler } from './chat-auth.handler';

describe('ChatAuthHandler', () => {
  it('JWT 인증 성공 시 auth:success를 전송하고 사용자 정보를 반환한다', async () => {
    const user = { sub: 1, role: UserRole.SENIOR };
    const authService = {
      verifyAccessToken: jest.fn().mockResolvedValue(user),
    };
    const client = { send: jest.fn(), close: jest.fn() };
    const handler = new ChatAuthHandler(authService as unknown as AuthService);

    const result = await handler.authenticate(
      client as unknown as WebSocket,
      Buffer.from(
        JSON.stringify({
          event: 'auth',
          payload: { accessToken: 'token' },
          ts: '2026-08-07T10:00:00.000Z',
        }),
      ),
      false,
    );

    expect(result).toEqual(user);
    expect(authService.verifyAccessToken).toHaveBeenCalledWith('token');
    expect(JSON.parse(client.send.mock.calls[0][0] as string)).toEqual(
      expect.objectContaining({
        event: 'auth:success',
        payload: { userId: 1, role: UserRole.SENIOR },
      }),
    );
  });

  it('JWT 인증 실패 시 auth:error를 전송하고 연결을 종료한다', async () => {
    const authService = {
      verifyAccessToken: jest.fn().mockRejectedValue(new Error()),
    };
    const client = { send: jest.fn(), close: jest.fn() };
    const handler = new ChatAuthHandler(authService as unknown as AuthService);

    const result = await handler.authenticate(
      client as unknown as WebSocket,
      Buffer.from(
        JSON.stringify({
          event: 'auth',
          payload: { accessToken: 'invalid' },
          ts: '2026-08-07T10:00:00.000Z',
        }),
      ),
      false,
    );

    expect(result).toBeNull();
    expect(JSON.parse(client.send.mock.calls[0][0] as string)).toEqual(
      expect.objectContaining({
        event: 'auth:error',
        payload: {
          message: '유효하지 않거나 만료된 인증정보입니다.',
        },
      }),
    );
    expect(client.close).toHaveBeenCalledWith(
      1008,
      'WebSocket authentication failed',
    );
  });
});
