/*
역할: 저장된 문항 분석 결과를 집계해 일간 정서 리포트를 생성·갱신한다.
전체 흐름: 내부 호출 → ReportsService → 계산기/DailyReportRepository → MySQL
주의: REST 조회 진입점과 주간 집계는 이후 별도로 연결한다.
*/
import { Injectable } from '@nestjs/common';
import {
  DailyEmotionReport,
  GenerationStatus,
} from './entities/daily-emotion-report.entity';
import { calculateDailyEmotionIndex } from './lib/daily-emotion-index.calculator';
import { DailyReportRepository } from './repositories/daily-report.repository';

@Injectable()
export class ReportsService {
  constructor(private readonly dailyReportRepository: DailyReportRepository) {}

  // 해당 서울 업무일의 최신 고유 문항을 집계하고 날짜별 리포트를 원자적으로 갱신한다.
  async generateDailyReport(
    seniorId: number,
    reportDate: string,
  ): Promise<DailyEmotionReport> {
    const analyses = await this.dailyReportRepository.findScaleAnalysesForDay(
      seniorId,
      reportDate,
    );
    const calculation = calculateDailyEmotionIndex(analyses);

    return this.dailyReportRepository.saveDailyReport(
      seniorId,
      reportDate,
      calculation.emotionIndex,
      calculation.status === 'COMPLETED'
        ? GenerationStatus.COMPLETED
        : GenerationStatus.WAITING,
    );
  }
}
