/*
역할: AI 질문 이후 시니어의 첫 답변을 기다리며 30초 안내와 총 10분 무음(무응답) 자동 종료를 관리한다.
연결 흐름: ChatStartHandler/AudioBinaryHandler → ChatInactivityService → chat:idle-warning 또는 chat:ended
[완료] 자동 종료는 대화 상태만 종료하고 WebSocket 연결 자체는 닫지 않는다.
[2026-08-19 수정] 무음 판정 기준: 답변 도중 3초 이상 무음이면 그 답변을 종료로 보고
(프론트 AUTO_SILENCE_MS, useRecordVoiceAnswer), 질문을 던진 뒤 시니어가 아예 말을
시작하지 않은 채로 10분간 무음이 이어지면 대화 자체를 종료한다.
[제약] 타이머는 프로세스 메모리에 있어 서버 재시작·다중 인스턴스 간에 이어지지 않는다.
*/
import { Injectable } from '@nestjs/common';
import type WebSocket from 'ws';
import { EmotionIndexRecalcTriggerService } from '../reports/emotion-index-recalc-trigger.service';
import { AudioTransferStateService } from './audio-transfer-state.service';
import { ChatConnectionStateService } from './chat-connection-state.service';
import { AudioMetadataHandler } from './handlers/audio-metadata.handler';
import { QuestionAnswerQueueService } from './question-answer-queue.service';
import { LastTurnRecalcTimerService } from './last-turn-recalc-timer.service';
import { sendWsEvent } from './ws-event';

export const IDLE_WARNING_MS = 30_000;
export const INACTIVITY_TIMEOUT_MS = 10 * 60_000;

interface InactivityTimers {
  warning: NodeJS.Timeout;
  timeout: NodeJS.Timeout;
}

@Injectable()
export class ChatInactivityService {
  private readonly timersByClient = new WeakMap<WebSocket, InactivityTimers>();
  private readonly questionAnswerQueueService: QuestionAnswerQueueService;
  private readonly audioMetadataHandler: AudioMetadataHandler;
  private readonly audioTransferStateService: AudioTransferStateService;
  private readonly chatConnectionStateService: ChatConnectionStateService;
  private readonly recalcTriggerService: EmotionIndexRecalcTriggerService;
  private readonly lastTurnRecalcTimerService: LastTurnRecalcTimerService;

  constructor(
    questionAnswerQueueService: QuestionAnswerQueueService,
    audioMetadataHandler: AudioMetadataHandler,
    audioTransferStateService: AudioTransferStateService,
    chatConnectionStateService: ChatConnectionStateService,
    recalcTriggerService: EmotionIndexRecalcTriggerService,
    lastTurnRecalcTimerService: LastTurnRecalcTimerService,
  ) {
    this.questionAnswerQueueService = questionAnswerQueueService;
    this.audioMetadataHandler = audioMetadataHandler;
    this.audioTransferStateService = audioTransferStateService;
    this.chatConnectionStateService = chatConnectionStateService;
    this.recalcTriggerService = recalcTriggerService;
    this.lastTurnRecalcTimerService = lastTurnRecalcTimerService;
  }

  startWaitingForAnswer(client: WebSocket): void {
    this.clearClient(client);
    const warning = setTimeout(() => {
      sendWsEvent(client, 'chat:idle-warning', {
        message: '천천히 생각하시고 편하게 말씀해 주세요.',
        remainingSeconds: (INACTIVITY_TIMEOUT_MS - IDLE_WARNING_MS) / 1000,
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
      // 무응답으로 대화가 끝났으니 이 질문에 답변이 더 늘어날 일이 없다 —
      // 개수·용량 카운터를 지운다(프로세스 수명 내내 누적되는 문제, 위 import한
      // 서비스의 clearCounters 주석 참고).
      this.questionAnswerQueueService.clearCounters(
        currentQuestion.questionMessageId,
      );
    }
    // markChatEnded가 seniorId 매핑을 지우므로 그 전에 읽어야 한다.
    const seniorId = this.chatConnectionStateService.getSeniorId(client);
    if (seniorId !== undefined) {
      this.lastTurnRecalcTimerService.cancel(seniorId);
      this.recalcTriggerService.recalcToday(seniorId);
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
