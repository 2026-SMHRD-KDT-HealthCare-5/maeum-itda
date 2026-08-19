/*
역할: 질문별 복수 음성을 multipart/form-data REST 요청으로 FastAPI에 전달하고 응답 계약을 검증한다.
전체 흐름: AnalysisService → AiClient → POST FastAPI /analysis/audio/batch → 검증된 결과 반환
[완료] FastAPI 내부 STT·감성·척도·질문 생성 로직은 구현하지 않으며 요청·응답 경계만 담당한다.
[연동 대기] 실제 서버 가용성은 URL 설정 여부가 아니라 분석 요청 성공·실패로 확인한다.
*/
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  ContinuationQuestionResult,
  QuestionAnswerAnalysisResult,
  QuestionAnswerBatch,
} from './dto/audio-analysis.contract';
import { AnalysisRequestContext } from './repositories/analysis-context.repository';
import { validateQuestionAnswerAnalysisResponse } from './validators/audio-analysis-response.validator';
import { validateContinuationQuestionResponse } from './validators/continuation-question-response.validator';

const FAST_API_RETRY_DELAY_MS = 500;
const RETRYABLE_HTTP_STATUSES = new Set([502, 503, 504]);

class FastApiHttpError extends Error {
  constructor(readonly status: number) {
    super(`FastAPI 음성 분석 요청 실패: HTTP ${status}`);
  }
}

@Injectable()
export class AiClient {
  private readonly baseUrl: string | undefined;

  constructor(configService: ConfigService) {
    this.baseUrl = configService.get<string>('AI_BASE_URL');
  }

  // [완료] 실제 네트워크 상태가 아니라 FastAPI 주소 설정 여부만 반환한다.
  isConfigured(): boolean {
    return this.baseUrl !== undefined && this.baseUrl.length > 0;
  }

  // 역할: answers 순서를 유지하며 반복 audioFiles/messageIds 필드로 한 질문의 모든 음성을 보낸다.
  async analyzeAnswerBatch(
    batch: QuestionAnswerBatch,
  ): Promise<QuestionAnswerAnalysisResult> {
    if (!this.isConfigured()) {
      throw new Error('FastAPI 음성 분석 서버 주소가 설정되지 않았습니다.');
    }

    for (let attempt = 0; attempt < 2; attempt += 1) {
      try {
        const response = await fetch(`${this.baseUrl}/analysis/audio/batch`, {
          method: 'POST',
          body: this.createFormData(batch),
          signal: AbortSignal.timeout(30_000),
        });
        if (!response.ok) throw new FastApiHttpError(response.status);
        return validateQuestionAnswerAnalysisResponse(
          await response.json(),
          batch,
        );
      } catch (error: unknown) {
        if (attempt === 0 && this.isRetryable(error)) {
          await new Promise((resolve) =>
            setTimeout(resolve, FAST_API_RETRY_DELAY_MS),
          );
          continue;
        }
        throw error;
      }
    }
    throw new Error('FastAPI 음성 분석 요청에 실패했습니다.');
  }

  // 역할: 새 음성 답변 없이(재진입 시 오늘 마지막 메시지가 시니어 답변으로 끝난
  // 경우) 기존 문맥만으로 이어갈 다음 질문을 요청한다.
  async generateContinuationQuestion(
    context: AnalysisRequestContext,
  ): Promise<ContinuationQuestionResult> {
    if (!this.isConfigured()) {
      throw new Error('FastAPI 음성 분석 서버 주소가 설정되지 않았습니다.');
    }

    for (let attempt = 0; attempt < 2; attempt += 1) {
      try {
        const response = await fetch(
          `${this.baseUrl}/analysis/text/next-question`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              pendingScaleItems: context.pendingScaleItems,
              prevSessionSummary: context.prevSessionSummary,
              conversationTurns: context.conversationTurns,
            }),
            signal: AbortSignal.timeout(30_000),
          },
        );
        if (!response.ok) throw new FastApiHttpError(response.status);
        return validateContinuationQuestionResponse(await response.json());
      } catch (error: unknown) {
        if (attempt === 0 && this.isRetryable(error)) {
          await new Promise((resolve) =>
            setTimeout(resolve, FAST_API_RETRY_DELAY_MS),
          );
          continue;
        }
        throw error;
      }
    }
    throw new Error('FastAPI 이어가기 질문 생성 요청에 실패했습니다.');
  }

  // 재시도마다 새로운 FormData를 생성해 동일한 음성 묶음을 안전하게 다시 전송한다.
  private createFormData(batch: QuestionAnswerBatch): FormData {
    const form = new FormData();
    form.append('questionMessageId', String(batch.questionMessageId));
    form.append('generationId', batch.generationId);
    form.append(
      'pendingScaleItems',
      JSON.stringify(batch.pendingScaleItems ?? {}),
    );
    form.append('prevSessionSummary', batch.prevSessionSummary ?? '');
    form.append(
      'conversationTurns',
      JSON.stringify(batch.conversationTurns ?? []),
    );
    for (const answer of batch.answers) {
      form.append(
        'audioFiles',
        new Blob([new Uint8Array(answer.audioBuffer)], {
          type: answer.mimeType,
        }),
        `${answer.audioTransferId}.audio`,
      );
      form.append('messageIds', String(answer.tempAnswerId));
      form.append('audioTransferIds', answer.audioTransferId);
      form.append('capturedAts', answer.capturedAt);
      form.append('endTypes', answer.endType);
    }

    return form;
  }

  // 네트워크·타임아웃·일시적 게이트웨이 오류만 1회 재시도하고 계약 오류와 4xx는 즉시 실패시킨다.
  private isRetryable(error: unknown): boolean {
    return (
      (error instanceof FastApiHttpError &&
        RETRYABLE_HTTP_STATUSES.has(error.status)) ||
      error instanceof TypeError ||
      (error instanceof Error && error.name === 'TimeoutError')
    );
  }
}
