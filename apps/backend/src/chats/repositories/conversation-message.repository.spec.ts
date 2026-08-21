import type { Repository } from 'typeorm';
import {
  ConversationMessage,
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
      speakerType: SpeakerType.AI,
      content: '오늘 하루는 어땠나요?',
      sttStatus: SttStatus.NOT_REQUIRED,
      sttErrorMessage: null,
    });
    expect(typeOrmRepository.save).toHaveBeenCalledWith(createdQuestion);
    expect(result).toBe(savedQuestion);
  });

  it('AI 질문 텍스트를 messageId·seniorId·speakerType=AI 조건으로 조회한다', async () => {
    const typeOrmRepository = {
      findOneBy: jest
        .fn()
        .mockResolvedValue({ content: '오늘 하루는 어땠나요?' }),
    };
    const repository = new ConversationMessageRepository(
      typeOrmRepository as unknown as Repository<ConversationMessage>,
    );

    const content = await repository.findAiQuestionContent(101, 7);

    expect(typeOrmRepository.findOneBy).toHaveBeenCalledWith({
      messageId: 101,
      seniorId: 7,
      speakerType: SpeakerType.AI,
    });
    expect(content).toBe('오늘 하루는 어땠나요?');
  });

  it('해당하는 AI 질문이 없으면 null을 반환한다', async () => {
    const typeOrmRepository = {
      findOneBy: jest.fn().mockResolvedValue(null),
    };
    const repository = new ConversationMessageRepository(
      typeOrmRepository as unknown as Repository<ConversationMessage>,
    );

    await expect(repository.findAiQuestionContent(999, 7)).resolves.toBeNull();
  });
});
