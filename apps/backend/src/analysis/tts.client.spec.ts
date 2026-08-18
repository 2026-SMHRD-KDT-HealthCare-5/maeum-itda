/* 역할: 첫 질문 TTS Client가 합의된 FastAPI JSON 계약으로 요청하고 응답을 검증하는지 확인한다. */
import type { ConfigService } from '@nestjs/config';
import { TtsClient } from './tts.client';

describe('TtsClient', () => {
  afterEach(() => jest.restoreAllMocks());

  it('POST /tts/synthesize로 첫 질문을 보내고 TTS를 반환한다', async () => {
    const base64 = Buffer.from('mock-mp3').toString('base64');
    const fetchMock = jest.spyOn(global, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({
          ttsAudioBase64: base64,
          ttsMimeType: 'audio/mpeg',
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ),
    );
    const client = new TtsClient({
      get: jest.fn().mockReturnValue('http://fastapi.test'),
    } as unknown as ConfigService);

    await expect(client.synthesize('오늘 하루는 어땠나요?')).resolves.toEqual({
      base64,
      mimeType: 'audio/mpeg',
    });
    expect(fetchMock).toHaveBeenCalledWith(
      'http://fastapi.test/tts/synthesize',
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

    await expect(client.synthesize('첫 질문')).rejects.toThrow('HTTP 502');
  });
});
