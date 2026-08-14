/*
역할: CONVERSATION_MESSAGE에서 cursor 과거 기록과 시니어 답변이 있는 날짜를 조회한다.
흐름: ChatHistoryQueryService -> ChatHistoryRepository -> TypeORM -> MySQL
*/
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  ConversationMessage,
  SpeakerType,
} from '../entities/conversation-message.entity';
import type { ChatDateRange } from '../lib/chat-date-range';

@Injectable()
export class ChatHistoryRepository {
  constructor(
    @InjectRepository(ConversationMessage)
    private readonly repository: Repository<ConversationMessage>,
  ) {}

  async findMessages(
    seniorId: number,
    cursor: number | undefined,
    limit: number,
    dateRange?: ChatDateRange,
  ): Promise<ConversationMessage[]> {
    const query = this.repository
      .createQueryBuilder('message')
      .where('message.SENIOR_ID = :seniorId', { seniorId })
      .orderBy('message.MESSAGE_ID', 'DESC')
      .take(limit);
    if (cursor !== undefined) {
      query.andWhere('message.MESSAGE_ID < :cursor', { cursor });
    }
    if (dateRange) {
      query
        .andWhere('message.CREATED_AT >= :start', { start: dateRange.start })
        .andWhere('message.CREATED_AT < :end', { end: dateRange.end });
    }
    const messages = await query.getMany();
    return messages.reverse();
  }

  async findConversationDates(
    seniorId: number,
    dateRange: ChatDateRange,
  ): Promise<string[]> {
    const rows = await this.repository
      .createQueryBuilder('message')
      .select(
        "DATE_FORMAT(CONVERT_TZ(message.CREATED_AT, '+00:00', '+09:00'), '%Y-%m-%d')",
        'conversationDate',
      )
      .where('message.SENIOR_ID = :seniorId', { seniorId })
      // AI 질문만 저장되고 답변이 없는 날은 실제 대화가 있었던 날로 표시하지 않는다.
      .andWhere('message.SPEAKER_TYPE = :speakerType', {
        speakerType: SpeakerType.SENIOR,
      })
      .andWhere('message.CREATED_AT >= :start', { start: dateRange.start })
      .andWhere('message.CREATED_AT < :end', { end: dateRange.end })
      .groupBy('conversationDate')
      .orderBy('conversationDate', 'ASC')
      .getRawMany<{ conversationDate: string }>();
    return rows.map((row) => row.conversationDate);
  }
}
