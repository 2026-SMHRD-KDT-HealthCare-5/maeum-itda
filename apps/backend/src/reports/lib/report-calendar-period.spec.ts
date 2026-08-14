import {
  addCalendarDays,
  toCalendarDateString,
  toReportCalendarPeriod,
} from './report-calendar-period';

describe('report-calendar-period', () => {
  it('요청 월을 다음 달 시작 전까지의 반개구간으로 변환한다', () => {
    expect(toReportCalendarPeriod(2026, 8)).toEqual({
      monthStart: '2026-08-01',
      nextMonthStart: '2026-09-01',
    });
  });

  it('12월의 다음 달을 다음 해 1월로 계산한다', () => {
    expect(toReportCalendarPeriod(2026, 12)).toEqual({
      monthStart: '2026-12-01',
      nextMonthStart: '2027-01-01',
    });
  });

  it('주 시작일로부터 일요일 종료일을 계산한다', () => {
    expect(addCalendarDays('2026-08-31', 6)).toBe('2026-09-06');
  });

  it('DB DATE가 Date 객체여도 YYYY-MM-DD로 정규화한다', () => {
    expect(toCalendarDateString(new Date(2026, 7, 3))).toBe('2026-08-03');
  });
});
