/*
역할: FastAPI 재분석 결과를 저장할 때 감정 태그와 척도 문항 결과가 중복되지 않는지 검증한다.
전체 흐름: AnalysisResultRepository.saveCompleted() → TypeORM transaction → 기존 척도 결과 교체
*/
import type { DataSource, EntityManager } from 'typeorm';
import type {
  QuestionAnswerAnalysisResult,
  QuestionAnswerBatch,
} from '../dto/audio-analysis.contract';
import { SentimentLabel } from '../entities/emotion-tag.entity';
import { ScaleType } from '../entities/scale-question-analysis.entity';
import { AnalysisResultRepository } from './analysis-result.repository';

describe('AnalysisResultRepository', () => {
  const batch: QuestionAnswerBatch = {
    questionMessageId: 10,
    seniorId: 1,
    generationId: 'generation-001',
    continueConversation: false,
    answers: [
      {
        messageId: 11,
        seniorId: 1,
        questionMessageId: 10,
        generationId: 'generation-001',
        audioTransferId: 'audio-001',
        mimeType: 'audio/webm',
        capturedAt: '2026-08-14T00:00:00.000Z',
        endType: 'manual',
        audioBuffer: Buffer.from([1]),
        continueConversation: false,
      },
    ],
  };

  const createRepository = () => {
    const update = jest.fn().mockResolvedValue(undefined);
    const upsert = jest.fn().mockResolvedValue(undefined);
    const deleteResult = jest.fn().mockResolvedValue(undefined);
    const create = jest.fn((_: unknown, value: unknown): unknown => value);
    const save = jest.fn((value: unknown) => Promise.resolve(value));
    const manager = {
      update,
      upsert,
      delete: deleteResult,
      create,
      save,
    } as unknown as EntityManager;
    const dataSource = {
      transaction: jest.fn((work: (value: EntityManager) => unknown) =>
        Promise.resolve(work(manager)),
      ),
    } as unknown as DataSource;

    return {
      repository: new AnalysisResultRepository(dataSource),
      mocks: { update, upsert, deleteResult, create, save },
    };
  };

  it('기존 문항 결과를 삭제한 뒤 검증된 최신 결과만 저장한다', async () => {
    const result: QuestionAnswerAnalysisResult = {
      answers: [
        {
          messageId: 11,
          transcript: '요즘 걱정이 많아요.',
          sentimentLabel: SentimentLabel.NEGATIVE,
          scaleAnalyses: [
            {
              scaleType: ScaleType.GAD_7,
              questionNumber: 1,
              analysisScore: 1,
            },
          ],
        },
      ],
      nextQuestion: '다음 질문입니다.',
      ttsAudioBase64: null,
      ttsMimeType: null,
    };
    const { repository, mocks } = createRepository();

    await repository.saveCompleted(batch, 'generation-002', result);

    expect(mocks.upsert).toHaveBeenCalledWith(
      expect.any(Function),
      expect.objectContaining({
        messageId: 11,
        sentimentLabel: SentimentLabel.NEGATIVE,
      }),
      ['messageId'],
    );
    expect(mocks.deleteResult).toHaveBeenCalledWith(expect.any(Function), {
      messageId: 11,
    });
    expect(mocks.save).toHaveBeenCalledWith([
      {
        messageId: 11,
        scaleType: ScaleType.GAD_7,
        questionNumber: 1,
        analysisScore: 1,
      },
    ]);
  });

  it('척도 결과가 빈 배열이면 기존 결과만 삭제하고 새 행은 저장하지 않는다', async () => {
    const result: QuestionAnswerAnalysisResult = {
      answers: [
        {
          messageId: 11,
          transcript: '오늘은 괜찮아요.',
          sentimentLabel: SentimentLabel.NEUTRAL,
          scaleAnalyses: [],
        },
      ],
      nextQuestion: '다음 질문입니다.',
      ttsAudioBase64: null,
      ttsMimeType: null,
    };
    const { repository, mocks } = createRepository();

    await repository.saveCompleted(batch, 'generation-002', result);

    expect(mocks.deleteResult).toHaveBeenCalledWith(expect.any(Function), {
      messageId: 11,
    });
    expect(mocks.save).not.toHaveBeenCalled();
  });
});
