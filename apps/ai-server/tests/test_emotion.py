import io
import unittest
import wave
from types import SimpleNamespace
from unittest.mock import patch

import numpy as np

from app.services import emotion


def _probabilities(**overrides):
    values = {label: 0.2 for label in emotion.LABELS}
    values.update(overrides)
    return values


class EmotionTests(unittest.TestCase):
    def test_label_order_matches_training(self):
        self.assertEqual(
            emotion.LABELS,
            ("happy", "angry", "sad", "anxious", "neutral"),
        )

    def test_test_mode_returns_fixed_sad_without_calling_models(self):
        with (
            patch.object(emotion.settings, "emotion_mode", "test"),
            patch.object(emotion, "classify_text_emotion") as classify_text,
            patch.object(emotion, "classify_voice_emotion") as classify_voice,
        ):
            result = emotion.classify_and_fuse("answer", b"not-real-audio")

        self.assertEqual(result, emotion.TEST_EMOTION)
        self.assertAlmostEqual(sum(result.values()), 1.0, places=6)
        self.assertEqual(emotion.dominant_emotion(result), "sad")
        classify_text.assert_not_called()
        classify_voice.assert_not_called()

    def test_invalid_emotion_mode_fails_fast(self):
        with patch.object(emotion.settings, "emotion_mode", "invalid"):
            with self.assertRaisesRegex(
                ValueError,
                "EMOTION_MODE must be one of: test, model",
            ):
                emotion.classify_and_fuse("answer", b"audio")

    def test_checkpoint_label_order_is_mapped_to_server_labels(self):
        result = emotion._align_to_labels(
            [0.1, 0.2, 0.3, 0.15, 0.25],
            {0: "기쁨", 1: "분노", 2: "슬픔", 3: "불안", 4: "중립"},
        )
        self.assertEqual(
            result,
            {
                "happy": 0.1,
                "angry": 0.2,
                "sad": 0.3,
                "anxious": 0.15,
                "neutral": 0.25,
            },
        )
        self.assertAlmostEqual(sum(result.values()), 1.0)

    def test_text_inference_matches_empty_context_fusion_tokenization(self):
        import torch

        class FakeTokenizer:
            def __init__(self):
                self.call = None

            def __call__(self, *args, **kwargs):
                self.call = (args, kwargs)
                return {
                    "input_ids": torch.tensor([[0, 1]]),
                    "attention_mask": torch.tensor([[1, 1]]),
                    "token_type_ids": torch.tensor([[0, 1]]),
                }

        class FakeModel:
            config = SimpleNamespace(
                id2label={0: "기쁨", 1: "분노", 2: "슬픔", 3: "불안", 4: "중립"}
            )

            def __call__(self, **inputs):
                self.inputs = inputs
                return SimpleNamespace(logits=torch.tensor([[5.0, 1.0, 0.0, -1.0, -2.0]]))

        tokenizer = FakeTokenizer()
        model = FakeModel()
        with patch.object(
            emotion,
            "_get_text_model",
            return_value=(tokenizer, model, torch.device("cpu")),
        ):
            result = emotion.classify_text_emotion("오늘은 기분이 좋아요")

        self.assertEqual(tokenizer.call[0], ("", "오늘은 기분이 좋아요"))
        self.assertEqual(
            tokenizer.call[1],
            {"return_tensors": "pt", "truncation": True, "max_length": 192},
        )
        self.assertNotIn("token_type_ids", model.inputs)
        self.assertEqual(list(result), list(emotion.LABELS))
        self.assertAlmostEqual(sum(result.values()), 1.0, places=6)

    def test_fusion_is_normalized(self):
        result = emotion.fuse_emotions(
            _probabilities(happy=0.6, neutral=0.0),
            _probabilities(sad=0.6, neutral=0.0),
        )
        self.assertAlmostEqual(sum(result.values()), 1.0)

    def test_fusion_uses_current_calibrated_classwise_parameters(self):
        result = emotion.fuse_emotions(
            {
                "happy": 0.10,
                "angry": 0.08,
                "sad": 0.12,
                "anxious": 0.55,
                "neutral": 0.15,
            },
            {
                "happy": 0.01,
                "angry": 0.02,
                "sad": 0.92,
                "anxious": 0.03,
                "neutral": 0.02,
            },
        )

        expected = {
            "happy": 0.169497,
            "angry": 0.160008,
            "sad": 0.187288,
            "anxious": 0.285765,
            "neutral": 0.197441,
        }
        for label in emotion.LABELS:
            self.assertAlmostEqual(result[label], expected[label], places=6)
        self.assertAlmostEqual(sum(result.values()), 1.0, places=6)

    def test_fusion_uses_available_modality_without_uniform_fallback(self):
        voice = _probabilities(angry=0.6, neutral=0.0)
        self.assertEqual(emotion.fuse_emotions(None, voice), voice)

    def test_fusion_fails_when_both_modalities_are_unavailable(self):
        with self.assertRaisesRegex(
            emotion.EmotionInferenceError, "Both emotion models failed"
        ):
            emotion.fuse_emotions(None, None)

    def test_classify_and_fuse_falls_back_to_voice(self):
        voice = _probabilities(anxious=0.6, neutral=0.0)
        with (
            patch.object(emotion.settings, "emotion_mode", "model"),
            patch.object(
                emotion,
                "classify_text_emotion",
                side_effect=emotion.EmotionInferenceError("missing text model"),
            ),
            patch.object(emotion, "classify_voice_emotion", return_value=voice),
        ):
            self.assertEqual(emotion.classify_and_fuse("answer", b"audio"), voice)

    def test_decode_wav_is_mono_16khz(self):
        samples = (np.sin(np.linspace(0, np.pi * 4, 1600)) * 32767).astype("<i2")
        buffer = io.BytesIO()
        with wave.open(buffer, "wb") as wav:
            wav.setnchannels(1)
            wav.setsampwidth(2)
            wav.setframerate(16000)
            wav.writeframes(samples.tobytes())

        decoded = emotion._decode_audio(buffer.getvalue(), 16000)
        self.assertEqual(decoded.dtype, np.float32)
        self.assertEqual(len(decoded), 1600)

    def test_decode_webm_opus_is_mono_16khz(self):
        import av

        buffer = io.BytesIO()
        samples = np.sin(
            np.linspace(0, np.pi * 40, 48_000, dtype=np.float32)
        ).reshape(1, -1)
        with av.open(buffer, mode="w", format="webm") as container:
            stream = container.add_stream("libopus", rate=48_000)
            stream.layout = "mono"
            frame = av.AudioFrame.from_ndarray(samples, format="flt", layout="mono")
            frame.sample_rate = 48_000
            for packet in stream.encode(frame):
                container.mux(packet)
            for packet in stream.encode(None):
                container.mux(packet)

        decoded = emotion._decode_audio(buffer.getvalue(), 16_000)
        self.assertEqual(decoded.dtype, np.float32)
        self.assertGreater(len(decoded), 15_000)
        self.assertLess(len(decoded), 17_000)


if __name__ == "__main__":
    unittest.main()
