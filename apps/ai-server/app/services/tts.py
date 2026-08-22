"""
TTS 서비스: Typecast 스트리밍 API (`/v1/text-to-speech/stream`).

지난 버전 정정: 이전에는 참고했던 원본 프로젝트(2026-08-05, TTS 단독 검증)가
비-스트리밍 엔드포인트(`/v1/text-to-speech`, 요청당 완성된 오디오 전체 반환)만
테스트했던 거라, 이 서버도 그 방식(문장 분할 후 조각별 완성 오디오 릴레이)으로
맞춰 짰었다. 하지만 Typecast 공식 문서를 다시 확인해보니 별도의 진짜 스트리밍
엔드포인트가 있다:

    POST /v1/text-to-speech/stream

이 엔드포인트는 순수 HTTP chunked transfer로, 오디오가 생성되는 대로 바이트가
그대로 내려온다("streams audio data in chunks, enabling low-latency audio
playback"). 요구사항정의서 FR-01-05가 말하는 "Typecast Streaming API,
TTFB 약 200ms"는 바로 이 엔드포인트를 가리키는 것으로 보인다. 그래서 이 파일은
httpx의 진짜 스트리밍 클라이언트(`client.stream()`)로 바이트가 도착하는 대로
그대로 yield하도록 다시 작성했다.

## 2000자 제한에 대해
이 스트리밍 엔드포인트도 요청당 텍스트 1~2000자 제한은 동일하게 있다(하드 리밋).
다만 이 서비스는 LLM이 만드는 단문형 꼬리질문 하나만 TTS로 보내는 구조라
실질적으로 이 제한에 걸릴 일은 없다. 그래도 안전장치로 `split_text()`를 남겨뒀고,
2000자를 넘는 경우에만(사실상 발생 안 함) 문장 단위로 나눠 순차 스트리밍한다.
평소에는 세그먼트가 1개뿐이라 이 분기는 사실상 타지 않는다.

## 포맷 선택: 스트리밍은 항상 mp3
스트리밍 응답에서 wav를 쓰면 "첫 청크에 들어있는 44바이트 WAV 헤더의 size 필드이
스트리밍이라 0xFFFFFFFF(무효값)로 온다"는 특이사항이 있다. 그 무효 헤더를 잘라내는
것만으로는 재생 가능한 WAV가 안 된다 — 뒤에 남는 건 컨테이너 헤더가 전혀 없는 raw
PCM이라, 브라우저의 `<audio src>`는 샘플레이트/채널/비트뎁스를 알 방법이 없어
디코딩 자체를 못 한다(HTTP 200으로 바이트는 온전히 도착하는데 무음인 이유). 유효한
WAV 헤더를 새로 만들어 붙이는 건 가능하지만 시도할 값어치가 없다 — mp3는 각 청크가
독립적으로 디코딩 가능한 MPEG 프레임이라 별도 처리 없이 그대로 흘려보내면 재생되기
때문이다. 그래서 이 스트리밍 경로는 `TYPECAST_AUDIO_FORMAT` 설정값과 무관하게 항상
mp3로 요청한다(아래 `_STREAM_AUDIO_FORMAT`). 그 설정은 `synthesize_full()`(완성된
파일 전체를 한 번에 반환하는 배치 엔드포인트, 헤더가 처음부터 유효해서 문제없음)에만
적용된다.

인증 헤더는 Authorization: Bearer가 아니라 X-API-KEY (Typecast 스펙).
target_lufs 와 volume 은 동시 사용 불가.
"""
import logging
import re
from collections.abc import AsyncIterator

import httpx

from app.config import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()

API_HOST = "https://api.typecast.ai"
STREAM_ENDPOINT = "/v1/text-to-speech/stream"
BATCH_ENDPOINT = "/v1/text-to-speech"       # 완성된 오디오 전체가 필요할 때(synthesize_full)만 사용
VOICES_ENDPOINT = "/v2/voices"

# 스트리밍 엔드포인트(/tts/synthesize/stream)는 TYPECAST_AUDIO_FORMAT 설정과 무관하게
# 항상 이 포맷으로 Typecast에 요청한다 — 위 모듈 docstring 참고.
_STREAM_AUDIO_FORMAT = "mp3"

MAX_CHARS = 2000
# 문장 끝: . ! ? 。 ！ ？ 뒤 공백, 또는 줄바꿈
_SENT = re.compile(r"(?<=[.!?。!?])\s+|\n")


