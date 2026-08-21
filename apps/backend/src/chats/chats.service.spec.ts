import { ChatsService } from './chats.service';
import { SpeakerType } from './entities/conversation-message.entity';
import type { ConversationMessageRepository } from './repositories/conversation-message.repository';

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

function createRepository(
  overrides: Partial<{
    findLatestMessageToday: jest.Mock;
    saveInitialAiQuestion: jest.Mock;
  }> = {},
) {
  return {
    findLatestMessageToday: jest.fn().mockResolvedValue(null),
    saveInitialAiQuestion: jest.fn().mockResolvedValue({
      messageId: 101,
      content: '오늘 하루는 어땠나요?',
    }),
    ...overrides,
  };
}

describe('ChatsService', () => {
  it('오늘 대화가 없으면 새 질문을 저장하고 generationId와 함께 반환한다', async () => {
    const conversationMessageRepository = createRepository();
    const service = new ChatsService(
      conversationMessageRepository as unknown as ConversationMessageRepository,
    );

    const result = await service.startChat(7);

    expect(
      conversationMessageRepository.findLatestMessageToday,
    ).toHaveBeenCalledWith(7, expect.any(Date), expect.any(Date));
    expect(
      conversationMessageRepository.saveInitialAiQuestion,
    ).toHaveBeenCalledWith(7, '오늘 하루는 어땠나요?');
    expect(result.messageId).toBe(101);
    expect(result.content).toBe('오늘 하루는 어땠나요?');
    expect(result.generationId).toMatch(UUID_PATTERN);
  });

  it('오늘 마지막 메시지가 아직 답변되지 않은 AI 질문이면 새로 만들지 않고 그대로 재사용한다', async () => {
    const conversationMessageRepository = createRepository({
      findLatestMessageToday: jest.fn().mockResolvedValue({
        messageId: 205,
        speakerType: SpeakerType.AI,
        content: '산책하면서 무엇이 좋으셨어요?',
      }),
    });
    const service = new ChatsService(
      conversationMessageRepository as unknown as ConversationMessageRepository,
    );

    const result = await service.startChat(7);

    expect(
      conversationMessageRepository.saveInitialAiQuestion,
    ).not.toHaveBeenCalled();
    expect(result.messageId).toBe(205);
    expect(result.content).toBe('산책하면서 무엇이 좋으셨어요?');
    expect(result.generationId).toMatch(UUID_PATTERN);
  });

  it('오늘 마지막 메시지가 시니어 답변이면(이미 답변됨) 새 질문을 만든다', async () => {
    const conversationMessageRepository = createRepository({
      findLatestMessageToday: jest.fn().mockResolvedValue({
        messageId: 206,
        speakerType: SpeakerType.SENIOR,
        content: '오늘 산책했어요.',
      }),
    });
    const service = new ChatsService(
      conversationMessageRepository as unknown as ConversationMessageRepository,
    );

    const result = await service.startChat(7);

    expect(
      conversationMessageRepository.saveInitialAiQuestion,
    ).toHaveBeenCalledWith(7, '오늘 하루는 어땠나요?');
    expect(result.messageId).toBe(101);
  });
});
