/* 역할: 즉시 재계산 트리거가 오늘(서울) 날짜로 generateDailyReport를 부르고 실패를 삼키는지 검증한다. */
import { EmotionIndexRecalcTriggerService } from './emotion-index-recalc-trigger.service';
import type { ReportsService } from './reports.service';

describe('EmotionIndexRecalcTriggerService', () => {
  function createService(reportsService: Partial<ReportsService>) {
    return new EmotionIndexRecalcTriggerService(
      reportsService as ReportsService,
    );
  }

  it('서울 오늘 날짜로 generateDailyReport를 호출한다', () => {
    const generateDailyReport = jest.fn().mockResolvedValue(undefined);
    const service = createService({ generateDailyReport });

    service.recalcToday(7, new Date('2026-08-16T10:00:00.000Z'));

    expect(generateDailyReport).toHaveBeenCalledWith(7, '2026-08-16');
  });

  it('generateDailyReport가 실패해도 예외를 던지지 않는다', async () => {
    const generateDailyReport = jest
      .fn()
      .mockRejectedValue(new Error('db down'));
    const service = createService({ generateDailyReport });

    expect(() =>
      service.recalcToday(7, new Date('2026-08-16T10:00:00.000Z')),
    ).not.toThrow();
    await new Promise((resolve) => setImmediate(resolve));
    expect(generateDailyReport).toHaveBeenCalledTimes(1);
  });
});
