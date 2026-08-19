/* 역할: FastAPI TTS 응답의 Base64·MIME·nullable 쌍 검증 정책을 확인한다. */
import {
  validateOptionalTtsAudio,
  validateRequiredTtsAudio,
  validateTtsSynthesizeResponse,
} from './tts-response.validator';

describe('TTS response validator', () => {
  const base64 = Buffer.from('mock-mp3').toString('base64');

  it('유효한 MP3 Base64 응답을 내부 TTS 객체로 변환한다', () => {
    expect(validateRequiredTtsAudio(base64, 'audio/mpeg')).toEqual({
      base64,
      mimeType: 'audio/mpeg',
    });
  });

  it('선택 TTS는 두 필드가 모두 null인 경우만 생성 실패로 허용한다', () => {
    expect(validateOptionalTtsAudio(null, null)).toBeNull();
    expect(() => validateOptionalTtsAudio(base64, null)).toThrow('함께 제공');
  });

  it('잘못된 Base64와 지원하지 않는 MIME 타입을 거부한다', () => {
    expect(() => validateRequiredTtsAudio('not-base64!', 'audio/mpeg')).toThrow(
      'Base64',
    );
    expect(() => validateRequiredTtsAudio(base64, 'audio/flac')).toThrow(
      'MIME',
    );
  });

  it('FastAPI가 지원하는 OGG 음성을 허용한다', () => {
    expect(validateRequiredTtsAudio(base64, 'audio/ogg')).toEqual({
      base64,
      mimeType: 'audio/ogg',
    });
  });

  it('TTS API 응답이 객체가 아니면 거부한다', () => {
    expect(() => validateTtsSynthesizeResponse(null)).toThrow('객체 형식');
  });
});
