/*
역할: FastAPI의 unknown JSON을 신뢰 가능한 음성·감정·척도 분석 DTO로 변환한다.
전체 흐름: AiClient → validateQuestionAnswerAnalysisResponse() → AnalysisService → AnalysisResultRepository
주의: AI 판단을 다시 수행하지 않고 허용된 척도·문항·점수와 요청 messageId 일치만 검증한다.
*/
import {
  AnswerAnalysisResult,
  QuestionAnswerAnalysisResult,
  QuestionAnswerBatch,
} from '../dto/audio-analysis.contract';
import { SentimentLabel } from '../entities/emotion-tag.entity';
import { ScaleType } from '../entities/scale-question-analysis.entity';

const SCALE_QUESTION_NUMBER_RANGES: Record<
  ScaleType,
  { min: number; max: number }
> = {
  [ScaleType.SGDS_K]: { min: 1, max: 15 },
  [ScaleType.GAD_7]: { min: 1, max: 7 },
  [ScaleType.LSNS_6]: { min: 1, max: 6 },
};

export function validateQuestionAnswerAnalysisResponse(
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

  const answers = response.answers.map(validateAnswerResult);
  const requestedIds = batch.answers.map(({ messageId }) => messageId).sort();
  const responseIds = answers.map(({ messageId }) => messageId).sort();
  if (
    requestedIds.length !== responseIds.length ||
    requestedIds.some((id, index) => id !== responseIds[index])
  ) {
    throw new Error('FastAPI 응답의 메시지 ID가 요청과 일치하지 않습니다.');
  }

  return { answers, nextQuestion: response.nextQuestion };
}

function validateAnswerResult(value: unknown): AnswerAnalysisResult {
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

  const scaleAnalysisKeys = new Set<string>();
  const scaleAnalyses = answer.scaleAnalyses.map((item) => {
    if (typeof item !== 'object' || item === null) {
      throw new Error('척도 분석 결과가 객체 형식이 아닙니다.');
    }
    const scale = item as Record<string, unknown>;
    if (
      !Object.values(ScaleType).includes(scale.scaleType as ScaleType) ||
      (scale.analysisScore !== 0 && scale.analysisScore !== 1)
    ) {
      throw new Error('척도 분석 결과 형식이 올바르지 않습니다.');
    }

    const scaleType = scale.scaleType as ScaleType;
    const questionNumber = Number(scale.questionNumber);
    const range = SCALE_QUESTION_NUMBER_RANGES[scaleType];
    if (
      !Number.isInteger(scale.questionNumber) ||
      questionNumber < range.min ||
      questionNumber > range.max
    ) {
      throw new Error(
        `FastAPI 응답의 ${scaleType} 문항 번호가 ${range.min}~${range.max} 범위를 벗어났습니다.`,
      );
    }

    // 한 답변의 동일 척도·문항은 DB unique 키와 일치하도록 한 건만 허용한다.
    const scaleAnalysisKey = `${scaleType}:${questionNumber}`;
    if (scaleAnalysisKeys.has(scaleAnalysisKey)) {
      throw new Error(
        `FastAPI 응답에 중복된 척도 문항이 있습니다: ${scaleAnalysisKey}`,
      );
    }
    scaleAnalysisKeys.add(scaleAnalysisKey);

    return {
      scaleType,
      questionNumber,
      analysisScore: scale.analysisScore,
    };
  });

  return {
    messageId: Number(answer.messageId),
    transcript: answer.transcript,
    sentimentLabel: answer.sentimentLabel as SentimentLabel,
    scaleAnalyses,
  };
}
