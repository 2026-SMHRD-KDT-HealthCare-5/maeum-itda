/*
역할: AI 질문 텍스트 전달과 TTS 스트리밍 경로 발급을 WebSocket으로 전달한다.
전체 흐름: ChatStartHandler/AudioBinaryHandler → deliverQuestion() → deliverTtsToken()
[2026-08-21 변경] TTS는 더 이상 오디오 자체를 실어보내지 않는다 — 합성 완료를
기다리지 않고 질문 텍스트를 먼저 보낸 뒤, AuthService로 단기 전용 토큰을 발급해
GET /chats/tts-stream 스트리밍 경로만 뒤이어 전달한다(§4.2/§6.3 참고). 최초 질문과
후속 질문 모두 이 순서(텍스트 먼저, TTS 경로 나중)로 통일한다.
*/
import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type WebSocket from 'ws';
import type { AiQuestionPayload } from '@maeum-itda/shared-types';
import { AuthService } from '../auth/auth.service';
import { sendWsEvent } from './ws-event';

@Injectable()
export class QuestionDeliveryService {
  private readonly authService: AuthService;

  constructor(authService: AuthService) {
    this.authService = authService;
  }

  deliverQuestion(client: WebSocket, question: AiQuestionPayload): void {
    sendWsEvent(client, 'ai:question', question);
  }

  // 역할: TTS 스트리밍 경로를 발급해 전달한다. 토큰 발급 자체는 네트워크 호출이
  // 없어 거의 즉시 끝나지만, 그 사이 연결이 끊겼을 수 있어 보내기 직전 한 번만
  // 확인한다(늦게 도착해도 해가 없지만, 이미 닫힌 소켓에 보내려는 시도 자체를 줄인다).
  async deliverTtsToken(
    client: WebSocket,
    messageId: number,
    seniorId: number,
  ): Promise<void> {
    const token = await this.authService.signTtsStreamToken(
      messageId,
      seniorId,
    );
    if (client.readyState !== 1) return;
    sendWsEvent(client, 'tts:audio', {
      ttsTransferId: randomUUID(),
      messageId,
      streamPath: `/chats/tts-stream?messageId=${messageId}&token=${encodeURIComponent(token)}`,
    });
  }
}
