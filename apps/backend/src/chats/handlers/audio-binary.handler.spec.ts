/* eslint-disable @typescript-eslint/no-unsafe-assignment -- JSON.parse 반환값을 WebSocket envelope와 비교하는 테스트다. */
import type WebSocket from 'ws';
import { AudioBinaryHandler } from './audio-binary.handler';
import type { AudioMetadataHandler } from './audio-metadata.handler';
import type { AnalysisService } from '../../analysis/analysis.service';
import type { ChatConnectionStateService } from '../chat-connection-state.service';
import type { QuestionAnswerQueueService } from '../question-answer-queue.service';
import type { AudioTransferStateService } from '../audio-transfer-state.service';
import type { LastTurnRecalcTimerService } from '../last-turn-recalc-timer.service';
import type { ChatInactivityService } from '../chat-inactivity.service';
import { QuestionDeliveryService } from '../question-delivery.service';
import type { TtsClient } from '../../analysis/tts.client';

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
    const analysisService = {
      enqueueAnswerBatch: jest.fn().mockResolvedValue(undefined),
      isFastApiConfigured: jest.fn().mockReturnValue(false),
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
      has: jest.fn().mockReturnValue(false),
      markProcessed: jest.fn(),
      clearClient: jest.fn(),
    };
    const lastTurnRecalcTimerService = { arm: jest.fn() };
    const chatInactivityService = { startWaitingForAnswer: jest.fn() };
    // 기본값은 실패로 둔다 — 대부분 테스트는 TTS 내용과 무관하고, 실패해도
    // deliverTtsWhenReady가 조용히 무시하도록 만들어져 있다(실제 구현과 동일한 경로).
    const ttsClient = {
      synthesize: jest.fn().mockRejectedValue(new Error('tts unavailable')),
    };
    const handler = new AudioBinaryHandler(
      metadataHandler as unknown as AudioMetadataHandler,
      questionAnswerQueueService as unknown as QuestionAnswerQueueService,
      analysisService as unknown as AnalysisService,
      connectionStateService as unknown as ChatConnectionStateService,
      transferStateService as unknown as AudioTransferStateService,
      chatInactivityService as unknown as ChatInactivityService,
      lastTurnRecalcTimerService as unknown as LastTurnRecalcTimerService,
      new QuestionDeliveryService(),
      ttsClient as unknown as TtsClient,
    );

    return {
      handler,
      client: clientValue as unknown as WebSocket,
      send: clientValue.send,
      metadataHandler,
      questionAnswerQueueService,
      analysisService,
      connectionStateService,
      transferStateService,
      lastTurnRecalcTimerService,
      ttsClient,
    };
  }

  it('metadata와 바이너리를 연결해 질문별 큐에 등록하고 audio:ack을 전송한다', () => {
    const context = createContext();

    context.handler.handleAudioBinary(context.client, Buffer.from([1, 2, 3]));

    expect(context.metadataHandler.takePendingMetadata).toHaveBeenCalledWith(
      context.client,
    );
    expect(context.questionAnswerQueueService.enqueue).toHaveBeenCalledWith(
      expect.objectContaining({
        audioTransferId: 'audio-transfer-001',
        audioBuffer: Buffer.from([1, 2, 3]),
      }),
    );
    expect(context.transferStateService.markProcessed).toHaveBeenCalledWith(
      context.client,
      'audio-transfer-001',
    );
    expect(JSON.parse(context.send.mock.calls[0][0]) as unknown).toEqual(
      expect.objectContaining({
        event: 'audio:ack',
        payload: { audioTransferId: 'audio-transfer-001' },
      }),
    );
  });

  it('처리한 audioTransferId가 다시 오면 큐에 다시 등록하지 않고 기존 ACK를 재전송한다', () => {
    const context = createContext();
    context.transferStateService.has.mockReturnValueOnce(true);

    context.handler.handleAudioBinary(context.client, Buffer.from([1]));

    expect(context.questionAnswerQueueService.enqueue).not.toHaveBeenCalled();
    expect(JSON.parse(context.send.mock.calls[0][0]) as unknown).toEqual(
      expect.objectContaining({
        event: 'audio:ack',
        payload: { audioTransferId: 'audio-transfer-001' },
      }),
    );
  });

  it('metadata 없이 바이너리가 도착하면 AUDIO_METADATA_MISSING을 전송한다', () => {
    const context = createContext(null);

    context.handler.handleAudioBinary(context.client, Buffer.from([1]));

    expect(context.questionAnswerQueueService.enqueue).not.toHaveBeenCalled();
    expect(JSON.parse(context.send.mock.calls[0][0]) as unknown).toEqual(
      expect.objectContaining({
        event: 'error',
        payload: expect.objectContaining({ code: 'AUDIO_METADATA_MISSING' }),
      }),
    );
  });

  it('빈 바이너리를 거부한다', () => {
    const context = createContext();

    context.handler.handleAudioBinary(context.client, Buffer.alloc(0));

    expect(context.questionAnswerQueueService.enqueue).not.toHaveBeenCalled();
    expect(JSON.parse(context.send.mock.calls[0][0]) as unknown).toEqual(
      expect.objectContaining({
        payload: expect.objectContaining({ code: 'EMPTY_AUDIO_BINARY' }),
      }),
    );
  });

  it('10MB를 초과하는 바이너리를 거부한다', () => {
    const context = createContext();

    context.handler.handleAudioBinary(
      context.client,
      Buffer.alloc(10 * 1024 * 1024 + 1),
    );

    expect(context.questionAnswerQueueService.enqueue).not.toHaveBeenCalled();
    expect(JSON.parse(context.send.mock.calls[0][0]) as unknown).toEqual(
      expect.objectContaining({
        payload: expect.objectContaining({ code: 'AUDIO_TOO_LARGE' }),
      }),
    );
  });

  it('다음 질문을 전송하면 10분 재계산 타이머를 다시 시작한다', async () => {
    const context = createContext();
    context.analysisService.isFastApiConfigured.mockReturnValue(true);
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

    context.handler.handleAudioBinary(context.client, Buffer.from([1]));
    await new Promise<void>((resolve) => setImmediate(resolve));

    expect(context.lastTurnRecalcTimerService.arm).toHaveBeenCalledWith(7);
  });

  it('질문 텍스트는 TTS 합성을 기다리지 않고 먼저 전송하고, 음성은 합성이 끝난 뒤 뒤이어 전송한다', async () => {
    const context = createContext();
    context.analysisService.isFastApiConfigured.mockReturnValue(true);
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
    let resolveSynthesize!: (value: {
      base64: string;
      mimeType: string;
    }) => void;
    context.ttsClient.synthesize.mockReturnValueOnce(
      new Promise((resolve) => {
        resolveSynthesize = resolve;
      }),
    );

    context.handler.handleAudioBinary(context.client, Buffer.from([1]));
    await new Promise<void>((resolve) => setImmediate(resolve));

    // TTS가 아직 합성 중인 시점에도 질문 텍스트는 이미 전송돼 있어야 한다.
    let events = context.send.mock.calls.map(
      (call) => JSON.parse(call[0]) as { event?: string; payload?: unknown },
    );
    expect(events.some((event) => event.event === 'ai:question')).toBe(true);
    expect(events.some((event) => event.event === 'tts:audio')).toBe(false);

    resolveSynthesize({ base64: 'bW9jaw==', mimeType: 'audio/mpeg' });
    await new Promise<void>((resolve) => setImmediate(resolve));

    events = context.send.mock.calls.map(
      (call) => JSON.parse(call[0]) as { event?: string; payload?: unknown },
    );
    expect(events).toContainEqual(
      expect.objectContaining({
        event: 'tts:audio',
        payload: expect.objectContaining({
          messageId: 103,
          base64: 'bW9jaw==',
          mimeType: 'audio/mpeg',
        }),
      }),
    );
  });

  it('TTS 합성이 끝나기 전에 다른 질문으로 넘어갔으면 뒤늦은 음성은 버린다', async () => {
    const context = createContext();
    context.analysisService.isFastApiConfigured.mockReturnValue(true);
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
    context.ttsClient.synthesize.mockResolvedValueOnce({
      base64: 'bW9jaw==',
      mimeType: 'audio/mpeg',
    });
    // 합성이 끝나기 전에 이미 다른 질문으로 넘어갔다고 가정한다.
    context.connectionStateService.matchesCurrentQuestion.mockReturnValue(
      false,
    );

    context.handler.handleAudioBinary(context.client, Buffer.from([1]));
    await new Promise<void>((resolve) => setImmediate(resolve));
    await new Promise<void>((resolve) => setImmediate(resolve));

    const events = context.send.mock.calls.map(
      (call) => JSON.parse(call[0]) as { event?: string; payload?: unknown },
    );
    expect(events.some((event) => event.event === 'tts:audio')).toBe(false);
  });

  it('다음 질문이 없는 늦은 답변이어도 STT 결과는 audio:transcript로 전송한다', async () => {
    const context = createContext();
    context.analysisService.isFastApiConfigured.mockReturnValue(true);
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

    context.handler.handleAudioBinary(context.client, Buffer.from([1]));
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

  it('FastAPI 분석 자체가 실패하면 저장 없이 AUDIO_ANALYSIS_FAILED만 전송한다', async () => {
    const context = createContext();
    context.analysisService.isFastApiConfigured.mockReturnValue(true);
    context.analysisService.processPendingAnswerBatch.mockRejectedValue(
      new Error('음성 분석에 실패했습니다.'),
    );
    context.questionAnswerQueueService.enqueue.mockReturnValueOnce({
      isBatchOwner: true,
      ready: Promise.resolve({
        questionMessageId: 101,
        seniorId: 7,
        continueConversation: true,
        answers: [{ tempAnswerId: 1 }, { tempAnswerId: 2 }],
      }),
    });

    context.handler.handleAudioBinary(context.client, Buffer.from([1]));
    await new Promise<void>((resolve) => setImmediate(resolve));

    const events = context.send.mock.calls.map(
      (call) => JSON.parse(call[0]) as { event?: string; payload?: unknown },
    );
    expect(events.some((event) => event.event === 'audio:transcript')).toBe(
      false,
    );
    expect(
      events.some(
        (event) =>
          event.event === 'error' &&
          (event.payload as { code?: string } | undefined)?.code ===
            'AUDIO_ANALYSIS_FAILED',
      ),
    ).toBe(true);
  });

  it('답변 묶음 준비 Promise가 실패하면 AUDIO_ANALYSIS_FAILED를 전송한다', async () => {
    const context = createContext();
    context.questionAnswerQueueService.enqueue.mockReturnValueOnce({
      isBatchOwner: true,
      ready: Promise.reject(new Error('batch failed')),
    });

    context.handler.handleAudioBinary(context.client, Buffer.from([1]));
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
