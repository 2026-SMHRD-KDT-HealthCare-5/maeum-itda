"""
STT 서비스.

1순위: OpenAI STT API (`/v1/audio/transcriptions`, httpx로 직접 호출)
2순위(폴백): 로컬 faster-whisper (OpenAI 호출 실패/타임아웃/네트워크 장애 시 자동 전환)

이 파일의 요청 형식(멀티파트 필드명, 모델별 language/languages[] 분기 등)과
faster-whisper 추론 파라미터(vad_filter, beam_size 등)는 2026-08-05에 STT만 따로
떼어 검증했던 프로젝트(STT-...-v1-API-openai / STT-...-v2-로컬-fasterwhisper)의
실전 검증된 구현을 그대로 가져와 이 WS 파이프라인에 맞게 통합한 것이다.

FR-01-08(음성 분석 실패 처리) 대응: 두 경로 모두 실패하면 SttResult.ok=False로
반환하고, WS 핸들러 쪽에서 stt_failed 메시지를 백엔드에 보낸다.

주의(원본 프로젝트에서 확인된 함정):
- 로컬 whisper 추론은 블로킹이라 이벤트 루프에서 직접 호출하면 안 됨
  -> 이 모듈은 동기 함수로 유지하고, 호출부(app/main.py)가 asyncio.to_thread로 감싼다.
- 로컬 whisper는 CPU/GPU를 통째로 쓰므로 동시 추론을 직렬화해야 함 -> _local_infer_lock
"""
import logging
import tempfile
import threading
from dataclasses import dataclass
from functools import lru_cache
from pathlib import Path

import httpx

from app.config import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()

OPENAI_API_HOST = "https://api.openai.com"
OPENAI_STT_ENDPOINT = "/v1/audio/transcriptions"

MIME_BY_EXT = {
    "mp3": "audio/mpeg", "mpga": "audio/mpeg", "mpeg": "audio/mpeg",
    "mp4": "audio/mp4", "m4a": "audio/mp4",
    "wav": "audio/wav", "webm": "audio/webm",
}

# 단어 타임스탬프를 지원하는 모델 (지금은 안 쓰지만 확장 대비 남겨둠)
TIMESTAMP_MODELS = {"whisper-1"}

# 로컬 whisper 추론은 CPU/GPU를 통째로 쓰므로 한 번에 하나씩만 (원본 STT 비교 문서의 함정 메모 반영)
_local_infer_lock = threading.Semaphore(1)


@dataclass
class SttResult:
    ok: bool
    text: str = ""
    reason: str = ""       # 실패 사유 (ok=False일 때)
    engine: str = ""       # "openai" | "local_whisper"


# ---------------------------------------------------------------- 1) OpenAI STT

# language 필드가 단수(language)인 모델과 복수(languages[])인 모델이 나뉜다.
# OpenAI 공식 문서(2026-08 기준) 확인 결과:
#   단수(language)  : whisper-1, gpt-4o-transcribe, gpt-4o-mini-transcribe
#   복수(languages[]): gpt-transcribe(현재 OpenAI 기본 추천 모델), gpt-4o-transcribe-diarize
_SINGULAR_LANGUAGE_MODELS = {"whisper-1", "gpt-4o-transcribe", "gpt-4o-mini-transcribe"}


def _build_openai_form(model: str) -> dict:
    fields: dict = {"model": model}

    if settings.openai_stt_prompt:
        fields["prompt"] = settings.openai_stt_prompt

    language = settings.openai_stt_language
    if language:
        if model in _SINGULAR_LANGUAGE_MODELS:
            fields["language"] = language
        else:
            fields["languages[]"] = [language]

    return fields


