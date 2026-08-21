/*
역할: 음성 Binary frame을 metadata와 결합해 질문별 큐에 등록한다.
연결 객체: ChatsGateway → AudioBinaryHandler → QuestionAnswerQueueService → AnalysisService
전체 흐름: 바이너리 검증 → audio:ack → 즉시 확정(2026-08-21부터 대기 없음) → FastAPI REST 요청 → 성공 시에만 DB 저장 → 다음 ai:question
[완료] STT·감성·척도·질문 생성은 FastAPI 책임이며 이 Handler는 NestJS 수신·전달 흐름만 담당한다.
[결정사항] 답변 메시지는 분석이 성공한 시점에야 처음 DB에 저장된다 — 분석 실패 시
CONVERSATION_MESSAGE에 아무 흔적도 남기지 않는다. 그래서 이 시점의 답변은 아직 실제
MESSAGE_ID가 없고, tempAnswerId(프로세스 메모리 전용 일련번호)로만 구분한다.
[제약] 질문별 처리 순서는 프로세스 메모리 Map으로 제어하므로 서버 재시작·다중 인스턴스 간에는 공유되지 않는다.
*/
import { Injectable, Logger } from '@nestjs/common';
import type WebSocket from 'ws';
import type { RawData } from 'ws';
import { AnalysisService } from '../../analysis/analysis.service';
import { ChatConnectionStateService } from '../chat-connection-state.service';
import {
  QuestionAnswerQueueLimitError,
  QuestionAnswerQueueService,
} from '../question-answer-queue.service';
import { sendWsError, sendWsEvent, type WsErrorPayload } from '../ws-event';
import { AudioMetadataHandler } from './audio-metadata.handler';
import { AudioTransferStateService } from '../audio-transfer-state.service';
import { ChatInactivityService } from '../chat-inactivity.service';
import { LastTurnRecalcTimerService } from '../last-turn-recalc-timer.service';
import { QuestionDeliveryService } from '../question-delivery.service';

const MAX_AUDIO_BYTES = 10 * 1024 * 1024;

@Injectable()
export class AudioBinaryHandler {
  private readonly logger = new Logger(AudioBinaryHandler.name);
  // 같은 질문에 늦게 도착한 추가 묶음은 앞선 FastAPI 요청 뒤에 순서대로 처리한다.
  private readonly processingByQuestionMessageId = new Map<
    number,
    Promise<void>
  >();
  // FastAPI 요청·응답 안에서만 답변을 구분하는 임시 번호 — DB MESSAGE_ID가 아니다.
  private nextTempAnswerId = 1;
  private readonly audioMetadataHandler: AudioMetadataHandler;
  private readonly questionAnswerQueueService: QuestionAnswerQueueService;
  private readonly analysisService: AnalysisService;
  private readonly chatConnectionStateService: ChatConnectionStateService;
  private readonly audioTransferStateService: AudioTransferStateService;
  private readonly chatInactivityService: ChatInactivityService;
  private readonly lastTurnRecalcTimerService: LastTurnRecalcTimerService;
  private readonly questionDeliveryService: QuestionDeliveryService;

  constructor(
    audioMetadataHandler: AudioMetadataHandler,
    questionAnswerQueueService: QuestionAnswerQueueService,
    analysisService: AnalysisService,
    chatConnectionStateService: ChatConnectionStateService,
    audioTransferStateService: AudioTransferStateService,
    chatInactivityService: ChatInactivityService,
    lastTurnRecalcTimerService: LastTurnRecalcTimerService,
    questionDeliveryService: QuestionDeliveryService,
  ) {
    this.audioMetadataHandler = audioMetadataHandler;
    this.questionAnswerQueueService = questionAnswerQueueService;
    this.analysisService = analysisService;
    this.chatConnectionStateService = chatConnectionStateService;
    this.audioTransferStateService = audioTransferStateService;
    this.chatInactivityService = chatInactivityService;
    this.lastTurnRecalcTimerService = lastTurnRecalcTimerService;
    this.questionDeliveryService = questionDeliveryService;
  }

