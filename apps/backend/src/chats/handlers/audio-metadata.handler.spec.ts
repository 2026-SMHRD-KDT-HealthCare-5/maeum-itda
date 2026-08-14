import type WebSocket from 'ws';
import { UserRole } from '../../users/entities/user.entity';
import { AudioMetadataHandler } from './audio-metadata.handler';
import type { ChatConnectionStateService } from '../chat-connection-state.service';
import { AUDIO_BINARY_WAIT_MS } from './audio-metadata.handler';
import type { AudioMetadataEvent } from '../client-ws-event';

describe('AudioMetadataHandler', () => {
  afterEach(() => {
    jest.useRealTimers();
  });
  function createHandler(matchesCurrentQuestion = true) {
    const stateService = {
      matchesKnownQuestion: jest.fn().mockReturnValue(matchesCurrentQuestion),
    };
    return {
      handler: new AudioMetadataHandler(
        stateService as unknown as ChatConnectionStateService,
      ),
      stateService,
    };
  }

  function createClient() {
    const client = { send: jest.fn<void, [string]>(), readyState: 1 };
    return {
      client: client as unknown as WebSocket,
      send: client.send,
    };
  }

  const validMetadata: AudioMetadataEvent = {
    event: 'audio:metadata',
    payload: {
      audioTransferId: 'audio-transfer-001',
      questionMessageId: 101,
      generationId: 'generation-001',
      mimeType: 'audio/webm;codecs=opus',
      capturedAt: '2026-08-07T10:00:03.500Z',
      endType: 'auto',
    },
    ts: '2026-08-07T10:00:04.000Z',
  };

  it('metadata 이후 바이너리가 제한 시간 안에 오지 않으면 pending 상태를 폐기한다', () => {
    jest.useFakeTimers();
    const { handler } = createHandler();
    const client = createClient();

    handler.handleAudioMetadata(
      client.client,
      { sub: 7, role: UserRole.SENIOR },
      validMetadata,
    );
    jest.advanceTimersByTime(AUDIO_BINARY_WAIT_MS);

    expect(handler.getPendingMetadata(client.client)).toBeUndefined();
    expect(JSON.parse(client.send.mock.calls[0][0]) as unknown).toEqual(
      expect.objectContaining({
        event: 'error',
        // jest의 objectContaining() 반환형이 any라 중첩 시 no-unsafe-assignment가 오탐한다.
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        payload: expect.objectContaining({ code: 'AUDIO_BINARY_TIMEOUT' }),
      }),
    );
  });

  it('유효한 metadata를 인증 사용자 ID와 함께 연결별로 보관한다', () => {
    const { handler, stateService } = createHandler();
    const client = createClient();

    handler.handleAudioMetadata(
      client.client,
      { sub: 7, role: UserRole.SENIOR },
      validMetadata,
    );

    expect(handler.getPendingMetadata(client.client)).toEqual({
      audioTransferId: 'audio-transfer-001',
      questionMessageId: 101,
      generationId: 'generation-001',
      mimeType: 'audio/webm;codecs=opus',
      capturedAt: '2026-08-07T10:00:03.500Z',
      endType: 'auto',
      seniorId: 7,
    });
    expect(stateService.matchesKnownQuestion).toHaveBeenCalledWith(
      client.client,
      101,
      'generation-001',
    );
    expect(client.send).not.toHaveBeenCalled();
  });

  it('pending metadata가 있으면 다음 metadata를 거부한다', () => {
    const { handler } = createHandler();
    const client = createClient();
    const user = { sub: 7, role: UserRole.SENIOR };

    handler.handleAudioMetadata(client.client, user, validMetadata);
    handler.handleAudioMetadata(client.client, user, validMetadata);

    expect(JSON.parse(client.send.mock.calls[0][0]) as unknown).toEqual(
      expect.objectContaining({
        event: 'error',
        // jest의 objectContaining() 반환형이 any라 중첩 시 no-unsafe-assignment가 오탐한다
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        payload: expect.objectContaining({
          code: 'AUDIO_METADATA_PENDING',
        }),
      }),
    );
  });

  it('현재 질문과 식별정보가 다르면 QUESTION_MISMATCH를 전송한다', () => {
    const { handler } = createHandler(false);
    const client = createClient();

    handler.handleAudioMetadata(
      client.client,
      { sub: 7, role: UserRole.SENIOR },
      validMetadata,
    );

    expect(JSON.parse(client.send.mock.calls[0][0]) as unknown).toEqual(
      expect.objectContaining({
        event: 'error',
        // jest의 objectContaining() 반환형이 any라 중첩 시 no-unsafe-assignment가 오탐한다
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        payload: expect.objectContaining({ code: 'QUESTION_MISMATCH' }),
      }),
    );
    expect(handler.getPendingMetadata(client.client)).toBeUndefined();
  });

  it('pending metadata를 한 번 꺼낸 뒤 제거한다', () => {
    const { handler } = createHandler();
    const client = createClient();

    handler.handleAudioMetadata(
      client.client,
      { sub: 7, role: UserRole.SENIOR },
      validMetadata,
    );

    expect(handler.takePendingMetadata(client.client)).toEqual(
      expect.objectContaining({ audioTransferId: 'audio-transfer-001' }),
    );
    expect(handler.takePendingMetadata(client.client)).toBeUndefined();
  });
});
