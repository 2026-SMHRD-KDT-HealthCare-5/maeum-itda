import type { Repository } from 'typeorm';
import {
  ConversationMessage,
  MessageType,
  SpeakerType,
  SttStatus,
} from '../entities/conversation-message.entity';
import { ConversationMessageRepository } from './conversation-message.repository';

describe('ConversationMessageRepository', () => {
  it('최초 AI 질문 Entity를 생성하여 저장한다', async () => {
    const createdQuestion = { messageId: 0 } as ConversationMessage;
    const savedQuestion = {
      ...createdQuestion,
      messageId: 101,
      content: '오늘 하루는 어땠나요?',
    } as ConversationMessage;
    const typeOrmRepository = {
      create: jest.fn().mockReturnValue(createdQuestion),
      save: jest.fn().mockResolvedValue(savedQuestion),
    };
    const repository = new ConversationMessageRepository(
      typeOrmRepository as unknown as Repository<ConversationMessage>,
    );

    const result = await repository.saveInitialAiQuestion(
      7,
      '오늘 하루는 어땠나요?',
    );

    expect(typeOrmRepository.create).toHaveBeenCalledWith({
      seniorId: 7,
      reportId: null,
      speakerType: SpeakerType.AI,
      messageType: MessageType.MESSAGE,
      content: '오늘 하루는 어땠나요?',
      sttStatus: SttStatus.NOT_REQUIRED,
      sttErrorMessage: null,
    });
    expect(typeOrmRepository.save).toHaveBeenCalledWith(createdQuestion);
    expect(result).toBe(savedQuestion);
  });
});
