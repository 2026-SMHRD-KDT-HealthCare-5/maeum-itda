/*
역할: 보호자 권한과 연결 관계를 확인한 뒤 일간·주간 달력 데이터를 조합한다.
주의: 달력 조회는 기존 리포트의 날짜만 읽으며 새로운 리포트를 생성하거나 저장하지 않는다.
*/
import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { AccessTokenPayload } from '../auth/auth.service';
import { UserRole } from '../users/entities/user.entity';
import { ReportCalendarResponseDto } from './dto/report-calendar-response.dto';
import {
  addCalendarDays,
  toCalendarDateString,
  toReportCalendarPeriod,
} from './lib/report-calendar-period';
import { ReportAccessRepository } from './repositories/report-access.repository';
import { ReportCalendarRepository } from './repositories/report-calendar.repository';

@Injectable()
export class ReportCalendarQueryService {
  constructor(
    private readonly reportAccessRepository: ReportAccessRepository,
    private readonly reportCalendarRepository: ReportCalendarRepository,
  ) {}

  async getCalendar(
    auth: AccessTokenPayload,
    year: number,
    month: number,
  ): Promise<ReportCalendarResponseDto> {
    if (auth.role !== UserRole.GUARDIAN) {
      throw new ForbiddenException(
        '보호자만 리포트 달력을 조회할 수 있습니다.',
      );
    }

    const seniorId = await this.reportAccessRepository.findConnectedSeniorId(
      auth.sub,
    );
    if (seniorId === null) {
      throw new NotFoundException('연결된 시니어가 없습니다.');
    }

    const { monthStart, nextMonthStart } = toReportCalendarPeriod(year, month);
    const [dailyReports, weeklyReports] = await Promise.all([
      this.reportCalendarRepository.findDailyReports(
        seniorId,
        monthStart,
        nextMonthStart,
      ),
      this.reportCalendarRepository.findWeeklyReportsOverlappingMonth(
        seniorId,
        monthStart,
        nextMonthStart,
      ),
    ]);

    return {
      year,
      month,
      dailyReports: dailyReports.map((report) => ({
        reportId: Number(report.reportId),
        date: toCalendarDateString(report.reportDate),
        generationStatus: report.generationStatus,
      })),
      weeklyReports: weeklyReports.map((report) => {
        const weekStart = toCalendarDateString(report.startDate);
        return {
          weeklyReportId: Number(report.weeklyReportId),
          weekStart,
          weekEnd: addCalendarDays(weekStart, 6),
          generationStatus: report.generationStatus,
        };
      }),
    };
  }
}
