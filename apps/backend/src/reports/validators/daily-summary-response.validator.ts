/*
역할: FastAPI 일간 요약 응답을 DB에 저장하기 전에 nullable 문자열 계약과 길이를 검증한다.
전체 흐름: DailySummaryClient -> validator -> ReportsService
*/
import type { DailySummaryResult } from '../dto/daily-summary.contract';

const MAX_CONVERSATION_SUMMARY_LENGTH = 500;
const MAX_RECOMMENDED_ACTION_LENGTH = 2_000;

function validateNullableText(
  value: unknown,
  fieldName: string,
  maxLength: number,
): string | null {
  if (value === null) return null;
  if (typeof value !== 'string') {
    throw new Error(`FastAPI ${fieldName}은 문자열 또는 null이어야 합니다.`);
  }

  const normalized = value.trim();
  if (normalized.length === 0) return null;
  if (normalized.length > maxLength) {
    throw new Error(
      `FastAPI ${fieldName}이 허용 길이 ${maxLength}자를 초과했습니다.`,
    );
  }
  return normalized;
}

export function validateDailySummaryResponse(
  value: unknown,
): DailySummaryResult {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new Error('FastAPI 일간 요약 응답은 객체여야 합니다.');
  }

  const response = value as Record<string, unknown>;
  return {
    conversationSummary: validateNullableText(
      response.conversationSummary,
      'conversationSummary',
      MAX_CONVERSATION_SUMMARY_LENGTH,
    ),
    recommendedAction: validateNullableText(
      response.recommendedAction,
      'recommendedAction',
      MAX_RECOMMENDED_ACTION_LENGTH,
    ),
  };
}
