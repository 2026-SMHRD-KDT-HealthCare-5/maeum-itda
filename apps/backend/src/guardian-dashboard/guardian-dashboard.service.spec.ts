import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { GenerationStatus } from '../reports/entities/daily-emotion-report.entity';
import { EmotionLevel } from '../reports/lib/weekly-report-statistics';
import { UserRole } from '../users/entities/user.entity';
import { GuardianDashboardService } from './guardian-dashboard.service';
import type { GuardianDashboardRepository } from './repositories/guardian-dashboard.repository';

describe('GuardianDashboardService', () => {
  const guardian = { sub: 10, role: UserRole.GUARDIAN };
  const now = new Date('2026-08-14T03:00:00.000Z');

  function createService() {
    const repository = {
      findConnectedPair: jest.fn(),
      findDailyReports: jest.fn(),
      hasSeniorConversation: jest.fn(),
    };
    return {
      service: new GuardianDashboardService(
        repository as unknown as GuardianDashboardRepository,
      ),
      repository,
    };
  }

  it('연결 정보, 오늘 리포트, 최근 7일 추이를 한 응답으로 조합한다', async () => {
    const { service, repository } = createService();
    repository.findConnectedPair.mockResolvedValue({
      guardianId: 10,
      guardianName: '테스트가디언',
      seniorId: 9,
      seniorName: '테스트시니어',
      connectedAt: new Date('2026-08-01T01:00:00.000Z'),
    });
    repository.findDailyReports.mockResolvedValue([
      {
        reportId: 9,
        seniorId: 9,
        weeklyReportId: null,
        reportDate: '2026-08-14',
        emotionIndex: 49,
        oneLineSummary: '평소보다 정서지수가 낮게 나타났어요.',
        recommendedAction: '가볍게 안부를 확인해 주세요.',
        generationStatus: GenerationStatus.COMPLETED,
        createdAt: now,
      },
    ]);
    repository.hasSeniorConversation.mockResolvedValue(true);

    const result = await service.getDashboard(guardian, now);

    expect(repository.findDailyReports).toHaveBeenCalledWith(
      9,
      '2026-08-08',
      '2026-08-14',
    );
    expect(result.latestDailyReport).toMatchObject({
      reportId: 9,
      reportDate: '2026-08-14',
      emotionIndex: 49,
      emotionLevel: EmotionLevel.BAD,
    });
    expect(result.dasolMessage).toBe('가볍게 안부를 확인해 주세요.');
    expect(result.recentSevenDays).toHaveLength(7);
    expect(result.recentSevenDays.at(-1)).toEqual({
      date: '2026-08-14',
      emotionIndex: 49,
    });
  });

  it('오늘 리포트가 없으면 점수는 null이고 대화 없음 문구를 반환한다', async () => {
    const { service, repository } = createService();
    repository.findConnectedPair.mockResolvedValue({
      guardianId: 10,
      guardianName: '보호자',
      seniorId: 9,
      seniorName: '시니어',
      connectedAt: new Date('2026-08-01T01:00:00.000Z'),
    });
    repository.findDailyReports.mockResolvedValue([]);
    repository.hasSeniorConversation.mockResolvedValue(false);

    const result = await service.getDashboard(guardian, now);

    expect(result.dasolMessage).toBe(
      '오늘은 아직 다슬이와 대화를 나누지 않으셨어요. 보호자님이 직접 따뜻한 안부를 건네보는 건 어떨까요?',
    );
    expect(result.latestDailyReport.emotionIndex).toBeNull();
    expect(
      result.recentSevenDays.every(({ emotionIndex }) => emotionIndex === null),
    ).toBe(true);
  });

  it('대화는 있지만 점수를 산출하지 못하면 데이터 부족 문구를 반환한다', async () => {
    const { service, repository } = createService();
    repository.findConnectedPair.mockResolvedValue({
      guardianId: 10,
      guardianName: '보호자',
      seniorId: 9,
      seniorName: '시니어',
      connectedAt: new Date('2026-08-01T01:00:00.000Z'),
    });
    repository.findDailyReports.mockResolvedValue([]);
    repository.hasSeniorConversation.mockResolvedValue(true);

    const result = await service.getDashboard(guardian, now);

    expect(result.dasolMessage).toBe(
      '정서지수를 분석하기 위한 대화가 부족합니다.',
    );
  });

  it('시니어 계정의 접근을 거부한다', async () => {
    const { service, repository } = createService();

    await expect(
      service.getDashboard({ sub: 9, role: UserRole.SENIOR }, now),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(repository.findConnectedPair).not.toHaveBeenCalled();
  });

  it('연결된 시니어가 없으면 404를 반환한다', async () => {
    const { service, repository } = createService();
    repository.findConnectedPair.mockResolvedValue(null);

    await expect(service.getDashboard(guardian, now)).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(repository.findDailyReports).not.toHaveBeenCalled();
  });
});
