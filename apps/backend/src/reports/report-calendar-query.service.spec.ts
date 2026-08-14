import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { UserRole } from '../users/entities/user.entity';
import { GenerationStatus } from './entities/daily-emotion-report.entity';
import { ReportCalendarQueryService } from './report-calendar-query.service';
import type { ReportAccessRepository } from './repositories/report-access.repository';
import type { ReportCalendarRepository } from './repositories/report-calendar.repository';

describe('ReportCalendarQueryService', () => {
  const guardian = { sub: 10, role: UserRole.GUARDIAN };

  function createService(seniorId: number | null = 9) {
    const accessRepository = {
      findConnectedSeniorId: jest.fn().mockResolvedValue(seniorId),
    };
    const calendarRepository = {
      findDailyReports: jest.fn().mockResolvedValue([
        {
          reportId: 2,
          reportDate: '2026-08-03',
          generationStatus: GenerationStatus.COMPLETED,
        },
        {
          reportId: 4,
          reportDate: '2026-08-05',
          generationStatus: GenerationStatus.WAITING,
        },
      ]),
      findWeeklyReportsOverlappingMonth: jest.fn().mockResolvedValue([
        {
          weeklyReportId: 1,
          startDate: '2026-08-03',
          generationStatus: GenerationStatus.COMPLETED,
        },
      ]),
    };
    return {
      service: new ReportCalendarQueryService(
        accessRepository as unknown as ReportAccessRepository,
        calendarRepository as unknown as ReportCalendarRepository,
      ),
      accessRepository,
      calendarRepository,
    };
  }

  it('연결된 시니어의 일간·주간 리포트 날짜를 함께 반환한다', async () => {
    const { service, calendarRepository } = createService();

    const result = await service.getCalendar(guardian, 2026, 8);

    expect(result).toEqual({
      year: 2026,
      month: 8,
      dailyReports: [
        {
          reportId: 2,
          date: '2026-08-03',
          generationStatus: GenerationStatus.COMPLETED,
        },
        {
          reportId: 4,
          date: '2026-08-05',
          generationStatus: GenerationStatus.WAITING,
        },
      ],
      weeklyReports: [
        {
          weeklyReportId: 1,
          weekStart: '2026-08-03',
          weekEnd: '2026-08-09',
          generationStatus: GenerationStatus.COMPLETED,
        },
      ],
    });
    expect(calendarRepository.findDailyReports).toHaveBeenCalledWith(
      9,
      '2026-08-01',
      '2026-09-01',
    );
    expect(
      calendarRepository.findWeeklyReportsOverlappingMonth,
    ).toHaveBeenCalledWith(9, '2026-08-01', '2026-09-01');
  });

  it('시니어 계정의 달력 조회를 거부한다', async () => {
    const { service, accessRepository } = createService();

    await expect(
      service.getCalendar({ sub: 9, role: UserRole.SENIOR }, 2026, 8),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(accessRepository.findConnectedSeniorId).not.toHaveBeenCalled();
  });

  it('연결된 시니어가 없으면 찾을 수 없음으로 처리한다', async () => {
    const { service, calendarRepository } = createService(null);

    await expect(service.getCalendar(guardian, 2026, 8)).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(calendarRepository.findDailyReports).not.toHaveBeenCalled();
  });
});
