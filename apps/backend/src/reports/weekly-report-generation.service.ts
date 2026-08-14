/*
역할: 저장된 월~일 일간 리포트에서 유효 날짜만 집계해 주간 리포트를 생성·갱신한다.
전체 흐름: 정기 실행 조정 Service → WeeklyReportGenerationService → 통계 계산기 → WeeklyReportRepository
*/
import { Injectable } from '@nestjs/common';
import { GenerationStatus } from './entities/daily-emotion-report.entity';
import { WeeklyEmotionReport } from './entities/weekly-emotion-report.entity';
import { toWeeklyReportPeriod } from './lib/weekly-report-period';
import { calculateWeeklyReportStatistics } from './lib/weekly-report-statistics';
import { WeeklyReportRepository } from './repositories/weekly-report.repository';

@Injectable()
export class WeeklyReportGenerationService {
  constructor(
    private readonly weeklyReportRepository: WeeklyReportRepository,
  ) {}

  async generateWeeklyReport(
    seniorId: number,
    weekStart: string,
  ): Promise<WeeklyEmotionReport> {
    const period = toWeeklyReportPeriod(weekStart);
    const dailyReports = await this.weeklyReportRepository.findDailyReports(
      seniorId,
      period.weekStart,
      period.weekEnd,
    );
    const scores = dailyReports.map((report) =>
      report.generationStatus === GenerationStatus.COMPLETED
        ? report.emotionIndex
        : null,
    );
    const statistics = calculateWeeklyReportStatistics(scores);
    const completed = statistics.averageScore !== null;

    // FastAPI 주간 문장 생성 연동 전까지 통계 기반의 사실 문장만 저장하고 과도한 해석은 하지 않는다.
    const weeklySummary = completed
      ? `${statistics.validDays}일의 정서지수 평균은 ${statistics.averageScore}점입니다.`
      : '주간 리포트를 생성하기에 데이터가 부족합니다.';

    return this.weeklyReportRepository.saveWeeklyReport(
      seniorId,
      period.weekStart,
      period.weekEnd,
      weeklySummary,
      completed ? GenerationStatus.COMPLETED : GenerationStatus.WAITING,
    );
  }
}
