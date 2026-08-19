/*
역할: WebSocket 연결별로 이미 접수 처리한 음성 전송 ID를 임시 보관한다.
연결 흐름: AudioBinaryHandler → AudioTransferStateService → 중복 바이너리 수신 시 기존 audio:ack 재전송
[완료] 현재 연결에서 같은 audioTransferId가 다시 오면 큐에 다시 넣지 않고 ACK만 재전송한다.
[제약] 처리 이력이 메모리에 있어 연결 종료·서버 재시작·다른 인스턴스 재접속 후에는 중복 여부를 공유하지 못한다.
*/
import { Injectable } from '@nestjs/common';
import type WebSocket from 'ws';

@Injectable()
export class AudioTransferStateService {
  private readonly processedByClient = new WeakMap<WebSocket, Set<string>>();

  has(client: WebSocket, audioTransferId: string): boolean {
    return this.processedByClient.get(client)?.has(audioTransferId) ?? false;
  }

  markProcessed(client: WebSocket, audioTransferId: string): void {
    let transfers = this.processedByClient.get(client);
    if (transfers === undefined) {
      transfers = new Set<string>();
      this.processedByClient.set(client, transfers);
    }
    transfers.add(audioTransferId);
  }

  clearClient(client: WebSocket): void {
    this.processedByClient.delete(client);
  }
}
