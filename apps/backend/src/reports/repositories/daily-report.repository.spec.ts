import { GenerationStatus } from '../entities/daily-emotion-report.entity';
import type { DailyReportEvidenceRepository } from './daily-report-evidence.repository';
import { DailyReportRepository } from './daily-report.repository';

describe('DailyReportRepository.saveDailyReport', () => {
  function createRepository() {
    const savedReport = {
      reportId: 31,
      seniorId: 7,
      reportDate: '2026-08-14',
    };
    const entityRepository = {
      upsert: jest.fn().mockResolvedValue(undefined),
      findOneByOrFail: jest.fn().mockResolvedValue(savedReport),
    };
    const manager = {
      getRepository: jest.fn().mockReturnValue(entityRepository),
    };
    const dataSource = {
      transaction: jest.fn((callback: (value: typeof manager) => unknown) =>
        callback(manager),
      ),
    };
    const evidenceRepository = {
      replaceForReport: jest.fn().mockResolvedValue(undefined),
    };

    return {
      repository: new DailyReportRepository(
        dataSource as never,
        evidenceRepository as unknown as DailyReportEvidenceRepository,
      ),
      entityRepository,
      evidenceRepository,
    };
  }

  it('동일 시니어·날짜를 충돌 키로 사용해 리포트와 근거를 갱신한다', async () => {
    const { repository, entityRepository, evidenceRepository } =
      createRepository();

    await repository.saveDailyReport(
      7,
      '2026-08-14',
      80,
      GenerationStatus.COMPLETED,
      [101, 102],
      '차분하게 하루를 보내셨어요.',
      '가볍게 안부를 확인해 주세요.',
    );

    expect(entityRepository.upsert).toHaveBeenCalledWith(
      {
        seniorId: 7,
        reportDate: '2026-08-14',
        emotionIndex: 80,
        generationStatus: GenerationStatus.COMPLETED,
        oneLineSummary: '차분하게 하루를 보내셨어요.',
        recommendedAction: '가볍게 안부를 확인해 주세요.',
      },
      ['seniorId', 'reportDate'],
    );
    expect(evidenceRepository.replaceForReport).toHaveBeenCalledWith(
      expect.anything(),
      31,
      [101, 102],
    );
  });

  it('요약 호출이 실패한 재집계에서는 기존 요약 컬럼을 갱신 대상에서 제외한다', async () => {
    const { repository, entityRepository } = createRepository();

    await repository.saveDailyReport(
      7,
      '2026-08-14',
      75,
      GenerationStatus.COMPLETED,
      [101],
      undefined,
      undefined,
    );

    expect(entityRepository.upsert).toHaveBeenCalledWith(
      {
        seniorId: 7,
        reportDate: '2026-08-14',
        emotionIndex: 75,
        generationStatus: GenerationStatus.COMPLETED,
      },
      ['seniorId', 'reportDate'],
    );
  });
});
