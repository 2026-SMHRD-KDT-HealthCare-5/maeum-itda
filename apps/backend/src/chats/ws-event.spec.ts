/* eslint-disable @typescript-eslint/no-unsafe-assignment -- JSON.parse 결과를 전송 envelope와 직접 비교하는 테스트다. */
/*
역할: 공통 WebSocket envelope와 확정된 오류 필드가 실제 전송 JSON에 포함되는지 검증한다.
연결 흐름: Gateway/Handler → sendWsError() → sendWsEvent() → WebSocket client.send()
*/
import type WebSocket from 'ws';
import { sendWsError } from './ws-event';

describe('sendWsError', () => {
  it('requestEvent와 retryable을 포함한 공통 오류 envelope를 전송한다', () => {
    const send = jest.fn<void, [string]>();
    const client = { send } as unknown as WebSocket;

    sendWsError(client, {
      code: 'QUESTION_MISMATCH',
      message: '현재 질문과 일치하지 않습니다.',
      requestEvent: 'audio:metadata',
      retryable: false,
    });

    const sent: unknown = JSON.parse(send.mock.calls[0][0]);
    expect(sent).toEqual({
      event: 'error',
      payload: {
        code: 'QUESTION_MISMATCH',
        message: '현재 질문과 일치하지 않습니다.',
        requestEvent: 'audio:metadata',
        retryable: false,
      },
      ts: expect.any(String),
    });
  });
});
