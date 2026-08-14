/* 역할: 보호자 역할·연결 관계·리포트 존재 여부에 따라 일간 조회 결과가 제한되는지 검증한다. */
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { UserRole } from '../users/entities/user.entity';
import { DailyReportQueryService } from './daily-report-query.service';
import {
  GenerationStatus,
  type DailyEmotionReport,
} from './entities/daily-emotion-report.entity';
import type { DailyReportRepository } from './repositories/daily-report.repository';
import type { ReportAccessRepository } from './repositories/report-access.repository';

describe('DailyReportQueryService', () => {
  const report: DailyEmotionReport = {
    reportId: 31,
    weeklyReportId: null,
    seniorId: 7,
    reportDate: '2026-08-14',
    emotionIndex: 80,
    oneLineSummary: null,
    recommendedAction: null,
    generationStatus: GenerationStatus.COMPLETED,
    createdAt: new Date('2026-08-15T00:00:00.000Z'),
  };

  const createService = (
    seniorId: number | null = 7,
    dailyReport: DailyEmotionReport | null = report,
  ) => {
    const accessRepository = {
      findConnectedSeniorId: jest.fn().mockResolvedValue(seniorId),
    };
    const repository = {
      findDailyReport: jest.fn().mockResolvedValue(dailyReport),
    };
    return {
      service: new DailyReportQueryService(
        accessRepository as unknown as ReportAccessRepository,
        repository as unknown as DailyReportRepository,
      ),
      accessRepository,
      repository,
    };
  };

  it('연결된 시니어의 해당 날짜 리포트를 반환한다', async () => {
    const { service, accessRepository, repository } = createService();

    const result = await service.getDailyReport(
      { sub: 3, role: UserRole.GUARDIAN },
      '2026-08-14',
    );

    expect(result).toEqual({
      reportId: 31,
      seniorId: 7,
      reportDate: '2026-08-14',
      emotionIndex: 80,
      oneLineSummary: null,
      recommendedAction: null,
      generationStatus: GenerationStatus.COMPLETED,
      createdAt: new Date('2026-08-15T00:00:00.000Z'),
    });
    expect(result).not.toHaveProperty('weeklyReportId');
    expect(accessRepository.findConnectedSeniorId).toHaveBeenCalledWith(3);
    expect(repository.findDailyReport).toHaveBeenCalledWith(7, '2026-08-14');
  });

  it('시니어 계정의 조회를 거부한다', async () => {
    const { service, accessRepository } = createService();

    await expect(
      service.getDailyReport({ sub: 7, role: UserRole.SENIOR }, '2026-08-14'),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(accessRepository.findConnectedSeniorId).not.toHaveBeenCalled();
  });

  it('연결된 시니어가 없으면 찾을 수 없음으로 처리한다', async () => {
    const { service, repository } = createService(null);

    await expect(
      service.getDailyReport({ sub: 3, role: UserRole.GUARDIAN }, '2026-08-14'),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(repository.findDailyReport).not.toHaveBeenCalled();
  });

  it('해당 날짜 리포트가 없으면 찾을 수 없음으로 처리한다', async () => {
    const { service } = createService(7, null);

    await expect(
      service.getDailyReport({ sub: 3, role: UserRole.GUARDIAN }, '2026-08-13'),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});
