/*
역할: 백엔드가 가진 질문 텍스트를 FastAPI TTS 스트리밍 API에 전달하고 스트림을 받아온다.
전체 흐름: TtsStreamController → TtsClient → POST /tts/synthesize/stream
*/
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { TtsSynthesizeRequest } from './dto/tts.contract';

@Injectable()
export class TtsClient {
  private readonly baseUrl: string | undefined;

  constructor(configService: ConfigService) {
    this.baseUrl = configService.get<string>('AI_BASE_URL');
  }

  // 역할: FastAPI의 실제 HTTP chunked TTS 스트림을 그대로 돌려준다 — 여기서
  // 본문을 소비하지 않고 호출부(TtsStreamController)가 그대로 중계한다.
  async synthesizeStream(text: string): Promise<Response> {
    if (this.baseUrl === undefined || this.baseUrl.length === 0) {
      throw new Error('FastAPI TTS 서버 주소가 설정되지 않았습니다.');
    }

    const request: TtsSynthesizeRequest = { text };
    const response = await fetch(`${this.baseUrl}/tts/synthesize/stream`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(request),
      signal: AbortSignal.timeout(30_000),
    });
    if (!response.ok || response.body === null) {
      throw new Error(
        `FastAPI TTS 스트리밍 요청 실패: HTTP ${response.status}`,
      );
    }

    return response;
  }
}
