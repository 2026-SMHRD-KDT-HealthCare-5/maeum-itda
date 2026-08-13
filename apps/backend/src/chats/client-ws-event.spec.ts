/*
역할: Gateway가 인증 이후 JSON을 한 번만 파싱하면서 이벤트별 계약을 검증하는지 확인한다.
*/
import { parseAuthenticatedClientEvent } from './client-ws-event';

describe('parseAuthenticatedClientEvent', () => {
  it('유효한 audio:metadata를 타입이 정해진 이벤트로 변환한다', () => {
    const event = parseAuthenticatedClientEvent(
      JSON.stringify({
        event: 'audio:metadata',
        payload: {
          audioTransferId: 'audio-1',
          questionMessageId: 10,
          generationId: 'generation-1',
          mimeType: 'audio/webm',
          capturedAt: '2026-08-13T00:00:00.000Z',
          endType: 'auto',
        },
        ts: '2026-08-13T00:00:01.000Z',
      }),
    );

    expect(event).toEqual(
      expect.objectContaining({
        event: 'audio:metadata',
        // jest의 objectContaining() 반환형이 any라 중첩 시 no-unsafe-assignment가 오탐한다.
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        payload: expect.objectContaining({ questionMessageId: 10 }),
      }),
    );
  });

  it('지원하지 않는 chat:end 사유를 Handler 호출 전에 거부한다', () => {
    expect(() =>
      parseAuthenticatedClientEvent(
        JSON.stringify({
          event: 'chat:end',
          payload: { reason: 'TIMEOUT' },
          ts: '2026-08-13T00:00:01.000Z',
        }),
      ),
    ).toThrow('유효하지 않은 chat:end 이벤트입니다.');
  });

  it('필수값이 빠진 audio:metadata를 Handler 호출 전에 거부한다', () => {
    expect(() =>
      parseAuthenticatedClientEvent(
        JSON.stringify({
          event: 'audio:metadata',
          payload: { audioTransferId: '' },
          ts: '2026-08-13T00:00:01.000Z',
        }),
      ),
    ).toThrow('유효하지 않은 audio:metadata 이벤트입니다.');
  });
});
