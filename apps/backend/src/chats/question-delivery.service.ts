/*
역할: AI 질문과 선택적인 TTS 음성을 동일한 messageId로 묶어 WebSocket에 정해진 순서로 전달한다.
전체 흐름: ChatStartHandler/AudioBinaryHandler → QuestionDeliveryService → tts:audio → ai:question
*/
import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type WebSocket from 'ws';
import type { TtsAudioResult } from '../analysis/dto/audio-analysis.contract';
import type { AiQuestionPayload } from '@maeum-itda/shared-types';
import { sendWsEvent } from './ws-event';

@Injectable()
export class QuestionDeliveryService {
  deliver(
    client: WebSocket,
    question: AiQuestionPayload,
    ttsAudio: TtsAudioResult | null,
  ): void {
    // 프론트가 질문 수신 즉시 재생할 음성을 찾을 수 있도록 TTS를 먼저 전송한다.
    if (ttsAudio !== null) {
      sendWsEvent(client, 'tts:audio', {
        ttsTransferId: randomUUID(),
        messageId: question.messageId,
        base64: ttsAudio.base64,
        mimeType: ttsAudio.mimeType,
      });
    }
    sendWsEvent(client, 'ai:question', question);
  }
}
