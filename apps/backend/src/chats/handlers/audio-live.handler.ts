/*
역할: 발화 중 PCM을 FastAPI /analysis/stt/live 로 중계하고 audio:partial 을 브라우저에 보낸다.
연결 흐름: audio:pcm → AudioLiveHandler → FastAPI gpt-live-transcribe → audio:partial
주의: 부분 전사는 DB에 저장하지 않는다. 확정 텍스트는 기존 배치 분석의 audio:transcript.
*/
import { Injectable, Logger } from '@nestjs/common';
import type WebSocket from 'ws';
import type { AudioPcmPayload } from '@maeum-itda/shared-types';
import { AiClient } from '../../analysis/ai.client';
import { ChatConnectionStateService } from '../chat-connection-state.service';
import { sendWsEvent } from '../ws-event';
import type { LiveSttSession } from '../../analysis/live-stt.session';

interface ClientLiveState {
  questionMessageId: number;
  generationId: string;
  cumulative: string;
  session: LiveSttSession;
}

@Injectable()
export class AudioLiveHandler {
  private readonly logger = new Logger(AudioLiveHandler.name);
  private readonly liveByClient = new WeakMap<WebSocket, ClientLiveState>();
  private readonly openingByClient = new WeakSet<WebSocket>();
  private readonly pendingPcmByClient = new WeakMap<WebSocket, string[]>();

  constructor(
    private readonly aiClient: AiClient,
    private readonly chatConnectionStateService: ChatConnectionStateService,
  ) {}

  handleAudioPcm(client: WebSocket, payload: AudioPcmPayload): void {
    if (
      !this.chatConnectionStateService.matchesKnownQuestion(
        client,
        payload.questionMessageId,
        payload.generationId,
      )
    ) {
      return;
    }

    if (!this.aiClient.isConfigured()) {
      return;
    }

    const existing = this.liveByClient.get(client);
    if (
      existing &&
      (existing.questionMessageId !== payload.questionMessageId ||
        existing.generationId !== payload.generationId)
    ) {
      existing.session.close();
      this.liveByClient.delete(client);
    }

    const state = this.liveByClient.get(client);
    if (state !== undefined) {
      state.session.append(payload.pcmBase64);
      return;
    }

    if (this.openingByClient.has(client)) {
      const queue = this.pendingPcmByClient.get(client) ?? [];
      queue.push(payload.pcmBase64);
      this.pendingPcmByClient.set(client, queue);
      return;
    }

    this.openingByClient.add(client);
    void this.startSession(client, payload).finally(() => {
      this.openingByClient.delete(client);
    });
  }

  clearClient(client: WebSocket): void {
    const state = this.liveByClient.get(client);
    if (state !== undefined) {
      state.session.close();
      this.liveByClient.delete(client);
    }
    this.pendingPcmByClient.delete(client);
  }

  private async startSession(
    client: WebSocket,
    payload: AudioPcmPayload,
  ): Promise<void> {
    try {
      const session = await this.aiClient.openLiveSttSession({
        onDelta: (delta) => {
          const current = this.liveByClient.get(client);
          if (current === undefined) return;
          current.cumulative += delta;
          sendWsEvent(client, 'audio:partial', {
            questionMessageId: current.questionMessageId,
            content: current.cumulative,
          });
        },
        onError: (reason) => {
          this.logger.warn(`live STT 오류: ${reason}`);
          this.clearClient(client);
        },
      });

      if (
        !this.chatConnectionStateService.matchesKnownQuestion(
          client,
          payload.questionMessageId,
          payload.generationId,
        )
      ) {
        session.close();
        this.pendingPcmByClient.delete(client);
        return;
      }

      const state: ClientLiveState = {
        questionMessageId: payload.questionMessageId,
        generationId: payload.generationId,
        cumulative: '',
        session,
      };
      this.liveByClient.set(client, state);

      const pending = this.pendingPcmByClient.get(client) ?? [];
      this.pendingPcmByClient.delete(client);
      session.append(payload.pcmBase64);
      for (const chunk of pending) {
        session.append(chunk);
      }
    } catch (error: unknown) {
      this.pendingPcmByClient.delete(client);
      this.logger.warn(
        `live STT 세션을 열지 못했습니다: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }
}
