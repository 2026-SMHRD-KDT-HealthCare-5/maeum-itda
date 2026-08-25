/*
역할: FastAPI /analysis/stt/live WebSocket 세션 한 건을 감싼다.
연결 흐름: AiClient.openLiveSttSession() → LiveSttSession.append/close
*/
import WebSocket from 'ws';
import { rawDataToString } from '../chats/ws-event';

export interface LiveSttSessionCallbacks {
  onDelta: (delta: string) => void;
  onError: (reason: string) => void;
}

export class LiveSttSession {
  private closed = false;

  constructor(
    private readonly socket: WebSocket,
    private readonly callbacks: LiveSttSessionCallbacks,
  ) {
    this.socket.on('message', (data) => {
      if (this.closed) return;
      try {
        const parsed: unknown = JSON.parse(rawDataToString(data));
        if (!isRecord(parsed) || typeof parsed.type !== 'string') return;
        if (parsed.type === 'delta' && typeof parsed.delta === 'string') {
          this.callbacks.onDelta(parsed.delta);
          return;
        }
        if (parsed.type === 'error') {
          this.callbacks.onError(
            typeof parsed.reason === 'string'
              ? parsed.reason
              : 'live STT error',
          );
          this.close();
        }
      } catch {
        // 깨진 프레임은 무시한다 — 다음 청크로 복구한다.
      }
    });
    this.socket.on('close', () => {
      this.closed = true;
    });
    this.socket.on('error', (error) => {
      this.callbacks.onError(error.message);
      this.close();
    });
  }

  append(pcmBase64: string): void {
    if (this.closed || this.socket.readyState !== WebSocket.OPEN) return;
    this.socket.send(JSON.stringify({ type: 'append', audio: pcmBase64 }));
  }

  close(): void {
    if (this.closed) return;
    this.closed = true;
    if (this.socket.readyState === WebSocket.OPEN) {
      try {
        this.socket.send(JSON.stringify({ type: 'close' }));
      } catch {
        // 닫는 중 전송 실패는 무시
      }
    }
    this.socket.close();
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
