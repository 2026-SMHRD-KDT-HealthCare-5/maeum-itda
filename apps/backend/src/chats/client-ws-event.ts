/*
역할: 인증 이후 수신하는 WebSocket JSON을 한 번 파싱하고 이벤트별 필수 필드를 검증한다.
연결 흐름: ChatsGateway → parseAuthenticatedClientEvent() → 이벤트별 Handler
주의: binary frame은 이 parser를 거치지 않고 AudioBinaryHandler로 직접 전달한다.
*/
import type { AudioMetadataPayload } from '@maeum-itda/shared-types';
import type {
  ClientWsRequestEvent,
  WsErrorCode,
} from '@maeum-itda/shared-types';

export class ClientWsEventParseError extends Error {
  constructor(
    readonly code: WsErrorCode,
    readonly requestEvent: ClientWsRequestEvent,
    message: string,
  ) {
    super(message);
  }
}

interface ClientEvent<TEvent extends string, TPayload> {
  event: TEvent;
  payload: TPayload;
  ts: string;
}

export type ChatStartEvent = ClientEvent<'chat:start', Record<string, never>>;
export type ChatEndEvent = ClientEvent<
  'chat:end',
  { reason: 'USER_REQUESTED' }
>;
export type AudioMetadataEvent = ClientEvent<
  'audio:metadata',
  AudioMetadataPayload
>;
export type AuthenticatedClientEvent =
  ChatStartEvent | ChatEndEvent | AudioMetadataEvent;

export function parseAuthenticatedClientEvent(
  message: string,
): AuthenticatedClientEvent {
  const parsed: unknown = JSON.parse(message);
  if (!isRecord(parsed) || !hasValidTimestamp(parsed)) {
    throw new ClientWsEventParseError(
      'INVALID_EVENT',
      'unknown',
      '유효하지 않은 WebSocket 이벤트 envelope입니다.',
    );
  }

  switch (parsed.event) {
    case 'chat:start':
      if (!isRecord(parsed.payload) || Object.keys(parsed.payload).length > 0) {
        throw new ClientWsEventParseError(
          'INVALID_EVENT',
          'chat:start',
          '유효하지 않은 chat:start 이벤트입니다.',
        );
      }
      return { event: 'chat:start', payload: {}, ts: parsed.ts };

    case 'chat:end':
      if (
        !isRecord(parsed.payload) ||
        parsed.payload.reason !== 'USER_REQUESTED' ||
        Object.keys(parsed.payload).length !== 1
      ) {
        throw new ClientWsEventParseError(
          'INVALID_EVENT',
          'chat:end',
          '유효하지 않은 chat:end 이벤트입니다.',
        );
      }
      return {
        event: 'chat:end',
        payload: { reason: 'USER_REQUESTED' },
        ts: parsed.ts,
      };

    case 'audio:metadata':
      return parseAudioMetadataEvent(parsed);

    default:
      throw new ClientWsEventParseError(
        'INVALID_EVENT',
        'unknown',
        '지원하지 않는 WebSocket 이벤트입니다.',
      );
  }
}

function parseAudioMetadataEvent(
  parsed: Record<string, unknown> & { ts: string },
): AudioMetadataEvent {
  const payload = parsed.payload;
  if (
    !isRecord(payload) ||
    typeof payload.audioTransferId !== 'string' ||
    payload.audioTransferId.length === 0 ||
    !Number.isInteger(payload.questionMessageId) ||
    Number(payload.questionMessageId) <= 0 ||
    typeof payload.generationId !== 'string' ||
    payload.generationId.length === 0 ||
    typeof payload.mimeType !== 'string' ||
    !payload.mimeType.startsWith('audio/') ||
    typeof payload.capturedAt !== 'string' ||
    Number.isNaN(Date.parse(payload.capturedAt)) ||
    (payload.endType !== 'auto' && payload.endType !== 'manual')
  ) {
    throw new ClientWsEventParseError(
      'INVALID_AUDIO_METADATA',
      'audio:metadata',
      '유효하지 않은 audio:metadata 이벤트입니다.',
    );
  }

  return {
    event: 'audio:metadata',
    payload: {
      audioTransferId: payload.audioTransferId,
      questionMessageId: Number(payload.questionMessageId),
      generationId: payload.generationId,
      mimeType: payload.mimeType,
      capturedAt: payload.capturedAt,
      endType: payload.endType,
    },
    ts: parsed.ts,
  };
}

function hasValidTimestamp(
  value: Record<string, unknown>,
): value is Record<string, unknown> & { event: string; ts: string } {
  return (
    typeof value.event === 'string' &&
    typeof value.ts === 'string' &&
    !Number.isNaN(Date.parse(value.ts))
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
