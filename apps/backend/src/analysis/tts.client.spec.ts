/* 역할: TTS Client가 스트리밍 엔드포인트를 올바른 계약으로 호출하고 응답을 그대로 돌려주는지 확인한다. */
import type { ConfigService } from '@nestjs/config';
import { TtsClient } from './tts.client';

describe('TtsClient', () => {
  afterEach(() => jest.restoreAllMocks());

  it('POST /tts/synthesize/stream으로 텍스트를 보내고 스트리밍 응답을 그대로 돌려준다', async () => {
    const upstreamResponse = new Response(
      new Blob([new Uint8Array([1, 2, 3])]),
      {
        status: 200,
        headers: { 'Content-Type': 'audio/mpeg' },
      },
    );
    const fetchMock = jest
      .spyOn(global, 'fetch')
      .mockResolvedValue(upstreamResponse);
    const client = new TtsClient({
      get: jest.fn().mockReturnValue('http://fastapi.test'),
    } as unknown as ConfigService);

    const response = await client.synthesizeStream('오늘 하루는 어땠나요?');

    expect(response).toBe(upstreamResponse);
    expect(fetchMock).toHaveBeenCalledWith(
      'http://fastapi.test/tts/synthesize/stream',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ text: '오늘 하루는 어땠나요?' }),
      }),
    );
  });

  it('FastAPI 오류 응답을 성공으로 처리하지 않는다', async () => {
    jest
      .spyOn(global, 'fetch')
      .mockResolvedValue(new Response(null, { status: 502 }));
    const client = new TtsClient({
      get: jest.fn().mockReturnValue('http://fastapi.test'),
    } as unknown as ConfigService);

    await expect(client.synthesizeStream('첫 질문')).rejects.toThrow(
      'HTTP 502',
    );
  });
});
