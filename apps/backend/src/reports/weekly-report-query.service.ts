/*
역할: 보호자 권한과 연결 관계를 확인한 뒤 저장된 주간 리포트에 월~일 일간 결과와 통계를 조합한다.
전체 흐름: ReportsController → WeeklyReportQueryService → 접근/주간 Repository → MySQL
*/
import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { AccessTokenPayload } from '../auth/auth.service';
import { UserRole } from '../users/entities/user.entity';
import { WeeklyReportResponseDto } from './dto/weekly-report-response.dto';
import { GenerationStatus } from './entities/daily-emotion-report.entity';
import { toWeeklyReportPeriod } from './lib/weekly-report-period';
import {
  calculateWeeklyReportStatistics,
  toEmotionLevel,
} from './lib/weekly-report-statistics';
import { ReportAccessRepository } from './repositories/report-access.repository';
import { WeeklyReportRepository } from './repositories/weekly-report.repository';

@Injectable()
export class WeeklyReportQueryService {
  constructor(
    private readonly reportAccessRepository: ReportAccessRepository,
    private readonly weeklyReportRepository: WeeklyReportRepository,
  ) {}

  async getWeeklyReport(
    auth: AccessTokenPayload,
    weekStart: string,
  ): Promise<WeeklyReportResponseDto> {
    if (auth.role !== UserRole.GUARDIAN) {
      throw new ForbiddenException(
        '보호자만 주간 리포트를 조회할 수 있습니다.',
      );
    }

    let period;
    try {
      period = toWeeklyReportPeriod(weekStart);
    } catch (error: unknown) {
      throw new BadRequestException(
        error instanceof Error
          ? error.message
          : '주 시작일이 올바르지 않습니다.',
      );
    }

    const seniorId = await this.reportAccessRepository.findConnectedSeniorId(
      auth.sub,
    );
    if (seniorId === null) {
      throw new NotFoundException('연결된 시니어가 없습니다.');
    }

    const [weeklyReport, storedDailyReports] = await Promise.all([
      this.weeklyReportRepository.findWeeklyReport(seniorId, weekStart),
      this.weeklyReportRepository.findDailyReports(
        seniorId,
        period.weekStart,
        period.weekEnd,
      ),
    ]);
    if (!weeklyReport) {
      throw new NotFoundException('해당 주의 주간 리포트가 없습니다.');
    }

    const reportsByDate = new Map(
      storedDailyReports.map((report) => [report.reportDate, report]),
    );
    const dailyReports = period.dates.map((date) => {
      const report = reportsByDate.get(date);
      const emotionIndex =
        report?.generationStatus === GenerationStatus.COMPLETED
          ? report.emotionIndex
          : null;
      return {
        reportId: report?.reportId ?? null,
        date,
        emotionIndex,
        emotionLevel: toEmotionLevel(emotionIndex),
        summary: report?.oneLineSummary ?? null,
      };
    });
    const statistics = calculateWeeklyReportStatistics(
      dailyReports.map((report) => report.emotionIndex),
    );

    return {
      weeklyReportId: weeklyReport.weeklyReportId,
      seniorId: weeklyReport.seniorId,
      weekStart: period.weekStart,
      weekEnd: period.weekEnd,
      dailyReports,
      ...statistics,
      weeklySummary: weeklyReport.weeklySummary,
      generationStatus: weeklyReport.generationStatus,
      createdAt: weeklyReport.createdAt,
      updatedAt: weeklyReport.updatedAt,
    };
  }
}
