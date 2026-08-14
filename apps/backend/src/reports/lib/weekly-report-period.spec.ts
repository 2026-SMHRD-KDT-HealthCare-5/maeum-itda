/* 역할: 주간 조회 범위가 월요일부터 일요일까지 정확히 생성되는지 검증한다. */
import { toWeeklyReportPeriod } from './weekly-report-period';

describe('toWeeklyReportPeriod', () => {
  it('월요일 시작일로 월~일 7개 날짜를 만든다', () => {
    expect(toWeeklyReportPeriod('2026-08-03')).toEqual({
      weekStart: '2026-08-03',
      weekEnd: '2026-08-09',
      dates: [
        '2026-08-03',
        '2026-08-04',
        '2026-08-05',
        '2026-08-06',
        '2026-08-07',
        '2026-08-08',
        '2026-08-09',
      ],
    });
  });

  it.each(['2026-08-04', '2026-02-30'])('%s를 주 시작일로 거부한다', (date) => {
    expect(() => toWeeklyReportPeriod(date)).toThrow();
  });
});
