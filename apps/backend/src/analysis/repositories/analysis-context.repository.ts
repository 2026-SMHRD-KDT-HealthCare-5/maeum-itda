/*
역할: FastAPI 질문 생성에 필요한 오늘의 미채점 문항, 최근 N일 요약, 오늘 대화 전체를 조회한다.
전체 흐름: AnalysisService → AnalysisContextRepository → MySQL → AiClient
주의: 별도 대화 세션 ID가 없으므로 대화 히스토리는 현재 질문과 같은 서울 날짜로 제한한다.
*/
import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import type {
  ConversationTurn,
  QuestionAnswerBatch,
} from '../dto/audio-analysis.contract';
import {
  ScaleQuestionAnalysis,
  ScaleType,
} from '../entities/scale-question-analysis.entity';
import {
  ConversationMessage,
  SpeakerType,
} from '../../chats/entities/conversation-message.entity';
import { DailyEmotionReport } from '../../reports/entities/daily-emotion-report.entity';
import { toSeoulBusinessDayUtcRange } from '../../reports/lib/seoul-business-date';

// 척도별 전체 문항 정원 — daily-emotion-index.calculator.ts도 정서지수 분모로 재사용한다.
export const SCALE_QUESTION_COUNTS: Record<ScaleType, number> = {
  [ScaleType.SGDS_K]: 15,
  [ScaleType.GAD_7]: 7,
  [ScaleType.LSNS_6]: 6,
};
// 이전 세션 요약은 리포트가 있는 최근 N일치를 이어 붙여 보낸다(직전 하루만 주던 것에서 확장).
const PREV_SUMMARY_DAYS_LIMIT = 3;

export interface AnalysisRequestContext {
  pendingScaleItems: Record<ScaleType, string[]>;
  prevSessionSummary: string;
  conversationTurns: ConversationTurn[];
}

@Injectable()
export class AnalysisContextRepository {
  constructor(private readonly dataSource: DataSource) {}

  async findForBatch(
    batch: QuestionAnswerBatch,
  ): Promise<AnalysisRequestContext> {
    const question = await this.dataSource
      .getRepository(ConversationMessage)
      .findOneByOrFail({
        messageId: batch.questionMessageId,
        seniorId: batch.seniorId,
        speakerType: SpeakerType.AI,
      });
    const reportDate = formatSeoulDate(question.createdAt);
    const { start, end } = toSeoulBusinessDayUtcRange(reportDate);

    const [scoredItems, previousReports, todayMessages] = await Promise.all([
      this.findScoredItems(batch.seniorId, start, end),
      this.findPreviousSummaries(batch.seniorId, reportDate),
      this.findTodayMessages(
        batch.seniorId,
        batch.questionMessageId,
        start,
        end,
      ),
    ]);

    return {
      pendingScaleItems: buildPendingScaleItems(scoredItems),
      prevSessionSummary: buildPrevSessionSummary(previousReports),
      conversationTurns: todayMessages.reverse().map((message) => ({
        speakerType: message.speakerType,
        content: message.content!,
      })),
    };
  }

  private findScoredItems(seniorId: number, start: Date, end: Date) {
    return this.dataSource
      .getRepository(ScaleQuestionAnalysis)
      .createQueryBuilder('scale')
      .select('scale.scaleType', 'scaleType')
      .addSelect('scale.questionNumber', 'questionNumber')
      .innerJoin(
        ConversationMessage,
        'message',
        'message.messageId = scale.messageId',
      )
      .where('message.seniorId = :seniorId', { seniorId })
      .andWhere('message.createdAt >= :start', { start })
      .andWhere('message.createdAt < :end', { end })
      .distinct(true)
      .getRawMany<{ scaleType: ScaleType; questionNumber: number }>();
  }

  private findPreviousSummaries(seniorId: number, reportDate: string) {
    return this.dataSource
      .getRepository(DailyEmotionReport)
      .createQueryBuilder('report')
      .where('report.seniorId = :seniorId', { seniorId })
      .andWhere('report.reportDate < :reportDate', { reportDate })
      .andWhere('report.oneLineSummary IS NOT NULL')
      .orderBy('report.reportDate', 'DESC')
      .take(PREV_SUMMARY_DAYS_LIMIT)
      .getMany();
  }

  // 오늘 대화 전체(질문 시점까지)를 히스토리로 넘긴다 — 개수 제한 없음.
  private findTodayMessages(
    seniorId: number,
    questionMessageId: number,
    start: Date,
    end: Date,
  ) {
    return this.dataSource
      .getRepository(ConversationMessage)
      .createQueryBuilder('message')
      .where('message.seniorId = :seniorId', { seniorId })
      .andWhere('message.messageId <= :questionMessageId', {
        questionMessageId,
      })
      .andWhere('message.createdAt >= :start', { start })
      .andWhere('message.createdAt < :end', { end })
      .andWhere('message.content IS NOT NULL')
      .orderBy('message.createdAt', 'DESC')
      .addOrderBy('message.messageId', 'DESC')
      .getMany();
  }
}

// 리포트가 있는 최근 N일 요약을 오래된 날짜부터 이어 붙인다(리포트가 없는 날은 자연히 빈다).
export function buildPrevSessionSummary(reports: DailyEmotionReport[]): string {
  return reports
    .slice()
    .reverse()
    .map((report) => `[${report.reportDate}] ${report.oneLineSummary}`)
    .join('\n');
}

export function buildPendingScaleItems(
  scoredItems: Array<{ scaleType: ScaleType; questionNumber: number }>,
): Record<ScaleType, string[]> {
  const scoredKeys = new Set(
    scoredItems.map(
      ({ scaleType, questionNumber }) => `${scaleType}:${questionNumber}`,
    ),
  );

  return Object.fromEntries(
    Object.entries(SCALE_QUESTION_COUNTS).map(([scaleType, count]) => [
      scaleType,
      Array.from({ length: count }, (_, index) => String(index + 1)).filter(
        (questionNumber) => !scoredKeys.has(`${scaleType}:${questionNumber}`),
      ),
    ]),
  ) as Record<ScaleType, string[]>;
}

function formatSeoulDate(value: Date): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(value);
}
