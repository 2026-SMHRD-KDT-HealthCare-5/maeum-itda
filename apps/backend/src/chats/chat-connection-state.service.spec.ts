import type WebSocket from 'ws';
import { ChatConnectionStateService } from './chat-connection-state.service';

describe('ChatConnectionStateService', () => {
  it('연결별 현재 질문 식별정보를 저장하고 비교한다', () => {
    const service = new ChatConnectionStateService();
    const client = {} as WebSocket;

    service.setCurrentQuestion(client, {
      messageId: 101,
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

  it('수동 종료 후 늦게 도착한 다음 질문을 차단하고 새 대화 시작 시 해제한다', () => {
    const service = new ChatConnectionStateService();
    const client = {} as WebSocket;

    service.markChatEnded(client);
    expect(service.isChatEnded(client)).toBe(true);

    service.setCurrentQuestion(client, {
      messageId: 201,
      generationId: 'generation-002',
      content: '새로운 대화 질문',
    });
    expect(service.isChatEnded(client)).toBe(false);
    expect(service.getCurrentQuestion(client)).toEqual({
      questionMessageId: 201,
      generationId: 'generation-002',
      content: '새로운 대화 질문',
    });
  });

  it('연결이 끊겨도 같은 시니어의 현재 질문을 새 연결에 복원한다', () => {
    const service = new ChatConnectionStateService();
    const firstClient = {} as WebSocket;
    const reconnectedClient = {} as WebSocket;
    service.setCurrentQuestion(
      firstClient,
      { messageId: 301, generationId: 'generation-003', content: '복원 질문' },
      7,
    );
    service.clearClient(firstClient);

    expect(service.restoreClient(reconnectedClient, 7)).toEqual({
      questionMessageId: 301,
      generationId: 'generation-003',
      content: '복원 질문',
    });
  });
});
