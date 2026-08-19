/* 역할: 일간 집계 결과가 데이터 충분 여부에 맞는 상태와 점수로 저장되는지 검증한다. */
import { ScaleType } from '../analysis/entities/scale-question-analysis.entity';
import { GenerationStatus } from './entities/daily-emotion-report.entity';
import type { DailyScaleAnalysisInput } from './lib/daily-emotion-index.calculator';
import type { DailyReportRepository } from './repositories/daily-report.repository';
import type { DailyReportEvidenceRepository } from './repositories/daily-report-evidence.repository';
import type { DailySummaryClient } from './daily-summary.client';
import type { DailySummaryContextRepository } from './repositories/daily-summary-context.repository';
import { ReportsService } from './reports.service';

describe('ReportsService', () => {
  const analysis = (
    scaleAnalysisId: number,
    questionNumber: number,
    analysisScore: 0 | 1,
  ): DailyScaleAnalysisInput => ({
    scaleAnalysisId,
    scaleType: ScaleType.GAD_7,
    questionNumber,
    analysisScore,
    analyzedAt: new Date('2026-08-14T01:00:00.000Z'),
  });

  const createService = (analyses: DailyScaleAnalysisInput[]) => {
    const evidenceRepository = {
      findCandidateMessageIds: jest.fn().mockResolvedValue([101, 102]),
    };
    const repository = {
      findScaleAnalysesForDay: jest.fn().mockResolvedValue(analyses),
      saveDailyReport: jest
        .fn()
        .mockImplementation(
          (
            seniorId: number,
            reportDate: string,
            emotionIndex: number | null,
            generationStatus: GenerationStatus,
          ) =>
            Promise.resolve({
              seniorId,
              reportDate,
              emotionIndex,
              generationStatus,
            }),
        ),
    };
    const summaryContextRepository = {
      findTurns: jest.fn().mockResolvedValue([
        {
          speakerType: 'SENIOR',
          content: '오늘은 기분이 괜찮아요.',
          sentimentLabel: 'POSITIVE',
        },
      ]),
    };
    const dailySummaryClient = {
      generate: jest.fn().mockResolvedValue({
        conversationSummary: '차분하게 하루를 보내셨어요.',
        recommendedAction: '가볍게 안부를 확인해 주세요.',
      }),
    };
    return {
      service: new ReportsService(
        repository as unknown as DailyReportRepository,
        evidenceRepository as unknown as DailyReportEvidenceRepository,
        summaryContextRepository as unknown as DailySummaryContextRepository,
        dailySummaryClient as unknown as DailySummaryClient,
      ),
      repository,
      evidenceRepository,
      summaryContextRepository,
      dailySummaryClient,
    };
  };

  it('5개 이상 문항을 계산해 완료된 일간 리포트로 저장한다', async () => {
    const { service, repository } = createService([
      analysis(1, 1, 1),
      analysis(2, 2, 0),
      analysis(3, 3, 0),
      analysis(4, 4, 0),
      analysis(5, 5, 0),
    ]);

    await service.generateDailyReport(7, '2026-08-14');

    expect(repository.saveDailyReport).toHaveBeenCalledWith(
      7,
      '2026-08-14',
      80,
      GenerationStatus.COMPLETED,
      [101, 102],
      '차분하게 하루를 보내셨어요.',
      '가볍게 안부를 확인해 주세요.',
    );
  });

  it('5개 미만 문항이면 점수 없이 대기 상태로 저장한다', async () => {
    const { service, repository } = createService([
      analysis(1, 1, 0),
      analysis(2, 2, 0),
      analysis(3, 3, 0),
      analysis(4, 4, 0),
    ]);

    await service.generateDailyReport(7, '2026-08-14');

    expect(repository.saveDailyReport).toHaveBeenCalledWith(
      7,
      '2026-08-14',
      null,
      GenerationStatus.WAITING,
      [101, 102],
      '차분하게 하루를 보내셨어요.',
      '가볍게 안부를 확인해 주세요.',
    );
  });

  it('FastAPI 요약이 실패해도 정서지수와 근거는 저장한다', async () => {
    const { service, repository, dailySummaryClient } = createService([
      analysis(1, 1, 1),
      analysis(2, 2, 0),
      analysis(3, 3, 0),
      analysis(4, 4, 0),
      analysis(5, 5, 0),
    ]);
    dailySummaryClient.generate.mockRejectedValueOnce(
      new Error('FastAPI 연결 실패'),
    );

    await expect(
      service.generateDailyReport(7, '2026-08-14'),
    ).resolves.toBeDefined();
    expect(repository.saveDailyReport).toHaveBeenCalledWith(
      7,
      '2026-08-14',
      80,
      GenerationStatus.COMPLETED,
      [101, 102],
      undefined,
      undefined,
    );
  });
});
