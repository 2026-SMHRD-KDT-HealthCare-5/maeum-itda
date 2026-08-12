import type { AnalysisService } from '../analysis/analysis.service';
import { ChatsService } from './chats.service';
import type { ConversationMessageRepository } from './repositories/conversation-message.repository';

describe('ChatsService', () => {
  it('Repository 저장 결과와 generationId를 최초 질문 결과로 반환한다', async () => {
    const conversationMessageRepository = {
      saveInitialAiQuestion: jest.fn().mockResolvedValue({
        messageId: 101,
        content: '오늘 하루는 어땠나요?',
      }),
    };
    const service = new ChatsService(
      {} as AnalysisService,
      conversationMessageRepository as unknown as ConversationMessageRepository,
    );

    const result = await service.startChat(7);

    expect(
      conversationMessageRepository.saveInitialAiQuestion,
    ).toHaveBeenCalledWith(7, '오늘 하루는 어땠나요?');
    expect(result.messageId).toBe(101);
    expect(result.content).toBe('오늘 하루는 어땠나요?');
    expect(result.generationId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    );
  });
});
