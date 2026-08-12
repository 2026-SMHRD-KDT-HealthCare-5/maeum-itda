/*
역할: 시니어의 chat:end 수동 종료 요청을 검증하고 남은 질문 큐와 연결별 상태를 정리한다.
연결 객체: ChatsGateway, QuestionAnswerQueueService, AudioMetadataHandler, AudioBinaryHandler, ChatConnectionStateService
전체 흐름: chat:end → 현재 질문 큐 즉시 확정 → 연결별 임시 상태 삭제 → chat:ended
주의: 재연결 만료와 자동 종료는 이번 MVP 범위에 포함하지 않고 USER_REQUESTED 수동 종료만 처리한다.
*/
import { Injectable } from '@nestjs/common';
import type WebSocket from 'ws';
import type { RawData } from 'ws';
import { ChatConnectionStateService } from '../chat-connection-state.service';
import { QuestionAnswerQueueService } from '../question-answer-queue.service';
import { rawDataToString, sendWsError, sendWsEvent } from '../ws-event';
import { AudioBinaryHandler } from './audio-binary.handler';
import { AudioMetadataHandler } from './audio-metadata.handler';
import { ChatInactivityService } from '../chat-inactivity.service';

interface ChatEndEvent {
  event: 'chat:end';
  payload: { reason: 'USER_REQUESTED' };
  ts: string;
}

@Injectable()
export class ChatEndHandler {
  constructor(
    private readonly questionAnswerQueueService: QuestionAnswerQueueService,
    private readonly audioMetadataHandler: AudioMetadataHandler,
    private readonly audioBinaryHandler: AudioBinaryHandler,
    private readonly chatConnectionStateService: ChatConnectionStateService,
    private readonly chatInactivityService?: ChatInactivityService,
  ) {}

  // 역할: 사용자의 수동 종료를 처리하되 WebSocket 연결은 유지하여 새 chat:start를 받을 수 있게 한다.
  handleChatEnd(client: WebSocket, data: RawData, isBinary: boolean): void {
    try {
      if (isBinary) throw new Error('chat:end는 JSON 형식이어야 합니다.');
      this.parseChatEndEvent(rawDataToString(data));
    } catch {
      sendWsError(client, {
        code: 'INVALID_EVENT',
        message: '대화 종료 이벤트 형식이 올바르지 않습니다.',
        requestEvent: 'chat:end',
        retryable: false,
      });
      return;
    }

    const currentQuestion =
      this.chatConnectionStateService.getCurrentQuestion(client);
    if (currentQuestion !== undefined) {
      this.questionAnswerQueueService.flush(
        currentQuestion.questionMessageId,
        false,
      );
    }

    this.audioMetadataHandler.clearClient(client);
    this.audioBinaryHandler.clearClient(client);
    this.chatInactivityService?.clearClient(client);
    this.chatConnectionStateService.markChatEnded(client);

    const endedAt = new Date().toISOString();
    sendWsEvent(client, 'chat:ended', {
      reason: 'USER_REQUESTED',
      endedAt,
    });
  }

  private parseChatEndEvent(message: string): ChatEndEvent {
    const parsed: unknown = JSON.parse(message);
    if (
      typeof parsed !== 'object' ||
      parsed === null ||
      !('event' in parsed) ||
      parsed.event !== 'chat:end' ||
      !('payload' in parsed) ||
      typeof parsed.payload !== 'object' ||
      parsed.payload === null ||
      !('reason' in parsed.payload) ||
      parsed.payload.reason !== 'USER_REQUESTED' ||
      Object.keys(parsed.payload).length !== 1 ||
      !('ts' in parsed) ||
      typeof parsed.ts !== 'string' ||
      Number.isNaN(Date.parse(parsed.ts))
    ) {
      throw new Error('유효하지 않은 chat:end 이벤트입니다.');
    }
    return {
      event: 'chat:end',
      payload: { reason: 'USER_REQUESTED' },
      ts: parsed.ts,
    };
  }
}
