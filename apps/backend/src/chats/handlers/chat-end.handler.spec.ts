/* eslint-disable @typescript-eslint/no-unsafe-assignment -- JSON.parse 반환값을 WebSocket envelope와 비교하는 테스트다. */
/*
역할: 수동 종료 시 질문 큐 확정, 연결 상태 정리, chat:ended 전송을 검증한다.
*/
import type WebSocket from 'ws';
import type { ChatConnectionStateService } from '../chat-connection-state.service';
import type { QuestionAnswerQueueService } from '../question-answer-queue.service';
import type { AudioBinaryHandler } from './audio-binary.handler';
import { ChatEndHandler } from './chat-end.handler';
import type { AudioMetadataHandler } from './audio-metadata.handler';

describe('ChatEndHandler', () => {
  function createContext() {
    const send = jest.fn<void, [string]>();
    const client = { send } as unknown as WebSocket;
    const queue = { flush: jest.fn() };
    const metadata = { clearClient: jest.fn() };
    const binary = { clearClient: jest.fn() };
    const state = {
      getCurrentQuestion: jest.fn().mockReturnValue({
        questionMessageId: 101,
        generationId: 'generation-001',
      }),
      markChatEnded: jest.fn(),
    };
    const handler = new ChatEndHandler(
      queue as unknown as QuestionAnswerQueueService,
      metadata as unknown as AudioMetadataHandler,
      binary as unknown as AudioBinaryHandler,
      state as unknown as ChatConnectionStateService,
    );
    return { handler, client, send, queue, metadata, binary, state };
  }

  it('남은 질문 큐와 연결 상태를 정리하고 chat:ended를 전송한다', () => {
    const context = createContext();
    context.handler.handleChatEnd(
      context.client,
      Buffer.from(
        JSON.stringify({
          event: 'chat:end',
          payload: { reason: 'USER_REQUESTED' },
          ts: '2026-08-12T00:00:00.000Z',
        }),
      ),
      false,
    );

    expect(context.queue.flush).toHaveBeenCalledWith(101, false);
    expect(context.metadata.clearClient).toHaveBeenCalledWith(context.client);
    expect(context.binary.clearClient).toHaveBeenCalledWith(context.client);
    expect(context.state.markChatEnded).toHaveBeenCalledWith(context.client);
    expect(JSON.parse(context.send.mock.calls[0][0]) as unknown).toEqual(
      expect.objectContaining({
        event: 'chat:ended',
        payload: {
          reason: 'USER_REQUESTED',
          endedAt: expect.any(String),
        },
      }),
    );
  });

  it('지원하지 않는 종료 사유를 거부하고 상태를 정리하지 않는다', () => {
    const context = createContext();
    context.handler.handleChatEnd(
      context.client,
      Buffer.from(
        JSON.stringify({
          event: 'chat:end',
          payload: { reason: 'TIMEOUT' },
          ts: '2026-08-12T00:00:00.000Z',
        }),
      ),
      false,
    );

    expect(context.queue.flush).not.toHaveBeenCalled();
    expect(context.state.markChatEnded).not.toHaveBeenCalled();
    expect(JSON.parse(context.send.mock.calls[0][0]) as unknown).toEqual(
      expect.objectContaining({
        event: 'error',
        payload: expect.objectContaining({
          requestEvent: 'chat:end',
          retryable: false,
        }),
      }),
    );
  });
});
