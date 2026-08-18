"""
환경설정 로더.
.env 파일 (또는 실제 배포 환경변수)에서 값을 읽어온다.
"""
from functools import lru_cache
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

# .env는 "현재 실행 위치(cwd) 기준 상대경로"가 아니라 이 파일(app/config.py) 기준으로
# 프로젝트 루트에 있는 걸 찾는다. cwd 기준으로 찾으면 scripts/ 안에서 실행하거나 다른
# 위치에서 실행할 때 .env를 못 찾아서 모든 값이 조용히 빈 문자열/기본값으로 떨어지고,
# 그 결과 "Authorization: Bearer " 처럼 키가 빈 채로 요청이 나가는 문제가 생긴다.
_PROJECT_ROOT = Path(__file__).resolve().parent.parent
_ENV_FILE = _PROJECT_ROOT / ".env"


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=_ENV_FILE, env_file_encoding="utf-8", extra="ignore")

    # OpenAI STT (/v1/audio/transcriptions)
    openai_api_key: str = ""
    openai_stt_model: str = "gpt-transcribe"   # OpenAI 현재 권장 STT 모델. whisper-1은 단어 타임스탬프 필요할 때만
    openai_stt_language: str = "ko"
    openai_stt_prompt: str = ""                # 녹음 상황 힌트(고유명사 등), 없으면 빈 문자열
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

    # 감정 분류 모델
    emotion_mode: str = "test"               # test/model
    text_emotion_model_path: str = "./models/text_emotion"
    voice_emotion_model_path: str = "./models/voice_emotion/kresnik_baseline_best.pt"
    emotion_device: str = "auto"              # auto/cuda/cpu

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


@lru_cache
def get_settings() -> Settings:
    return Settings()