def split_text(text: str, max_chars: int = MAX_CHARS) -> list[str]:
    """Typecast 요청당 2000자 제한에 대한 안전장치.
    우리 서비스는 LLM이 만드는 단문 꼬리질문 하나만 보내므로 평소엔 세그먼트가 1개뿐이고,
    이 함수가 실제로 텍스트를 쪼개는 경우는 사실상 없다. 혹시 모를 예외적으로 긴 텍스트가
    들어왔을 때만 문단 -> 문장 단위로 분할한다."""
    chunks: list[str] = []

    for block in re.split(r"\n\s*\n", text):
        block = block.strip()
        if not block:
            continue
        if len(block) <= max_chars:
            chunks.append(block)
            continue

        buf = ""
        for sentence in _SENT.split(block):
            sentence = sentence.strip()
            if not sentence:
                continue
            while len(sentence) > max_chars:
                if buf:
                    chunks.append(buf.strip())
                    buf = ""
                chunks.append(sentence[:max_chars])
                sentence = sentence[max_chars:]
            if len(buf) + len(sentence) + 1 > max_chars:
                if buf:
                    chunks.append(buf.strip())
                buf = sentence
            else:
                buf = f"{buf} {sentence}".strip()
        if buf.strip():
            chunks.append(buf.strip())

    return chunks


def _build_payload(text: str, audio_format: str) -> dict:
    return {
        "voice_id": settings.typecast_voice_id,
        "text": text,
        "model": settings.typecast_model,
        "prompt": {
            "emotion_type": "preset",
            "emotion_preset": settings.typecast_emotion_preset,
            "emotion_intensity": settings.typecast_emotion_intensity,
        },
        "output": {
            "audio_format": audio_format,
            "audio_tempo": settings.typecast_audio_tempo,
            "audio_pitch": settings.typecast_audio_pitch,
            # target_lufs와 volume은 동시 사용 불가
            "target_lufs": settings.typecast_target_lufs,
        },
        "language": settings.typecast_lang,
    }


def _headers() -> dict:
    return {"X-API-KEY": settings.typecast_api_key, "Content-Type": "application/json"}


def _raise_for_typecast_error(resp: httpx.Response, body: bytes | None = None) -> None:
    if resp.status_code == 200:
        return
    detail = body
    if detail is None:
        detail = resp.text
    else:
        try:
            import json as _json
            detail = _json.loads(detail)
        except ValueError:
            detail = detail.decode("utf-8", errors="replace")
    raise RuntimeError(f"Typecast API 오류 {resp.status_code}: {detail}")


async def _stream_one_segment(client: httpx.AsyncClient, text: str, chunk_size: int = 4096) -> AsyncIterator[bytes]:
    """세그먼트 하나를 실제 HTTP chunked transfer로 스트리밍 수신. mp3 청크는
    각각 독립적으로 디코딩 가능한 MPEG 프레임이라 별도 처리 없이 그대로
    흘려보낸다(위 모듈 docstring의 포맷 선택 이유 참고)."""
    payload = _build_payload(text, _STREAM_AUDIO_FORMAT)

    async with client.stream("POST", STREAM_ENDPOINT, headers=_headers(), json=payload) as resp:
        if resp.status_code != 200:
            body = await resp.aread()
            _raise_for_typecast_error(resp, body)

        async for chunk in resp.aiter_bytes(chunk_size=chunk_size):
            if chunk:
                yield chunk


async def synthesize_stream(text: str) -> AsyncIterator[bytes]:
    """텍스트 -> 실제 오디오 바이트 스트림. 생성되는 대로 바로 yield된다
    TTS 스트리밍 성능과 TTFB를 개별 검증할 때 사용한다.

    2000자를 넘는 예외적인 경우에만 split_text()로 나눠 세그먼트별로 순차 스트리밍한다.
    평소(단문 질문)에는 세그먼트가 1개뿐이라 사실상 한 번의 스트리밍 호출로 끝난다."""
    segments = split_text(text) if len(text) > MAX_CHARS else [text]

    async with httpx.AsyncClient(base_url=API_HOST, timeout=httpx.Timeout(60.0, connect=10.0)) as client:
        for segment in segments:
            async for chunk in _stream_one_segment(client, segment):
                yield chunk


async def synthesize_full(text: str) -> bytes:
    """REST 응답에 넣을 완성 오디오를 비-스트리밍 배치 엔드포인트로 생성한다."""
    segments = split_text(text) if len(text) > MAX_CHARS else [text]
    parts = []
    async with httpx.AsyncClient(base_url=API_HOST, timeout=httpx.Timeout(60.0, connect=10.0)) as client:
        for segment in segments:
            payload = _build_payload(segment, settings.typecast_audio_format)
            resp = await client.post(BATCH_ENDPOINT, headers=_headers(), json=payload)
            _raise_for_typecast_error(resp, resp.content)
            parts.append(resp.content)
    return b"".join(parts)


async def list_voices() -> list:
    """등록된 보이스 목록 조회 (TYPECAST_VOICE_ID 확인용 헬퍼)."""
    async with httpx.AsyncClient(base_url=API_HOST, timeout=httpx.Timeout(30.0)) as client:
        resp = await client.get(VOICES_ENDPOINT, headers=_headers())
    _raise_for_typecast_error(resp, resp.content)
    return resp.json()
