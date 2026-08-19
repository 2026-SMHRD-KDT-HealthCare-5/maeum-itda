/*
역할: 인증된 보호자가 연결된 시니어의 특정 날짜 일간 리포트만 조회하도록 권한과 존재 여부를 확인한다.
전체 흐름: ReportsController → DailyReportQueryService → DailyReportRepository → MySQL
*/
import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { AccessTokenPayload } from '../auth/auth.service';
import { UserRole } from '../users/entities/user.entity';
import { DailyReportResponseDto } from './dto/daily-report-response.dto';
import { mapDailyEvidenceRows } from './lib/daily-report-evidence.mapper';
import { DailyReportEvidenceRepository } from './repositories/daily-report-evidence.repository';
import { DailyReportRepository } from './repositories/daily-report.repository';
import { ReportAccessRepository } from './repositories/report-access.repository';

@Injectable()
export class DailyReportQueryService {
  constructor(
    private readonly reportAccessRepository: ReportAccessRepository,
    private readonly dailyReportRepository: DailyReportRepository,
    private readonly evidenceRepository: DailyReportEvidenceRepository,
  ) {}

  async getDailyReport(
    auth: AccessTokenPayload,
    reportDate: string,
  ): Promise<DailyReportResponseDto> {
    if (auth.role !== UserRole.GUARDIAN) {
      throw new ForbiddenException(
        '보호자만 일간 리포트를 조회할 수 있습니다.',
      );
    }

    const seniorId = await this.reportAccessRepository.findConnectedSeniorId(
      auth.sub,
    );
    if (seniorId === null) {
      throw new NotFoundException('연결된 시니어가 없습니다.');
    }

    const report = await this.dailyReportRepository.findDailyReport(
      seniorId,
      reportDate,
    );
    if (!report) {
      throw new NotFoundException('해당 날짜의 일간 리포트가 없습니다.');
    }

    const evidenceRows = await this.evidenceRepository.findRowsForReport(
      report.reportId,
    );

    // Entity 내부 연결 키는 숨기고 Swagger에 선언한 필드만 명시적으로 반환한다.
    return {
      reportId: report.reportId,
      seniorId: report.seniorId,
      reportDate: report.reportDate,
      emotionIndex: report.emotionIndex,
      conversationSummary: report.oneLineSummary,
      recommendedAction: report.recommendedAction,
      generationStatus: report.generationStatus,
      evidences: mapDailyEvidenceRows(evidenceRows),
      createdAt: report.createdAt,
    };
  }
}
