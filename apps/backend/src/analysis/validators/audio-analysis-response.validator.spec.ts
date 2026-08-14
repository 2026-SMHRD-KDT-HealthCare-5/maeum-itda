/* 역할: FastAPI 응답의 척도 문항 범위·점수·중복·messageId 계약을 순수 함수 단위로 검증한다. */
import type { QuestionAnswerBatch } from '../dto/audio-analysis.contract';
import { validateQuestionAnswerAnalysisResponse } from './audio-analysis-response.validator';

describe('validateQuestionAnswerAnalysisResponse', () => {
  const batch: QuestionAnswerBatch = {
    questionMessageId: 101,
    seniorId: 7,
    generationId: 'generation-001',
    continueConversation: true,
    answers: [
      {
        messageId: 102,
        seniorId: 7,
        questionMessageId: 101,
        generationId: 'generation-001',
        audioTransferId: 'audio-001',
        mimeType: 'audio/webm',
        capturedAt: '2026-08-12T00:00:00.000Z',
        endType: 'auto',
        audioBuffer: Buffer.from([1]),
        continueConversation: true,
      },
    ],
  };
  const validResult = {
    answers: [
      {
        messageId: 102,
        transcript: '오늘은 기분이 좋아요.',
        sentimentLabel: 'POSITIVE',
        scaleAnalyses: [] as unknown[],
      },
    ],
    nextQuestion: '어떤 일이 가장 좋았나요?',
  };

  it.each([
    ['SGDS_K', 1],
    ['SGDS_K', 15],
    ['GAD_7', 1],
    ['GAD_7', 7],
    ['LSNS_6', 1],
    ['LSNS_6', 6],
  ])('%s %i번 문항과 0/1 점수를 허용한다', (scaleType, questionNumber) => {
    const result = {
      ...validResult,
      answers: [
        {
          ...validResult.answers[0],
          scaleAnalyses: [{ scaleType, questionNumber, analysisScore: 1 }],
        },
      ],
    };

    expect(validateQuestionAnswerAnalysisResponse(result, batch)).toEqual(
      result,
    );
  });

  it.each([
    ['SGDS_K', 16],
    ['GAD_7', 8],
    ['LSNS_6', 7],
  ])('%s 문항 범위를 벗어난 응답을 거부한다', (scaleType, questionNumber) => {
    const result = {
      ...validResult,
      answers: [
        {
          ...validResult.answers[0],
          scaleAnalyses: [{ scaleType, questionNumber, analysisScore: 1 }],
        },
      ],
    };

    expect(() => validateQuestionAnswerAnalysisResponse(result, batch)).toThrow(
      '문항 번호',
    );
  });

  it('0과 1 이외의 문항 점수를 거부한다', () => {
    const result = {
      ...validResult,
      answers: [
        {
          ...validResult.answers[0],
          scaleAnalyses: [
            { scaleType: 'GAD_7', questionNumber: 1, analysisScore: 2 },
          ],
        },
      ],
    };

    expect(() => validateQuestionAnswerAnalysisResponse(result, batch)).toThrow(
      '척도 분석 결과 형식',
    );
  });

  it('한 답변에 동일한 척도·문항 결과가 중복되면 거부한다', () => {
    const duplicatedScale = {
      scaleType: 'GAD_7',
      questionNumber: 1,
      analysisScore: 1,
    };
    const result = {
      ...validResult,
      answers: [
        {
          ...validResult.answers[0],
          scaleAnalyses: [duplicatedScale, duplicatedScale],
        },
      ],
    };

    expect(() => validateQuestionAnswerAnalysisResponse(result, batch)).toThrow(
      '중복된 척도 문항',
    );
  });

  it('요청하지 않은 messageId 응답을 거부한다', () => {
    const result = {
      ...validResult,
      answers: [{ ...validResult.answers[0], messageId: 999 }],
    };

    expect(() => validateQuestionAnswerAnalysisResponse(result, batch)).toThrow(
      '메시지 ID가 요청과 일치하지 않습니다',
    );
  });
});
