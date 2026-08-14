/* 역할: 저장된 주간 리포트와 화면에 필요한 월~일 일간 리포트를 조회한다. */
import { Injectable } from '@nestjs/common';
import { Between, DataSource } from 'typeorm';
import {
  DailyEmotionReport,
  GenerationStatus,
} from '../entities/daily-emotion-report.entity';
import { WeeklyEmotionReport } from '../entities/weekly-emotion-report.entity';

@Injectable()
export class WeeklyReportRepository {
  constructor(private readonly dataSource: DataSource) {}

  findWeeklyReport(
    seniorId: number,
    weekStart: string,
  ): Promise<WeeklyEmotionReport | null> {
    return this.dataSource.getRepository(WeeklyEmotionReport).findOne({
      where: { seniorId, startDate: weekStart },
    });
  }

  findDailyReports(
    seniorId: number,
    weekStart: string,
    weekEnd: string,
  ): Promise<DailyEmotionReport[]> {
    return this.dataSource.getRepository(DailyEmotionReport).find({
      where: { seniorId, reportDate: Between(weekStart, weekEnd) },
      order: { reportDate: 'ASC' },
    });
  }

  async saveWeeklyReport(
    seniorId: number,
    weekStart: string,
    weekEnd: string,
    weeklySummary: string,
    generationStatus: GenerationStatus,
  ): Promise<WeeklyEmotionReport> {
    return this.dataSource.transaction(async (manager) => {
      const weeklyRepository = manager.getRepository(WeeklyEmotionReport);
      await weeklyRepository.upsert(
        {
          seniorId,
          startDate: weekStart,
          weeklySummary,
          generationStatus,
        },
        ['seniorId', 'startDate'],
      );
      const weeklyReport = await weeklyRepository.findOneByOrFail({
        seniorId,
        startDate: weekStart,
      });

      // 월~일 일간 결과가 주간 리포트 상세의 원본임을 FK 값으로 함께 기록한다.
      await manager
        .getRepository(DailyEmotionReport)
        .update(
          { seniorId, reportDate: Between(weekStart, weekEnd) },
          { weeklyReportId: weeklyReport.weeklyReportId },
        );
      return weeklyReport;
    });
  }
}
