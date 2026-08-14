/*
역할: 시니어 본인의 전체·날짜별 과거 대화와 대화 날짜 달력을 조회한다.
주의: 보호자는 이 API로 시니어 원문 대화를 조회할 수 없다.
*/
import { ForbiddenException, Injectable } from '@nestjs/common';
import type { AccessTokenPayload } from '../auth/auth.service';
import { UserRole } from '../users/entities/user.entity';
import { ChatCalendarResponseDto } from './dto/chat-calendar.dto';
import { ChatHistoryQueryDto } from './dto/chat-history-query.dto';
import { ChatHistoryPageResponseDto } from './dto/chat-history-response.dto';
import { toChatDayUtcRange, toChatMonthUtcRange } from './lib/chat-date-range';
import { ChatHistoryRepository } from './repositories/chat-history.repository';

@Injectable()
export class ChatHistoryQueryService {
  constructor(private readonly historyRepository: ChatHistoryRepository) {}

  async getMessages(
    auth: AccessTokenPayload,
    query: ChatHistoryQueryDto,
  ): Promise<ChatHistoryPageResponseDto> {
    this.requireSenior(auth);
    const messages = await this.historyRepository.findMessages(
      auth.sub,
      query.cursor,
      query.limit + 1,
      query.date ? toChatDayUtcRange(query.date) : undefined,
    );
    const hasNextPage = messages.length > query.limit;
    const pageMessages = hasNextPage
      ? messages.slice(messages.length - query.limit)
      : messages;
    return {
      messages: pageMessages.map((message) => ({
        messageId: message.messageId,
        speakerType: message.speakerType,
        content: message.content,
        sttStatus: message.sttStatus,
        createdAt: message.createdAt,
      })),
      nextCursor:
        hasNextPage && pageMessages.length > 0
          ? (pageMessages[0]?.messageId ?? null)
          : null,
    };
  }

  async getCalendar(
    auth: AccessTokenPayload,
    year: number,
    month: number,
  ): Promise<ChatCalendarResponseDto> {
    this.requireSenior(auth);
    const conversationDates =
      await this.historyRepository.findConversationDates(
        auth.sub,
        toChatMonthUtcRange(year, month),
      );
    return { year, month, conversationDates };
  }

  private requireSenior(auth: AccessTokenPayload): void {
    if (auth.role !== UserRole.SENIOR) {
      throw new ForbiddenException(
        '시니어 계정만 이전 대화를 조회할 수 있습니다.',
      );
    }
  }
}
