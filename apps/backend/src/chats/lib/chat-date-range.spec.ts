import { toChatDayUtcRange, toChatMonthUtcRange } from './chat-date-range';

describe('chat-date-range', () => {
  it('서울 날짜 하루를 UTC 반개구간으로 변환한다', () => {
    expect(toChatDayUtcRange('2026-08-13')).toEqual({
      start: new Date('2026-08-12T15:00:00.000Z'),
      end: new Date('2026-08-13T15:00:00.000Z'),
    });
  });

  it('12월 조회의 종료를 다음 해 1월로 계산한다', () => {
    expect(toChatMonthUtcRange(2026, 12)).toEqual({
      start: new Date('2026-11-30T15:00:00.000Z'),
      end: new Date('2026-12-31T15:00:00.000Z'),
    });
  });
});
