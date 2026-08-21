/*
역할: 일간 대화 문맥을 FastAPI 요약 API로 전달하고 검증된 요약·추천 행동만 반환한다.
전체 흐름: ReportsService -> DailySummaryClient -> POST /reports/daily-summary -> validator
*/
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AI_BASE_URL_ENV } from '../config/ai.config';
import type {
  DailySummaryRequest,
  DailySummaryResult,
} from './dto/daily-summary.contract';
import { validateDailySummaryResponse } from './validators/daily-summary-response.validator';

const DAILY_SUMMARY_TIMEOUT_MS = 30_000;
const RETRY_DELAY_MS = 500;
const RETRYABLE_HTTP_STATUSES = new Set([502, 503, 504]);

class FastApiHttpError extends Error {
  constructor(readonly status: number) {
    super(`FastAPI 일간 요약 요청 실패: HTTP ${status}`);
  }
}

@Injectable()
export class DailySummaryClient {
  private readonly baseUrl: string | undefined;

  constructor(configService: ConfigService) {
    this.baseUrl = configService
      .get<string>(AI_BASE_URL_ENV)
      ?.replace(/\/+$/, '');
  }

  async generate(request: DailySummaryRequest): Promise<DailySummaryResult> {
    if (!this.baseUrl) {
      throw new Error('FastAPI 서버 주소 AI_BASE_URL이 설정되지 않았습니다.');
    }

    for (let attempt = 0; attempt < 2; attempt += 1) {
      try {
        const response = await fetch(`${this.baseUrl}/reports/daily-summary`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(request),
          signal: AbortSignal.timeout(DAILY_SUMMARY_TIMEOUT_MS),
        });
        if (!response.ok) throw new FastApiHttpError(response.status);
        return validateDailySummaryResponse(await response.json());
      } catch (error: unknown) {
        if (attempt === 0 && this.isRetryable(error)) {
          await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS));
          continue;
        }
        throw error;
      }
    }
    throw new Error('FastAPI 일간 요약 요청에 실패했습니다.');
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
