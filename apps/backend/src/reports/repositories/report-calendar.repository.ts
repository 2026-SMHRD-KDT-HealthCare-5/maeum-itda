/*
역할: 연결된 시니어의 월간 일간 리포트와 해당 월에 겹치는 주간 리포트를 조회한다.
흐름: ReportCalendarQueryService -> ReportCalendarRepository -> 리포트 테이블 -> MySQL
*/
import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import {
  DailyEmotionReport,
  GenerationStatus,
} from '../entities/daily-emotion-report.entity';
import { WeeklyEmotionReport } from '../entities/weekly-emotion-report.entity';

export interface DailyReportCalendarRow {
  reportId: number;
  reportDate: string | Date;
  generationStatus: GenerationStatus;
}

export interface WeeklyReportCalendarRow {
  weeklyReportId: number;
  startDate: string | Date;
  generationStatus: GenerationStatus;
}

@Injectable()
export class ReportCalendarRepository {
  constructor(private readonly dataSource: DataSource) {}

  findDailyReports(
    seniorId: number,
    monthStart: string,
    nextMonthStart: string,
  ): Promise<DailyReportCalendarRow[]> {
    return this.dataSource
      .getRepository(DailyEmotionReport)
      .createQueryBuilder('report')
      .select('report.REPORT_ID', 'reportId')
      .addSelect('report.REPORT_DATE', 'reportDate')
      .addSelect('report.GENERATION_STATUS', 'generationStatus')
      .where('report.SENIOR_ID = :seniorId', { seniorId })
      .andWhere('report.REPORT_DATE >= :monthStart', { monthStart })
      .andWhere('report.REPORT_DATE < :nextMonthStart', { nextMonthStart })
      .orderBy('report.REPORT_DATE', 'ASC')
      .getRawMany<DailyReportCalendarRow>();
  }

  findWeeklyReportsOverlappingMonth(
    seniorId: number,
    monthStart: string,
    nextMonthStart: string,
  ): Promise<WeeklyReportCalendarRow[]> {
    return (
      this.dataSource
        .getRepository(WeeklyEmotionReport)
        .createQueryBuilder('report')
        .select('report.WEEKLY_REPORT_ID', 'weeklyReportId')
        .addSelect('report.START_DATE', 'startDate')
        .addSelect('report.GENERATION_STATUS', 'generationStatus')
        .where('report.SENIOR_ID = :seniorId', { seniorId })
        // 월 경계에 걸친 월~일 리포트도 달력에서 선택할 수 있도록 겹침 범위로 조회한다.
        .andWhere('report.START_DATE < :nextMonthStart', { nextMonthStart })
        .andWhere(
          'DATE_ADD(report.START_DATE, INTERVAL 6 DAY) >= :monthStart',
          {
            monthStart,
          },
        )
        .orderBy('report.START_DATE', 'ASC')
        .getRawMany<WeeklyReportCalendarRow>()
    );
  }
}
