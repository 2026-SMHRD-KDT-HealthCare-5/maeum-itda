/* eslint-disable @typescript-eslint/no-unsafe-assignment -- WebSocket JSON envelope의 순서와 payload를 비교한다. */
/* 역할: 질문 TTS가 있으면 tts:audio를 먼저 보내고 텍스트 질문을 이어 보내는지 검증한다. */
import type WebSocket from 'ws';
import { QuestionDeliveryService } from './question-delivery.service';

describe('QuestionDeliveryService', () => {
  it('TTS와 질문을 같은 messageId로 순서대로 전송한다', () => {
    const send = jest.fn<void, [string]>();
    const client = { send, readyState: 1 } as unknown as WebSocket;
    const base64 = Buffer.from('mock-mp3').toString('base64');

    new QuestionDeliveryService().deliver(
      client,
      {
        messageId: 101,
        generationId: 'generation-001',
        content: '오늘 하루는 어땠나요?',
      },
      { base64, mimeType: 'audio/mpeg' },
    );

    const events: unknown[] = send.mock.calls.map(
      ([value]) => JSON.parse(value) as unknown,
    );
    expect(events).toEqual([
      expect.objectContaining({
        event: 'tts:audio',
        payload: expect.objectContaining({
          messageId: 101,
          base64,
          mimeType: 'audio/mpeg',
        }),
      }),
      expect.objectContaining({
        event: 'ai:question',
        payload: expect.objectContaining({ messageId: 101 }),
      }),
    ]);
  });

  it('TTS가 없으면 텍스트 질문만 전송한다', () => {
    const send = jest.fn<void, [string]>();
    const client = { send, readyState: 1 } as unknown as WebSocket;

    new QuestionDeliveryService().deliver(
      client,
      {
        messageId: 101,
        generationId: 'generation-001',
        content: '오늘 하루는 어땠나요?',
      },
      null,
    );

    expect(JSON.parse(send.mock.calls[0][0])).toEqual(
      expect.objectContaining({ event: 'ai:question' }),
    );
    expect(send).toHaveBeenCalledTimes(1);
  });
});
