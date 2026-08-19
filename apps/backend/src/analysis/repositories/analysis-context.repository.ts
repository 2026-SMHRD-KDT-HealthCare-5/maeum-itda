/*
역할: FastAPI 질문 생성에 필요한 오늘의 미채점 문항, 이전 요약, 최근 대화 5개를 조회한다.
전체 흐름: AnalysisService → AnalysisContextRepository → MySQL → AiClient
주의: 별도 대화 세션 ID가 없으므로 최근 대화는 현재 질문과 같은 서울 날짜로 제한한다.
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

const SCALE_QUESTION_COUNTS: Record<ScaleType, number> = {
  [ScaleType.SGDS_K]: 15,
  [ScaleType.GAD_7]: 7,
  [ScaleType.LSNS_6]: 6,
};
const RECENT_TURN_LIMIT = 5;

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

    const [scoredItems, previousReport, recentMessages] = await Promise.all([
      this.findScoredItems(batch.seniorId, start, end),
      this.findPreviousSummary(batch.seniorId, reportDate),
      this.findRecentMessages(
        batch.seniorId,
        batch.questionMessageId,
        start,
        end,
      ),
    ]);

    return {
      pendingScaleItems: buildPendingScaleItems(scoredItems),
      prevSessionSummary: previousReport?.oneLineSummary ?? '',
      conversationTurns: recentMessages.reverse().map((message) => ({
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

  private findPreviousSummary(seniorId: number, reportDate: string) {
    return this.dataSource
      .getRepository(DailyEmotionReport)
      .createQueryBuilder('report')
      .where('report.seniorId = :seniorId', { seniorId })
      .andWhere('report.reportDate < :reportDate', { reportDate })
      .andWhere('report.oneLineSummary IS NOT NULL')
      .orderBy('report.reportDate', 'DESC')
      .getOne();
  }

  private findRecentMessages(
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
      .take(RECENT_TURN_LIMIT)
      .getMany();
  }

  // 역할: 재진입 시 오늘 마지막 메시지가 시니어 답변으로 끝났을 때, 새 음성
  // 답변 없이 기존 문맥만으로 이어갈 질문을 생성하는 데 쓸 컨텍스트를 조회한다.
  // findForBatch와 달리 기준이 될 AI 질문 메시지가 없으므로 reportDate를
  // 직접 받고, messageId 상한 없이 오늘 범위의 최신 메시지를 그대로 가져온다.
  async findForResume(
    seniorId: number,
    reportDate: string,
  ): Promise<AnalysisRequestContext> {
    const { start, end } = toSeoulBusinessDayUtcRange(reportDate);

    const [scoredItems, previousReport, recentMessages] = await Promise.all([
      this.findScoredItems(seniorId, start, end),
      this.findPreviousSummary(seniorId, reportDate),
      this.dataSource
        .getRepository(ConversationMessage)
        .createQueryBuilder('message')
        .where('message.seniorId = :seniorId', { seniorId })
        .andWhere('message.createdAt >= :start', { start })
        .andWhere('message.createdAt < :end', { end })
        .andWhere('message.content IS NOT NULL')
        .orderBy('message.createdAt', 'DESC')
        .addOrderBy('message.messageId', 'DESC')
        .take(RECENT_TURN_LIMIT)
        .getMany(),
    ]);

    return {
      pendingScaleItems: buildPendingScaleItems(scoredItems),
      prevSessionSummary: previousReport?.oneLineSummary ?? '',
      conversationTurns: recentMessages.reverse().map((message) => ({
        speakerType: message.speakerType,
        content: message.content!,
      })),
    };
  }
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
