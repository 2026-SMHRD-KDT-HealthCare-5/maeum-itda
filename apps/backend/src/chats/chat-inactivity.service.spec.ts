/* eslint-disable @typescript-eslint/no-unsafe-assignment -- 전송된 WebSocket JSON envelope 검증용 */
import type WebSocket from 'ws';
import type { EmotionIndexRecalcTriggerService } from '../reports/emotion-index-recalc-trigger.service';
import type { AudioTransferStateService } from './audio-transfer-state.service';
import {
  ChatInactivityService,
  IDLE_WARNING_MS,
  INACTIVITY_TIMEOUT_MS,
} from './chat-inactivity.service';
import type { ChatConnectionStateService } from './chat-connection-state.service';
import type { AudioMetadataHandler } from './handlers/audio-metadata.handler';
import type { QuestionAnswerQueueService } from './question-answer-queue.service';
import type { LastTurnRecalcTimerService } from './last-turn-recalc-timer.service';

describe('ChatInactivityService', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  function createContext() {
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
      getSeniorId: jest.fn().mockReturnValue(7),
      markChatEnded: jest.fn(),
    };
    const recalcTriggerService = { recalcToday: jest.fn() };
    const lastTurnRecalcTimerService = { cancel: jest.fn() };
    const service = new ChatInactivityService(
      queue as unknown as QuestionAnswerQueueService,
      metadata as unknown as AudioMetadataHandler,
      transfer as unknown as AudioTransferStateService,
      state as unknown as ChatConnectionStateService,
      recalcTriggerService as unknown as EmotionIndexRecalcTriggerService,
      lastTurnRecalcTimerService as unknown as LastTurnRecalcTimerService,
    );
    return {
      service,
      client,
      send,
      queue,
      metadata,
      transfer,
      state,
      recalcTriggerService,
      lastTurnRecalcTimerService,
    };
  }

  it('30초 후 안내하고 총 10분 무응답이면 연결을 닫지 않고 대화를 종료한다', () => {
    const context = createContext();

    context.service.startWaitingForAnswer(context.client);
    jest.advanceTimersByTime(IDLE_WARNING_MS);
    expect(JSON.parse(context.send.mock.calls[0][0]) as unknown).toEqual(
      expect.objectContaining({ event: 'chat:idle-warning' }),
    );

    jest.advanceTimersByTime(INACTIVITY_TIMEOUT_MS - IDLE_WARNING_MS);
    expect(context.queue.flush).toHaveBeenCalledWith(101, false);
    expect(context.state.markChatEnded).toHaveBeenCalledWith(context.client);
    expect(JSON.parse(context.send.mock.calls[1][0]) as unknown).toEqual(
      expect.objectContaining({
        event: 'chat:ended',
        payload: expect.objectContaining({ reason: 'INACTIVITY_TIMEOUT' }),
      }),
    );
  });

  it('유휴 타임아웃으로 종료될 때 정서지수 즉시 재계산을 트리거한다', () => {
    const context = createContext();

    context.service.startWaitingForAnswer(context.client);
    jest.advanceTimersByTime(INACTIVITY_TIMEOUT_MS);

    expect(context.recalcTriggerService.recalcToday).toHaveBeenCalledWith(7);
    expect(context.lastTurnRecalcTimerService.cancel).toHaveBeenCalledWith(7);
  });
});
