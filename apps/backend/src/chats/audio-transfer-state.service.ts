/*
역할: WebSocket 연결별로 처리가 끝난 음성 전송 ID와 반환한 메시지 ID를 임시 보관한다.
연결 흐름: AudioBinaryHandler → AudioTransferStateService → 중복 바이너리 수신 시 기존 audio:ack 재전송
[완료] 현재 연결에서 같은 audioTransferId가 다시 오면 기존 ACK를 반환한다.
[제약] 처리 이력이 메모리에 있어 연결 종료·서버 재시작·다른 인스턴스 재접속 후에는 중복 여부를 공유하지 못한다.
*/
import { Injectable } from '@nestjs/common';
import type WebSocket from 'ws';

export interface ProcessedAudioTransfer {
  messageId: number;
}

@Injectable()
export class AudioTransferStateService {
  private readonly processedByClient = new WeakMap<
    WebSocket,
    Map<string, ProcessedAudioTransfer>
  >();

  find(
    client: WebSocket,
    audioTransferId: string,
  ): ProcessedAudioTransfer | undefined {
    return this.processedByClient.get(client)?.get(audioTransferId);
  }

  markProcessed(
    client: WebSocket,
    audioTransferId: string,
    messageId: number,
  ): void {
    let transfers = this.processedByClient.get(client);
    if (transfers === undefined) {
      transfers = new Map<string, ProcessedAudioTransfer>();
      this.processedByClient.set(client, transfers);
    }
    transfers.set(audioTransferId, { messageId });
  }

  clearClient(client: WebSocket): void {
    this.processedByClient.delete(client);
  }
}
