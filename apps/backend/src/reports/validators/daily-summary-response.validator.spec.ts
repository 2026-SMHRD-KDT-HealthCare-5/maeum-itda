import { validateDailySummaryResponse } from './daily-summary-response.validator';

describe('validateDailySummaryResponse', () => {
  it('FastAPI 요약과 추천 행동의 앞뒤 공백을 제거한다', () => {
    expect(
      validateDailySummaryResponse({
        conversationSummary: '  편안하게 대화를 이어가셨어요.  ',
        recommendedAction: '  가볍게 안부를 확인해 주세요.  ',
      }),
    ).toEqual({
      conversationSummary: '편안하게 대화를 이어가셨어요.',
      recommendedAction: '가볍게 안부를 확인해 주세요.',
    });
  });

  it('빈 문자열은 생성되지 않은 값인 null로 정규화한다', () => {
    expect(
      validateDailySummaryResponse({
        conversationSummary: ' ',
        recommendedAction: null,
      }),
    ).toEqual({ conversationSummary: null, recommendedAction: null });
  });

  it('계약에 없는 자료형은 거부한다', () => {
    expect(() =>
      validateDailySummaryResponse({
        conversationSummary: 123,
        recommendedAction: null,
      }),
    ).toThrow('conversationSummary');
  });

  it('추천 행동의 자료형과 최대 길이도 검증한다', () => {
    expect(() =>
      validateDailySummaryResponse({
        conversationSummary: null,
        recommendedAction: { text: '잘못된 형식' },
      }),
    ).toThrow('recommendedAction');

    expect(() =>
      validateDailySummaryResponse({
        conversationSummary: null,
        recommendedAction: '가'.repeat(2_001),
      }),
    ).toThrow('2000자');
  });
});
