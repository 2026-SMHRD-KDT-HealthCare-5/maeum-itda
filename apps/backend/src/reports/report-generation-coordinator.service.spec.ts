/* 역할: 오전 9시 조정 로직이 일간 생성 후 월요일 주간·알림을 순차 실행하는지 검증한다. */
import { GenerationStatus } from './entities/daily-emotion-report.entity';
import type { NotificationsService } from '../notifications/notifications.service';
import type { ReportGenerationTargetRepository } from './repositories/report-generation-target.repository';
import type { ReportsService } from './reports.service';
import { ReportGenerationCoordinatorService } from './report-generation-coordinator.service';
import type { WeeklyReportGenerationService } from './weekly-report-generation.service';

describe('ReportGenerationCoordinatorService', () => {
  const createCoordinator = () => {
    const targetRepository = {
      findConnectedTargets: jest
        .fn()
        .mockResolvedValue([{ guardianId: 3, seniorId: 9 }]),
    };
    const reportsService = {
      generateDailyReport: jest.fn().mockResolvedValue({ reportId: 1 }),
    };
    const weeklyService = {
      generateWeeklyReport: jest.fn().mockResolvedValue({
        weeklyReportId: 10,
        generationStatus: GenerationStatus.COMPLETED,
      }),
    };
    const notificationsService = {
      createWeeklyReportReadyNotification: jest.fn().mockResolvedValue({}),
    };
    return {
      coordinator: new ReportGenerationCoordinatorService(
        targetRepository as unknown as ReportGenerationTargetRepository,
        reportsService as unknown as ReportsService,
        weeklyService as unknown as WeeklyReportGenerationService,
        notificationsService as unknown as NotificationsService,
      ),
      reportsService,
      weeklyService,
      notificationsService,
    };
  };

  it('일반 날짜에는 전날 일간 리포트만 생성한다', async () => {
    const { coordinator, reportsService, weeklyService } = createCoordinator();

    await coordinator.run(new Date('2026-08-14T00:00:00.000Z'));

    expect(reportsService.generateDailyReport).toHaveBeenCalledWith(
      9,
      '2026-08-13',
    );
    expect(weeklyService.generateWeeklyReport).not.toHaveBeenCalled();
  });

  it('월요일에는 일요일 일간 후 지난주 주간과 알림을 순서대로 처리한다', async () => {
    const { coordinator, reportsService, weeklyService, notificationsService } =
      createCoordinator();
    const order: string[] = [];
    reportsService.generateDailyReport.mockImplementation(() => {
      order.push('daily');
      return Promise.resolve({ reportId: 1 });
    });
    weeklyService.generateWeeklyReport.mockImplementation(() => {
      order.push('weekly');
      return Promise.resolve({
        weeklyReportId: 10,
        generationStatus: GenerationStatus.COMPLETED,
      });
    });
    notificationsService.createWeeklyReportReadyNotification.mockImplementation(
      () => {
        order.push('notification');
        return Promise.resolve({});
      },
    );

    await coordinator.run(new Date('2026-08-17T00:00:00.000Z'));

    expect(order).toEqual(['daily', 'weekly', 'notification']);
    expect(reportsService.generateDailyReport).toHaveBeenCalledWith(
      9,
      '2026-08-16',
    );
    expect(weeklyService.generateWeeklyReport).toHaveBeenCalledWith(
      9,
      '2026-08-10',
    );
    expect(
      notificationsService.createWeeklyReportReadyNotification,
    ).toHaveBeenCalledWith(3, 10);
  });

  it('주간 데이터가 부족하면 생성 완료 알림을 보내지 않는다', async () => {
    const { coordinator, weeklyService, notificationsService } =
      createCoordinator();
    weeklyService.generateWeeklyReport.mockResolvedValue({
      weeklyReportId: 10,
      generationStatus: GenerationStatus.WAITING,
    });

    await coordinator.run(new Date('2026-08-17T00:00:00.000Z'));

    expect(
      notificationsService.createWeeklyReportReadyNotification,
    ).not.toHaveBeenCalled();
  });
});
