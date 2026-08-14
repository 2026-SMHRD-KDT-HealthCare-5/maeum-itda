/*
역할: 서울 업무일에 해당하는 척도 분석 결과를 조회하고 일간 정서 리포트를 날짜별로 저장한다.
전체 흐름: ReportsService → DailyReportRepository → TypeORM → MySQL
주의: 계산 정책은 포함하지 않고 UTC 조회 범위와 (seniorId, reportDate) upsert만 담당한다.
*/
import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { ScaleQuestionAnalysis } from '../../analysis/entities/scale-question-analysis.entity';
import {
  ConversationMessage,
  SpeakerType,
} from '../../chats/entities/conversation-message.entity';
import {
  DailyEmotionReport,
  GenerationStatus,
} from '../entities/daily-emotion-report.entity';
import { DailyScaleAnalysisInput } from '../lib/daily-emotion-index.calculator';
import { toSeoulBusinessDayUtcRange } from '../lib/seoul-business-date';

@Injectable()
export class DailyReportRepository {
  constructor(private readonly dataSource: DataSource) {}

  async findScaleAnalysesForDay(
    seniorId: number,
    reportDate: string,
  ): Promise<DailyScaleAnalysisInput[]> {
    const { start, end } = toSeoulBusinessDayUtcRange(reportDate);
    const analyses = await this.dataSource
      .getRepository(ScaleQuestionAnalysis)
      .createQueryBuilder('scale')
      .innerJoin(
        ConversationMessage,
        'message',
        'message.messageId = scale.messageId',
      )
      .where('message.seniorId = :seniorId', { seniorId })
      // 척도 결과가 연결된 시니어 답변 메시지의 CREATED_AT을 answeredAt으로 사용한다.
      .andWhere('message.speakerType = :speakerType', {
        speakerType: SpeakerType.SENIOR,
      })
      .andWhere('message.createdAt >= :start', { start })
      .andWhere('message.createdAt < :end', { end })
      .getMany();

    return analyses.map((analysis) => ({
      scaleAnalysisId: analysis.scaleAnalysisId,
      scaleType: analysis.scaleType,
      questionNumber: analysis.questionNumber,
      analysisScore: analysis.analysisScore as 0 | 1,
      analyzedAt: analysis.analyzedAt,
    }));
  }

  async saveDailyReport(
    seniorId: number,
    reportDate: string,
    emotionIndex: number | null,
    generationStatus: GenerationStatus,
  ): Promise<DailyEmotionReport> {
    const repository = this.dataSource.getRepository(DailyEmotionReport);
    await repository.upsert(
      { seniorId, reportDate, emotionIndex, generationStatus },
      ['seniorId', 'reportDate'],
    );
    return repository.findOneByOrFail({ seniorId, reportDate });
  }
}
