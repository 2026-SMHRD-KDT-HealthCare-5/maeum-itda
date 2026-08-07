import type WebSocket from 'ws';
import { UserRole } from '../../users/entities/user.entity';
import type { ChatsService } from '../chats.service';
import { ChatStartHandler } from './chat-start.handler';
import type { ChatConnectionStateService } from '../chat-connection-state.service';

describe('ChatStartHandler', () => {
  it('chat:start 수신 시 chat:started와 ai:question을 순서대로 전송한다', async () => {
    const chatsService = {
      startChat: jest.fn().mockResolvedValue({
        aiQuestionMessageId: 101,
        generationId: 'generation-001',
        content: '오늘 하루는 어땠나요?',
      }),
    };
    const client = { send: jest.fn() };
    const chatConnectionStateService = { setCurrentQuestion: jest.fn() };
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
      expect.objectContaining({ aiQuestionMessageId: 101 }),
    );
    expect(
      client.send.mock.calls.map(([message]) => JSON.parse(message as string)),
    ).toEqual([
      expect.objectContaining({ event: 'chat:started', payload: {} }),
      expect.objectContaining({
        event: 'ai:question',
        payload: expect.objectContaining({ aiQuestionMessageId: 101 }),
      }),
    ]);
  });
});
