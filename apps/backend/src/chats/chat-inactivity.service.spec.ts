/* eslint-disable @typescript-eslint/no-unsafe-assignment -- 전송된 WebSocket JSON envelope 검증용 */
import type WebSocket from 'ws';
import type { AudioTransferStateService } from './audio-transfer-state.service';
import {
  ChatInactivityService,
  IDLE_WARNING_MS,
  INACTIVITY_TIMEOUT_MS,
} from './chat-inactivity.service';
import type { ChatConnectionStateService } from './chat-connection-state.service';
import type { AudioMetadataHandler } from './handlers/audio-metadata.handler';
import type { QuestionAnswerQueueService } from './question-answer-queue.service';

describe('ChatInactivityService', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it('30초 후 안내하고 총 2분 무응답이면 연결을 닫지 않고 대화를 종료한다', () => {
    const send = jest.fn<void, [string]>();
    const client = { send, readyState: 1 } as unknown as WebSocket;
    const queue = { flush: jest.fn() };
    const metadata = { clearClient: jest.fn() };
    const transfer = { clearClient: jest.fn() };
    const state = {
      getCurrentQuestion: jest.fn().mockReturnValue({
        questionMessageId: 101,
        generationId: 'generation-001',
        content: '오늘 하루는 어떠셨어요?',
      }),
      markChatEnded: jest.fn(),
    };
    const service = new ChatInactivityService(
      queue as unknown as QuestionAnswerQueueService,
      metadata as unknown as AudioMetadataHandler,
      transfer as unknown as AudioTransferStateService,
      state as unknown as ChatConnectionStateService,
    );

    service.startWaitingForAnswer(client);
    jest.advanceTimersByTime(IDLE_WARNING_MS);
    expect(JSON.parse(send.mock.calls[0][0]) as unknown).toEqual(
      expect.objectContaining({ event: 'chat:idle-warning' }),
    );

    jest.advanceTimersByTime(INACTIVITY_TIMEOUT_MS - IDLE_WARNING_MS);
    expect(queue.flush).toHaveBeenCalledWith(101, false);
    expect(state.markChatEnded).toHaveBeenCalledWith(client);
    expect(JSON.parse(send.mock.calls[1][0]) as unknown).toEqual(
      expect.objectContaining({
        event: 'chat:ended',
        payload: expect.objectContaining({ reason: 'INACTIVITY_TIMEOUT' }),
      }),
    );
  });
});
