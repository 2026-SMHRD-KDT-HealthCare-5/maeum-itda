"""Text/voice emotion inference and late fusion."""

from __future__ import annotations

import io
import logging
from functools import lru_cache
from pathlib import Path

import numpy as np

from app.config import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()

# Both checkpoints were trained with this exact class order.
MODEL_LABELS = ("happy", "angry", "sad", "anxious", "neutral")
KOREAN_TO_SERVER_LABEL = {
    "기쁨": "happy",
    "분노": "angry",
    "슬픔": "sad",
    "불안": "anxious",
    "중립": "neutral",
}
LABELS = MODEL_LABELS
VOICE_CHECKPOINT = "kresnik/wav2vec2-large-xlsr-korean"
VOICE_MAX_SAMPLES = 320_000
TEST_EMOTION = {
    "happy": 0.0,
    "angry": 0.0,
    "sad": 1.0,
    "anxious": 0.0,
    "neutral": 0.0,
}


class EmotionInferenceError(RuntimeError):
    """Raised when a modality cannot produce a trustworthy prediction."""


def _resolve_path(value: str, *, expected: str) -> Path:
    path = Path(value).expanduser()
    if not path.is_absolute():
        path = (Path(__file__).resolve().parents[2] / path).resolve()
    valid = path.is_dir() if expected == "directory" else path.is_file()
    if not valid:
        raise FileNotFoundError(f"Expected model {expected} does not exist: {path}")
    return path


def _select_device():
    import torch

    requested = settings.emotion_device.strip().lower()
    if requested not in {"auto", "cuda", "cpu"}:
        raise ValueError("EMOTION_DEVICE must be one of: auto, cuda, cpu")
    if requested == "cuda" and not torch.cuda.is_available():
        raise EmotionInferenceError("EMOTION_DEVICE=cuda but CUDA is unavailable")
    selected = (
        "cuda"
        if requested == "cuda" or (requested == "auto" and torch.cuda.is_available())
        else "cpu"
    )
    return torch.device(selected)


@lru_cache(maxsize=1)
def _get_text_model():
    from transformers import AutoModelForSequenceClassification, AutoTokenizer

    path = _resolve_path(settings.text_emotion_model_path, expected="directory")
    device = _select_device()
    logger.info("Loading text emotion model from %s on %s", path, device)
    tokenizer = AutoTokenizer.from_pretrained(path, local_files_only=True)
    model = AutoModelForSequenceClassification.from_pretrained(path, local_files_only=True)
    model.to(device).eval()
    return tokenizer, model, device


def _audio_classifier_class():
    import torch.nn as nn
    from transformers import AutoModel

    class AudioEmotionClassifier(nn.Module):
        def __init__(self, checkpoint: str, num_labels: int):
            super().__init__()
            self.encoder = AutoModel.from_pretrained(checkpoint)
            self.dropout = nn.Dropout(0.1)
            self.classifier = nn.Linear(self.encoder.config.hidden_size, num_labels)

        def forward(self, input_values, attention_mask=None):
            outputs = self.encoder(input_values=input_values, attention_mask=attention_mask)
            hidden = outputs.last_hidden_state
            if attention_mask is not None and hasattr(
                self.encoder, "_get_feature_vector_attention_mask"
            ):
                feature_mask = self.encoder._get_feature_vector_attention_mask(
                    hidden.shape[1], attention_mask
                )
                mask = feature_mask.unsqueeze(-1).to(hidden.dtype)
                pooled = (hidden * mask).sum(dim=1) / mask.sum(dim=1).clamp(min=1e-6)
            else:
                pooled = hidden.mean(dim=1)
            return self.classifier(self.dropout(pooled))

    return AudioEmotionClassifier


@lru_cache(maxsize=1)
def _get_voice_model():
    import torch
    from transformers import AutoFeatureExtractor

    path = _resolve_path(settings.voice_emotion_model_path, expected="file")
    device = _select_device()
    logger.info("Loading voice emotion model from %s on %s", path, device)
    feature_extractor = AutoFeatureExtractor.from_pretrained(VOICE_CHECKPOINT)
    model = _audio_classifier_class()(VOICE_CHECKPOINT, len(MODEL_LABELS))
    state_dict = torch.load(path, map_location="cpu", weights_only=True)
    model.load_state_dict(state_dict, strict=True)
    model.to(device).eval()
    return feature_extractor, model, device


def classify_text_emotion(text: str) -> dict[str, float]:
    if not text.strip():
        raise EmotionInferenceError("Text emotion inference requires non-empty text")
    try:
        import torch

        tokenizer, model, device = _get_text_model()
        inputs = tokenizer(text, return_tensors="pt", truncation=True, max_length=192)
        inputs = {name: value.to(device) for name, value in inputs.items()}
        with torch.inference_mode():
            probabilities = torch.softmax(model(**inputs).logits, dim=-1)[0].cpu().tolist()
        return _align_to_labels(probabilities, getattr(model.config, "id2label", None))
    except EmotionInferenceError:
        raise
    except Exception as exc:  # noqa: BLE001
        logger.exception("Text emotion inference failed")
        raise EmotionInferenceError("Text emotion inference failed") from exc


