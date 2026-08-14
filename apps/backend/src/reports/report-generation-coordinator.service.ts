/*
역할: 대상 시니어별 일간 생성과 월요일 주간 생성·알림을 순서대로 실행하고 개별 실패를 격리한다.
전체 흐름: Scheduler → Coordinator → 일간 생성 → 월요일 주간 생성 → 알림 저장
*/
import { Injectable, Logger } from '@nestjs/common';
import { NotificationsService } from '../notifications/notifications.service';
import { GenerationStatus } from './entities/daily-emotion-report.entity';
import { toReportScheduleContext } from './lib/report-schedule-date';
import { ReportGenerationTargetRepository } from './repositories/report-generation-target.repository';
import { ReportsService } from './reports.service';
import { WeeklyReportGenerationService } from './weekly-report-generation.service';

@Injectable()
export class ReportGenerationCoordinatorService {
  private readonly logger = new Logger(ReportGenerationCoordinatorService.name);

  constructor(
    private readonly targetRepository: ReportGenerationTargetRepository,
    private readonly reportsService: ReportsService,
    private readonly weeklyReportGenerationService: WeeklyReportGenerationService,
    private readonly notificationsService: NotificationsService,
  ) {}

  async run(now: Date = new Date()): Promise<void> {
    const context = toReportScheduleContext(now);
    const targets = await this.targetRepository.findConnectedTargets();

    for (const target of targets) {
      try {
        // 월요일에도 일요일 일간 저장이 끝난 뒤에만 아래 주간 단계로 넘어간다.
        await this.reportsService.generateDailyReport(
          target.seniorId,
          context.reportDate,
        );

        if (context.previousWeekStart !== null) {
          const weeklyReport =
            await this.weeklyReportGenerationService.generateWeeklyReport(
              target.seniorId,
              context.previousWeekStart,
            );
          if (weeklyReport.generationStatus === GenerationStatus.COMPLETED) {
            await this.notificationsService.createWeeklyReportReadyNotification(
              target.guardianId,
              weeklyReport.weeklyReportId,
            );
          }
        }
      } catch (error: unknown) {
        // 한 관계의 데이터 오류가 다른 보호자·시니어 리포트 생성을 막지 않도록 계속 진행한다.
        this.logger.error(
          `리포트 정기 생성 실패: guardianId=${target.guardianId}, seniorId=${target.seniorId}`,
          error instanceof Error ? error.stack : String(error),
        );
      }
    }
  }
}