def _transcribe_openai(audio_bytes: bytes, audio_format: str) -> str:
    ext = audio_format.lower().lstrip(".")
    mime = MIME_BY_EXT.get(ext, "application/octet-stream")
    model = settings.openai_stt_model

    files = {"file": (f"utterance.{ext}", audio_bytes, mime)}
    form = _build_openai_form(model)

    with httpx.Client(base_url=OPENAI_API_HOST, timeout=httpx.Timeout(settings.openai_timeout_sec, connect=10.0)) as client:
        resp = client.post(
            OPENAI_STT_ENDPOINT,
            headers={"Authorization": f"Bearer {settings.openai_api_key}"},
            data=form,
            files=files,
        )

    if resp.status_code != 200:
        try:
            detail = resp.json()
        except ValueError:
            detail = resp.text
        raise RuntimeError(f"OpenAI STT 오류 {resp.status_code}: {detail}")

    result = resp.json()
    return (result.get("text") or "").strip()


# ---------------------------------------------------------------- 2) 로컬 faster-whisper

@lru_cache
def _resolve_device() -> tuple[str, str]:
    device = settings.local_whisper_device
    if device == "auto":
        try:
            import ctranslate2
            device = "cuda" if ctranslate2.get_cuda_device_count() > 0 else "cpu"
        except Exception:  # noqa: BLE001
            device = "cpu"

    compute_type = settings.local_whisper_compute_type
    if not compute_type:
        compute_type = "float16" if device == "cuda" else "int8"
    return device, compute_type


@lru_cache
def _get_local_whisper_model():
    """faster-whisper 모델은 무겁기 때문에 최초 폴백 호출 시점에 지연 로딩 + 캐시."""
    from faster_whisper import WhisperModel
    device, compute_type = _resolve_device()
    logger.info(
        "로컬 faster-whisper 모델 로딩 중... (size=%s, device=%s, compute_type=%s)",
        settings.local_whisper_model_size, device, compute_type,
    )
    return WhisperModel(settings.local_whisper_model_size, device=device, compute_type=compute_type)


def _transcribe_local(audio_bytes: bytes, audio_format: str) -> str:
    model = _get_local_whisper_model()

    # faster-whisper는 파일 경로를 받는 편이 안정적 (원본 구현과 동일하게 임시파일 경유)
    ext = audio_format.lower().lstrip(".")
    with tempfile.NamedTemporaryFile(suffix=f".{ext}", delete=False) as tmp:
        tmp.write(audio_bytes)
        tmp_path = tmp.name

    try:
        with _local_infer_lock:
            kwargs = {
                "beam_size": settings.local_whisper_beam_size,
                "language": settings.local_whisper_language or None,
                "condition_on_previous_text": False,  # True면 한 번 잘못 인식 시 뒤로 환각 전파될 수 있음
            }
            if settings.local_whisper_vad_filter:
                kwargs["vad_filter"] = True
                kwargs["vad_parameters"] = {"min_silence_duration_ms": 500}

            segments, _info = model.transcribe(tmp_path, **kwargs)
            return "".join(seg.text for seg in segments).strip()
    finally:
        Path(tmp_path).unlink(missing_ok=True)


# ---------------------------------------------------------------- 진입점

def transcribe(audio_bytes: bytes, audio_format: str = "webm") -> SttResult:
    if not audio_bytes:
        return SttResult(ok=False, reason="empty_audio")

    # 1) OpenAI STT 우선 시도
    try:
        text = _transcribe_openai(audio_bytes, audio_format)
        if text:
            return SttResult(ok=True, text=text, engine="openai")
        logger.warning("OpenAI STT 결과가 비어 있음(무음/잡음 추정), 로컬로 폴백")
    except Exception as e:  # noqa: BLE001 - 폴백을 위해 광범위 캐치
        logger.warning("OpenAI STT 실패, 로컬 whisper로 폴백: %s", e)

    # 2) 로컬 whisper 폴백
    try:
        text = _transcribe_local(audio_bytes, audio_format)
        if text:
            return SttResult(ok=True, text=text, engine="local_whisper")
        return SttResult(ok=False, reason="empty_transcript", engine="local_whisper")
    except Exception as e:  # noqa: BLE001
        logger.error("로컬 whisper도 실패: %s", e)
        return SttResult(ok=False, reason=f"stt_all_failed: {e}")
