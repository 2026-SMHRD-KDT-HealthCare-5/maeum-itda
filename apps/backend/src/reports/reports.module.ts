/*
역할: 리포트 기능의 Controller, Service, Entity Repository를 등록한다.
전체 흐름: AppModule → ReportsModule → ReportsController → ReportsService
*/
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { GuardianSeniorRelationship } from '../users/entities/guardian-senior-relationship.entity';
import { DailyReportQueryService } from './daily-report-query.service';
import { EmotionIndexRecalcTriggerService } from './emotion-index-recalc-trigger.service';
import { DailyEmotionReport } from './entities/daily-emotion-report.entity';
import { DailyReportEvidence } from './entities/daily-report-evidence.entity';
import { WeeklyEmotionReport } from './entities/weekly-emotion-report.entity';
import { ReportsController } from './reports.controller';
import { DailyReportRepository } from './repositories/daily-report.repository';
import { DailyReportEvidenceRepository } from './repositories/daily-report-evidence.repository';
import { ReportAccessRepository } from './repositories/report-access.repository';
import { WeeklyReportRepository } from './repositories/weekly-report.repository';
import { ReportsService } from './reports.service';
import { ReportGenerationCoordinatorService } from './report-generation-coordinator.service';
import { ReportGenerationTargetRepository } from './repositories/report-generation-target.repository';
import { ReportGenerationScheduler } from './schedulers/report-generation.scheduler';
import { ReportCalendarQueryService } from './report-calendar-query.service';
import { ReportCalendarRepository } from './repositories/report-calendar.repository';
import { WeeklyReportGenerationService } from './weekly-report-generation.service';
import { WeeklyReportQueryService } from './weekly-report-query.service';

// DailyEmotionReport Repository와 리포트 요청 처리 객체를 등록한다.
@Module({
  imports: [
    // ReportsController의 AccessTokenGuard가 AuthService를 주입받도록 인증 모듈을 연결한다.
    AuthModule,
    NotificationsModule,
    TypeOrmModule.forFeature([
      DailyEmotionReport,
      DailyReportEvidence,
      WeeklyEmotionReport,
      GuardianSeniorRelationship,
    ]),
  ],
  controllers: [ReportsController],
  providers: [
    ReportsService,
    DailyReportQueryService,
    WeeklyReportQueryService,
    ReportCalendarQueryService,
    WeeklyReportGenerationService,
    ReportGenerationCoordinatorService,
    ReportGenerationScheduler,
    EmotionIndexRecalcTriggerService,
    DailyReportRepository,
    DailyReportEvidenceRepository,
    WeeklyReportRepository,
    ReportAccessRepository,
    ReportCalendarRepository,
    ReportGenerationTargetRepository,
  ],
  exports: [ReportsService, EmotionIndexRecalcTriggerService],
})
export class ReportsModule {}
