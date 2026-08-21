import io
import unittest
import wave

import numpy as np

from app.services import audio_features


class DecodeAudioTests(unittest.TestCase):
    def test_decode_wav_is_mono_16khz(self):
        samples = (np.sin(np.linspace(0, np.pi * 4, 1600)) * 32767).astype("<i2")
        buffer = io.BytesIO()
        with wave.open(buffer, "wb") as wav:
            wav.setnchannels(1)
            wav.setsampwidth(2)
            wav.setframerate(16000)
            wav.writeframes(samples.tobytes())

        decoded = audio_features._decode_audio(buffer.getvalue(), 16000)
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

        decoded = audio_features._decode_audio(buffer.getvalue(), 16_000)
        self.assertEqual(decoded.dtype, np.float32)
        self.assertGreater(len(decoded), 15_000)
        self.assertLess(len(decoded), 17_000)

    def test_decode_garbage_raises(self):
        with self.assertRaises(audio_features.AudioFeatureExtractionError):
            audio_features._decode_audio(b"not-real-audio", 16000)


def _tone_wav_bytes(duration_sec: float, frequency_hz: float, sample_rate: int = 16000) -> bytes:
    sample_count = int(duration_sec * sample_rate)
    t = np.linspace(0, duration_sec, sample_count, endpoint=False)
    samples = (np.sin(2 * np.pi * frequency_hz * t) * 0.5 * 32767).astype("<i2")
    buffer = io.BytesIO()
    with wave.open(buffer, "wb") as wav:
        wav.setnchannels(1)
        wav.setsampwidth(2)
        wav.setframerate(sample_rate)
        wav.writeframes(samples.tobytes())
    return buffer.getvalue()


def _silence_wav_bytes(duration_sec: float, sample_rate: int = 16000) -> bytes:
    sample_count = int(duration_sec * sample_rate)
    samples = np.zeros(sample_count, dtype="<i2")
    buffer = io.BytesIO()
    with wave.open(buffer, "wb") as wav:
        wav.setnchannels(1)
        wav.setsampwidth(2)
        wav.setframerate(sample_rate)
        wav.writeframes(samples.tobytes())
    return buffer.getvalue()


class ExtractFeaturesTests(unittest.TestCase):
    def test_requires_non_empty_audio(self):
        with self.assertRaises(audio_features.AudioFeatureExtractionError):
            audio_features.extract_features(b"", 16000)

    def test_tone_has_expected_duration_energy_and_low_pitch_variation(self):
        result = audio_features.extract_features(_tone_wav_bytes(1.0, 150.0), 16000)

        self.assertAlmostEqual(result["duration_sec"], 1.0, places=1)
        self.assertGreater(result["rms_energy"], 0.0)
        self.assertLess(result["silence_ratio"], 0.5)
        # 순수 단일 주파수 톤이므로 프레임 간 피치 추정치 변동이 거의 없어야 한다.
        self.assertLess(result["pitch_variation_hz"], 5.0)

    def test_silence_has_full_silence_ratio_and_zero_energy(self):
        result = audio_features.extract_features(_silence_wav_bytes(1.0), 16000)

        self.assertEqual(result["rms_energy"], 0.0)
        self.assertEqual(result["silence_ratio"], 1.0)
        self.assertEqual(result["pitch_variation_hz"], 0.0)

    def test_decode_failure_raises(self):
        with self.assertRaises(audio_features.AudioFeatureExtractionError):
            audio_features.extract_features(b"not-real-audio", 16000)


class FormatFeaturesForPromptTests(unittest.TestCase):
    def test_formats_all_four_fields(self):
        text = audio_features.format_features_for_prompt(
            {
                "duration_sec": 4.2,
                "rms_energy": 0.031,
                "silence_ratio": 0.18,
                "pitch_variation_hz": 12.4,
            }
        )

        self.assertIn("4.2초", text)
        self.assertIn("0.031", text)
        self.assertIn("18%", text)
        self.assertIn("12.4Hz", text)


if __name__ == "__main__":
    unittest.main()
