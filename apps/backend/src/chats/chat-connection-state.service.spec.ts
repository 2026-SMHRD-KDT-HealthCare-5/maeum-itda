import type WebSocket from 'ws';
import { ChatConnectionStateService } from './chat-connection-state.service';

describe('ChatConnectionStateService', () => {
  it('연결별 현재 질문 식별정보를 저장하고 비교한다', () => {
    const service = new ChatConnectionStateService();
    const client = {} as WebSocket;

    service.setCurrentQuestion(client, {
      aiQuestionMessageId: 101,
      generationId: 'generation-001',
      content: '오늘 하루는 어땠나요?',
    });

    expect(service.matchesCurrentQuestion(client, 101, 'generation-001')).toBe(
      true,
    );
    expect(service.matchesCurrentQuestion(client, 102, 'generation-001')).toBe(
      false,
    );
  });
});
