import { SpeakerType } from '../chats/entities/conversation-message.entity';
import { DailySummaryClient } from './daily-summary.client';

describe('DailySummaryClient', () => {
  const request = {
    seniorId: 9,
    reportDate: '2026-08-18',
    turns: [
      {
        speakerType: SpeakerType.SENIOR,
        content: '오늘은 기분이 괜찮아요.',
        sentimentLabel: null,
      },
    ],
  };

  afterEach(() => jest.restoreAllMocks());

  it('AI_BASE_URL의 끝 슬래시를 제거하고 일간 요약 API를 호출한다', async () => {
    const fetchMock = jest.spyOn(global, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({
          conversationSummary: '편안하게 대화를 이어가셨어요.',
          recommendedAction: '가볍게 안부를 확인해 주세요.',
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ),
    );
    const client = new DailySummaryClient({
      get: jest.fn().mockReturnValue('http://localhost:8000/'),
    } as never);

    await expect(client.generate(request)).resolves.toEqual({
      conversationSummary: '편안하게 대화를 이어가셨어요.',
      recommendedAction: '가볍게 안부를 확인해 주세요.',
    });
    expect(fetchMock).toHaveBeenCalledWith(
      'http://localhost:8000/reports/daily-summary',
      expect.objectContaining({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(request),
      }),
    );
  });

  it('AI_BASE_URL이 없으면 외부 요청 전에 실패한다', async () => {
    const fetchMock = jest.spyOn(global, 'fetch');
    const client = new DailySummaryClient({
      get: jest.fn().mockReturnValue(undefined),
    } as never);

    await expect(client.generate(request)).rejects.toThrow('AI_BASE_URL');
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
