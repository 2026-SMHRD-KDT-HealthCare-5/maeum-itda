/*
역할: DAILY_REPORT_EVIDENCE의 집계 대상 선정·교체·보호자 조회를 담당한다.
흐름: ReportsService/QueryService -> DailyReportEvidenceRepository -> 메시지·분석 테이블 -> MySQL
정책: 척도 분석 또는 감성 태그가 있는 시니어 답변을 근거로 포함한다.
*/
import { Injectable } from '@nestjs/common';
import { DataSource, EntityManager } from 'typeorm';
import {
  ScaleQuestionAnalysis,
  ScaleType,
} from '../../analysis/entities/scale-question-analysis.entity';
import {
  EmotionTag,
  SentimentLabel,
} from '../../analysis/entities/emotion-tag.entity';
import {
  ConversationMessage,
  SpeakerType,
} from '../../chats/entities/conversation-message.entity';
import {
  MessageRelationship,
  MessageRelationshipType,
} from '../../chats/entities/message-relationship.entity';
import { DailyReportEvidence } from '../entities/daily-report-evidence.entity';
import { toSeoulBusinessDayUtcRange } from '../lib/seoul-business-date';

export interface DailyEvidenceRawRow {
  answerMessageId: number;
  question: string | null;
  answer: string;
  questionCreatedAt: Date | null;
  answerCreatedAt: Date;
  scaleType: ScaleType | null;
  analysisScore: number | null;
  sentimentLabel: SentimentLabel | null;
}

@Injectable()
export class DailyReportEvidenceRepository {
  constructor(private readonly dataSource: DataSource) {}

  async findCandidateMessageIds(
    seniorId: number,
    reportDate: string,
  ): Promise<number[]> {
    const { start, end } = toSeoulBusinessDayUtcRange(reportDate);
    const rows = await this.dataSource
      .getRepository(ConversationMessage)
      .createQueryBuilder('message')
      .select('message.MESSAGE_ID', 'messageId')
      .where('message.SENIOR_ID = :seniorId', { seniorId })
      .andWhere('message.SPEAKER_TYPE = :speakerType', {
        speakerType: SpeakerType.SENIOR,
      })
      .andWhere('message.CREATED_AT >= :start', { start })
      .andWhere('message.CREATED_AT < :end', { end })
      .andWhere(
        `(
          EXISTS (
            SELECT 1 FROM SCALE_QUESTION_ANALYSIS scale
            WHERE scale.MESSAGE_ID = message.MESSAGE_ID
          )
          OR EXISTS (
            SELECT 1 FROM EMOTION_TAG emotion
            WHERE emotion.MESSAGE_ID = message.MESSAGE_ID
          )
        )`,
      )
      .orderBy('message.MESSAGE_ID', 'ASC')
      .getRawMany<{ messageId: number | string }>();

    return rows.map((row) => Number(row.messageId));
  }

  async replaceForReport(
    manager: EntityManager,
    reportId: number,
    messageIds: number[],
  ): Promise<void> {
    const repository = manager.getRepository(DailyReportEvidence);
    await repository.delete({ reportId });
    const uniqueMessageIds = [...new Set(messageIds)];
    if (uniqueMessageIds.length === 0) {
      return;
    }

    // 복합 PK(REPORT_ID, MESSAGE_ID)가 재생성·중복 입력을 최종적으로도 차단한다.
    await repository.insert(
      uniqueMessageIds.map((messageId) => ({ reportId, messageId })),
    );
  }

  async findRowsForReport(reportId: number): Promise<DailyEvidenceRawRow[]> {
    return this.dataSource
      .getRepository(DailyReportEvidence)
      .createQueryBuilder('evidence')
      .innerJoin(
        ConversationMessage,
        'answer',
        'answer.MESSAGE_ID = evidence.MESSAGE_ID',
      )
      .leftJoin(
        MessageRelationship,
        'relationship',
        `relationship.TARGET_MESSAGE_ID = answer.MESSAGE_ID
         AND relationship.RELATIONSHIP_TYPE IN (:...relationshipTypes)`,
        {
          relationshipTypes: [
            MessageRelationshipType.ANSWER,
            MessageRelationshipType.ADDITIONAL_ANSWER,
          ],
        },
      )
      .leftJoin(
        ConversationMessage,
        'question',
        'question.MESSAGE_ID = relationship.SOURCE_MESSAGE_ID',
      )
      .leftJoin(
        ScaleQuestionAnalysis,
        'scale',
        'scale.MESSAGE_ID = answer.MESSAGE_ID',
      )
      .leftJoin(EmotionTag, 'emotion', 'emotion.MESSAGE_ID = answer.MESSAGE_ID')
      .select('answer.MESSAGE_ID', 'answerMessageId')
      .addSelect('question.CONTENT', 'question')
      .addSelect('answer.CONTENT', 'answer')
      .addSelect('question.CREATED_AT', 'questionCreatedAt')
      .addSelect('answer.CREATED_AT', 'answerCreatedAt')
      .addSelect('scale.SCALE_TYPE', 'scaleType')
      .addSelect('scale.ANALYSIS_SCORE', 'analysisScore')
      .addSelect('emotion.SENTIMENT_LABEL', 'sentimentLabel')
      .where('evidence.REPORT_ID = :reportId', { reportId })
      .andWhere('answer.CONTENT IS NOT NULL')
      .orderBy('answer.CREATED_AT', 'ASC')
      .addOrderBy('answer.MESSAGE_ID', 'ASC')
      .addOrderBy('scale.SCALE_ANALYSIS_ID', 'ASC')
      .getRawMany<DailyEvidenceRawRow>();
  }
}
