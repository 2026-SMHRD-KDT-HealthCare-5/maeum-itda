/* 역할: 서울 업무일이 DB UTC 반개구간으로 정확히 변환되는지 검증한다. */
import { toSeoulBusinessDayUtcRange } from './seoul-business-date';

describe('toSeoulBusinessDayUtcRange', () => {
  it('서울 날짜의 자정을 UTC 시작·종료 시각으로 변환한다', () => {
    const range = toSeoulBusinessDayUtcRange('2026-08-14');

    expect(range.start.toISOString()).toBe('2026-08-13T15:00:00.000Z');
    expect(range.end.toISOString()).toBe('2026-08-14T15:00:00.000Z');
  });

  it.each(['2026-02-30', '2026/08/14', 'invalid'])(
    '잘못된 날짜 %s를 거부한다',
    (value) => {
      expect(() => toSeoulBusinessDayUtcRange(value)).toThrow();
    },
  );
});
