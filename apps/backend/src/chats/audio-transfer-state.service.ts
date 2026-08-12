/*
역할: WebSocket 연결별로 처리가 끝난 음성 전송 ID와 반환한 메시지 ID를 임시 보관한다.
연결 흐름: AudioBinaryHandler → AudioTransferStateService → 중복 바이너리 수신 시 기존 audio:ack 재전송
주의: MVP에서는 현재 연결 동안만 보관하며 WebSocket 연결 종료 또는 대화 종료 시 폐기한다.
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
