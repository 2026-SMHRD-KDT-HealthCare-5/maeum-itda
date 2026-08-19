import { ChatsService } from './chats.service';
import { SpeakerType } from './entities/conversation-message.entity';
import type { ConversationMessageRepository } from './repositories/conversation-message.repository';
import type { AnalysisService } from '../analysis/analysis.service';
import type { TtsClient } from '../analysis/tts.client';

function createTtsClient(): TtsClient {
  return {
    synthesize: jest.fn().mockResolvedValue({
      base64: Buffer.from('mock-mp3').toString('base64'),
      mimeType: 'audio/mpeg',
    }),
  } as unknown as TtsClient;
}

describe('ChatsService', () => {
  it('오늘 메시지가 없으면 고정 첫 질문을 새로 저장한다', async () => {
    const conversationMessageRepository = {
      findLastMessageForToday: jest.fn().mockResolvedValue(null),
      saveInitialAiQuestion: jest.fn().mockResolvedValue({
        messageId: 101,
        content: '오늘 하루는 어땠나요?',
      }),
    };
    const analysisService = {
      isFastApiConfigured: jest.fn(),
      generateContinuationQuestion: jest.fn(),
    };
    const service = new ChatsService(
      conversationMessageRepository as unknown as ConversationMessageRepository,
      analysisService as unknown as AnalysisService,
      createTtsClient(),
    );

    const result = await service.startChat(7);

    expect(
      conversationMessageRepository.saveInitialAiQuestion,
    ).toHaveBeenCalledWith(7, '오늘 하루는 어땠나요?');
    expect(result.messageId).toBe(101);
    expect(result.content).toBe('오늘 하루는 어땠나요?');
    expect(result.ttsAudio).toEqual({
      base64: Buffer.from('mock-mp3').toString('base64'),
      mimeType: 'audio/mpeg',
    });
    expect(result.generationId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    );
  });

  it('첫 질문 TTS 생성이 실패해도 텍스트 질문을 반환한다', async () => {
    const conversationMessageRepository = {
      findLastMessageForToday: jest.fn().mockResolvedValue(null),
      saveInitialAiQuestion: jest.fn().mockResolvedValue({
        messageId: 101,
        content: '오늘 하루는 어땠나요?',
      }),
    };
    const service = new ChatsService(
      conversationMessageRepository as unknown as ConversationMessageRepository,
      {
        isFastApiConfigured: jest.fn(),
        generateContinuationQuestion: jest.fn(),
      } as unknown as AnalysisService,
      {
        synthesize: jest.fn().mockRejectedValue(new Error('not ready')),
      } as unknown as TtsClient,
    );

    await expect(service.startChat(7)).resolves.toEqual(
      expect.objectContaining({ messageId: 101, ttsAudio: null }),
    );
  });

  it('오늘 마지막 메시지가 AI 질문이면 새로 만들지 않고 그대로 재사용한다', async () => {
    const conversationMessageRepository = {
      findLastMessageForToday: jest.fn().mockResolvedValue({
        messageId: 55,
        speakerType: SpeakerType.AI,
        content: '아까 하시던 이야기 계속 들려주시겠어요?',
      }),
      saveInitialAiQuestion: jest.fn(),
    };
    const service = new ChatsService(
      conversationMessageRepository as unknown as ConversationMessageRepository,
      {
        isFastApiConfigured: jest.fn(),
        generateContinuationQuestion: jest.fn(),
      } as unknown as AnalysisService,
      createTtsClient(),
    );

    const result = await service.startChat(7);

    expect(
      conversationMessageRepository.saveInitialAiQuestion,
    ).not.toHaveBeenCalled();
    expect(result.messageId).toBe(55);
    expect(result.content).toBe('아까 하시던 이야기 계속 들려주시겠어요?');
  });

  it('오늘 마지막 메시지가 시니어 답변이면 이어가기 질문을 생성해 새로 저장한다', async () => {
    const conversationMessageRepository = {
      findLastMessageForToday: jest.fn().mockResolvedValue({
        messageId: 55,
        speakerType: SpeakerType.SENIOR,
        content: '요즘 잠을 잘 못 자요.',
      }),
      saveInitialAiQuestion: jest.fn().mockResolvedValue({
        messageId: 56,
        content: '잠을 설치실 때 특별히 신경 쓰이는 게 있으셨어요?',
      }),
    };
    const analysisService = {
      isFastApiConfigured: jest.fn().mockReturnValue(true),
      generateContinuationQuestion: jest.fn().mockResolvedValue({
        question: '잠을 설치실 때 특별히 신경 쓰이는 게 있으셨어요?',
        ttsAudio: null,
      }),
    };
    const service = new ChatsService(
      conversationMessageRepository as unknown as ConversationMessageRepository,
      analysisService as unknown as AnalysisService,
      createTtsClient(),
    );

    const result = await service.startChat(7);

    expect(analysisService.generateContinuationQuestion).toHaveBeenCalledWith(
      7,
      expect.any(String),
    );
    expect(
      conversationMessageRepository.saveInitialAiQuestion,
    ).toHaveBeenCalledWith(
      7,
      '잠을 설치실 때 특별히 신경 쓰이는 게 있으셨어요?',
    );
    expect(result.messageId).toBe(56);
  });

  it('이어가기 질문 생성이 실패하면 고정 질문으로 대체한다', async () => {
    const conversationMessageRepository = {
      findLastMessageForToday: jest.fn().mockResolvedValue({
        messageId: 55,
        speakerType: SpeakerType.SENIOR,
        content: '요즘 잠을 잘 못 자요.',
      }),
      saveInitialAiQuestion: jest.fn().mockResolvedValue({
        messageId: 56,
        content: '오늘 하루는 어땠나요?',
      }),
    };
    const analysisService = {
      isFastApiConfigured: jest.fn().mockReturnValue(true),
      generateContinuationQuestion: jest
        .fn()
        .mockRejectedValue(new Error('FastAPI down')),
    };
    const service = new ChatsService(
      conversationMessageRepository as unknown as ConversationMessageRepository,
      analysisService as unknown as AnalysisService,
      createTtsClient(),
    );

    const result = await service.startChat(7);

    expect(
      conversationMessageRepository.saveInitialAiQuestion,
    ).toHaveBeenCalledWith(7, '오늘 하루는 어땠나요?');
    expect(result.content).toBe('오늘 하루는 어땠나요?');
  });

  it('FastAPI가 설정되지 않았으면 이어가기 질문 생성을 시도하지 않고 고정 질문으로 대체한다', async () => {
    const conversationMessageRepository = {
      findLastMessageForToday: jest.fn().mockResolvedValue({
        messageId: 55,
        speakerType: SpeakerType.SENIOR,
        content: '요즘 잠을 잘 못 자요.',
      }),
      saveInitialAiQuestion: jest.fn().mockResolvedValue({
        messageId: 56,
        content: '오늘 하루는 어땠나요?',
      }),
    };
    const analysisService = {
      isFastApiConfigured: jest.fn().mockReturnValue(false),
      generateContinuationQuestion: jest.fn(),
    };
    const service = new ChatsService(
      conversationMessageRepository as unknown as ConversationMessageRepository,
      analysisService as unknown as AnalysisService,
      createTtsClient(),
    );

    await service.startChat(7);

    expect(analysisService.generateContinuationQuestion).not.toHaveBeenCalled();
  });
});
