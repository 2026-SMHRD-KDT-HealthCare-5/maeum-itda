/*
역할: 백엔드가 가진 첫 질문 텍스트를 FastAPI TTS 전용 API에 전달하고 검증된 음성을 반환한다.
전체 흐름: ChatsService → TtsClient → POST /tts/synthesize → validateTtsSynthesizeResponse
[연동 대기] FastAPI가 동일 계약의 엔드포인트를 추가하기 전에는 호출이 실패하며 ChatsService가 텍스트 질문으로 대체한다.
*/
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { TtsSynthesizeRequest } from './dto/tts.contract';
import { validateTtsSynthesizeResponse } from './validators/tts-response.validator';

@Injectable()
export class TtsClient {
  private readonly baseUrl: string | undefined;

  constructor(configService: ConfigService) {
    this.baseUrl = configService.get<string>('AI_BASE_URL');
  }

  async synthesize(text: string) {
    if (this.baseUrl === undefined || this.baseUrl.length === 0) {
      throw new Error('FastAPI TTS 서버 주소가 설정되지 않았습니다.');
    }

    const request: TtsSynthesizeRequest = { text };
    const response = await fetch(`${this.baseUrl}/tts/synthesize`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(request),
      signal: AbortSignal.timeout(30_000),
    });
    if (!response.ok) {
      throw new Error(`FastAPI TTS 요청 실패: HTTP ${response.status}`);
    }

    return validateTtsSynthesizeResponse(await response.json());
  }
}
