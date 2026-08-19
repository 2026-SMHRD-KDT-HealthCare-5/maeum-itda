/*
역할: FastAPI /analysis/text/next-question 응답을 신뢰 가능한 이어가기 질문 결과로 변환한다.
전체 흐름: AiClient → validateContinuationQuestionResponse() → AnalysisService → ChatsService
*/
import { ContinuationQuestionResult } from '../dto/audio-analysis.contract';
import { validateOptionalTtsAudio } from './tts-response.validator';

export function validateContinuationQuestionResponse(
  value: unknown,
): ContinuationQuestionResult {
  if (typeof value !== 'object' || value === null) {
    throw new Error('FastAPI 이어가기 질문 응답이 객체 형식이 아닙니다.');
  }
  const response = value as Record<string, unknown>;
  if (
    typeof response.question !== 'string' ||
    response.question.trim().length === 0
  ) {
    throw new Error('FastAPI 이어가기 질문 응답 형식이 올바르지 않습니다.');
  }

  return {
    question: response.question,
    ttsAudio: validateOptionalTtsAudio(
      response.ttsAudioBase64,
      response.ttsMimeType,
    ),
  };
}
