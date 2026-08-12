import type WebSocket from 'ws';
import { UserRole } from '../../users/entities/user.entity';
import type { ChatsService } from '../chats.service';
import { ChatStartHandler } from './chat-start.handler';
import type { ChatConnectionStateService } from '../chat-connection-state.service';

describe('ChatStartHandler', () => {
  it('chat:start 수신 시 chat:started와 ai:question을 순서대로 전송한다', async () => {
    const chatsService = {
      startChat: jest.fn().mockResolvedValue({
        messageId: 101,
        generationId: 'generation-001',
        content: '오늘 하루는 어땠나요?',
      }),
    };
    const client = { send: jest.fn<void, [string]>() };
    const chatConnectionStateService = {
      getCurrentQuestion: jest.fn().mockReturnValue(undefined),
      setCurrentQuestion: jest.fn(),
    };
    const handler = new ChatStartHandler(
      chatsService as unknown as ChatsService,
      chatConnectionStateService as unknown as ChatConnectionStateService,
    );

    await handler.handleChatStart(
      client as unknown as WebSocket,
      { sub: 1, role: UserRole.SENIOR },
      Buffer.from(
        JSON.stringify({
          event: 'chat:start',
          payload: {},
          ts: '2026-08-07T10:00:01.000Z',
        }),
      ),
      false,
    );

    expect(chatsService.startChat).toHaveBeenCalledWith(1);
    expect(chatConnectionStateService.setCurrentQuestion).toHaveBeenCalledWith(
      client,
      expect.objectContaining({ messageId: 101 }),
      1,
    );
    expect(
      client.send.mock.calls.map(([message]) => JSON.parse(message) as unknown),
    ).toEqual([
      expect.objectContaining({ event: 'chat:started', payload: {} }),
      expect.objectContaining({
        event: 'ai:question',
        // jest의 objectContaining() 반환형이 any라 중첩 시 no-unsafe-assignment가 오탐한다
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        payload: expect.objectContaining({ messageId: 101 }),
      }),
    ]);
  });

  it('진행 중인 대화에서 chat:start를 다시 받으면 시작을 거부한다', async () => {
    const chatsService = { startChat: jest.fn() };
    const client = { send: jest.fn<void, [string]>() };
    const state = {
      getCurrentQuestion: jest.fn().mockReturnValue({
        questionMessageId: 101,
        generationId: 'generation-001',
      }),
      setCurrentQuestion: jest.fn(),
    };
    const handler = new ChatStartHandler(
      chatsService as unknown as ChatsService,
      state as unknown as ChatConnectionStateService,
    );

    await handler.handleChatStart(
      client as unknown as WebSocket,
      { sub: 1, role: UserRole.SENIOR },
      Buffer.from(
        JSON.stringify({
          event: 'chat:start',
          payload: {},
          ts: '2026-08-12T00:00:00.000Z',
        }),
      ),
      false,
    );

    expect(chatsService.startChat).not.toHaveBeenCalled();
    expect(JSON.parse(client.send.mock.calls[0][0]) as unknown).toEqual(
      expect.objectContaining({
        event: 'error',
        // jest의 objectContaining() 반환형이 any라 중첩 시 no-unsafe-assignment가 오탐한다.
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        payload: expect.objectContaining({ code: 'CHAT_ALREADY_STARTED' }),
      }),
    );
  });
});
