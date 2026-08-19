/*
역할: 저장된 문항 분석 결과를 집계해 일간 정서 리포트를 생성·갱신한다.
전체 흐름: 내부 호출 → ReportsService → 계산기/DailyReportRepository → MySQL
[완료] REST 조회와 주간 집계는 별도 Service로 분리되어 있으며 이 Service는 일간 생성만 담당한다.
*/
import { Injectable, Logger } from '@nestjs/common';
import {
  DailyEmotionReport,
  GenerationStatus,
} from './entities/daily-emotion-report.entity';
import { calculateDailyEmotionIndex } from './lib/daily-emotion-index.calculator';
import { DailyReportRepository } from './repositories/daily-report.repository';
import { DailyReportEvidenceRepository } from './repositories/daily-report-evidence.repository';
import { DailySummaryClient } from './daily-summary.client';
import type {
  DailySummaryResult,
  DailySummaryTurn,
} from './dto/daily-summary.contract';
import { DailySummaryContextRepository } from './repositories/daily-summary-context.repository';

@Injectable()
export class ReportsService {
  private readonly logger = new Logger(ReportsService.name);

  constructor(
    private readonly dailyReportRepository: DailyReportRepository,
    private readonly evidenceRepository: DailyReportEvidenceRepository,
    private readonly summaryContextRepository: DailySummaryContextRepository,
    private readonly dailySummaryClient: DailySummaryClient,
  ) {}

  // 해당 서울 업무일의 최신 고유 문항을 집계하고 날짜별 리포트를 원자적으로 갱신한다.
  async generateDailyReport(
    seniorId: number,
    reportDate: string,
  ): Promise<DailyEmotionReport> {
    const [analyses, evidenceMessageIds, turns] = await Promise.all([
      this.dailyReportRepository.findScaleAnalysesForDay(seniorId, reportDate),
      this.evidenceRepository.findCandidateMessageIds(seniorId, reportDate),
      this.summaryContextRepository.findTurns(seniorId, reportDate),
    ]);
    const calculation = calculateDailyEmotionIndex(analyses);
    const summary = await this.generateSummarySafely(
      seniorId,
      reportDate,
      turns,
    );

    return this.dailyReportRepository.saveDailyReport(
      seniorId,
      reportDate,
      calculation.emotionIndex,
      calculation.status === 'COMPLETED'
        ? GenerationStatus.COMPLETED
        : GenerationStatus.WAITING,
      evidenceMessageIds,
      summary?.conversationSummary,
      summary?.recommendedAction,
    );
  }

  // 요약 장애는 정서지수·근거 저장을 막지 않는다. undefined는 재집계 시 기존 성공 요약을 보존한다.
  private async generateSummarySafely(
    seniorId: number,
    reportDate: string,
    turns: DailySummaryTurn[],
  ): Promise<DailySummaryResult | undefined> {
    if (turns.length === 0) {
      return { conversationSummary: null, recommendedAction: null };
    }

    try {
      return await this.dailySummaryClient.generate({
        seniorId,
        reportDate,
        turns,
      });
    } catch (error: unknown) {
      this.logger.warn(
        `일간 AI 요약 생성 실패: seniorId=${seniorId}, reportDate=${reportDate}, reason=${error instanceof Error ? error.message : String(error)}`,
      );
      return undefined;
    }
  }
}
