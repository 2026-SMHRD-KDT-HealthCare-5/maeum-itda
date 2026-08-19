/* 역할: 보호자 권한과 연결 관계를 검증하고 홈 화면용 데이터를 하나의 응답으로 조합한다. */
import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { AccessTokenPayload } from '../auth/auth.service';
import { UserRole } from '../users/entities/user.entity';
import { GuardianDashboardResponseDto } from './dto/guardian-dashboard-response.dto';
import {
  calculateDaysTogether,
  toGuardianDashboardPeriod,
} from './lib/guardian-dashboard-period';
import { GuardianDashboardRepository } from './repositories/guardian-dashboard.repository';
import { toEmotionLevel } from '../reports/lib/weekly-report-statistics';
import { toSeoulBusinessDayUtcRange } from '../reports/lib/seoul-business-date';

const NO_CONVERSATION_MESSAGE = '대화를 하지 않았습니다.';
const INSUFFICIENT_DATA_MESSAGE = '정서지수를 분석하기 위한 대화가 부족합니다.';

@Injectable()
export class GuardianDashboardService {
  constructor(
    private readonly dashboardRepository: GuardianDashboardRepository,
  ) {}

  async getDashboard(
    auth: AccessTokenPayload,
    now = new Date(),
  ): Promise<GuardianDashboardResponseDto> {
    if (auth.role !== UserRole.GUARDIAN) {
      throw new ForbiddenException(
        '보호자 계정만 대시보드를 조회할 수 있습니다.',
      );
    }

    const connection = await this.dashboardRepository.findConnectedPair(
      auth.sub,
    );
    if (!connection) {
      throw new NotFoundException('연결된 시니어가 없습니다.');
    }

    const period = toGuardianDashboardPeriod(now);
    const reportDateRange = toSeoulBusinessDayUtcRange(period.reportDate);
    const [reports, hasConversation] = await Promise.all([
      this.dashboardRepository.findDailyReports(
        connection.seniorId,
        period.startDate,
        period.reportDate,
      ),
      this.dashboardRepository.hasSeniorConversation(
        connection.seniorId,
        reportDateRange.start,
        reportDateRange.end,
      ),
    ]);
    const reportByDate = new Map(
      reports.map((report) => [report.reportDate, report]),
    );
    const latest = reportByDate.get(period.reportDate);
    const hasCompletedScore = latest?.emotionIndex != null;

    return {
      guardian: {
        userId: connection.guardianId,
        name: connection.guardianName,
      },
      senior: {
        userId: connection.seniorId,
        name: connection.seniorName,
        connectedAt: connection.connectedAt,
        daysTogether: calculateDaysTogether(connection.connectedAt, now),
      },
      dasolMessage: hasCompletedScore
        ? (latest.recommendedAction ??
          latest.oneLineSummary ??
          NO_CONVERSATION_MESSAGE)
        : hasConversation
          ? INSUFFICIENT_DATA_MESSAGE
          : NO_CONVERSATION_MESSAGE,
      latestDailyReport: {
        reportId: latest?.reportId ?? null,
        reportDate: period.reportDate,
        emotionIndex: latest?.emotionIndex ?? null,
        emotionLevel: toEmotionLevel(latest?.emotionIndex ?? null),
        conversationSummary: latest?.oneLineSummary ?? null,
        recommendedAction: latest?.recommendedAction ?? null,
        generationStatus: latest?.generationStatus ?? null,
      },
      recentSevenDays: period.dates.map((date) => ({
        date,
        emotionIndex: reportByDate.get(date)?.emotionIndex ?? null,
      })),
    };
  }
}
