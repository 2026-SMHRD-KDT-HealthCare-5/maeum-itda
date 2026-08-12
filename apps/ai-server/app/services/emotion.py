"""
감정 분류 서비스: 텍스트 모델 + 음성 모델 각각 추론 후 융합(fusion).

현재 텍스트/음성 감정분류 모델은 각각 학습은 되어 있으나 아직 하나로 합쳐지지
않은 상태라고 들었다. 그래서 이 파일은:

  1) classify_text_emotion() / classify_voice_emotion() : 각 모델 추론 함수
     -> 실제 체크포인트 로딩/전처리 방식은 TODO 부분에 팀에서 쓰는 모델에 맞춰 교체
  2) fuse_emotions()                                    : 두 결과를 합치는 부분
     -> 지금은 라벨별 가중평균(config의 EMOTION_FUSION_*_WEIGHT)으로 "합쳤다고 가정"
     -> 나중에 실제 융합 모델(예: late-fusion MLP)이 나오면 이 함수 내부만 교체하면 됨

두 모델의 출력 라벨셋이 다를 경우, EMOTION_LABELS(.env) 기준으로 정렬/보정한다.
"""
import logging
from functools import lru_cache

import numpy as np

from app.config import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()
LABELS = settings.emotion_label_list  # 예: ["happy","sad","angry","anxious","neutral"]


# ---------------------------------------------------------------------------
# 모델 로딩 (지연 로딩 + 캐시). 실제 체크포인트 형식에 맞춰 아래 두 함수만 교체하면 됨.
# ---------------------------------------------------------------------------

@lru_cache
def _get_text_model():
    """
    TODO: 실제 텍스트 감정분류 체크포인트 로딩 코드로 교체.
    예시는 HuggingFace transformers 시퀀스분류 모델 가정.
    """
    from transformers import AutoModelForSequenceClassification, AutoTokenizer
    path = settings.text_emotion_model_path
    logger.info("텍스트 감정분류 모델 로딩: %s", path)
    tokenizer = AutoTokenizer.from_pretrained(path)
    model = AutoModelForSequenceClassification.from_pretrained(path)
    model.eval()
    return tokenizer, model


@lru_cache
def _get_voice_model():
    """
    TODO: 실제 음성 감정분류 체크포인트 로딩 코드로 교체.
    (예: torch.load(state_dict) + 커스텀 아키텍처, 또는 wav2vec2 기반 등)
    """
    import torch
    path = settings.voice_emotion_model_path
    logger.info("음성 감정분류 모델 로딩: %s", path)
    model = torch.load(path, map_location="cpu")
    model.eval()
    return model


# ---------------------------------------------------------------------------
# 추론
# ---------------------------------------------------------------------------

def classify_text_emotion(text: str) -> dict[str, float]:
    """텍스트 -> {라벨: 확률} 딕셔너리. 실패 시 균등분포 반환(파이프라인 안 죽게)."""
    if not text.strip():
        return {label: 1.0 / len(LABELS) for label in LABELS}
    try:
        import torch
        tokenizer, model = _get_text_model()
        inputs = tokenizer(text, return_tensors="pt", truncation=True, max_length=128)
        with torch.no_grad():
            logits = model(**inputs).logits
            probs = torch.softmax(logits, dim=-1).squeeze(0).tolist()
        return _align_to_labels(probs, getattr(model.config, "id2label", None))
    except Exception as e:  # noqa: BLE001
        logger.error("텍스트 감정분류 실패, 균등분포로 대체: %s", e)
        return {label: 1.0 / len(LABELS) for label in LABELS}


def classify_voice_emotion(audio_bytes: bytes, sample_rate: int = 16000) -> dict[str, float]:
    """오디오 bytes -> {라벨: 확률} 딕셔너리. 실패 시 균등분포 반환."""
    try:
        import io
        import librosa
        import torch

        y, _sr = librosa.load(io.BytesIO(audio_bytes), sr=sample_rate, mono=True)
        model = _get_voice_model()

        # TODO: 실제 전처리(MFCC/Spectrogram 등) 및 forward 방식은 팀 모델 스펙에 맞춰 교체
        x = torch.tensor(y, dtype=torch.float32).unsqueeze(0)
        with torch.no_grad():
            logits = model(x)
            probs = torch.softmax(logits, dim=-1).squeeze(0).tolist()
        return _align_to_labels(probs, None)
    except Exception as e:  # noqa: BLE001
        logger.error("음성 감정분류 실패, 균등분포로 대체: %s", e)
        return {label: 1.0 / len(LABELS) for label in LABELS}


def _align_to_labels(probs: list[float], id2label: dict | None) -> dict[str, float]:
    """모델 출력 순서를 config의 EMOTION_LABELS 순서로 맞춰준다.
    id2label이 없으면 모델 출력 순서 == LABELS 순서라고 가정."""
    if id2label:
        raw = {id2label[i]: p for i, p in enumerate(probs)}
        return {label: raw.get(label, 0.0) for label in LABELS}
    if len(probs) != len(LABELS):
        logger.warning("모델 출력 차원(%d)과 EMOTION_LABELS 개수(%d)가 다릅니다.", len(probs), len(LABELS))
    return {label: probs[i] if i < len(probs) else 0.0 for i, label in enumerate(LABELS)}


# ---------------------------------------------------------------------------
# 융합 (fusion) - 텍스트/음성 모델이 아직 하나로 합쳐지지 않았으므로 임시 가중평균
# ---------------------------------------------------------------------------

def fuse_emotions(text_probs: dict[str, float], voice_probs: dict[str, float]) -> dict[str, float]:
    w_text = settings.emotion_fusion_text_weight
    w_voice = settings.emotion_fusion_voice_weight
    total_w = w_text + w_voice or 1.0

    fused = {}
    for label in LABELS:
        t = text_probs.get(label, 0.0)
        v = voice_probs.get(label, 0.0)
        fused[label] = (t * w_text + v * w_voice) / total_w

    # 정규화 (합이 1이 되도록)
    s = sum(fused.values()) or 1.0
    fused = {k: round(v / s, 4) for k, v in fused.items()}
    return fused


def dominant_emotion(emotion_probs: dict[str, float]) -> str:
    return max(emotion_probs.items(), key=lambda kv: kv[1])[0]


def classify_and_fuse(text: str, audio_bytes: bytes, sample_rate: int = 16000) -> dict[str, float]:
    """REST 배치 엔드포인트에서 호출하는 텍스트·음성 감정분류 진입점."""
    text_probs = classify_text_emotion(text)
    voice_probs = classify_voice_emotion(audio_bytes, sample_rate=sample_rate)
    return fuse_emotions(text_probs, voice_probs)
