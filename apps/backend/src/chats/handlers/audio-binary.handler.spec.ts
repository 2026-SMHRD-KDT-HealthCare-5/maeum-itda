/* eslint-disable @typescript-eslint/no-unsafe-assignment -- JSON.parse 반환값을 WebSocket envelope와 비교하는 테스트다. */
import type WebSocket from 'ws';
import type { AudioAnswerRepository } from '../repositories/audio-answer.repository';
import { AudioBinaryHandler } from './audio-binary.handler';
import type { AudioMetadataHandler } from './audio-metadata.handler';
import type { AnalysisService } from '../../analysis/analysis.service';
import type { ChatConnectionStateService } from '../chat-connection-state.service';
import type { QuestionAnswerQueueService } from '../question-answer-queue.service';
import type { AudioTransferStateService } from '../audio-transfer-state.service';
import type { LastTurnRecalcTimerService } from '../last-turn-recalc-timer.service';

describe('AudioBinaryHandler', () => {
  const metadata = {
    audioTransferId: 'audio-transfer-001',
    questionMessageId: 101,
    generationId: 'generation-001',
    mimeType: 'audio/webm;codecs=opus',
    capturedAt: '2026-08-10T06:00:03.500Z',
    endType: 'auto' as const,
    seniorId: 7,
  };

  function createContext(pendingMetadata: typeof metadata | null = metadata) {
    const clientValue = { send: jest.fn<void, [string]>(), readyState: 1 };
    const metadataHandler = {
      takePendingMetadata: jest
        .fn()
        .mockReturnValue(pendingMetadata ?? undefined),
    };
    const answerRepository = {
      savePendingAnswer: jest.fn().mockResolvedValue({ messageId: 102 }),
    };
    const analysisService = {
      enqueueAnswerBatch: jest.fn().mockResolvedValue(undefined),
      isFastApiConnected: jest.fn().mockReturnValue(false),
      processPendingAnswerBatch: jest.fn(),
    };
    const questionAnswerQueueService = {
      assertCanAccept: jest.fn(),
      enqueue: jest.fn().mockReturnValue({
        isBatchOwner: false,
        ready: new Promise(() => undefined),
      }),
    };
    const connectionStateService = {
      setCurrentQuestion: jest.fn(),
      matchesCurrentQuestion: jest.fn().mockReturnValue(true),
      isChatEnded: jest.fn().mockReturnValue(false),
    };
    const transferStateService = {
      find: jest.fn().mockReturnValue(undefined),
      markProcessed: jest.fn(),
      clearClient: jest.fn(),
    };
    const lastTurnRecalcTimerService = { arm: jest.fn() };
    const handler = new AudioBinaryHandler(
      metadataHandler as unknown as AudioMetadataHandler,
      answerRepository as unknown as AudioAnswerRepository,
      questionAnswerQueueService as unknown as QuestionAnswerQueueService,
      analysisService as unknown as AnalysisService,
      connectionStateService as unknown as ChatConnectionStateService,
      transferStateService as unknown as AudioTransferStateService,
      undefined,
      lastTurnRecalcTimerService as unknown as LastTurnRecalcTimerService,
    );

    return {
      handler,
      client: clientValue as unknown as WebSocket,
      send: clientValue.send,
      metadataHandler,
      answerRepository,
      questionAnswerQueueService,
      analysisService,
      connectionStateService,
      transferStateService,
      lastTurnRecalcTimerService,
    };
  }

  it('metadata와 바이너리를 연결해 답변을 저장하고 audio:ack을 전송한다', async () => {
    const context = createContext();

    await context.handler.handleAudioBinary(
      context.client,
      Buffer.from([1, 2, 3]),
    );

    expect(context.metadataHandler.takePendingMetadata).toHaveBeenCalledWith(
      context.client,
    );
    expect(context.answerRepository.savePendingAnswer).toHaveBeenCalledWith(
      7,
      101,
    );
    expect(context.questionAnswerQueueService.enqueue).toHaveBeenCalledWith(
      expect.objectContaining({
        messageId: 102,
        audioTransferId: 'audio-transfer-001',
        audioBuffer: Buffer.from([1, 2, 3]),
      }),
    );
    expect(JSON.parse(context.send.mock.calls[0][0]) as unknown).toEqual(
      expect.objectContaining({
        event: 'audio:ack',
        payload: {
          audioTransferId: 'audio-transfer-001',
          messageId: 102,
        },
      }),
    );
  });

  it('처리한 audioTransferId가 다시 오면 DB 저장 없이 기존 ACK를 재전송한다', async () => {
    const context = createContext();
    context.transferStateService.find.mockReturnValueOnce({ messageId: 102 });

    await context.handler.handleAudioBinary(context.client, Buffer.from([1]));

    expect(context.answerRepository.savePendingAnswer).not.toHaveBeenCalled();
    expect(JSON.parse(context.send.mock.calls[0][0]) as unknown).toEqual(
      expect.objectContaining({
        event: 'audio:ack',
        payload: { audioTransferId: 'audio-transfer-001', messageId: 102 },
      }),
    );
  });

  it('metadata 없이 바이너리가 도착하면 AUDIO_METADATA_MISSING을 전송한다', async () => {
    const context = createContext(null);

    await context.handler.handleAudioBinary(context.client, Buffer.from([1]));

    expect(context.answerRepository.savePendingAnswer).not.toHaveBeenCalled();
    expect(JSON.parse(context.send.mock.calls[0][0]) as unknown).toEqual(
      expect.objectContaining({
        event: 'error',
        payload: expect.objectContaining({ code: 'AUDIO_METADATA_MISSING' }),
      }),
    );
  });

  it('빈 바이너리를 거부한다', async () => {
    const context = createContext();

    await context.handler.handleAudioBinary(context.client, Buffer.alloc(0));

    expect(context.answerRepository.savePendingAnswer).not.toHaveBeenCalled();
    expect(JSON.parse(context.send.mock.calls[0][0]) as unknown).toEqual(
      expect.objectContaining({
        payload: expect.objectContaining({ code: 'EMPTY_AUDIO_BINARY' }),
      }),
    );
  });

  it('10MB를 초과하는 바이너리를 거부한다', async () => {
    const context = createContext();

    await context.handler.handleAudioBinary(
      context.client,
      Buffer.alloc(10 * 1024 * 1024 + 1),
    );

    expect(context.answerRepository.savePendingAnswer).not.toHaveBeenCalled();
    expect(JSON.parse(context.send.mock.calls[0][0]) as unknown).toEqual(
      expect.objectContaining({
        payload: expect.objectContaining({ code: 'AUDIO_TOO_LARGE' }),
      }),
    );
  });

  it('답변 저장에 실패하면 AUDIO_SAVE_FAILED를 전송한다', async () => {
    const context = createContext();
    context.answerRepository.savePendingAnswer.mockRejectedValueOnce(
      new Error('db failed'),
    );

    await context.handler.handleAudioBinary(context.client, Buffer.from([1]));

    expect(JSON.parse(context.send.mock.calls[0][0]) as unknown).toEqual(
      expect.objectContaining({
        payload: expect.objectContaining({ code: 'AUDIO_SAVE_FAILED' }),
      }),
    );
  });

  it('다음 질문을 전송하면 마지막 턴 재계산 타이머를 다시 시작한다', async () => {
    const context = createContext();
    context.analysisService.isFastApiConnected.mockReturnValue(true);
    context.analysisService.processPendingAnswerBatch.mockResolvedValue({
      answerTranscripts: [],
      nextQuestion: {
        messageId: 103,
        generationId: 'generation-002',
        content: '산책하면서 무엇이 좋으셨어요?',
      },
    });
    context.questionAnswerQueueService.enqueue.mockReturnValueOnce({
      isBatchOwner: true,
      ready: Promise.resolve({
        questionMessageId: 101,
        seniorId: 7,
        continueConversation: true,
      }),
    });

    await context.handler.handleAudioBinary(context.client, Buffer.from([1]));
    await new Promise<void>((resolve) => setImmediate(resolve));

    expect(context.lastTurnRecalcTimerService.arm).toHaveBeenCalledWith(7);
  });

  it('다음 질문이 없는 늦은 답변이어도 STT 결과는 audio:transcript로 전송한다', async () => {
    const context = createContext();
    context.analysisService.isFastApiConnected.mockReturnValue(true);
    context.analysisService.processPendingAnswerBatch.mockResolvedValue({
      answerTranscripts: [{ messageId: 102, content: '오늘 산책했어요.' }],
      nextQuestion: null,
    });
    context.questionAnswerQueueService.enqueue.mockReturnValueOnce({
      isBatchOwner: true,
      ready: Promise.resolve({
        questionMessageId: 101,
        continueConversation: true,
      }),
    });

    await context.handler.handleAudioBinary(context.client, Buffer.from([1]));
    await new Promise<void>((resolve) => setImmediate(resolve));

    const events = context.send.mock.calls.map(
      (call) => JSON.parse(call[0]) as { event?: string; payload?: unknown },
    );
    expect(events).toContainEqual(
      expect.objectContaining({
        event: 'audio:transcript',
        payload: {
          transcripts: [{ messageId: 102, content: '오늘 산책했어요.' }],
        },
      }),
    );
    expect(events.some((event) => event.event === 'ai:question')).toBe(false);
  });

  it('답변 묶음 준비 Promise가 실패하면 AUDIO_ANALYSIS_FAILED를 전송한다', async () => {
    const context = createContext();
    context.questionAnswerQueueService.enqueue.mockReturnValueOnce({
      isBatchOwner: true,
      ready: Promise.reject(new Error('batch failed')),
    });

    await context.handler.handleAudioBinary(context.client, Buffer.from([1]));
    await new Promise<void>((resolve) => setImmediate(resolve));

    expect(
      context.send.mock.calls.some((call) => {
        const event = JSON.parse(call[0]) as {
          event?: string;
          payload?: { code?: string };
        };
        return (
          event.event === 'error' &&
          event.payload?.code === 'AUDIO_ANALYSIS_FAILED'
        );
      }),
    ).toBe(true);
  });
});
