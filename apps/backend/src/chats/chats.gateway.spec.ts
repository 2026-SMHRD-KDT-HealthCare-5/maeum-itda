import type WebSocket from 'ws';
import type { RawData } from 'ws';
import { UserRole } from '../users/entities/user.entity';
import { ChatsGateway, WS_AUTH_TIMEOUT_MS } from './chats.gateway';
import type { ChatAuthHandler } from './handlers/chat-auth.handler';
import type { ChatStartHandler } from './handlers/chat-start.handler';
import type { AudioMetadataHandler } from './handlers/audio-metadata.handler';
import type { ChatConnectionStateService } from './chat-connection-state.service';
import type { AudioBinaryHandler } from './handlers/audio-binary.handler';
import type { ChatEndHandler } from './handlers/chat-end.handler';
import type { LastTurnRecalcTimerService } from './last-turn-recalc-timer.service';
import type { ChatInactivityService } from './chat-inactivity.service';
import type { QuestionDeliveryService } from './question-delivery.service';

describe('ChatsGateway', () => {
  afterEach(() => {
    jest.useRealTimers();
  });

  function createClient() {
    let messageHandler:
      ((data: RawData, isBinary: boolean) => void) | undefined;
    const clientValue = {
      on: jest.fn(
        (
          event: string,
          handler: (data: RawData, isBinary: boolean) => void,
        ) => {
          if (event === 'message') messageHandler = handler;
        },
      ),
      send: jest.fn<void, [string]>(),
      close: jest.fn<void, [number, string]>(),
      readyState: 1,
    };

    return {
      client: clientValue as unknown as WebSocket,
      close: clientValue.close,
      receiveJson(value: object) {
        messageHandler?.(Buffer.from(JSON.stringify(value)), false);
      },
      receiveBinary(data: Buffer) {
        messageHandler?.(data, true);
      },
    };
  }

  function createGateway(authResult: unknown) {
    const chatAuthHandler = {
      authenticate: jest.fn().mockResolvedValue(authResult),
    };
    const chatStartHandler = { handleChatStart: jest.fn() };
    const chatEndHandler = { handleChatEnd: jest.fn() };
    const audioMetadataHandler = {
      handleAudioMetadata: jest.fn(),
      clearClient: jest.fn(),
    };
    const audioBinaryHandler = {
      handleAudioBinary: jest.fn(),
      clearClient: jest.fn(),
    };
    const chatConnectionStateService = {
      clearClient: jest.fn(),
      restoreClient: jest.fn(),
    };
    const lastTurnRecalcTimerService = { arm: jest.fn() };
    const chatInactivityService = {
      clearClient: jest.fn(),
      startWaitingForAnswer: jest.fn(),
      markAnswerStarted: jest.fn(),
    };
    const questionDeliveryService = {
      deliverQuestion: jest.fn(),
      deliverTtsToken: jest.fn().mockResolvedValue(undefined),
    };
    const gateway = new ChatsGateway(
      chatAuthHandler as unknown as ChatAuthHandler,
      chatStartHandler as unknown as ChatStartHandler,
      chatEndHandler as unknown as ChatEndHandler,
      audioMetadataHandler as unknown as AudioMetadataHandler,
      audioBinaryHandler as unknown as AudioBinaryHandler,
      chatConnectionStateService as unknown as ChatConnectionStateService,
      chatInactivityService as unknown as ChatInactivityService,
      lastTurnRecalcTimerService as unknown as LastTurnRecalcTimerService,
      questionDeliveryService as unknown as QuestionDeliveryService,
    );
    return {
      gateway,
      chatAuthHandler,
      chatStartHandler,
      chatEndHandler,
      audioMetadataHandler,
      audioBinaryHandler,
      chatConnectionStateService,
      lastTurnRecalcTimerService,
      questionDeliveryService,
    };
  }

  const authEvent = {
    event: 'auth',
    payload: { accessToken: 'token' },
    ts: '2026-08-13T00:00:00.000Z',
  };
  const chatStartEvent = {
    event: 'chat:start',
    payload: {},
    ts: '2026-08-13T00:00:01.000Z',
  };

  it('첫 메시지는 인증하고 이후 chat:start를 검증된 이벤트로 전달한다', async () => {
    const authenticatedUser = { sub: 1, role: UserRole.SENIOR };
    const context = createGateway(authenticatedUser);
    const client = createClient();

    context.gateway.handleConnection(client.client);
    client.receiveJson(authEvent);
    await Promise.resolve();
    client.receiveJson(chatStartEvent);
    await Promise.resolve();

    expect(context.chatAuthHandler.authenticate).toHaveBeenCalled();
    expect(context.chatStartHandler.handleChatStart).toHaveBeenCalledWith(
      client.client,
      authenticatedUser,
      chatStartEvent,
    );
  });

  it('인증 처리 중 도착한 메시지는 인증 성공 후 순서대로 전달한다', async () => {
    const authenticatedUser = { sub: 1, role: UserRole.SENIOR };
    let resolveAuth!: (value: typeof authenticatedUser) => void;
    const authPromise = new Promise<typeof authenticatedUser>((resolve) => {
      resolveAuth = resolve;
    });
    const context = createGateway(authenticatedUser);
    context.chatAuthHandler.authenticate.mockReturnValueOnce(authPromise);
    const client = createClient();

    context.gateway.handleConnection(client.client);
    client.receiveJson(authEvent);
    client.receiveJson(chatStartEvent);
    expect(context.chatStartHandler.handleChatStart).not.toHaveBeenCalled();

    resolveAuth(authenticatedUser);
    await authPromise;
    await Promise.resolve();

    expect(context.chatStartHandler.handleChatStart).toHaveBeenCalledWith(
      client.client,
      authenticatedUser,
      chatStartEvent,
    );
  });

  it('제한 시간 안에 인증하지 않으면 정책 위반 코드로 연결을 닫는다', () => {
    jest.useFakeTimers();
    const context = createGateway(null);
    const client = createClient();

    context.gateway.handleConnection(client.client);
    jest.advanceTimersByTime(WS_AUTH_TIMEOUT_MS);

    expect(client.close).toHaveBeenCalledWith(
      1008,
      'WebSocket authentication timeout',
    );
  });

  it('인증 실패 후 후속 메시지를 처리하지 않는다', async () => {
    const context = createGateway(null);
    const client = createClient();

    context.gateway.handleConnection(client.client);
    client.receiveJson(authEvent);
    await Promise.resolve();
    client.receiveJson(chatStartEvent);
    await Promise.resolve();

    expect(context.chatStartHandler.handleChatStart).not.toHaveBeenCalled();
  });

  it('인증 이후 바이너리 프레임을 AudioBinaryHandler로 전달한다', async () => {
    const authenticatedUser = { sub: 1, role: UserRole.SENIOR };
    const context = createGateway(authenticatedUser);
    const client = createClient();
    const binary = Buffer.from([1, 2, 3]);

    context.gateway.handleConnection(client.client);
    client.receiveJson(authEvent);
    await Promise.resolve();
    client.receiveBinary(binary);
    await Promise.resolve();

    expect(context.audioBinaryHandler.handleAudioBinary).toHaveBeenCalledWith(
      client.client,
      binary,
    );
  });

  it('단기 재접속으로 질문이 복원되면 10분 재계산 타이머를 다시 시작한다', async () => {
    const authenticatedUser = { sub: 1, role: UserRole.SENIOR };
    const context = createGateway(authenticatedUser);
    context.chatConnectionStateService.restoreClient.mockReturnValue({
      questionMessageId: 101,
      generationId: 'generation-001',
      content: '오늘 하루는 어땠나요?',
    });
    const client = createClient();

    context.gateway.handleConnection(client.client);
    client.receiveJson(authEvent);
    await Promise.resolve();

    expect(context.lastTurnRecalcTimerService.arm).toHaveBeenCalledWith(1);
  });

  it('단기 재접속으로 질문이 복원되면 해당 질문의 TTS 스트리밍 토큰도 다시 발급한다', async () => {
    const authenticatedUser = { sub: 1, role: UserRole.SENIOR };
    const context = createGateway(authenticatedUser);
    context.chatConnectionStateService.restoreClient.mockReturnValue({
      questionMessageId: 101,
      generationId: 'generation-001',
      content: '오늘 하루는 어땠나요?',
    });
    const client = createClient();

    context.gateway.handleConnection(client.client);
    client.receiveJson(authEvent);
    await Promise.resolve();

    expect(
      context.questionDeliveryService.deliverTtsToken,
    ).toHaveBeenCalledWith(client.client, 101, 1);
  });
});
