/* eslint-disable @typescript-eslint/no-unsafe-assignment -- 실제 WS JSON과 multipart mock 요청을 검증하는 E2E 테스트다. */
/*
역할: 실제 WebSocket 연결과 mock FastAPI HTTP 서버를 사용해 NestJS 대화 한 사이클을 검증한다.
Mock 경계: JWT 검증과 MySQL Repository만 고정값으로 대체하고 Gateway·Handler·Queue·AnalysisService·AiClient는 실제 객체를 사용한다.
전체 흐름: WS auth → chat:start → audio metadata/binary → mock REST → ai:question → chat:end → chat:ended
*/
import { INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { WsAdapter } from '@nestjs/platform-ws';
import { Test } from '@nestjs/testing';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import WebSocket from 'ws';
import { AiClient } from '../src/analysis/ai.client';
import { AnalysisService } from '../src/analysis/analysis.service';
import { AnalysisResultRepository } from '../src/analysis/repositories/analysis-result.repository';
import { TemporaryAudioRepository } from '../src/analysis/repositories/temporary-audio.repository';
import { AuthService } from '../src/auth/auth.service';
import { ChatConnectionStateService } from '../src/chats/chat-connection-state.service';
import { ChatsGateway } from '../src/chats/chats.gateway';
import { ChatsService } from '../src/chats/chats.service';
import { AudioBinaryHandler } from '../src/chats/handlers/audio-binary.handler';
import { AudioMetadataHandler } from '../src/chats/handlers/audio-metadata.handler';
import { ChatAuthHandler } from '../src/chats/handlers/chat-auth.handler';
import { ChatEndHandler } from '../src/chats/handlers/chat-end.handler';
import { ChatStartHandler } from '../src/chats/handlers/chat-start.handler';
import { QuestionAnswerQueueService } from '../src/chats/question-answer-queue.service';
import { AudioTransferStateService } from '../src/chats/audio-transfer-state.service';
import { ChatInactivityService } from '../src/chats/chat-inactivity.service';
import { AudioAnswerRepository } from '../src/chats/repositories/audio-answer.repository';
import { ConversationMessageRepository } from '../src/chats/repositories/conversation-message.repository';
import { LastTurnRecalcTimerService } from '../src/chats/last-turn-recalc-timer.service';
import { rawDataToString } from '../src/chats/ws-event';
import { EmotionIndexRecalcTriggerService } from '../src/reports/emotion-index-recalc-trigger.service';
import { UserRole } from '../src/users/entities/user.entity';

interface ReceivedWsEvent {
  event: string;
  payload: Record<string, unknown>;
  ts: string;
}

class WsEventCollector {
  private readonly received: ReceivedWsEvent[] = [];
  private readonly waiters = new Map<
    string,
    Array<(event: ReceivedWsEvent) => void>
  >();

  constructor(client: WebSocket) {
    client.on('message', (data) => {
      const event = JSON.parse(rawDataToString(data)) as ReceivedWsEvent;
      const waiter = this.waiters.get(event.event)?.shift();
      if (waiter !== undefined) waiter(event);
      else this.received.push(event);
    });
  }

  next(eventName: string, timeoutMs = 8_000): Promise<ReceivedWsEvent> {
    const existingIndex = this.received.findIndex(
      ({ event }) => event === eventName,
    );
    if (existingIndex >= 0) {
      return Promise.resolve(this.received.splice(existingIndex, 1)[0]);
    }
    return new Promise((resolve, reject) => {
      const timer = setTimeout(
        () => reject(new Error(`${eventName} 수신 시간이 초과됐습니다.`)),
        timeoutMs,
      );
      const resolveWithCleanup = (event: ReceivedWsEvent) => {
        clearTimeout(timer);
        resolve(event);
      };
      const waiters = this.waiters.get(eventName) ?? [];
      waiters.push(resolveWithCleanup);
      this.waiters.set(eventName, waiters);
    });
  }
}

describe('Chats WebSocket + FastAPI REST mock (e2e)', () => {
  let app: INestApplication;
  let aiServer: Server;
  let aiBaseUrl: string;
  let receivedMultipartBody = '';

  const conversationMessageRepository = {
    saveInitialAiQuestion: jest.fn().mockResolvedValue({
      messageId: 101,
      content: '오늘 하루는 어땠나요?',
    }),
  };
  const audioAnswerRepository = {
    savePendingAnswer: jest.fn().mockResolvedValue({ messageId: 102 }),
  };
  const analysisResultRepository = {
    markWaiting: jest.fn().mockResolvedValue(undefined),
    markProcessing: jest.fn().mockResolvedValue(undefined),
    markFailed: jest.fn().mockResolvedValue(undefined),
    findStatus: jest.fn(),
    saveCompleted: jest.fn().mockImplementation(
      (
        _batch,
        nextGenerationId: string,
        result: {
          answers: Array<{ messageId: number; transcript: string }>;
          nextQuestion: string | null;
        },
      ) =>
        Promise.resolve({
          answerTranscripts: result.answers.map(
            ({ messageId, transcript }) => ({
              messageId,
              content: transcript,
            }),
          ),
          nextQuestion: {
            messageId: 201,
            generationId: nextGenerationId,
            content: result.nextQuestion,
          },
        }),
    ),
  };

  beforeAll(async () => {
    aiServer = createServer((request, response) => {
      const chunks: Buffer[] = [];
      request.on('data', (chunk: Buffer) => chunks.push(chunk));
      request.on('end', () => {
        receivedMultipartBody = Buffer.concat(chunks).toString('latin1');
        response.writeHead(200, { 'content-type': 'application/json' });
        response.end(
          JSON.stringify({
            answers: [
              {
                messageId: 102,
                transcript: '오늘 산책을 다녀왔어요.',
                sentimentLabel: 'POSITIVE',
                scaleAnalyses: [],
              },
            ],
            nextQuestion: '산책하면서 무엇이 가장 좋으셨어요?',
          }),
        );
      });
    });
    await new Promise<void>((resolve) =>
      aiServer.listen(0, '127.0.0.1', resolve),
    );
    const aiAddress = aiServer.address() as AddressInfo;
    aiBaseUrl = `http://127.0.0.1:${aiAddress.port}`;

    const moduleRef = await Test.createTestingModule({
      providers: [
        ChatsGateway,
        ChatAuthHandler,
        ChatStartHandler,
        ChatEndHandler,
        AudioMetadataHandler,
        AudioBinaryHandler,
        ChatConnectionStateService,
        QuestionAnswerQueueService,
        AudioTransferStateService,
        ChatInactivityService,
        LastTurnRecalcTimerService,
        ChatsService,
        AnalysisService,
        AiClient,
        TemporaryAudioRepository,
        {
          provide: EmotionIndexRecalcTriggerService,
          useValue: { recalcToday: jest.fn() },
        },
        {
          provide: AuthService,
          useValue: {
            verifyAccessToken: jest.fn().mockResolvedValue({
              sub: 7,
              role: UserRole.SENIOR,
            }),
          },
        },
        {
          provide: ConfigService,
          useValue: {
            get: (key: string) =>
              key === 'AI_BASE_URL' ? aiBaseUrl : undefined,
          },
        },
        {
          provide: ConversationMessageRepository,
          useValue: conversationMessageRepository,
        },
        {
          provide: AudioAnswerRepository,
          useValue: audioAnswerRepository,
        },
        {
          provide: AnalysisResultRepository,
          useValue: analysisResultRepository,
        },
      ],
    }).compile();

    app = moduleRef.createNestApplication();
    app.useWebSocketAdapter(new WsAdapter(app));
    await app.listen(0, '127.0.0.1');
  });

  afterAll(async () => {
    await app.close();
    await new Promise<void>((resolve, reject) =>
      aiServer.close((error) =>
        error === undefined ? resolve() : reject(error),
      ),
    );
  });

  it('WS 음성을 mock FastAPI REST로 분석하고 다음 질문과 수동 종료를 전송한다', async () => {
    const appUrl = await app.getUrl();
    const client = new WebSocket(`${appUrl.replace(/^http/, 'ws')}/ws/chats`);
    await new Promise<void>((resolve, reject) => {
      client.once('open', resolve);
      client.once('error', reject);
    });
    const events = new WsEventCollector(client);

    client.send(
      JSON.stringify({
        event: 'auth',
        payload: { accessToken: 'mock-access-token' },
        ts: '2026-08-12T00:00:00.000Z',
      }),
    );
    await expect(events.next('auth:success')).resolves.toEqual(
      expect.objectContaining({ payload: { userId: 7, role: 'SENIOR' } }),
    );

    client.send(
      JSON.stringify({
        event: 'chat:start',
        payload: {},
        ts: '2026-08-12T00:00:01.000Z',
      }),
    );
    await events.next('chat:started');
    const initialQuestion = await events.next('ai:question');

    client.send(
      JSON.stringify({
        event: 'audio:metadata',
        payload: {
          audioTransferId: 'audio-transfer-001',
          questionMessageId: initialQuestion.payload.messageId,
          generationId: initialQuestion.payload.generationId,
          mimeType: 'audio/webm;codecs=opus',
          capturedAt: '2026-08-12T00:00:02.000Z',
          endType: 'manual',
        },
        ts: '2026-08-12T00:00:02.100Z',
      }),
    );
    client.send(Buffer.from([1, 2, 3, 4]));

    await expect(events.next('audio:ack')).resolves.toEqual(
      expect.objectContaining({
        payload: { audioTransferId: 'audio-transfer-001', messageId: 102 },
      }),
    );
    await expect(events.next('audio:transcript', 15_000)).resolves.toEqual(
      expect.objectContaining({
        payload: {
          transcripts: [{ messageId: 102, content: '오늘 산책을 다녀왔어요.' }],
        },
      }),
    );
    const nextQuestion = await events.next('ai:question', 15_000);
    expect(nextQuestion.payload).toEqual(
      expect.objectContaining({
        messageId: 201,
        content: '산책하면서 무엇이 가장 좋으셨어요?',
      }),
    );

    client.send(
      JSON.stringify({
        event: 'chat:end',
        payload: { reason: 'USER_REQUESTED' },
        ts: '2026-08-12T00:00:10.000Z',
      }),
    );
    await expect(events.next('chat:ended')).resolves.toEqual(
      expect.objectContaining({
        payload: {
          reason: 'USER_REQUESTED',
          endedAt: expect.any(String),
        },
      }),
    );

    expect(receivedMultipartBody).toContain('name="audioFiles"');
    expect(receivedMultipartBody).toContain('name="messageIds"');
    expect(receivedMultipartBody).toContain('audio-transfer-001');
    expect(analysisResultRepository.saveCompleted).toHaveBeenCalledTimes(1);
    client.close();
  }, 25_000);
});
