/* 역할: 주간 생성이 데이터 부족일을 제외하고 상태·요약을 정해 저장하는지 검증한다. */
import { GenerationStatus } from './entities/daily-emotion-report.entity';
import type { WeeklyReportRepository } from './repositories/weekly-report.repository';
import { WeeklyReportGenerationService } from './weekly-report-generation.service';

describe('WeeklyReportGenerationService', () => {
  const dailyReport = (emotionIndex: number | null) => ({
    emotionIndex,
    generationStatus:
      emotionIndex === null
        ? GenerationStatus.WAITING
        : GenerationStatus.COMPLETED,
  });

  const createService = (scores: Array<number | null>) => {
    const saved = { weeklyReportId: 10 };
    const repository = {
      findDailyReports: jest
        .fn()
        .mockResolvedValue(scores.map((score) => dailyReport(score))),
      saveWeeklyReport: jest.fn().mockResolvedValue(saved),
    };
    return {
      service: new WeeklyReportGenerationService(
        repository as unknown as WeeklyReportRepository,
      ),
      repository,
      saved,
    };
  };

  it('유효한 날짜가 3일 이상이면 완료 주간 리포트로 저장한다', async () => {
    const { service, repository, saved } = createService([
      80,
      null,
      60,
      70,
      null,
      90,
      50,
    ]);

    await expect(service.generateWeeklyReport(9, '2026-08-03')).resolves.toBe(
      saved,
    );
    expect(repository.saveWeeklyReport).toHaveBeenCalledWith(
      9,
      '2026-08-03',
      '2026-08-09',
      '5일의 정서지수 평균은 70점입니다.',
      GenerationStatus.COMPLETED,
    );
  });

  it('유효한 날짜가 3일 미만이면 대기 상태로 저장한다', async () => {
    const { service, repository } = createService([80, null, 60]);

    await service.generateWeeklyReport(9, '2026-08-03');

    expect(repository.saveWeeklyReport).toHaveBeenCalledWith(
      9,
      '2026-08-03',
      '2026-08-09',
      '주간 리포트를 생성하기에 데이터가 부족합니다.',
      GenerationStatus.WAITING,
    );
  });
});
