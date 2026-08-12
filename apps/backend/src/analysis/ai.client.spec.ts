import type { ConfigService } from '@nestjs/config';
import { AiClient } from './ai.client';
import type { QuestionAnswerBatch } from './dto/audio-analysis.contract';

describe('AiClient', () => {
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
        scaleAnalyses: [],
      },
    ],
    nextQuestion: '어떤 일이 가장 좋았나요?',
  };

  const createClient = () =>
    new AiClient({
      get: jest.fn().mockReturnValue('http://fastapi.test'),
    } as unknown as ConfigService);

  afterEach(() => jest.restoreAllMocks());

  it('503 일시 오류는 1회 재시도하고 성공 응답을 반환한다', async () => {
    const fetchMock = jest
      .spyOn(global, 'fetch')
      .mockResolvedValueOnce(new Response(null, { status: 503 }))
      .mockResolvedValueOnce(
        new Response(JSON.stringify(validResult), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      );

    await expect(createClient().analyzeAnswerBatch(batch)).resolves.toEqual(
      validResult,
    );
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('422 계약 오류는 재시도하지 않는다', async () => {
    const fetchMock = jest
      .spyOn(global, 'fetch')
      .mockResolvedValue(new Response(null, { status: 422 }));

    await expect(createClient().analyzeAnswerBatch(batch)).rejects.toThrow(
      'HTTP 422',
    );
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
