import type { ConfigService } from '@nestjs/config';
import { AiClient } from './ai.client';
import type { QuestionAnswerBatch } from './dto/audio-analysis.contract';

describe('AiClient', () => {
  const batch: QuestionAnswerBatch = {
    questionMessageId: 101,
    seniorId: 7,
    generationId: 'generation-001',
    continueConversation: true,
    pendingScaleItems: {
      SGDS_K: ['2'],
      GAD_7: ['1'],
      LSNS_6: ['4'],
    },
    prevSessionSummary: '어제는 산책을 하셨어요.',
    conversationTurns: [
      { speakerType: 'AI', content: '오늘 기분은 어떠세요?' },
    ],
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
  const wireResult = {
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
  // AiClient가 검증기를 거쳐 반환하는 내부 DTO 형식(messageId → tempAnswerId).
  const validResult = {
    ...wireResult,
    answers: wireResult.answers.map(({ messageId, ...rest }) => ({
      tempAnswerId: messageId,
      ...rest,
    })),
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
        new Response(JSON.stringify(wireResult), {
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

  it('질문 생성 문맥 세 필드를 multipart 요청에 포함한다', async () => {
    const fetchMock = jest.spyOn(global, 'fetch').mockResolvedValue(
      new Response(JSON.stringify(wireResult), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    await createClient().analyzeAnswerBatch(batch);

    const form = fetchMock.mock.calls[0]?.[1]?.body as FormData;
    expect(form.get('pendingScaleItems')).toBe(
      JSON.stringify(batch.pendingScaleItems),
    );
    expect(form.get('prevSessionSummary')).toBe(batch.prevSessionSummary);
    expect(form.get('conversationTurns')).toBe(
      JSON.stringify(batch.conversationTurns),
    );
  });
});
