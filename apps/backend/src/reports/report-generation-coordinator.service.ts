/*
역할: 대상 시니어별 일간 생성과 월요일 주간 생성·알림을 제한된 동시성으로 실행하고 개별 실패를 격리한다.
전체 흐름: Scheduler → Coordinator → 일간 생성 → 월요일 주간 생성 → 알림 저장
*/
import { Injectable, Logger } from '@nestjs/common';
import { NotificationsService } from '../notifications/notifications.service';
import { GenerationStatus } from './entities/daily-emotion-report.entity';
import { runWithConcurrency } from './lib/run-with-concurrency';
import { toReportScheduleContext } from './lib/report-schedule-date';
import { ReportGenerationTargetRepository } from './repositories/report-generation-target.repository';
import { ReportsService } from './reports.service';
import { WeeklyReportGenerationService } from './weekly-report-generation.service';

// 대상을 전부 동시에 처리하면 콜드스타트 중일 수 있는 ai-server(Render 무료
// 플랜, daily-summary.client.ts 참고)에 요청이 한꺼번에 몰려 오히려 전부
// 타임아웃날 수 있다 — 순차 실행과 완전 병렬 실행 사이의 절충으로 이 값만큼만
// 동시에 처리한다.
const MAX_CONCURRENT_TARGETS = 4;

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

    await runWithConcurrency(
      targets,
      MAX_CONCURRENT_TARGETS,
      async (target) => {
        try {
          // 월요일에도 일요일 일간 저장이 끝난 뒤에만 아래 주간 단계로 넘어간다.
          const dailyReport = await this.reportsService.generateDailyReport(
            target.seniorId,
            context.reportDate,
          );
          if (
            dailyReport.generationStatus === GenerationStatus.COMPLETED &&
            dailyReport.emotionIndex !== null
          ) {
            await this.notificationsService.createEmotionIndexDropNotification(
              target.guardianId,
              dailyReport.reportId,
              context.reportDate,
              dailyReport.emotionIndex,
            );
          }

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
                context.previousWeekStart,
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
      },
    );
  }
}
