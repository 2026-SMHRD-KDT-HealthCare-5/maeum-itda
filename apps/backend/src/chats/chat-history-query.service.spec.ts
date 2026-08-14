import { ForbiddenException } from '@nestjs/common';
import { UserRole } from '../users/entities/user.entity';
import { ChatHistoryQueryService } from './chat-history-query.service';
import {
  ConversationMessage,
  SpeakerType,
  SttStatus,
} from './entities/conversation-message.entity';
import type { ChatHistoryRepository } from './repositories/chat-history.repository';

describe('ChatHistoryQueryService', () => {
  const senior = { sub: 9, role: UserRole.SENIOR };

  function createService() {
    const repository = {
      findMessages: jest.fn(),
      findConversationDates: jest.fn(),
    };
    return {
      service: new ChatHistoryQueryService(
        repository as unknown as ChatHistoryRepository,
      ),
      repository,
    };
  }

  it('선택한 서울 날짜 범위로 대화를 조회한다', async () => {
    const { service, repository } = createService();
    repository.findMessages.mockResolvedValue([
      {
        messageId: 101,
        seniorId: 9,
        speakerType: SpeakerType.AI,
        content: '오늘 하루는 어땠나요?',
        sttStatus: SttStatus.NOT_REQUIRED,
        sttErrorMessage: null,
        createdAt: new Date('2026-08-13T01:00:00.000Z'),
      } satisfies ConversationMessage,
    ]);

    const result = await service.getMessages(senior, {
      date: '2026-08-13',
      limit: 30,
    });

    expect(repository.findMessages).toHaveBeenCalledWith(9, undefined, 31, {
      start: new Date('2026-08-12T15:00:00.000Z'),
      end: new Date('2026-08-13T15:00:00.000Z'),
    });
    expect(result.messages[0]).toMatchObject({
      messageId: 101,
      speakerType: SpeakerType.AI,
    });
    expect(result.nextCursor).toBeNull();
  });

  it('date가 없으면 기존 전체 과거 대화 조회를 유지한다', async () => {
    const { service, repository } = createService();
    repository.findMessages.mockResolvedValue([]);

    await service.getMessages(senior, { cursor: 100, limit: 30 });

    expect(repository.findMessages).toHaveBeenCalledWith(9, 100, 31, undefined);
  });

  it('실제 다음 메시지가 있을 때만 nextCursor를 반환한다', async () => {
    const { service, repository } = createService();
    const message = (messageId: number): ConversationMessage => ({
      messageId,
      seniorId: 9,
      speakerType: SpeakerType.AI,
      content: `질문 ${messageId}`,
      sttStatus: SttStatus.NOT_REQUIRED,
      sttErrorMessage: null,
      createdAt: new Date('2026-08-13T01:00:00.000Z'),
    });
    // Repository는 최신 2건을 화면 표시 순서로 뒤집어 반환한다.
    repository.findMessages.mockResolvedValue([message(4), message(5)]);

    const firstPage = await service.getMessages(senior, { limit: 1 });

    expect(repository.findMessages).toHaveBeenCalledWith(
      9,
      undefined,
      2,
      undefined,
    );
    expect(firstPage.messages.map(({ messageId }) => messageId)).toEqual([5]);
    expect(firstPage.nextCursor).toBe(5);

    repository.findMessages.mockResolvedValue([message(4)]);
    const lastPage = await service.getMessages(senior, {
      cursor: 5,
      limit: 1,
    });

    expect(lastPage.messages.map(({ messageId }) => messageId)).toEqual([4]);
    expect(lastPage.nextCursor).toBeNull();
  });

  it('시니어 답변이 존재하는 날짜 목록을 반환한다', async () => {
    const { service, repository } = createService();
    repository.findConversationDates.mockResolvedValue([
      '2026-08-03',
      '2026-08-13',
    ]);

    const result = await service.getCalendar(senior, 2026, 8);

    expect(result).toEqual({
      year: 2026,
      month: 8,
      conversationDates: ['2026-08-03', '2026-08-13'],
    });
  });

  it('보호자 계정의 원문 대화 조회를 거부한다', async () => {
    const { service, repository } = createService();

    await expect(
      service.getMessages({ sub: 10, role: UserRole.GUARDIAN }, { limit: 30 }),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(repository.findMessages).not.toHaveBeenCalled();
  });
});
