/*
역할: audio:metadata 이벤트 검증과 음성 바이너리 수신 전 임시 상태 보관
연결 객체: WebSocket 연결 객체, 인증된 사용자 정보
전체 흐름: ChatsGateway → AudioMetadataHandler → 연결별 pending metadata → AudioBinaryHandler
[완료] metadata와 다음 binary frame을 연결별로 한 번만 페어링하고 제한 시간 뒤 폐기한다.
[제약] pending metadata는 프로세스 메모리에 있어 서버 재시작이나 다른 인스턴스로의 재접속 시 복원되지 않는다.
*/
import { Injectable } from '@nestjs/common';
import type WebSocket from 'ws';
import type { AccessTokenPayload } from '../../auth/auth.service';
import { sendWsError } from '../ws-event';
import { ChatConnectionStateService } from '../chat-connection-state.service';
import type { AudioMetadataEvent } from '../client-ws-event';

// 대화 종료 방식
export type AudioEndType = 'auto' | 'manual';

// 프론트가 음성 바이너리보다 먼저 보내는 발화 정보 형식
export interface AudioMetadata {
  audioTransferId: string;
  questionMessageId: number;
  generationId: string;
  mimeType: string;
  capturedAt: string;
  endType: AudioEndType;
  seniorId: number;
}

export const AUDIO_BINARY_WAIT_MS = 10_000;

interface PendingAudioMetadata {
  metadata: AudioMetadata;
  timeout: NodeJS.Timeout;
}

@Injectable()
export class AudioMetadataHandler {
  private readonly pendingMetadataByClient: WeakMap<
    WebSocket,
    PendingAudioMetadata
  >; // 연결별 다음 바이너리의 발화 정보와 만료 타이머
  private readonly chatConnectionStateService: ChatConnectionStateService; // 현재 AI 질문 식별정보 확인 객체

  // NestJS DI 컨테이너가 연결별 대화 상태 객체를 생성자에 주입
  constructor(chatConnectionStateService: ChatConnectionStateService) {
    this.chatConnectionStateService = chatConnectionStateService;
    this.pendingMetadataByClient = new WeakMap<
      WebSocket,
      PendingAudioMetadata
    >();
  }

  // 역할: audio:metadata 검증 후 인증 사용자 ID와 함께 연결별 임시 보관
  // 연결 객체: WebSocket 연결 객체, 인증된 사용자 정보
  // 다음 호출: 음성 바이너리 수신 → pending metadata 조회 및 페어링
  handleAudioMetadata(
    client: WebSocket,
    authenticatedUser: AccessTokenPayload,
    metadataEvent: AudioMetadataEvent,
  ): boolean {
    try {
      // 이전 metadata에 해당하는 바이너리를 받기 전에는 새 metadata 수신 거부
      if (this.pendingMetadataByClient.has(client)) {
        sendWsError(client, {
          code: 'AUDIO_METADATA_PENDING',
          message: '이전 음성 메타데이터의 바이너리 수신을 기다리고 있습니다.',
          requestEvent: 'audio:metadata',
          retryable: false,
        });
        return false;
      }

      // 서버가 현재 연결에 전송한 AI 질문과 식별정보가 일치하는지 확인
      if (
        !this.chatConnectionStateService.matchesKnownQuestion(
          client,
          metadataEvent.payload.questionMessageId,
          metadataEvent.payload.generationId,
        )
      ) {
        sendWsError(client, {
          code: 'QUESTION_MISMATCH',
          message: '현재 AI 질문과 일치하지 않는 음성 메타데이터입니다.',
          requestEvent: 'audio:metadata',
          retryable: false,
        });
        return false;
      }

      const metadata: AudioMetadata = {
        ...metadataEvent.payload,
        seniorId: authenticatedUser.sub,
      };
      const timeout = setTimeout(
        () => this.expirePendingMetadata(client),
        AUDIO_BINARY_WAIT_MS,
      );
      // pending metadata 타이머 하나만 남았다는 이유로 NestJS 프로세스 종료가 지연되지 않게 한다.
      timeout.unref();
      this.pendingMetadataByClient.set(client, { metadata, timeout });
      return true;
    } catch {
      sendWsError(client, {
        code: 'INVALID_AUDIO_METADATA',
        message: '음성 메타데이터 형식이 올바르지 않습니다.',
        requestEvent: 'audio:metadata',
        retryable: false,
      });
      return false;
    }
  }

  // 역할: 다음 음성 바이너리와 연결할 pending metadata 조회
  // 다음 호출: AudioBinaryHandler가 binary frame과 metadata를 페어링할 때 사용
  getPendingMetadata(client: WebSocket): AudioMetadata | undefined {
    return this.pendingMetadataByClient.get(client)?.metadata;
  }

  // 역할: 바이너리와 연결할 metadata를 한 번만 꺼내고 pending 상태에서 제거
  takePendingMetadata(client: WebSocket): AudioMetadata | undefined {
    const pending = this.pendingMetadataByClient.get(client);
    if (pending === undefined) return undefined;
    clearTimeout(pending.timeout);
    this.pendingMetadataByClient.delete(client);
    return pending.metadata;
  }

  // 역할: WebSocket 종료 시 연결별 pending metadata 제거
  clearClient(client: WebSocket): void {
    const pending = this.pendingMetadataByClient.get(client);
    if (pending !== undefined) clearTimeout(pending.timeout);
    this.pendingMetadataByClient.delete(client);
  }

  // metadata와 짝을 이룰 바이너리가 제한 시간 안에 오지 않으면 오래된 전송 상태를 폐기한다.
  private expirePendingMetadata(client: WebSocket): void {
    if (!this.pendingMetadataByClient.has(client)) return;
    this.pendingMetadataByClient.delete(client);
    sendWsError(client, {
      code: 'AUDIO_BINARY_TIMEOUT',
      message: '음성 데이터가 제한 시간 안에 도착하지 않았습니다.',
      requestEvent: 'audio:binary',
      retryable: true,
    });
  }
}