def classify_voice_emotion(audio_bytes: bytes, sample_rate: int = 16000) -> dict[str, float]:
    if not audio_bytes:
        raise EmotionInferenceError("Voice emotion inference requires audio data")
    try:
        import torch

        waveform = _decode_audio(audio_bytes, sample_rate)[:VOICE_MAX_SAMPLES]
        if waveform.size == 0:
            raise EmotionInferenceError("Decoded audio contains no samples")
        feature_extractor, model, device = _get_voice_model()
        inputs = feature_extractor(
            [waveform],
            sampling_rate=sample_rate,
            padding=True,
            truncation=True,
            max_length=VOICE_MAX_SAMPLES,
            return_tensors="pt",
        )
        model_inputs = {"input_values": inputs.input_values.to(device)}
        if getattr(inputs, "attention_mask", None) is not None:
            model_inputs["attention_mask"] = inputs.attention_mask.to(device)
        with torch.inference_mode():
            probabilities = torch.softmax(model(**model_inputs), dim=-1)[0].cpu().tolist()
        return _align_to_labels(probabilities)
    except EmotionInferenceError:
        raise
    except Exception as exc:  # noqa: BLE001
        logger.exception("Voice emotion inference failed")
        raise EmotionInferenceError("Voice emotion inference failed") from exc


def _decode_audio(audio_bytes: bytes, sample_rate: int) -> np.ndarray:
    """Decode WAV/WebM/Opus and normalize it to mono float32 PCM."""
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
    except EmotionInferenceError:
        raise
    except Exception as exc:  # noqa: BLE001
        raise EmotionInferenceError("Audio decoding failed") from exc


def _align_to_labels(
    probabilities: list[float], id2label: dict[int | str, str] | None = None
) -> dict[str, float]:
    if len(probabilities) != len(MODEL_LABELS):
        raise EmotionInferenceError(
            f"Expected {len(MODEL_LABELS)} emotion logits, got {len(probabilities)}"
        )
    labels = list(MODEL_LABELS)
    if id2label:
        raw_labels = [
            id2label.get(index, id2label.get(str(index))) for index in range(len(labels))
        ]
        labels = [KOREAN_TO_SERVER_LABEL.get(label, label) for label in raw_labels]
    if set(labels) != set(MODEL_LABELS):
        raise EmotionInferenceError(f"Unsupported checkpoint labels: {labels}")
    raw = dict(zip(labels, map(float, probabilities), strict=True))
    return {label: raw[label] for label in LABELS}


def fuse_emotions(
    text_probs: dict[str, float] | None,
    voice_probs: dict[str, float] | None,
) -> dict[str, float]:
    if text_probs is None and voice_probs is None:
        raise EmotionInferenceError("Both emotion models failed")
    if text_probs is None:
        return dict(voice_probs or {})
    if voice_probs is None:
        return dict(text_probs)

    total_weight = settings.emotion_fusion_text_weight + settings.emotion_fusion_voice_weight
    if total_weight <= 0:
        raise EmotionInferenceError("Emotion fusion weights must have a positive sum")
    fused = {
        label: (
            text_probs[label] * settings.emotion_fusion_text_weight
            + voice_probs[label] * settings.emotion_fusion_voice_weight
        )
        / total_weight
        for label in LABELS
    }
    total = sum(fused.values())
    if total <= 0:
        raise EmotionInferenceError("Fused emotion probabilities have zero mass")
    return {label: value / total for label, value in fused.items()}


def dominant_emotion(emotion_probs: dict[str, float]) -> str:
    return max(emotion_probs.items(), key=lambda item: item[1])[0]


def classify_and_fuse(text: str, audio_bytes: bytes, sample_rate: int = 16000) -> dict[str, float]:
    mode = settings.emotion_mode.strip().lower()
    if mode == "test":
        return dict(TEST_EMOTION)
    if mode != "model":
        raise ValueError("EMOTION_MODE must be one of: test, model")

    predictions: dict[str, dict[str, float] | None] = {"text": None, "voice": None}
    for modality, classify, value in (
        ("text", classify_text_emotion, text),
        ("voice", lambda data: classify_voice_emotion(data, sample_rate), audio_bytes),
    ):
        try:
            predictions[modality] = classify(value)
        except EmotionInferenceError as exc:
            logger.warning("%s emotion unavailable: %s", modality, exc)
    return fuse_emotions(predictions["text"], predictions["voice"])