  // 역할: 음성 한 건은 즉시 큐에 등록·확인하고, 분석은 같은 질문의 추가 답변 대기가 끝난 뒤 한 번만 시작한다.
  handleAudioBinary(client: WebSocket, data: RawData): void {
    const metadata = this.audioMetadataHandler.takePendingMetadata(client);
    if (metadata === undefined) {
      this.sendError(
        client,
        'AUDIO_METADATA_MISSING',
        '음성 바이너리보다 audio:metadata를 먼저 전송해야 합니다.',
        false,
      );
      return;
    }

    if (this.audioTransferStateService.has(client, metadata.audioTransferId)) {
      sendWsEvent(client, 'audio:ack', {
        audioTransferId: metadata.audioTransferId,
      });
      return;
    }

    const audioBuffer = this.toBuffer(data);
    if (audioBuffer.byteLength === 0) {
      this.sendError(
        client,
        'EMPTY_AUDIO_BINARY',
        '음성 데이터가 비어 있습니다.',
        false,
      );
      return;
    }
    if (audioBuffer.byteLength > MAX_AUDIO_BYTES) {
      this.sendError(
        client,
        'AUDIO_TOO_LARGE',
        '음성 데이터는 10MB를 초과할 수 없습니다.',
        false,
      );
      return;
    }

    try {
      this.questionAnswerQueueService.assertCanAccept(
        metadata.questionMessageId,
        audioBuffer.byteLength,
      );
    } catch (error: unknown) {
      if (error instanceof QuestionAnswerQueueLimitError) {
        this.sendError(client, error.code, error.message, false);
        return;
      }
      throw error;
    }

    const queued = this.questionAnswerQueueService.enqueue({
      tempAnswerId: this.nextTempAnswerId++,
      seniorId: metadata.seniorId,
      questionMessageId: metadata.questionMessageId,
      generationId: metadata.generationId,
      audioTransferId: metadata.audioTransferId,
      mimeType: metadata.mimeType,
      capturedAt: metadata.capturedAt,
      endType: metadata.endType,
      audioBuffer,
      continueConversation:
        this.chatConnectionStateService.matchesCurrentQuestion(
          client,
          metadata.questionMessageId,
          metadata.generationId,
        ),
    });

    this.audioTransferStateService.markProcessed(
      client,
      metadata.audioTransferId,
    );
    sendWsEvent(client, 'audio:ack', {
      audioTransferId: metadata.audioTransferId,
    });

    // 첫 등록 Handler만 공용 ready Promise를 기다려 질문별 분석을 한 번 실행한다.
    if (queued.isBatchOwner) {
      void queued.ready
        .then((batch) => this.scheduleBatch(client, batch))
        .catch((error: unknown) => {
          this.logger.error(
            `음성 답변 묶음 준비 실패: questionMessageId=${metadata.questionMessageId}`,
            error instanceof Error ? error.stack : String(error),
          );
          if (this.isClientOpen(client)) {
            this.sendError(
              client,
              'AUDIO_ANALYSIS_FAILED',
              '음성 답변 묶음을 준비하지 못했습니다.',
              true,
            );
          }
        });
    }
  }

  private scheduleBatch(
    client: WebSocket,
    batch: Parameters<AnalysisService['enqueueAnswerBatch']>[0],
  ): void {
    const previous =
      this.processingByQuestionMessageId.get(batch.questionMessageId) ??
      Promise.resolve();
    const current = previous.then(() =>
      this.processBatchAndSendNextQuestion(client, batch),
    );
    this.processingByQuestionMessageId.set(batch.questionMessageId, current);
    void current.finally(() => {
      if (
        this.processingByQuestionMessageId.get(batch.questionMessageId) ===
        current
      ) {
        this.processingByQuestionMessageId.delete(batch.questionMessageId);
      }
    });
  }

