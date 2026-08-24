/*
역할: 시니어의 chat:end 수동 종료 요청을 검증하고 남은 질문 큐와 연결별 상태를 정리한다.
연결 객체: ChatsGateway, QuestionAnswerQueueService, AudioMetadataHandler, AudioBinaryHandler, ChatConnectionStateService
전체 흐름: chat:end → 현재 질문 큐 즉시 확정 → 연결별 임시 상태 삭제 → chat:ended
[완료] 이 Handler는 USER_REQUESTED 수동 종료만 처리하고, 무응답 자동 종료는 ChatInactivityService가 담당한다.
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
import { LastTurnRecalcTimerService } from '../last-turn-recalc-timer.service';
import { QuestionProcessingTrackerService } from '../question-processing-tracker.service';

import type { ChatEndEvent } from '../client-ws-event';

@Injectable()
export class ChatEndHandler {
  private readonly questionAnswerQueueService: QuestionAnswerQueueService;
  private readonly audioMetadataHandler: AudioMetadataHandler;
  private readonly audioBinaryHandler: AudioBinaryHandler;
  private readonly chatConnectionStateService: ChatConnectionStateService;
  private readonly chatInactivityService: ChatInactivityService;
  private readonly recalcTriggerService: EmotionIndexRecalcTriggerService;
  private readonly lastTurnRecalcTimerService: LastTurnRecalcTimerService;
  private readonly questionProcessingTrackerService: QuestionProcessingTrackerService;

  constructor(
    questionAnswerQueueService: QuestionAnswerQueueService,
    audioMetadataHandler: AudioMetadataHandler,
    audioBinaryHandler: AudioBinaryHandler,
    chatConnectionStateService: ChatConnectionStateService,
    chatInactivityService: ChatInactivityService,
    recalcTriggerService: EmotionIndexRecalcTriggerService,
    lastTurnRecalcTimerService: LastTurnRecalcTimerService,
    questionProcessingTrackerService: QuestionProcessingTrackerService,
  ) {
    this.questionAnswerQueueService = questionAnswerQueueService;
    this.audioMetadataHandler = audioMetadataHandler;
    this.audioBinaryHandler = audioBinaryHandler;
    this.chatConnectionStateService = chatConnectionStateService;
    this.chatInactivityService = chatInactivityService;
    this.recalcTriggerService = recalcTriggerService;
    this.lastTurnRecalcTimerService = lastTurnRecalcTimerService;
    this.questionProcessingTrackerService = questionProcessingTrackerService;
  }

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
      // 대화가 끝났으니 이 질문에 답변이 더 늘어날 일이 없다 — 개수·용량
      // 카운터를 지운다(프로세스 수명 내내 누적되는 문제, 위 import한
      // 서비스의 clearCounters 주석 참고).
      this.questionAnswerQueueService.clearCounters(
        currentQuestion.questionMessageId,
      );
    }

    // markChatEnded가 seniorId 매핑을 지우므로 그 전에 읽어야 한다.
    const seniorId = this.chatConnectionStateService.getSeniorId(client);
    if (seniorId !== undefined) {
      this.lastTurnRecalcTimerService.cancel(seniorId);
      // 방금 flush한 답변(있다면)의 FastAPI 분석·DB 저장이 아직 진행 중일 수
      // 있다 — 그게 끝나기 전에 재계산하면 그 날 리포트가 마지막 턴 점수가
      // 빠진 채로 "완료" 상태가 돼버린다(chat:ended 응답 자체는 지연 없이
      // 즉시 보내고, 재계산만 내부적으로 기다린 뒤 실행한다).
      const pendingQuestionMessageId = currentQuestion?.questionMessageId;
      void (
        pendingQuestionMessageId === undefined
          ? Promise.resolve()
          : this.questionProcessingTrackerService.waitFor(
              pendingQuestionMessageId,
            )
      ).then(() => this.recalcTriggerService.recalcToday(seniorId));
    }

    this.audioMetadataHandler.clearClient(client);
    this.audioBinaryHandler.clearClient(client);
    this.chatInactivityService.clearClient(client);
    this.chatConnectionStateService.markChatEnded(client);

    const endedAt = new Date().toISOString();
    sendWsEvent(client, 'chat:ended', {
      reason: 'USER_REQUESTED',
      endedAt,
    });
  }
}
