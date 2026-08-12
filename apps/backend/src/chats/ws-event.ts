/*
역할: 서버가 보내는 모든 WebSocket JSON 이벤트에 공통 전송 형식 적용
연결 객체: WebSocket 연결 객체
전체 흐름: Handler → sendWsEvent() → 브라우저
*/
import type WebSocket from 'ws';
import type { RawData } from 'ws';
import type { WsErrorPayload, WsEvent } from '@maeum-itda/shared-types';

export type { WsErrorPayload } from '@maeum-itda/shared-types';

// 역할: ws 수신 데이터(Buffer | ArrayBuffer | Buffer[])를 UTF-8 문자열로 변환
// Buffer.prototype.toString은 위 세 형태 모두 처리하지만, ArrayBuffer.prototype.toString은
// 기본 Object 문자열화("[object ArrayBuffer]")라 그대로 호출하면 안 된다.
export function rawDataToString(data: RawData): string {
  if (Array.isArray(data)) {
    return Buffer.concat(data).toString('utf8');
  }
  if (Buffer.isBuffer(data)) {
    return data.toString('utf8');
  }
  return Buffer.from(data).toString('utf8');
}

// 모든 WebSocket JSON 이벤트가 공유하는 event/payload/ts 형식
// 역할: 응답 데이터에 이벤트 이름과 서버 전송 시각을 추가하여 브라우저로 전송
export function sendWsEvent<TEvent extends string, TPayload>(
  client: WebSocket,
  event: TEvent,
  payload: TPayload,
): void {
  const responseEvent: WsEvent<TEvent, TPayload> = {
    event,
    payload,
    ts: new Date().toISOString(),
  };

  client.send(JSON.stringify(responseEvent));
}

// 역할: 모든 일반 오류에 발생 요청과 재시도 가능 여부를 빠짐없이 포함해 전송한다.
// 연결 흐름: Gateway/Handler → sendWsError() → sendWsEvent() → 브라우저
export function sendWsError(client: WebSocket, payload: WsErrorPayload): void {
  sendWsEvent(client, 'error', payload);
}
