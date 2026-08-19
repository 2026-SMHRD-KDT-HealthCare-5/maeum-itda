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
    const result = await service.processPendingAnswerBatch(9);

    expect(temporaryAudioRepository.save).toHaveBeenCalledWith(batch);
    expect(aiClient.analyzeAnswerBatch).not.toHaveBeenCalled();
    expect(result).toBeNull();
  });
});
