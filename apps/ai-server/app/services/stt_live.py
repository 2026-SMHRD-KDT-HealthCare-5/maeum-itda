"""gpt-live-transcribe Realtime transcription 세션 계약.

OpenAI는 이 모델을 POST /v1/audio/transcriptions 파일 업로드가 아니라
Realtime WebSocket(type=transcription)으로만 쓰라고 권장한다. 배치 파이프라인은
녹음 파일을 PCM16 24kHz로 바꾼 뒤 이 세션에 밀어 넣고 commit한다. 안부 대화
중 부분 자막은 같은 세션을 FastAPI /analysis/stt/live 가 프록시한다.
"""

from __future__ import annotations

OPENAI_REALTIME_URL = "wss://api.openai.com/v1/realtime?intent=transcription"
LIVE_STT_MODEL = "gpt-live-transcribe"
PCM_CHUNK_BYTES = 4800  # 24kHz pcm16 mono 100ms


def build_session_update(
    *,
    language: str = "ko",
    prompt: str = "",
    delay: str = "low",
) -> dict:
    transcription: dict = {
        "model": LIVE_STT_MODEL,
        "delay": delay,
    }
    if language:
        transcription["languages"] = [language]
    if prompt:
        transcription["prompt"] = prompt

    return {
        "type": "session.update",
        "session": {
            "type": "transcription",
            "audio": {
                "input": {
                    "format": {"type": "audio/pcm", "rate": 24000},
                    "transcription": transcription,
                    "turn_detection": None,
                }
            },
        },
    }


def build_audio_append(pcm_chunk: bytes) -> dict:
    import base64

    return {
        "type": "input_audio_buffer.append",
        "audio": base64.b64encode(pcm_chunk).decode("ascii"),
    }


def build_audio_commit() -> dict:
    return {"type": "input_audio_buffer.commit"}


def iter_pcm_chunks(pcm_bytes: bytes, chunk_size: int = PCM_CHUNK_BYTES):
    if chunk_size <= 0:
        raise ValueError("chunk_size must be positive")
    for start in range(0, len(pcm_bytes), chunk_size):
        yield pcm_bytes[start : start + chunk_size]


def classify_realtime_event(event: dict) -> tuple[str, str]:
    """Realtime 서버 이벤트를 (kind, text)로 정규화한다.

    kind: delta | completed | error | unavailable | other
    """
    event_type = event.get("type")
    if event_type == "conversation.item.input_audio_transcription.delta":
        return "delta", str(event.get("delta") or "")
    if event_type == "conversation.item.input_audio_transcription.completed":
        return "completed", str(event.get("transcript") or "").strip()
    if event_type == "error":
        error = event.get("error") if isinstance(event.get("error"), dict) else {}
        code = str(error.get("code") or "")
        message = str(error.get("message") or event)
        if code in {"invalid_api_key", "invalid_api_key_format"} or "authentication" in code:
            return "unavailable", message
        if code == "insufficient_quota":
            return "unavailable", message
        return "error", message
    return "other", ""
