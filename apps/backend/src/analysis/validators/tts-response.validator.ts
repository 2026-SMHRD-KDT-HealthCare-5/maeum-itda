/*
역할: FastAPI가 반환한 Base64 TTS와 MIME 타입을 WebSocket으로 전달 가능한 값으로 검증한다.
전체 흐름: AiClient/TtsClient → validateTtsAudio() → AnalysisService/ChatsService
*/
import type { TtsAudioResult } from '../dto/audio-analysis.contract';

// FastAPI `_tts_mime_type()`이 반환할 수 있는 MVP 형식과 동일하게 유지한다.
const ALLOWED_TTS_MIME_TYPES = new Set([
  'audio/mpeg',
  'audio/wav',
  'audio/ogg',
]);
const BASE64_PATTERN =
  /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/;
const MAX_TTS_AUDIO_BYTES = 10 * 1024 * 1024;

export function validateRequiredTtsAudio(
  base64: unknown,
  mimeType: unknown,
): TtsAudioResult {
  if (
    typeof base64 !== 'string' ||
    base64.length === 0 ||
    !BASE64_PATTERN.test(base64)
  ) {
    throw new Error('FastAPI TTS 음성이 올바른 Base64 형식이 아닙니다.');
  }
  if (typeof mimeType !== 'string' || !ALLOWED_TTS_MIME_TYPES.has(mimeType)) {
    throw new Error('FastAPI TTS MIME 타입이 올바르지 않습니다.');
  }

  const audioBytes = Buffer.from(base64, 'base64').byteLength;
  if (audioBytes === 0 || audioBytes > MAX_TTS_AUDIO_BYTES) {
    throw new Error('FastAPI TTS 음성 크기가 허용 범위를 벗어났습니다.');
  }

  return { base64, mimeType };
}

export function validateTtsSynthesizeResponse(value: unknown): TtsAudioResult {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new Error('FastAPI TTS 응답이 객체 형식이 아닙니다.');
  }
  const response = value as Record<string, unknown>;
  return validateRequiredTtsAudio(
    response.ttsAudioBase64,
    response.ttsMimeType,
  );
}

export function validateOptionalTtsAudio(
  base64: unknown,
  mimeType: unknown,
): TtsAudioResult | null {
  if (base64 === null && mimeType === null) return null;
  if (base64 === null || mimeType === null) {
    throw new Error('FastAPI TTS 음성과 MIME 타입은 함께 제공되어야 합니다.');
  }
  return validateRequiredTtsAudio(base64, mimeType);
}
