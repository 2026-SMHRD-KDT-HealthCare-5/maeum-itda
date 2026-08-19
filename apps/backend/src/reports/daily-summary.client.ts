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

    const response = await fetch(`${this.baseUrl}/reports/daily-summary`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(request),
      signal: AbortSignal.timeout(DAILY_SUMMARY_TIMEOUT_MS),
    });
    if (!response.ok) {
      throw new Error(`FastAPI 일간 요약 요청 실패: HTTP ${response.status}`);
    }

    return validateDailySummaryResponse(await response.json());
  }
}
