/* 역할: 보호자 주간 조회가 연결 권한과 저장 결과를 확인하고 화면용 월~일 응답을 만드는지 검증한다. */
import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { UserRole } from '../users/entities/user.entity';
import { GenerationStatus } from './entities/daily-emotion-report.entity';
import type { ReportAccessRepository } from './repositories/report-access.repository';
import type { WeeklyReportRepository } from './repositories/weekly-report.repository';
import { WeeklyReportQueryService } from './weekly-report-query.service';

describe('WeeklyReportQueryService', () => {
  const weeklyReport = {
    weeklyReportId: 10,
    seniorId: 9,
    startDate: '2026-08-03',
    weeklySummary: '전반적으로 안정적인 한 주였어요.',
    generationStatus: GenerationStatus.COMPLETED,
    createdAt: new Date('2026-08-10T00:10:00.000Z'),
    updatedAt: new Date('2026-08-10T00:10:00.000Z'),
  };
  const dailyReports = [
    {
      reportId: 1,
      weeklyReportId: 10,
      seniorId: 9,
      reportDate: '2026-08-03',
      emotionIndex: 80,
      oneLineSummary: '대화를 편안하게 이어가셨어요.',
      recommendedAction: null,
      generationStatus: GenerationStatus.COMPLETED,
      createdAt: new Date('2026-08-04T00:00:00.000Z'),
    },
    {
      reportId: 2,
      weeklyReportId: 10,
      seniorId: 9,
      reportDate: '2026-08-04',
      emotionIndex: null,
      oneLineSummary: null,
      recommendedAction: null,
      generationStatus: GenerationStatus.WAITING,
      createdAt: new Date('2026-08-05T00:00:00.000Z'),
    },
  ];

  const createService = (
    seniorId: number | null = 9,
    storedWeeklyReport: typeof weeklyReport | null = weeklyReport,
  ) => {
    const accessRepository = {
      findConnectedSeniorId: jest.fn().mockResolvedValue(seniorId),
    };
    const weeklyRepository = {
      findWeeklyReport: jest.fn().mockResolvedValue(storedWeeklyReport),
      findDailyReports: jest.fn().mockResolvedValue(dailyReports),
    };
    return {
      service: new WeeklyReportQueryService(
        accessRepository as unknown as ReportAccessRepository,
        weeklyRepository as unknown as WeeklyReportRepository,
      ),
      accessRepository,
      weeklyRepository,
    };
  };

  it('월~일 7개 항목과 유효 점수 통계를 반환한다', async () => {
    const { service, weeklyRepository } = createService();

    const result = await service.getWeeklyReport(
      { sub: 3, role: UserRole.GUARDIAN },
      '2026-08-03',
    );

    expect(result.dailyReports).toHaveLength(7);
    expect(result.dailyReports[0]).toMatchObject({
      date: '2026-08-03',
      emotionIndex: 80,
      emotionLevel: 'GOOD',
    });
    expect(result.dailyReports[1]).toMatchObject({
      date: '2026-08-04',
      emotionIndex: null,
      emotionLevel: null,
    });
    expect(result.dailyReports[6].date).toBe('2026-08-09');
    expect(result).toMatchObject({
      weekStart: '2026-08-03',
      weekEnd: '2026-08-09',
      validDays: 1,
      averageScore: null,
      maxScore: null,
      minScore: null,
    });
    expect(weeklyRepository.findDailyReports).toHaveBeenCalledWith(
      9,
      '2026-08-03',
      '2026-08-09',
    );
  });

  it('월요일이 아닌 weekStart를 거부한다', async () => {
    const { service, accessRepository } = createService();

    await expect(
      service.getWeeklyReport(
        { sub: 3, role: UserRole.GUARDIAN },
        '2026-08-04',
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(accessRepository.findConnectedSeniorId).not.toHaveBeenCalled();
  });

  it('시니어 계정의 조회를 거부한다', async () => {
    const { service } = createService();
    await expect(
      service.getWeeklyReport({ sub: 9, role: UserRole.SENIOR }, '2026-08-03'),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('연결 또는 저장된 주간 리포트가 없으면 404로 처리한다', async () => {
    const noConnection = createService(null);
    await expect(
      noConnection.service.getWeeklyReport(
        { sub: 3, role: UserRole.GUARDIAN },
        '2026-08-03',
      ),
    ).rejects.toBeInstanceOf(NotFoundException);

    const noReport = createService(9, null);
    await expect(
      noReport.service.getWeeklyReport(
        { sub: 3, role: UserRole.GUARDIAN },
        '2026-08-03',
      ),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});
