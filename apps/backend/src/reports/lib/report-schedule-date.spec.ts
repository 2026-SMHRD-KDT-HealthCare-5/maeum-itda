/* 역할: 서울 오전 9시 실행 기준 전날과 월요일의 지난주 시작일 계산을 검증한다. */
import {
  toReportScheduleContext,
  toSeoulTodayDate,
} from './report-schedule-date';

describe('toReportScheduleContext', () => {
  it('평일에는 전날 일간 날짜만 반환한다', () => {
    expect(
      toReportScheduleContext(new Date('2026-08-14T00:00:00.000Z')),
    ).toEqual({
      reportDate: '2026-08-13',
      previousWeekStart: null,
    });
  });

  it('월요일에는 일요일과 지난주 월요일을 반환한다', () => {
    expect(
      toReportScheduleContext(new Date('2026-08-17T00:00:00.000Z')),
    ).toEqual({
      reportDate: '2026-08-16',
      previousWeekStart: '2026-08-10',
    });
  });
});

describe('toSeoulTodayDate', () => {
  it('서울 자정 직후(UTC 전날 15:00)는 이미 다음 날짜다', () => {
    expect(toSeoulTodayDate(new Date('2026-08-13T15:00:00.000Z'))).toBe(
      '2026-08-14',
    );
  });

  it('서울 자정 직전(UTC 14:59)은 아직 그날 날짜다', () => {
    expect(toSeoulTodayDate(new Date('2026-08-13T14:59:00.000Z'))).toBe(
      '2026-08-13',
    );
  });
});
