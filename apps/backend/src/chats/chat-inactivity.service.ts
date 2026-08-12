/*
역할: AI 질문 이후 시니어의 첫 답변을 기다리며 30초 안내와 총 2분 무응답 자동 종료를 관리한다.
연결 흐름: ChatStartHandler/AudioBinaryHandler → ChatInactivityService → chat:idle-warning 또는 chat:ended
주의: 자동 종료는 대화 상태만 종료하고 WebSocket 연결 자체는 닫지 않는다.
*/
import { Injectable } from '@nestjs/common';
import type WebSocket from 'ws';
import { AudioTransferStateService } from './audio-transfer-state.service';
import { ChatConnectionStateService } from './chat-connection-state.service';
import { AudioMetadataHandler } from './handlers/audio-metadata.handler';
import { QuestionAnswerQueueService } from './question-answer-queue.service';
import { sendWsEvent } from './ws-event';

export const IDLE_WARNING_MS = 30_000;
export const INACTIVITY_TIMEOUT_MS = 120_000;

interface InactivityTimers {
  warning: NodeJS.Timeout;
  timeout: NodeJS.Timeout;
}

@Injectable()
export class ChatInactivityService {
  private readonly timersByClient = new WeakMap<WebSocket, InactivityTimers>();

  constructor(
    private readonly questionAnswerQueueService: QuestionAnswerQueueService,
    private readonly audioMetadataHandler: AudioMetadataHandler,
    private readonly audioTransferStateService: AudioTransferStateService,
    private readonly chatConnectionStateService: ChatConnectionStateService,
  ) {}

  startWaitingForAnswer(client: WebSocket): void {
    this.clearClient(client);
    const warning = setTimeout(() => {
      sendWsEvent(client, 'chat:idle-warning', {
        message: '천천히 생각하시고 편하게 말씀해 주세요.',
        remainingSeconds: 90,
      });
    }, IDLE_WARNING_MS);
    const timeout = setTimeout(
      () => this.endForInactivity(client),
      INACTIVITY_TIMEOUT_MS,
    );
    this.timersByClient.set(client, { warning, timeout });
  }

  markAnswerStarted(client: WebSocket): void {
    this.clearClient(client);
  }

  clearClient(client: WebSocket): void {
    const timers = this.timersByClient.get(client);
    if (timers === undefined) return;
    clearTimeout(timers.warning);
    clearTimeout(timers.timeout);
    this.timersByClient.delete(client);
  }

  private endForInactivity(client: WebSocket): void {
    const currentQuestion =
      this.chatConnectionStateService.getCurrentQuestion(client);
    if (currentQuestion !== undefined) {
      this.questionAnswerQueueService.flush(
        currentQuestion.questionMessageId,
        false,
      );
    }
    this.clearClient(client);
    this.audioMetadataHandler.clearClient(client);
    this.audioTransferStateService.clearClient(client);
    this.chatConnectionStateService.markChatEnded(client);
    const endedAt = new Date().toISOString();
    sendWsEvent(client, 'chat:ended', {
      reason: 'INACTIVITY_TIMEOUT',
      endedAt,
    });
  }
}
