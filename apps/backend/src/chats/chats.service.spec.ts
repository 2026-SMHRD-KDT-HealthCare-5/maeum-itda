import { ChatsService } from './chats.service';
import type { ConversationMessageRepository } from './repositories/conversation-message.repository';
import type { TtsClient } from '../analysis/tts.client';

describe('ChatsService', () => {
  it('Repository 저장 결과와 generationId를 최초 질문 결과로 반환한다', async () => {
    const conversationMessageRepository = {
      saveInitialAiQuestion: jest.fn().mockResolvedValue({
        messageId: 101,
        content: '오늘 하루는 어땠나요?',
      }),
    };
    const service = new ChatsService(
      conversationMessageRepository as unknown as ConversationMessageRepository,
      {
        synthesize: jest.fn().mockResolvedValue({
          base64: Buffer.from('mock-mp3').toString('base64'),
          mimeType: 'audio/mpeg',
        }),
      } as unknown as TtsClient,
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
    const service = new ChatsService(
      {
        saveInitialAiQuestion: jest.fn().mockResolvedValue({
          messageId: 101,
          content: '오늘 하루는 어땠나요?',
        }),
      } as unknown as ConversationMessageRepository,
      {
        synthesize: jest.fn().mockRejectedValue(new Error('not ready')),
      } as unknown as TtsClient,
    );

    await expect(service.startChat(7)).resolves.toEqual(
      expect.objectContaining({ messageId: 101, ttsAudio: null }),
    );
  });
});
