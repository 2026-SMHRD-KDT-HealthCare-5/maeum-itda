"""
환경설정 로더.
.env 파일 (또는 실제 배포 환경변수)에서 값을 읽어온다.
"""
import logging
from functools import lru_cache
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

logger = logging.getLogger(__name__)

# .env는 "현재 실행 위치(cwd) 기준 상대경로"가 아니라 이 파일(app/config.py) 기준으로
# 프로젝트 루트에 있는 걸 찾는다. cwd 기준으로 찾으면 scripts/ 안에서 실행하거나 다른
# 위치에서 실행할 때 .env를 못 찾아서 모든 값이 조용히 빈 문자열/기본값으로 떨어지고,
# 그 결과 "Authorization: Bearer " 처럼 키가 빈 채로 요청이 나가는 문제가 생긴다.
_PROJECT_ROOT = Path(__file__).resolve().parent.parent
_ENV_FILE = _PROJECT_ROOT / ".env"


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=_ENV_FILE, env_file_encoding="utf-8", extra="ignore")

    # OpenAI STT — 기본은 gpt-live-transcribe (Realtime WebSocket).
    # whisper-1 / gpt-transcribe / gpt-4o-transcribe* 는 예전 파일 업로드
    # 엔드포인트(/v1/audio/transcriptions)로 폴백한다.
    openai_api_key: str = ""
    openai_stt_model: str = "gpt-live-transcribe"
    openai_stt_language: str = "ko"
    openai_stt_prompt: str = ""                # 녹음 상황 힌트(고유명사 등), 없으면 빈 문자열
    openai_stt_delay: str = "low"              # gpt-live-transcribe delay: minimal/low/medium/high/xhigh
    openai_timeout_sec: int = 60

    # OpenAI LLM (Chat Completions)
    openai_llm_model: str = "gpt-4o"
    openai_llm_timeout_sec: int = 15

    # 로컬 whisper 폴백 (faster-whisper)
    local_whisper_model_size: str = "small"
    local_whisper_device: str = "auto"         # auto/cuda/cpu
    local_whisper_compute_type: str = ""       # 빈 문자열이면 장치에 맞춰 자동 선택(cuda→float16, cpu→int8)
    local_whisper_language: str = "ko"         # 빈 문자열이면 자동 감지(느려짐)
    local_whisper_beam_size: int = 5
    local_whisper_vad_filter: bool = True      # 무음 구간 잘라내고 처리(속도 향상)

    # Typecast TTS 스트리밍 응답은 REST 결과에서 Base64 문자열로 변환한다.
    # 2000자 제한이 있어 긴 텍스트는 문장 단위로 쪼개 순차 호출한다 (app/services/tts.py 참고).
    typecast_api_key: str = ""
    typecast_voice_id: str = ""                # https://api.typecast.ai/v2/voices 로 목록 조회 가능
    typecast_model: str = "ssfm-v30"           # ssfm-v30(최신, 감정 7종) 또는 ssfm-v21
    typecast_lang: str = "kor"                 # kor/eng/jpn/zho...
    typecast_emotion_preset: str = "normal"    # normal/happy/sad/angry/whisper/toneup/tonedown
    typecast_emotion_intensity: float = 1.0    # 0.0~2.0
    typecast_audio_format: str = "mp3"         # mp3(가벼움) / wav(무압축)
    typecast_audio_tempo: float = 1.0          # 0.5~2.0
    typecast_audio_pitch: int = 0              # -12~+12 반음
    typecast_target_lufs: float = -14.0        # 볼륨 정규화. volume 필드와 동시 사용 불가(Typecast 스펙)

    # 척도 채점
    scale_analysis_mode: str = "test"          # test: 고정 목업 채점 / empty: 항상 빈 배열 / model: SYSTEM_PROMPT 기반 실채점 사용

    # STT 교정 (SCALE_ANALYSIS_MODE와 독립적으로 토글)
    stt_correction_mode: str = "test"          # test: STT 원문 그대로 사용 / model: SYSTEM_PROMPT의 corrected_transcript 신뢰

    # UC-06-4 일간 요약·추천 행동 생성
    daily_summary_mode: str = "test"           # test: 고정 목업 문구 반환 / model: DAILY_SUMMARY_SYSTEM_PROMPT로 실제 생성

    # 서버
    host: str = "0.0.0.0"
    port: int = 8000
    log_level: str = "INFO"


# scale_analysis_mode/stt_correction_mode 오타는 요청 처리 중(llm.py)엔 조용히
# 안전 폴백(고정 목업 또는 STT 원문 그대로)으로 흡수된다 — 실시간 대화 중 하나가
# 잘못됐다고 전체 파이프라인을 502로 끊는 게 데모 중엔 더 나쁘기 때문에 의도적으로
# 그렇게 설계했다. 하지만 그 대가로 오타가 나면 증상(채점이 항상 목업이거나 STT
# 교정이 전혀 안 먹는 것)만 보이고 원인은 로그를 뒤져야만 보인다(2026-08-23,
# TTS wav 헤더 버그와 같은 종류의 "설정값 오류가 조용히 실패"하는 패턴). 그래서
# 런타임 동작은 그대로 두고, 기동 시점에만 값이 이상하면 크게 경고해서 배포 직후
# Render 로그만 보면 바로 알 수 있게 한다.
_VALID_MODES = {
    "scale_analysis_mode": {"test", "empty", "model"},
    "stt_correction_mode": {"test", "model"},
    "daily_summary_mode": {"test", "model"},
}


def _warn_on_unexpected_mode(settings: "Settings") -> None:
    for field_name, valid_values in _VALID_MODES.items():
        value = getattr(settings, field_name).strip().lower()
        if value not in valid_values:
            logger.warning(
                "%s=%r 값이 예상 밖입니다(유효값: %s) — 요청 처리 중엔 조용히 "
                "안전 폴백으로 흡수되니, 오타라면 지금 Render 환경변수를 고치세요.",
                field_name.upper(), value, sorted(valid_values),
            )


@lru_cache
def get_settings() -> Settings:
    settings = Settings()
    _warn_on_unexpected_mode(settings)
    return settings
