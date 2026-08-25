import {
  calculateDaysTogether,
  toGuardianDashboardPeriod,
} from './guardian-dashboard-period';

describe('guardian dashboard period', () => {
  it('서울 기준 오늘까지 최근 7일을 만든다', () => {
    expect(
      toGuardianDashboardPeriod(new Date('2026-08-14T03:00:00.000Z')),
    ).toEqual({
      reportDate: '2026-08-14',
      startDate: '2026-08-08',
      dates: [
        '2026-08-08',
        '2026-08-09',
        '2026-08-10',
        '2026-08-11',
        '2026-08-12',
        '2026-08-13',
        '2026-08-14',
      ],
    });
  });

  it('연결 승인일을 1일째로 계산한다', () => {
    expect(
      calculateDaysTogether(
        new Date('2026-08-12T01:00:00.000Z'),
        new Date('2026-08-14T03:00:00.000Z'),
      ),
    ).toBe(3);
  });
});
