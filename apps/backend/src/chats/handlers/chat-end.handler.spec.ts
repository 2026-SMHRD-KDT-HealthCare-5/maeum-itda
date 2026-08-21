/* eslint-disable @typescript-eslint/no-unsafe-assignment -- JSON.parse 반환값을 WebSocket envelope와 비교하는 테스트다. */
/*
역할: 수동 종료 시 질문 큐 확정, 연결 상태 정리, chat:ended 전송을 검증한다.
*/
import type WebSocket from 'ws';
import type { EmotionIndexRecalcTriggerService } from '../../reports/emotion-index-recalc-trigger.service';
import type { ChatConnectionStateService } from '../chat-connection-state.service';
import type { QuestionAnswerQueueService } from '../question-answer-queue.service';
import type { AudioBinaryHandler } from './audio-binary.handler';
import { ChatEndHandler } from './chat-end.handler';
import type { AudioMetadataHandler } from './audio-metadata.handler';
import type { ChatEndEvent } from '../client-ws-event';
import type { ChatInactivityService } from '../chat-inactivity.service';
import type { LastTurnRecalcTimerService } from '../last-turn-recalc-timer.service';

const chatEndEvent: ChatEndEvent = {
  event: 'chat:end',
  payload: { reason: 'USER_REQUESTED' },
  ts: '2026-08-12T00:00:00.000Z',
};

describe('ChatEndHandler', () => {
  function createContext() {
    const send = jest.fn<void, [string]>();
    const client = { send, readyState: 1 } as unknown as WebSocket;
    const queue = { flush: jest.fn(), clearCounters: jest.fn() };
    const metadata = { clearClient: jest.fn() };
    const binary = { clearClient: jest.fn() };
    const state = {
      getCurrentQuestion: jest.fn().mockReturnValue({
        questionMessageId: 101,
        generationId: 'generation-001',
      }),
      getSeniorId: jest.fn().mockReturnValue(7),
      markChatEnded: jest.fn(),
    };
    const recalcTriggerService = { recalcToday: jest.fn() };
    const chatInactivityService = { clearClient: jest.fn() };
    const lastTurnRecalcTimerService = { cancel: jest.fn() };
    const handler = new ChatEndHandler(
      queue as unknown as QuestionAnswerQueueService,
      metadata as unknown as AudioMetadataHandler,
      binary as unknown as AudioBinaryHandler,
      state as unknown as ChatConnectionStateService,
      chatInactivityService as unknown as ChatInactivityService,
      recalcTriggerService as unknown as EmotionIndexRecalcTriggerService,
      lastTurnRecalcTimerService as unknown as LastTurnRecalcTimerService,
    );
    return {
      handler,
      client,
      send,
      queue,
      metadata,
      binary,
      state,
      recalcTriggerService,
      lastTurnRecalcTimerService,
    };
  }

  it('남은 질문 큐와 연결 상태를 정리하고 chat:ended를 전송한다', () => {
    const context = createContext();
    context.handler.handleChatEnd(context.client, chatEndEvent);

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

  it('markChatEnded 이전에 조회한 seniorId로 정서지수 즉시 재계산을 트리거한다', () => {
    const context = createContext();
    context.handler.handleChatEnd(context.client, chatEndEvent);

    expect(context.recalcTriggerService.recalcToday).toHaveBeenCalledWith(7);
    expect(context.lastTurnRecalcTimerService.cancel).toHaveBeenCalledWith(7);
  });

  it('seniorId를 알 수 없으면 재계산을 트리거하지 않는다', () => {
    const context = createContext();
    context.state.getSeniorId.mockReturnValue(undefined);

    context.handler.handleChatEnd(context.client, chatEndEvent);

    expect(context.recalcTriggerService.recalcToday).not.toHaveBeenCalled();
  });
});