  // 역할: 확정 묶음을 임시 저장하고 FastAPI가 연결된 경우 분석 결과와 다음 질문을 처리한다.
  private async processBatchAndSendNextQuestion(
    client: WebSocket,
    batch: Parameters<AnalysisService['enqueueAnswerBatch']>[0],
  ): Promise<void> {
    try {
      // 분석 대기 중 다음 질문이 이미 전송됐다면 늦은 답변은 저장·분석만 하고 새 질문은 만들지 않는다.
      batch.continueConversation =
        batch.continueConversation &&
        this.chatConnectionStateService.matchesCurrentQuestion(
          client,
          batch.questionMessageId,
          batch.generationId,
        );
      this.analysisService.enqueueAnswerBatch(batch);
      if (!this.analysisService.isFastApiConfigured()) return;

      const completed = await this.analysisService.processPendingAnswerBatch(
        batch.questionMessageId,
        () =>
          this.chatConnectionStateService.matchesCurrentQuestion(
            client,
            batch.questionMessageId,
            batch.generationId,
          ),
      );
      if (
        completed === null ||
        this.chatConnectionStateService.isChatEnded(client) ||
        !this.isClientOpen(client)
      ) {
        return;
      }
      // 다음 질문 유무와 무관하게(늦은 답변이라 다음 질문이 없는 경우도 포함)
      // STT(LLM 교정 포함) 결과를 먼저 전달한다 — 결정사항 로그 §0 "STT 결과는
      // 다음 질문 생성 시점에 함께 전달".
      if (completed.answerTranscripts.length > 0) {
        sendWsEvent(client, 'audio:transcript', {
          transcripts: completed.answerTranscripts,
        });
      }
      if (completed.nextQuestion === null) return;
      // 새 질문이 만들어졌다는 건 이 질문(batch.questionMessageId)이 완전히
      // 닫혔다는 뜻이다 — 앞으로 클라이언트가 보낼 답변은 전부 새 질문 ID로
      // 붙으므로, 이 ID의 개수·용량 카운터는 더 늘어나지 않는다. 여기서 지워
      // 프로세스 수명 내내 쌓이는 걸 막는다(위 클래스 주석 [제약] 참고).
      this.questionAnswerQueueService.clearCounters(batch.questionMessageId);
      this.chatConnectionStateService.setCurrentQuestion(
        client,
        completed.nextQuestion,
      );
      // TTS 합성을 기다리지 않고 텍스트부터 보낸다 — 음성은 준비되는 대로 별도로 뒤이어 보낸다.
      this.questionDeliveryService.deliverQuestion(
        client,
        completed.nextQuestion,
      );
      this.chatInactivityService.startWaitingForAnswer(client);
      // [완료] 다음 질문을 전달한 시점부터 10분 재계산 타이머를 다시 시작한다.
      this.lastTurnRecalcTimerService.arm(batch.seniorId);
      void this.questionDeliveryService.deliverTtsToken(
        client,
        completed.nextQuestion.messageId,
        batch.seniorId,
      );
    } catch {
      // AnalysisService.processPendingAnswerBatch는 실패 시 아무것도 저장하지
      // 않는다 — 이 답변들은 애초에 메시지로 존재한 적이 없으므로 프론트에
      // 알릴 audio:transcript도 없다. error 이벤트만으로 실패를 알리고,
      // 시니어 쪽 녹음 UI는 이 이벤트를 받아 곧바로 같은 질문에 대한 새 녹음을
      // 다시 연다(처음 화면 진입 때와 같은 대기 상태로 복귀).
      if (this.isClientOpen(client)) {
        this.sendError(
          client,
          'AUDIO_ANALYSIS_FAILED',
          '음성 분석에 실패했습니다.',
          true,
        );
      }
    }
  }

  clearClient(client: WebSocket): void {
    this.audioTransferStateService.clearClient(client);
  }

  private toBuffer(data: RawData): Buffer {
    if (Array.isArray(data)) return Buffer.concat(data);
    if (Buffer.isBuffer(data)) return data;
    return Buffer.from(data);
  }

  private isClientOpen(client: WebSocket): boolean {
    return client.readyState === 1;
  }

  private sendError(
    client: WebSocket,
    code: WsErrorPayload['code'],
    message: string,
    retryable: boolean,
  ): void {
    sendWsError(client, {
      code,
      message,
      requestEvent: 'audio:binary',
      retryable,
    });
  }
}
