/* eslint-disable @typescript-eslint/no-unsafe-assignment -- WebSocket JSON envelope의 순서와 payload를 비교한다. */
/* 역할: 질문 텍스트 전달과 TTS 스트리밍 경로 발급이 각각 올바른 WS 이벤트로 나가는지 검증한다. */
import type WebSocket from 'ws';
import { QuestionDeliveryService } from './question-delivery.service';
import type { AuthService } from '../auth/auth.service';

function createService(
  signTtsStreamToken = jest.fn().mockResolvedValue('signed-token'),
) {
  const authService = { signTtsStreamToken } as unknown as AuthService;
  return new QuestionDeliveryService(authService);
}

describe('QuestionDeliveryService', () => {
  it('deliverQuestion은 ai:question 하나만 전송한다', () => {
    const send = jest.fn<void, [string]>();
    const client = { send, readyState: 1 } as unknown as WebSocket;

    createService().deliverQuestion(client, {
      messageId: 101,
      generationId: 'generation-001',
      content: '오늘 하루는 어땠나요?',
    });

    expect(send).toHaveBeenCalledTimes(1);
    expect(JSON.parse(send.mock.calls[0][0]) as unknown).toEqual(
      expect.objectContaining({
        event: 'ai:question',
        payload: expect.objectContaining({ messageId: 101 }),
      }),
    );
  });

  it('deliverTtsToken은 발급받은 토큰을 담은 streamPath로 tts:audio를 전송한다', async () => {
    const send = jest.fn<void, [string]>();
    const client = { send, readyState: 1 } as unknown as WebSocket;
    const signTtsStreamToken = jest.fn().mockResolvedValue('signed-token');

    await createService(signTtsStreamToken).deliverTtsToken(client, 101, 7);

    expect(signTtsStreamToken).toHaveBeenCalledWith(101, 7);
    expect(JSON.parse(send.mock.calls[0][0]) as unknown).toEqual(
      expect.objectContaining({
        event: 'tts:audio',
        payload: expect.objectContaining({
          messageId: 101,
          streamPath: '/chats/tts-stream?messageId=101&token=signed-token',
        }),
      }),
    );
  });

  it('토큰 발급 중 연결이 끊기면 조용히 아무것도 보내지 않는다', async () => {
    const send = jest.fn<void, [string]>();
    const client = { send, readyState: 3 } as unknown as WebSocket; // CLOSED

    await createService().deliverTtsToken(client, 101, 7);

    expect(send).not.toHaveBeenCalled();
  });
});
