/*
역할: AI 질문 텍스트와 TTS 음성을 WebSocket으로 전달한다.
전체 흐름: ChatStartHandler → QuestionDeliveryService.deliver() → tts:audio → ai:question(최초 질문, 순서 고정)
          AudioBinaryHandler → deliverQuestion() → (비동기 TTS 합성 완료 시) deliverTts()(후속 질문, 텍스트 먼저)
[2026-08-20 변경] 후속 질문은 텍스트가 TTS 합성 시간만큼 화면 표시가 늦어지지 않도록 텍스트를
먼저 보내고, 음성은 별도로 합성이 끝나는 대로 뒤이어 보낸다(§4.2 참고, 최초 질문은 기존 순서 유지).
*/
import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type WebSocket from 'ws';
import type { TtsAudioResult } from '../analysis/dto/audio-analysis.contract';
import type { AiQuestionPayload } from '@maeum-itda/shared-types';
import { sendWsEvent } from './ws-event';

@Injectable()
export class QuestionDeliveryService {
  // 최초 질문(chat:start)에서만 사용 — TTS를 먼저 준비해둔 뒤 함께 전달한다.
  deliver(
    client: WebSocket,
    question: AiQuestionPayload,
    ttsAudio: TtsAudioResult | null,
  ): void {
    // 프론트가 질문 수신 즉시 재생할 음성을 찾을 수 있도록 TTS를 먼저 전송한다.
    if (ttsAudio !== null) {
      this.deliverTts(client, question.messageId, ttsAudio);
    }
    this.deliverQuestion(client, question);
  }

  deliverQuestion(client: WebSocket, question: AiQuestionPayload): void {
    sendWsEvent(client, 'ai:question', question);
  }

  deliverTts(
    client: WebSocket,
    messageId: number,
    ttsAudio: TtsAudioResult,
  ): void {
    sendWsEvent(client, 'tts:audio', {
      ttsTransferId: randomUUID(),
      messageId,
      base64: ttsAudio.base64,
      mimeType: ttsAudio.mimeType,
    });
  }
}
