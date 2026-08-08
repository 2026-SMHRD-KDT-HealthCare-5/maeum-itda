import type WebSocket from 'ws';
import type { RawData } from 'ws';
import { UserRole } from '../users/entities/user.entity';
import { ChatsGateway } from './chats.gateway';
import type { ChatAuthHandler } from './handlers/chat-auth.handler';
import type { ChatStartHandler } from './handlers/chat-start.handler';
import type { AudioMetadataHandler } from './handlers/audio-metadata.handler';
import type { ChatConnectionStateService } from './chat-connection-state.service';

describe('ChatsGateway', () => {
  function createClient() {
    let firstMessageHandler:
      ((data: RawData, isBinary: boolean) => void) | undefined;
    let authenticatedMessageHandler:
      ((data: RawData, isBinary: boolean) => void) | undefined;
    const client = {
      once: jest.fn((event: string, handler: typeof firstMessageHandler) => {
        if (event === 'message') firstMessageHandler = handler;
      }),
      on: jest.fn(
        (event: string, handler: typeof authenticatedMessageHandler) => {
          if (event === 'message') authenticatedMessageHandler = handler;
        },
      ),
      send: jest.fn(),
    };

    return {
      client: client as unknown as WebSocket,
      receiveFirstMessage(data: string) {
        firstMessageHandler?.(Buffer.from(data), false);
      },
      receiveAuthenticatedMessage(data: string) {
        authenticatedMessageHandler?.(Buffer.from(data), false);
      },
    };
  }

  it('첫 메시지는 인증 Handler로, 인증 이후 메시지는 대화 시작 Handler로 전달한다', async () => {
    const authenticatedUser = { sub: 1, role: UserRole.SENIOR };
    const chatAuthHandler = {
      authenticate: jest.fn().mockResolvedValue(authenticatedUser),
    };
    const chatStartHandler = { handleChatStart: jest.fn() };
    const audioMetadataHandler = {
      handleAudioMetadata: jest.fn(),
      clearClient: jest.fn(),
    };
    const chatConnectionStateService = { clearClient: jest.fn() };
    const gateway = new ChatsGateway(
      chatAuthHandler as unknown as ChatAuthHandler,
      chatStartHandler as unknown as ChatStartHandler,
      audioMetadataHandler as unknown as AudioMetadataHandler,
      chatConnectionStateService as unknown as ChatConnectionStateService,
    );
    const client = createClient();

    gateway.handleConnection(client.client);
    client.receiveFirstMessage('{"event":"auth"}');
    await Promise.resolve();
    client.receiveAuthenticatedMessage('{"event":"chat:start"}');

    expect(chatAuthHandler.authenticate).toHaveBeenCalled();
    expect(chatStartHandler.handleChatStart).toHaveBeenCalledWith(
      client.client,
      authenticatedUser,
      expect.any(Buffer),
      false,
    );
  });

  it('인증 실패 시 이후 메시지 수신을 등록하지 않는다', async () => {
    const chatAuthHandler = { authenticate: jest.fn().mockResolvedValue(null) };
    const chatStartHandler = { handleChatStart: jest.fn() };
    const audioMetadataHandler = {
      handleAudioMetadata: jest.fn(),
      clearClient: jest.fn(),
    };
    const chatConnectionStateService = { clearClient: jest.fn() };
    const gateway = new ChatsGateway(
      chatAuthHandler as unknown as ChatAuthHandler,
      chatStartHandler as unknown as ChatStartHandler,
      audioMetadataHandler as unknown as AudioMetadataHandler,
      chatConnectionStateService as unknown as ChatConnectionStateService,
    );
    const client = createClient();

    gateway.handleConnection(client.client);
    client.receiveFirstMessage('{"event":"auth"}');
    await Promise.resolve();
    client.receiveAuthenticatedMessage('{"event":"chat:start"}');

    expect(chatStartHandler.handleChatStart).not.toHaveBeenCalled();
  });

  it('인증 이후 audio:metadata를 AudioMetadataHandler로 전달한다', async () => {
    const authenticatedUser = { sub: 1, role: UserRole.SENIOR };
    const chatAuthHandler = {
      authenticate: jest.fn().mockResolvedValue(authenticatedUser),
    };
    const chatStartHandler = { handleChatStart: jest.fn() };
    const audioMetadataHandler = {
      handleAudioMetadata: jest.fn(),
      clearClient: jest.fn(),
    };
    const chatConnectionStateService = { clearClient: jest.fn() };
    const gateway = new ChatsGateway(
      chatAuthHandler as unknown as ChatAuthHandler,
      chatStartHandler as unknown as ChatStartHandler,
      audioMetadataHandler as unknown as AudioMetadataHandler,
      chatConnectionStateService as unknown as ChatConnectionStateService,
    );
    const client = createClient();

    gateway.handleConnection(client.client);
    client.receiveFirstMessage('{"event":"auth"}');
    await Promise.resolve();
    client.receiveAuthenticatedMessage('{"event":"audio:metadata"}');

    expect(audioMetadataHandler.handleAudioMetadata).toHaveBeenCalledWith(
      client.client,
      authenticatedUser,
      expect.any(Buffer),
      false,
    );
  });
});
