/*
역할: 분석이 성공했을 때만 답변 메시지가 새로 INSERT되고, 감정 태그·척도 결과가 그 새
messageId에 정확히 연결되는지 검증한다(결정사항: 분석 실패 시 아무 메시지도 남기지 않는다).
전체 흐름: AnalysisResultRepository.saveCompleted() → TypeORM transaction → 새 메시지 INSERT
*/
import type { DataSource, EntityManager } from 'typeorm';
import type {
  QuestionAnswerAnalysisResult,
  QuestionAnswerBatch,
} from '../dto/audio-analysis.contract';
import { MessageRelationshipType } from '../../chats/entities/message-relationship.entity';
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
        tempAnswerId: 11,
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

  // 실제 DB는 save() 시점에 자동 증가 MESSAGE_ID를 부여한다 — id가 없는 create() 결과에만
  // 순번을 매겨 흉내 낸다(척도/감정 태그처럼 이미 messageId를 가진 배열 저장은 그대로 통과).
  function createRepository(existingAnswerCount = 0) {
    let nextMessageId = 100;
    const create = jest.fn((_: unknown, value: unknown): unknown =>
      Array.isArray(value) ? value : { ...(value as object) },
    );
    const save = jest.fn((value: unknown) => {
      if (Array.isArray(value)) return Promise.resolve(value);
      const record = value as Record<string, unknown>;
      if (record.messageId !== undefined) return Promise.resolve(record);
      return Promise.resolve({ ...record, messageId: nextMessageId++ });
    });
    const count = jest.fn().mockResolvedValue(existingAnswerCount);
    const manager = { create, save, count } as unknown as EntityManager;
    const dataSource = {
      transaction: jest.fn((work: (value: EntityManager) => unknown) =>
        Promise.resolve(work(manager)),
      ),
    } as unknown as DataSource;

    return {
      repository: new AnalysisResultRepository(dataSource),
      mocks: { create, save, count },
    };
  }

  it('분석이 성공하면 새 메시지를 INSERT하고 감정·척도 결과를 그 messageId에 연결한다', async () => {
    const result: QuestionAnswerAnalysisResult = {
      answers: [
        {
          tempAnswerId: 11,
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
    const { repository, mocks } = createRepository(0);

    const completed = await repository.saveCompleted(
      batch,
      'generation-002',
      result,
    );

    expect(mocks.save).toHaveBeenCalledWith(
      expect.objectContaining({
        content: '요즘 걱정이 많아요.',
        sttStatus: 'COMPLETED',
      }),
    );
    expect(mocks.save).toHaveBeenCalledWith(
      expect.objectContaining({
        sourceMessageId: 10,
        targetMessageId: 100,
        relationshipType: MessageRelationshipType.ANSWER,
      }),
    );
    expect(mocks.save).toHaveBeenCalledWith(
      expect.objectContaining({
        messageId: 100,
        sentimentLabel: SentimentLabel.NEGATIVE,
      }),
    );
    expect(mocks.save).toHaveBeenCalledWith([
      {
        messageId: 100,
        scaleType: ScaleType.GAD_7,
        questionNumber: 1,
        analysisScore: 1,
      },
    ]);
    expect(completed.answerTranscripts).toEqual([
      { messageId: 100, content: '요즘 걱정이 많아요.' },
    ]);
  });

  it('같은 질문에 답변이 이미 있으면 새 답변은 ADDITIONAL_ANSWER로 연결한다', async () => {
    const result: QuestionAnswerAnalysisResult = {
      answers: [
        {
          tempAnswerId: 11,
          transcript: '오늘은 괜찮아요.',
          sentimentLabel: SentimentLabel.NEUTRAL,
          scaleAnalyses: [],
        },
      ],
      nextQuestion: '다음 질문입니다.',
      ttsAudioBase64: null,
      ttsMimeType: null,
    };
    const { repository, mocks } = createRepository(1);

    await repository.saveCompleted(batch, 'generation-002', result);

    expect(mocks.save).toHaveBeenCalledWith(
      expect.objectContaining({
        relationshipType: MessageRelationshipType.ADDITIONAL_ANSWER,
      }),
    );
    expect(mocks.save.mock.calls.some((call) => Array.isArray(call[0]))).toBe(
      false,
    );
  });

  it('분석 실패 시 대응하는 답변이 없으면 저장 없이 실패한다', async () => {
    const result: QuestionAnswerAnalysisResult = {
      answers: [],
      nextQuestion: '다음 질문입니다.',
      ttsAudioBase64: null,
      ttsMimeType: null,
    };
    const { repository } = createRepository(0);

    await expect(
      repository.saveCompleted(batch, 'generation-002', result),
    ).rejects.toThrow('tempAnswerId=11');
  });
});
