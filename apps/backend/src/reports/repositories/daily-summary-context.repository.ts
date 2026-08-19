/*
역할: FastAPI 일간 요약 요청에 사용할 서울 업무일 기준 대화와 감정 라벨을 시간순으로 조회한다.
전체 흐름: ReportsService -> DailySummaryContextRepository -> CONVERSATION_MESSAGE/EMOTION_TAG
*/
import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import {
  EmotionTag,
  SentimentLabel,
} from '../../analysis/entities/emotion-tag.entity';
import {
  ConversationMessage,
  SpeakerType,
} from '../../chats/entities/conversation-message.entity';
import type { DailySummaryTurn } from '../dto/daily-summary.contract';
import { toSeoulBusinessDayUtcRange } from '../lib/seoul-business-date';

interface DailySummaryTurnRow {
  speakerType: SpeakerType;
  content: string;
  sentimentLabel: SentimentLabel | null;
}

@Injectable()
export class DailySummaryContextRepository {
  constructor(private readonly dataSource: DataSource) {}

  async findTurns(
    seniorId: number,
    reportDate: string,
  ): Promise<DailySummaryTurn[]> {
    const { start, end } = toSeoulBusinessDayUtcRange(reportDate);
    const rows = await this.dataSource
      .getRepository(ConversationMessage)
      .createQueryBuilder('message')
      .leftJoin(
        EmotionTag,
        'emotion',
        'emotion.MESSAGE_ID = message.MESSAGE_ID',
      )
      .select('message.SPEAKER_TYPE', 'speakerType')
      .addSelect('message.CONTENT', 'content')
      .addSelect('emotion.SENTIMENT_LABEL', 'sentimentLabel')
      .where('message.SENIOR_ID = :seniorId', { seniorId })
      .andWhere('message.CREATED_AT >= :start', { start })
      .andWhere('message.CREATED_AT < :end', { end })
      .andWhere('message.CONTENT IS NOT NULL')
      .andWhere("TRIM(message.CONTENT) <> ''")
      .orderBy('message.CREATED_AT', 'ASC')
      .addOrderBy('message.MESSAGE_ID', 'ASC')
      .getRawMany<DailySummaryTurnRow>();

    return rows.map((row) => ({
      speakerType: row.speakerType,
      content: row.content,
      sentimentLabel: row.sentimentLabel,
    }));
  }
}
