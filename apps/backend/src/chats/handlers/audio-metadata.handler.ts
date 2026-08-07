/*
역할: audio:metadata 이벤트 검증과 음성 바이너리 수신 전 임시 상태 보관
연결 객체: WebSocket 연결 객체, 인증된 사용자 정보
전체 흐름: ChatsGateway → AudioMetadataHandler → 연결별 pending metadata → 음성 바이너리 처리 예정
*/
import { Injectable } from '@nestjs/common';
import type WebSocket from 'ws';
import type { RawData } from 'ws';
import type { AccessTokenPayload } from '../../auth/auth.service';
import { sendWsEvent } from '../ws-event';
import { ChatConnectionStateService } from '../chat-connection-state.service';

export type AudioEndType = 'auto' | 'manual';

// 프론트가 음성 바이너리보다 먼저 보내는 발화 정보 형식
export interface AudioMetadata {
  captureId: string;
  aiQuestionMessageId: number;
  generationId: string;
  mimeType: string;
  capturedAt: string;
  endType: AudioEndType;
  seniorId: number;
}

interface AudioMetadataEvent {
  event: 'audio:metadata';
  payload: Omit<AudioMetadata, 'seniorId'>;
  ts: string;
}

@Injectable()
export class AudioMetadataHandler {
  private readonly pendingMetadataByClient: WeakMap<WebSocket, AudioMetadata>; // 연결별 다음 바이너리의 발화 정보
  private readonly chatConnectionStateService: ChatConnectionStateService; // 현재 AI 질문 식별정보 확인 객체

  // NestJS DI 컨테이너가 연결별 대화 상태 객체를 생성자에 주입
  constructor(chatConnectionStateService: ChatConnectionStateService) {
    this.chatConnectionStateService = chatConnectionStateService;
    this.pendingMetadataByClient = new WeakMap<WebSocket, AudioMetadata>();
  }

  // 역할: audio:metadata 검증 후 인증 사용자 ID와 함께 연결별 임시 보관
  // 연결 객체: WebSocket 연결 객체, 인증된 사용자 정보
  // 다음 호출: 음성 바이너리 수신 → pending metadata 조회 및 페어링
  handleAudioMetadata(
    client: WebSocket,
    authenticatedUser: AccessTokenPayload,
    data: RawData,
    isBinary: boolean,
  ): void {
    try {
      if (isBinary) {
        throw new Error('audio:metadata는 JSON 형식이어야 합니다.');
      }

      // 이전 metadata에 해당하는 바이너리를 받기 전에는 새 metadata 수신 거부
      if (this.pendingMetadataByClient.has(client)) {
        sendWsEvent(client, 'error', {
          code: 'AUDIO_METADATA_PENDING',
          message: '이전 음성 메타데이터의 바이너리 수신을 기다리고 있습니다.',
        });
        return;
      }

      const metadataEvent = this.parseAudioMetadataEvent(data.toString());

      // 서버가 현재 연결에 전송한 AI 질문과 식별정보가 일치하는지 확인
      if (
        !this.chatConnectionStateService.matchesCurrentQuestion(
          client,
          metadataEvent.payload.aiQuestionMessageId,
          metadataEvent.payload.generationId,
        )
      ) {
        sendWsEvent(client, 'error', {
          code: 'QUESTION_MISMATCH',
          message: '현재 AI 질문과 일치하지 않는 음성 메타데이터입니다.',
        });
        return;
      }

      this.pendingMetadataByClient.set(client, {
        ...metadataEvent.payload,
        seniorId: authenticatedUser.sub,
      });
    } catch {
      sendWsEvent(client, 'error', {
        code: 'INVALID_AUDIO_METADATA',
        message: '음성 메타데이터 형식이 올바르지 않습니다.',
      });
    }
  }

  // 역할: 다음 음성 바이너리와 연결할 pending metadata 조회
  // 다음 호출: 바이너리 처리 Handler 구현 시 사용
  getPendingMetadata(client: WebSocket): AudioMetadata | undefined {
    return this.pendingMetadataByClient.get(client);
  }

  // 역할: WebSocket 종료 시 연결별 pending metadata 제거
  clearClient(client: WebSocket): void {
    this.pendingMetadataByClient.delete(client);
  }

  // 역할: JSON 변환과 audio:metadata 필수 필드·타입 검증
  // 다음 호출: 검증 성공 → pendingMetadataByClient에 보관
  private parseAudioMetadataEvent(message: string): AudioMetadataEvent {
    const parsedEvent: unknown = JSON.parse(message);

    if (
      typeof parsedEvent !== 'object' ||
      parsedEvent === null ||
      !('event' in parsedEvent) ||
      parsedEvent.event !== 'audio:metadata' ||
      !('payload' in parsedEvent) ||
      typeof parsedEvent.payload !== 'object' ||
      parsedEvent.payload === null ||
      !('captureId' in parsedEvent.payload) ||
      typeof parsedEvent.payload.captureId !== 'string' ||
      parsedEvent.payload.captureId.length === 0 ||
      !('aiQuestionMessageId' in parsedEvent.payload) ||
      !Number.isInteger(parsedEvent.payload.aiQuestionMessageId) ||
      Number(parsedEvent.payload.aiQuestionMessageId) <= 0 ||
      !('generationId' in parsedEvent.payload) ||
      typeof parsedEvent.payload.generationId !== 'string' ||
      parsedEvent.payload.generationId.length === 0 ||
      !('mimeType' in parsedEvent.payload) ||
      typeof parsedEvent.payload.mimeType !== 'string' ||
      !parsedEvent.payload.mimeType.startsWith('audio/') ||
      !('capturedAt' in parsedEvent.payload) ||
      typeof parsedEvent.payload.capturedAt !== 'string' ||
      Number.isNaN(Date.parse(parsedEvent.payload.capturedAt)) ||
      !('endType' in parsedEvent.payload) ||
      (parsedEvent.payload.endType !== 'auto' &&
        parsedEvent.payload.endType !== 'manual') ||
      !('ts' in parsedEvent) ||
      typeof parsedEvent.ts !== 'string' ||
      Number.isNaN(Date.parse(parsedEvent.ts))
    ) {
      throw new Error('유효하지 않은 audio:metadata 이벤트입니다.');
    }

    return {
      event: 'audio:metadata',
      payload: {
        captureId: parsedEvent.payload.captureId,
        aiQuestionMessageId: Number(parsedEvent.payload.aiQuestionMessageId),
        generationId: parsedEvent.payload.generationId,
        mimeType: parsedEvent.payload.mimeType,
        capturedAt: parsedEvent.payload.capturedAt,
        endType: parsedEvent.payload.endType,
      },
      ts: parsedEvent.ts,
    };
  }
}
