"""음성 답변에서 가벼운 수치 지표를 뽑아 LLM 프롬프트에 넣을 텍스트로 요약한다.

2026-08-21: KLUE(텍스트)·Kresnik(음성) 5감정 분류 모델(구 emotion.py)을 폐기하고,
감정 판단 자체는 LLM(llm.py의 SYSTEM_PROMPT)에게 STT 텍스트와 함께 넘긴다. 이
모듈은 그 LLM 판단을 돕는 "음성에서 뽑은 보조 신호"만 만든다 — 감정 분류를
직접 하지 않는다.

별도 acoustic feature 추출 라이브러리(librosa/parselmouth 등)가 설치돼 있지
않아서, numpy만으로 계산 가능한 가벼운 지표만 뽑는다:
- 발화 길이, 평균 음량(RMS), 무음 비율: 프레임 단위 RMS로 계산.
- 피치 변동폭: 프레임별 자기상관(autocorrelation) 기반 F0 근사치의 표준편차.
  정식 피치 추적기가 아니라 1차 근사이며, 무음 프레임은 제외한다.
"""

from __future__ import annotations

import io
import logging

import numpy as np

logger = logging.getLogger(__name__)

FRAME_MS = 32
HOP_MS = 16
MIN_VOICE_HZ = 80.0
MAX_VOICE_HZ = 400.0
# 이 두 값(무음 판정 RMS 임계값, 프레임 길이)은 실제 마이크 게인/환경에 맞춘
# 보정 전 1차 후보값이다 — emotion.py의 TEXT_TEMPERATURE 등과 같은 성격.
SILENCE_RMS_THRESHOLD = 0.01

# 텍스트/음성 모두 디코딩·추출에 실패했을 때(예: 손상된 오디오)의 안전한 대체값 —
# main.py가 이 값으로 감정 판단 없이 나머지 파이프라인(STT 결과, 꼬리질문 생성)을
# 계속 진행한다.
EMPTY_FEATURES: dict[str, float] = {
    "duration_sec": 0.0,
    "rms_energy": 0.0,
    "silence_ratio": 1.0,
    "pitch_variation_hz": 0.0,
}


class AudioFeatureExtractionError(RuntimeError):
    """오디오 디코딩 등 추출 과정에서 신뢰할 수 없는 결과가 나왔을 때 발생한다."""


LIVE_STT_SAMPLE_RATE = 24000  # OpenAI Realtime transcription 입력 포맷(pcm16 / 24kHz)


def to_pcm16le_mono(audio_bytes: bytes, sample_rate: int = LIVE_STT_SAMPLE_RATE) -> bytes:
    """녹음 파일(WebM/WAV 등)을 gpt-live-transcribe가 받는 PCM16 LE mono 바이트로 바꾼다."""
    waveform = _decode_audio(audio_bytes, sample_rate)
    if waveform.size == 0:
        raise AudioFeatureExtractionError("Decoded audio is empty")
    clipped = np.clip(np.round(waveform * 32767.0), -32768, 32767)
    return clipped.astype(np.int16).tobytes()


def _decode_audio(audio_bytes: bytes, sample_rate: int) -> np.ndarray:
    """WAV/WebM/Opus를 mono float32 PCM으로 정규화한다."""
    try:
        import av

        chunks: list[np.ndarray] = []
        with av.open(io.BytesIO(audio_bytes), mode="r") as container:
            resampler = av.AudioResampler(format="fltp", layout="mono", rate=sample_rate)
            for frame in container.decode(audio=0):
                for resampled in resampler.resample(frame):
                    chunks.append(resampled.to_ndarray().reshape(-1))
            for resampled in resampler.resample(None):
                chunks.append(resampled.to_ndarray().reshape(-1))
        if not chunks:
            raise ValueError("No audio frames were decoded")
        return np.concatenate(chunks).astype(np.float32, copy=False)
    except Exception as exc:  # noqa: BLE001
        raise AudioFeatureExtractionError("Audio decoding failed") from exc


def _frame_signal(waveform: np.ndarray, sample_rate: int, frame_ms: int, hop_ms: int):
    frame_len = int(sample_rate * frame_ms / 1000)
    hop_len = int(sample_rate * hop_ms / 1000)
    if frame_len <= 0 or waveform.size < frame_len:
        return
    for start in range(0, waveform.size - frame_len + 1, hop_len):
        yield waveform[start : start + frame_len]


def _frame_rms(frame: np.ndarray) -> float:
    return float(np.sqrt(np.mean(np.square(frame)))) if frame.size else 0.0


def _estimate_pitch_hz(frame: np.ndarray, sample_rate: int) -> float | None:
    """자기상관 기반 F0 1차 근사 — 사람 음성대(80~400Hz) 밖 결과는 버린다."""
    windowed = frame * np.hanning(frame.size)
    correlation = np.correlate(windowed, windowed, mode="full")
    correlation = correlation[correlation.size // 2 :]

    min_lag = int(sample_rate / MAX_VOICE_HZ)
    max_lag = min(int(sample_rate / MIN_VOICE_HZ), correlation.size - 1)
    if max_lag <= min_lag:
        return None

    segment = correlation[min_lag:max_lag]
    if segment.size == 0 or np.max(segment) <= 0:
        return None

    peak_lag = min_lag + int(np.argmax(segment))
    return sample_rate / peak_lag


def extract_features(audio_bytes: bytes, sample_rate: int = 16000) -> dict[str, float]:
    """답변 음성 하나에서 duration_sec/rms_energy/silence_ratio/pitch_variation_hz를 뽑는다."""
    if not audio_bytes:
        raise AudioFeatureExtractionError("Feature extraction requires audio data")

    waveform = _decode_audio(audio_bytes, sample_rate)
    if waveform.size == 0:
        return dict(EMPTY_FEATURES)

    frame_rms_values: list[float] = []
    voiced_pitches: list[float] = []
    for frame in _frame_signal(waveform, sample_rate, FRAME_MS, HOP_MS):
        rms = _frame_rms(frame)
        frame_rms_values.append(rms)
        if rms >= SILENCE_RMS_THRESHOLD:
            pitch = _estimate_pitch_hz(frame, sample_rate)
            if pitch is not None:
                voiced_pitches.append(pitch)

    silence_ratio = (
        sum(1 for rms in frame_rms_values if rms < SILENCE_RMS_THRESHOLD) / len(frame_rms_values)
        if frame_rms_values
        else 1.0
    )
    pitch_variation = float(np.std(voiced_pitches)) if len(voiced_pitches) >= 2 else 0.0

    return {
        "duration_sec": round(waveform.size / sample_rate, 2),
        "rms_energy": round(_frame_rms(waveform), 4),
        "silence_ratio": round(silence_ratio, 2),
        "pitch_variation_hz": round(pitch_variation, 1),
    }


def format_features_for_prompt(features: dict[str, float]) -> str:
    """LLM 프롬프트의 답변 블록에 그대로 넣을 한 줄 요약."""
    return (
        f"발화길이 {features['duration_sec']}초, "
        f"평균음량(RMS) {features['rms_energy']}, "
        f"무음비율 {features['silence_ratio'] * 100:.0f}%, "
        f"피치변동폭 {features['pitch_variation_hz']}Hz"
    )
