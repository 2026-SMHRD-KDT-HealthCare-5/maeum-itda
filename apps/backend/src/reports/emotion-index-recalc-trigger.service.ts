/*
역할: 대화 종료/유휴 타임아웃/같은 날 재접속 시점에 오늘 정서지수를 즉시 재계산·저장한다.
연결 흐름: chats 모듈의 ChatEndHandler/ChatInactivityService/ChatStartHandler → 이 서비스 → ReportsService.generateDailyReport
주의: 09:00 정기 배치(ReportGenerationCoordinatorService)와 달리 알림 발송은 하지 않고
리포트 값만 최신화한다 — 대화 흐름을 막으면 안 되므로 실패해도 에러를 삼킨다.
*/
import { Injectable, Logger } from '@nestjs/common';
import { toSeoulTodayDate } from './lib/report-schedule-date';
import { ReportsService } from './reports.service';

@Injectable()
export class EmotionIndexRecalcTriggerService {
  private readonly logger = new Logger(EmotionIndexRecalcTriggerService.name);

  constructor(private readonly reportsService: ReportsService) {}

  // 역할: 오늘(Asia/Seoul) 리포트를 즉시 재계산한다. fire-and-forget으로
  // 호출하는 대화 흐름(chat:end/chat:start 등)을 기다리게 하지 않는다.
  recalcToday(seniorId: number, now: Date = new Date()): void {
    const reportDate = toSeoulTodayDate(now);
    this.reportsService
      .generateDailyReport(seniorId, reportDate)
      .catch((error: unknown) => {
        this.logger.error(
          `정서지수 즉시 재계산 실패: seniorId=${seniorId}, reportDate=${reportDate}`,
          error instanceof Error ? error.stack : String(error),
        );
      });
  }
}
