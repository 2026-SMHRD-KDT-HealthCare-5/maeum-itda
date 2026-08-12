/*
역할: 질문별 복수 음성을 multipart/form-data REST 요청으로 FastAPI에 전달하고 응답 계약을 검증한다.
전체 흐름: AnalysisService → AiClient → POST FastAPI /analysis/audio/batch → 검증된 결과 반환
주의: FastAPI 내부 STT·감성·척도·질문 생성 로직은 구현하지 않으며 요청·응답 경계만 담당한다.
*/
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  AnswerAnalysisResult,
  QuestionAnswerAnalysisResult,
  QuestionAnswerBatch,
} from './dto/audio-analysis.contract';
import { SentimentLabel } from './entities/emotion-tag.entity';
import { ScaleType } from './entities/scale-question-analysis.entity';

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

  isConnected(): boolean {
    return this.baseUrl !== undefined && this.baseUrl.length > 0;
  }

  // 역할: answers 순서를 유지하며 반복 audioFiles/messageIds 필드로 한 질문의 모든 음성을 보낸다.
  async analyzeAnswerBatch(
    batch: QuestionAnswerBatch,
  ): Promise<QuestionAnswerAnalysisResult> {
    if (!this.isConnected()) {
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
        return this.validateResponse(await response.json(), batch);
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

  // 재시도마다 새로운 FormData를 생성해 동일한 음성 묶음을 안전하게 다시 전송한다.
  private createFormData(batch: QuestionAnswerBatch): FormData {
    const form = new FormData();
    form.append('questionMessageId', String(batch.questionMessageId));
    form.append('generationId', batch.generationId);
    for (const answer of batch.answers) {
      form.append(
        'audioFiles',
        new Blob([new Uint8Array(answer.audioBuffer)], {
          type: answer.mimeType,
        }),
        `${answer.audioTransferId}.audio`,
      );
      form.append('messageIds', String(answer.messageId));
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

  // 역할: 응답 답변 ID가 요청 ID와 정확히 일치하는지와 각 분석 결과 형식을 검사한다.
  private validateResponse(
    value: unknown,
    batch: QuestionAnswerBatch,
  ): QuestionAnswerAnalysisResult {
    if (typeof value !== 'object' || value === null) {
      throw new Error('FastAPI 응답이 객체 형식이 아닙니다.');
    }
    const response = value as Record<string, unknown>;
    if (
      !Array.isArray(response.answers) ||
      !(
        response.nextQuestion === null ||
        typeof response.nextQuestion === 'string'
      )
    ) {
      throw new Error('FastAPI 질문별 분석 응답 형식이 올바르지 않습니다.');
    }

    const answers = response.answers.map((item) =>
      this.validateAnswerResult(item),
    );
    const requestedIds = batch.answers.map(({ messageId }) => messageId).sort();
    const responseIds = answers.map(({ messageId }) => messageId).sort();
    if (
      requestedIds.length !== responseIds.length ||
      requestedIds.some((id, index) => id !== responseIds[index])
    ) {
      throw new Error('FastAPI 응답의 메시지 ID가 요청과 일치하지 않습니다.');
    }

    return {
      answers,
      nextQuestion: response.nextQuestion,
    };
  }

  private validateAnswerResult(value: unknown): AnswerAnalysisResult {
    if (typeof value !== 'object' || value === null) {
      throw new Error('답변 분석 결과가 객체 형식이 아닙니다.');
    }
    const answer = value as Record<string, unknown>;
    if (
      !Number.isInteger(answer.messageId) ||
      typeof answer.transcript !== 'string' ||
      answer.transcript.trim().length === 0 ||
      !Object.values(SentimentLabel).includes(
        answer.sentimentLabel as SentimentLabel,
      ) ||
      !Array.isArray(answer.scaleAnalyses)
    ) {
      throw new Error('답변 분석 결과 형식이 올바르지 않습니다.');
    }
    const scaleAnalyses = answer.scaleAnalyses.map((item) => {
      if (typeof item !== 'object' || item === null) {
        throw new Error('척도 분석 결과가 객체 형식이 아닙니다.');
      }
      const scale = item as Record<string, unknown>;
      if (
        !Object.values(ScaleType).includes(scale.scaleType as ScaleType) ||
        !Number.isInteger(scale.questionNumber) ||
        (scale.analysisScore !== 0 && scale.analysisScore !== 1)
      ) {
        throw new Error('척도 분석 결과 형식이 올바르지 않습니다.');
      }
      const analysisScore: 0 | 1 = scale.analysisScore === 0 ? 0 : 1;
      return {
        scaleType: scale.scaleType as ScaleType,
        questionNumber: Number(scale.questionNumber),
        analysisScore,
      };
    });
    return {
      messageId: Number(answer.messageId),
      transcript: answer.transcript,
      sentimentLabel: answer.sentimentLabel as SentimentLabel,
      scaleAnalyses,
    };
  }
}
