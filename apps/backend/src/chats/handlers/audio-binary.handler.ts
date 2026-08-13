/*
역할: 음성 Binary frame을 metadata와 결합해 답변을 저장하고 질문별 추가 답변 큐에 등록한다.
연결 객체: ChatsGateway → AudioBinaryHandler → AudioAnswerRepository → QuestionAnswerQueueService → AnalysisService
전체 흐름: 바이너리 검증 → 답변·관계 DB 저장 → audio:ack → 5초간 추가 답변 결합 → FastAPI REST 요청 → 다음 ai:question
주의: STT·감성·척도·질문 생성은 FastAPI 책임이며 이 Handler는 NestJS 수신·저장·전달 흐름만 담당한다.
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
import { AudioAnswerRepository } from '../repositories/audio-answer.repository';
import { sendWsError, sendWsEvent, type WsErrorPayload } from '../ws-event';
import { AudioMetadataHandler } from './audio-metadata.handler';
import { AudioTransferStateService } from '../audio-transfer-state.service';
import { ChatInactivityService } from '../chat-inactivity.service';

const MAX_AUDIO_BYTES = 10 * 1024 * 1024;

@Injectable()
export class AudioBinaryHandler {
  private readonly logger = new Logger(AudioBinaryHandler.name);
  // 같은 질문에 늦게 도착한 추가 묶음은 앞선 FastAPI 요청 뒤에 순서대로 처리한다.
  private readonly processingByQuestionMessageId = new Map<
    number,
    Promise<void>
  >();

  constructor(
    private readonly audioMetadataHandler: AudioMetadataHandler,
    private readonly audioAnswerRepository: AudioAnswerRepository,
    private readonly questionAnswerQueueService: QuestionAnswerQueueService,
    private readonly analysisService: AnalysisService,
    private readonly chatConnectionStateService: ChatConnectionStateService,
    private readonly audioTransferStateService: AudioTransferStateService,
    private readonly chatInactivityService?: ChatInactivityService,
  ) {}

  // 역할: 음성 한 건은 즉시 저장·확인하고, 분석은 같은 질문의 추가 답변 대기가 끝난 뒤 한 번만 시작한다.
  async handleAudioBinary(client: WebSocket, data: RawData): Promise<void> {
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

    const processedTransfer = this.audioTransferStateService.find(
      client,
      metadata.audioTransferId,
    );
    if (processedTransfer !== undefined) {
      sendWsEvent(client, 'audio:ack', {
        audioTransferId: metadata.audioTransferId,
        messageId: processedTransfer.messageId,
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
      // 분석되지 않는 DB 메시지가 남지 않도록 답변 저장 전에 질문별 큐 한도를 검사한다.
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

    try {
      const savedAnswer = await this.audioAnswerRepository.savePendingAnswer(
        metadata.seniorId,
        metadata.questionMessageId,
      );
      const queued = this.questionAnswerQueueService.enqueue({
        messageId: savedAnswer.messageId,
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
        savedAnswer.messageId,
      );
      sendWsEvent(client, 'audio:ack', {
        audioTransferId: metadata.audioTransferId,
        messageId: savedAnswer.messageId,
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
    } catch {
      this.sendError(
        client,
        'AUDIO_SAVE_FAILED',
        '음성 답변 정보를 저장하지 못했습니다.',
        true,
      );
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
      await this.analysisService.enqueueAnswerBatch(batch);
      if (!this.analysisService.isFastApiConnected()) return;

      const completed = await this.analysisService.processPendingAnswerBatch(
        batch.questionMessageId,
      );
      if (
        completed?.nextQuestion === null ||
        completed === null ||
        this.chatConnectionStateService.isChatEnded(client) ||
        !this.isClientOpen(client)
      ) {
        return;
      }
      this.chatConnectionStateService.setCurrentQuestion(
        client,
        completed.nextQuestion,
      );
      sendWsEvent(client, 'ai:question', completed.nextQuestion);
      this.chatInactivityService?.startWaitingForAnswer(client);
    } catch {
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
