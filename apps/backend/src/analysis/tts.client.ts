/*
역할: 백엔드가 가진 질문 텍스트를 FastAPI TTS 스트리밍 API에 전달하고 스트림을 받아온다.
전체 흐름: TtsStreamController → TtsClient → POST /tts/synthesize/stream
*/
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { TtsSynthesizeRequest } from './dto/tts.contract';

// Render 무료 플랜의 ai-server 콜드스타트가 30초를 넘기는 경우가 있어(2026-08-23
// 확인) 그보다 여유를 둔다. 이 요청은 스트리밍 응답이라 재시도를 두지 않는다 —
// 첫 바이트가 이미 브라우저로 흘러간 뒤라면 다시 시도해도 처음부터 새로
// 스트리밍해야 해서 의미가 없다.
const TTS_STREAM_TIMEOUT_MS = 45_000;

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
      signal: AbortSignal.timeout(TTS_STREAM_TIMEOUT_MS),
    });
    if (!response.ok || response.body === null) {
      throw new Error(
        `FastAPI TTS 스트리밍 요청 실패: HTTP ${response.status}`,
      );
    }

    return response;
  }
}
