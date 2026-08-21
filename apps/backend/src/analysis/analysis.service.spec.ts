/* 역할: FastAPI 주소 미설정 시 질문별 음성 묶음을 메모리에 보관하고 분석 호출은 보류하는지 검증한다. */
import type { AiClient } from './ai.client';
import { AnalysisService } from './analysis.service';
import type { QuestionAnswerBatch } from './dto/audio-analysis.contract';
import type { AnalysisResultRepository } from './repositories/analysis-result.repository';
import type { TemporaryAudioRepository } from './repositories/temporary-audio.repository';
import type { AnalysisContextRepository } from './repositories/analysis-context.repository';

describe('AnalysisService', () => {
  it('FastAPI 주소 미설정 상태에서 묶음을 저장하고 분석 호출은 보류한다', async () => {
    const aiClient = {
      isConfigured: jest.fn().mockReturnValue(false),
      analyzeAnswerBatch: jest.fn(),
    };
    const temporaryAudioRepository = {
      save: jest.fn(),
      findByQuestionMessageId: jest.fn(),
      delete: jest.fn(),
    };
    const analysisResultRepository = {
      saveCompleted: jest.fn(),
      findStatus: jest.fn(),
    };
    const analysisContextRepository = { findForBatch: jest.fn() };
    const service = new AnalysisService(
      aiClient as unknown as AiClient,
      temporaryAudioRepository as unknown as TemporaryAudioRepository,
      analysisResultRepository as unknown as AnalysisResultRepository,
      analysisContextRepository as unknown as AnalysisContextRepository,
    );
    const batch: QuestionAnswerBatch = {
      questionMessageId: 9,
      seniorId: 7,
      generationId: 'generation-1',
      continueConversation: true,
      answers: [
        {
          tempAnswerId: 10,
          seniorId: 7,
          questionMessageId: 9,
          generationId: 'generation-1',
          audioTransferId: 'audio-1',
          mimeType: 'audio/webm',
          capturedAt: '2026-08-11T00:00:00.000Z',
          endType: 'manual',
          audioBuffer: Buffer.from([1]),
          continueConversation: true,
        },
      ],
    };

    service.enqueueAnswerBatch(batch);
    const result = await service.processPendingAnswerBatch(9, () => true);

    expect(temporaryAudioRepository.save).toHaveBeenCalledWith(batch);
    expect(aiClient.analyzeAnswerBatch).not.toHaveBeenCalled();
    expect(result).toBeNull();
  });

  it('FastAPI 왕복 사이에 대화가 종료돼 isStillCurrent가 false를 반환하면 다음 질문을 저장하지 않는다', async () => {
    const aiClient = {
      isConfigured: jest.fn().mockReturnValue(true),
      analyzeAnswerBatch: jest.fn().mockResolvedValue({
        answers: [
          {
            tempAnswerId: 10,
            transcript: '오늘 산책했어요.',
            sentimentLabel: 'POSITIVE',
            scaleAnalyses: [],
          },
        ],
        nextQuestion: '산책하면서 무엇이 좋으셨어요?',
      }),
    };
    const batch: QuestionAnswerBatch = {
      questionMessageId: 9,
      seniorId: 7,
      generationId: 'generation-1',
      continueConversation: true,
      answers: [
        {
          tempAnswerId: 10,
          seniorId: 7,
          questionMessageId: 9,
          generationId: 'generation-1',
          audioTransferId: 'audio-1',
          mimeType: 'audio/webm',
          capturedAt: '2026-08-11T00:00:00.000Z',
          endType: 'manual',
          audioBuffer: Buffer.from([1]),
          continueConversation: true,
        },
      ],
    };
    const temporaryAudioRepository = {
      save: jest.fn(),
      findByQuestionMessageId: jest.fn().mockReturnValue(batch),
      delete: jest.fn(),
    };
    const analysisResultRepository = {
      saveCompleted: jest.fn().mockResolvedValue({
        answerTranscripts: [{ messageId: 102, content: '오늘 산책했어요.' }],
        nextQuestion: null,
      }),
      findStatus: jest.fn(),
    };
    const analysisContextRepository = {
      findForBatch: jest.fn().mockResolvedValue({}),
    };
    const service = new AnalysisService(
      aiClient as unknown as AiClient,
      temporaryAudioRepository as unknown as TemporaryAudioRepository,
      analysisResultRepository as unknown as AnalysisResultRepository,
      analysisContextRepository as unknown as AnalysisContextRepository,
    );

    // FastAPI 왕복(수 초)이 끝난 시점엔 대화가 이미 끝났다고 가정한다 — 답변된
    // 시각 이후 chat:end가 먼저 도착한 상황을 흉내낸다.
    await service.processPendingAnswerBatch(9, () => false);

    expect(analysisResultRepository.saveCompleted).toHaveBeenCalledWith(
      expect.objectContaining({ continueConversation: false }),
      expect.any(String),
      expect.anything(),
    );
  });
});
