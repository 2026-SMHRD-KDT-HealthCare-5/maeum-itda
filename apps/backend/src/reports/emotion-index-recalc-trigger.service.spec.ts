/*
역할: 즉시 재계산 트리거가 오늘(서울) 날짜로 generateDailyReport를 부르고, 완료된 재계산이
임계치 이하면 보호자에게 실시간 알림을 보내며, 각 단계의 실패를 삼키는지 검증한다.
*/
import { GenerationStatus } from './entities/daily-emotion-report.entity';
import { EmotionIndexRecalcTriggerService } from './emotion-index-recalc-trigger.service';
import type { NotificationsService } from '../notifications/notifications.service';
import type { ReportGenerationTargetRepository } from './repositories/report-generation-target.repository';
import type { ReportsService } from './reports.service';

describe('EmotionIndexRecalcTriggerService', () => {
  function createService(overrides: {
    reportsService?: Partial<ReportsService>;
    targetRepository?: Partial<ReportGenerationTargetRepository>;
    notificationsService?: Partial<NotificationsService>;
  }) {
    return new EmotionIndexRecalcTriggerService(
      (overrides.reportsService ?? {}) as ReportsService,
      (overrides.targetRepository ?? {}) as ReportGenerationTargetRepository,
      (overrides.notificationsService ?? {}) as NotificationsService,
    );
  }

  const waitingReport = {
    reportId: 1,
    generationStatus: GenerationStatus.WAITING,
    emotionIndex: null,
  };

  async function flush() {
    await new Promise((resolve) => setImmediate(resolve));
  }

  it('서울 오늘 날짜로 generateDailyReport를 호출한다', () => {
    const generateDailyReport = jest.fn().mockResolvedValue(waitingReport);
    const service = createService({ reportsService: { generateDailyReport } });

    service.recalcToday(7, new Date('2026-08-16T10:00:00.000Z'));

    expect(generateDailyReport).toHaveBeenCalledWith(7, '2026-08-16');
  });

  it('generateDailyReport가 실패해도 예외를 던지지 않는다', async () => {
    const generateDailyReport = jest
      .fn()
      .mockRejectedValue(new Error('db down'));
    const service = createService({ reportsService: { generateDailyReport } });

    expect(() =>
      service.recalcToday(7, new Date('2026-08-16T10:00:00.000Z')),
    ).not.toThrow();
    await flush();
    expect(generateDailyReport).toHaveBeenCalledTimes(1);
  });

  it('완료 상태이고 임계치 이하면 연결된 보호자에게 실시간으로 알린다', async () => {
    const generateDailyReport = jest.fn().mockResolvedValue({
      reportId: 31,
      generationStatus: GenerationStatus.COMPLETED,
      emotionIndex: 40,
    });
    const findConnectedGuardianId = jest.fn().mockResolvedValue(3);
    const createEmotionIndexDropNotification = jest.fn().mockResolvedValue({});
    const service = createService({
      reportsService: { generateDailyReport },
      targetRepository: { findConnectedGuardianId },
      notificationsService: { createEmotionIndexDropNotification },
    });

    service.recalcToday(7, new Date('2026-08-16T10:00:00.000Z'));
    await flush();

    expect(findConnectedGuardianId).toHaveBeenCalledWith(7);
    expect(createEmotionIndexDropNotification).toHaveBeenCalledWith(
      3,
      31,
      '2026-08-16',
      40,
    );
  });

  it('연결된 보호자가 없으면 알림을 보내지 않는다', async () => {
    const generateDailyReport = jest.fn().mockResolvedValue({
      reportId: 31,
      generationStatus: GenerationStatus.COMPLETED,
      emotionIndex: 40,
    });
    const findConnectedGuardianId = jest.fn().mockResolvedValue(null);
    const createEmotionIndexDropNotification = jest.fn();
    const service = createService({
      reportsService: { generateDailyReport },
      targetRepository: { findConnectedGuardianId },
      notificationsService: { createEmotionIndexDropNotification },
    });

    service.recalcToday(7, new Date('2026-08-16T10:00:00.000Z'));
    await flush();

    expect(createEmotionIndexDropNotification).not.toHaveBeenCalled();
  });

  it('아직 WAITING 상태이거나 정서지수가 없으면 알림을 보내지 않는다', async () => {
    const generateDailyReport = jest.fn().mockResolvedValue(waitingReport);
    const createEmotionIndexDropNotification = jest.fn();
    const service = createService({
      reportsService: { generateDailyReport },
      notificationsService: { createEmotionIndexDropNotification },
    });

    service.recalcToday(7, new Date('2026-08-16T10:00:00.000Z'));
    await flush();

    expect(createEmotionIndexDropNotification).not.toHaveBeenCalled();
  });

  it('알림 발송이 실패해도 예외를 던지지 않는다', async () => {
    const generateDailyReport = jest.fn().mockResolvedValue({
      reportId: 31,
      generationStatus: GenerationStatus.COMPLETED,
      emotionIndex: 40,
    });
    const findConnectedGuardianId = jest.fn().mockResolvedValue(3);
    const createEmotionIndexDropNotification = jest
      .fn()
      .mockRejectedValue(new Error('push down'));
    const service = createService({
      reportsService: { generateDailyReport },
      targetRepository: { findConnectedGuardianId },
      notificationsService: { createEmotionIndexDropNotification },
    });

    expect(() =>
      service.recalcToday(7, new Date('2026-08-16T10:00:00.000Z')),
    ).not.toThrow();
    await flush();
    await flush();
    expect(createEmotionIndexDropNotification).toHaveBeenCalledTimes(1);
  });
});
