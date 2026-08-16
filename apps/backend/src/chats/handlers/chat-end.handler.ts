/*
역할: 시니어의 chat:end 수동 종료 요청을 검증하고 남은 질문 큐와 연결별 상태를 정리한다.
연결 객체: ChatsGateway, QuestionAnswerQueueService, AudioMetadataHandler, AudioBinaryHandler, ChatConnectionStateService
전체 흐름: chat:end → 현재 질문 큐 즉시 확정 → 연결별 임시 상태 삭제 → chat:ended
주의: 재연결 만료와 자동 종료는 이번 MVP 범위에 포함하지 않고 USER_REQUESTED 수동 종료만 처리한다.
*/
import { Injectable } from '@nestjs/common';
import type WebSocket from 'ws';
import { EmotionIndexRecalcTriggerService } from '../../reports/emotion-index-recalc-trigger.service';
import { ChatConnectionStateService } from '../chat-connection-state.service';
import { QuestionAnswerQueueService } from '../question-answer-queue.service';
import { sendWsEvent } from '../ws-event';
import { AudioBinaryHandler } from './audio-binary.handler';
import { AudioMetadataHandler } from './audio-metadata.handler';
import { ChatInactivityService } from '../chat-inactivity.service';

import type { ChatEndEvent } from '../client-ws-event';

@Injectable()
export class ChatEndHandler {
  constructor(
    private readonly questionAnswerQueueService: QuestionAnswerQueueService,
    private readonly audioMetadataHandler: AudioMetadataHandler,
    private readonly audioBinaryHandler: AudioBinaryHandler,
    private readonly chatConnectionStateService: ChatConnectionStateService,
    private readonly chatInactivityService?: ChatInactivityService,
    private readonly recalcTriggerService?: EmotionIndexRecalcTriggerService,
  ) {}

  // 역할: 사용자의 수동 종료를 처리하되 WebSocket 연결은 유지하여 새 chat:start를 받을 수 있게 한다.
  handleChatEnd(client: WebSocket, event: ChatEndEvent): void {
    void event;

    const currentQuestion =
      this.chatConnectionStateService.getCurrentQuestion(client);
    if (currentQuestion !== undefined) {
      this.questionAnswerQueueService.flush(
        currentQuestion.questionMessageId,
        false,
      );
    }

    // markChatEnded가 seniorId 매핑을 지우므로 그 전에 읽어야 한다.
    const seniorId = this.chatConnectionStateService.getSeniorId(client);
    if (seniorId !== undefined) {
      this.recalcTriggerService?.recalcToday(seniorId);
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
}
