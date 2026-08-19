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
        tempAnswerId: 102,
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
  // FastAPI가 실제로 보내는 wire 형식(messageId 필드명은 apps/ai-server 계약 그대로 유지).
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
    ttsAudioBase64: Buffer.from('mock-mp3').toString('base64'),
    ttsMimeType: 'audio/mpeg',
  };
  // 검증기가 반환하는 내부 DTO 형식(messageId → tempAnswerId, 아직 실제 DB ID가 아님).
  function toExpected(result: {
    answers: Array<{ messageId: number; [key: string]: unknown }>;
    nextQuestion: string;
    ttsAudioBase64: string | null;
    ttsMimeType: string | null;
  }) {
    return {
      ...result,
      answers: result.answers.map(({ messageId, ...rest }) => ({
        tempAnswerId: messageId,
        ...rest,
      })),
    };
  }

  it('TTS가 실패한 응답은 Base64와 MIME이 모두 null일 때만 허용한다', () => {
    expect(
      validateQuestionAnswerAnalysisResponse(
        { ...validResult, ttsAudioBase64: null, ttsMimeType: null },
        batch,
      ),
    ).toEqual(
      toExpected({ ...validResult, ttsAudioBase64: null, ttsMimeType: null }),
    );

    expect(() =>
      validateQuestionAnswerAnalysisResponse(
        { ...validResult, ttsAudioBase64: null },
        batch,
      ),
    ).toThrow('함께 제공');
  });

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
      toExpected(result),
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
