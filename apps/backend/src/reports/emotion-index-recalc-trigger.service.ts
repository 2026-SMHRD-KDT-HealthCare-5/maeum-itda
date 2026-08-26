/*
역할: 대화 시작·종료, 유휴 타임아웃, 마지막 질문 후 타이머 만료 시 오늘 정서지수를 즉시 재계산·저장하고,
오늘 처음 임계치 아래로 떨어진 순간이면 보호자에게 실시간으로 알린다.
연결 흐름: chats 모듈의 ChatEndHandler/ChatInactivityService/ChatStartHandler → 이 서비스
→ ReportsService.generateDailyReport → (임계치 이하면) NotificationsService.createEmotionIndexDropNotification
09:00 정기 배치(ReportGenerationCoordinatorService)는 이 실시간 경로가 놓친 경우를 위한
안전망으로 계속 남겨둔다 — 대화 흐름을 막으면 안 되므로 재계산·알림 모두 실패해도 에러를 삼킨다.
*/
import { Injectable, Logger } from '@nestjs/common';
import { NotificationsService } from '../notifications/notifications.service';
import {
  DailyEmotionReport,
  GenerationStatus,
} from './entities/daily-emotion-report.entity';
import { toSeoulTodayDate } from './lib/report-schedule-date';
import { ReportGenerationTargetRepository } from './repositories/report-generation-target.repository';
import { ReportsService } from './reports.service';

@Injectable()
export class EmotionIndexRecalcTriggerService {
  private readonly logger = new Logger(EmotionIndexRecalcTriggerService.name);

  constructor(
    private readonly reportsService: ReportsService,
    private readonly targetRepository: ReportGenerationTargetRepository,
    private readonly notificationsService: NotificationsService,
  ) {}

  // 역할: 오늘(Asia/Seoul) 리포트를 즉시 재계산한다. fire-and-forget으로
  // 호출하는 대화 흐름(chat:end/chat:start 등)을 기다리게 하지 않는다.
  recalcToday(seniorId: number, now: Date = new Date()): void {
    const reportDate = toSeoulTodayDate(now);
    this.reportsService
      .generateDailyReport(seniorId, reportDate)
      .then((dailyReport) =>
        this.notifyIfDropped(seniorId, reportDate, dailyReport),
      )
      .catch((error: unknown) => {
        this.logger.error(
          `정서지수 즉시 재계산 실패: seniorId=${seniorId}, reportDate=${reportDate}`,
          error instanceof Error ? error.stack : String(error),
        );
      });
  }

  // createEmotionIndexDropNotification은 (dailyReportId, alertType) 유니크 제약으로
  // 저장을 시도한다 — 같은 날 재대화로 여러 번 재계산돼도 dailyReportId가 그대로라
  // 오늘 첫 임계치 이하 순간에만 실제로 삽입되고 그 뒤로는 조용히 무시된다(하루 1회 보장).
  private async notifyIfDropped(
    seniorId: number,
    reportDate: string,
    dailyReport: DailyEmotionReport,
  ): Promise<void> {
    if (
      dailyReport.generationStatus !== GenerationStatus.COMPLETED ||
      dailyReport.emotionIndex === null
    ) {
      return;
    }

    try {
      const guardianId =
        await this.targetRepository.findConnectedGuardianId(seniorId);
      if (guardianId === null) return;

      await this.notificationsService.createEmotionIndexDropNotification(
        guardianId,
        dailyReport.reportId,
        reportDate,
        dailyReport.emotionIndex,
      );
    } catch (error: unknown) {
      this.logger.error(
        `정서지수 하락 실시간 알림 발송 실패: seniorId=${seniorId}, reportDate=${reportDate}`,
        error instanceof Error ? error.stack : String(error),
      );
    }
  }
}
