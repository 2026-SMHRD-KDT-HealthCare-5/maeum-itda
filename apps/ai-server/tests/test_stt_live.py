"""gpt-live-transcribe Realtime 세션 계약 단위 테스트."""
import unittest

from app.services import stt_live


class SttLiveContractTests(unittest.TestCase):
    def test_session_update_uses_live_model_and_languages(self):
        payload = stt_live.build_session_update(language="ko", prompt="안부 대화", delay="low")
        transcription = payload["session"]["audio"]["input"]["transcription"]
        self.assertEqual(payload["session"]["type"], "transcription")
        self.assertEqual(transcription["model"], "gpt-live-transcribe")
        self.assertEqual(transcription["languages"], ["ko"])
        self.assertEqual(transcription["prompt"], "안부 대화")
        self.assertEqual(transcription["delay"], "low")
        self.assertIsNone(payload["session"]["audio"]["input"]["turn_detection"])

    def test_classify_delta_and_completed(self):
        self.assertEqual(
            stt_live.classify_realtime_event(
                {
                    "type": "conversation.item.input_audio_transcription.delta",
                    "delta": "안녕",
                }
            ),
            ("delta", "안녕"),
        )
        self.assertEqual(
            stt_live.classify_realtime_event(
                {
                    "type": "conversation.item.input_audio_transcription.completed",
                    "transcript": "안녕하세요",
                }
            ),
            ("completed", "안녕하세요"),
        )

    def test_classify_quota_as_unavailable(self):
        kind, _text = stt_live.classify_realtime_event(
            {
                "type": "error",
                "error": {"code": "insufficient_quota", "message": "quota"},
            }
        )
        self.assertEqual(kind, "unavailable")

    def test_iter_pcm_chunks(self):
        chunks = list(stt_live.iter_pcm_chunks(b"abcdefghij", chunk_size=4))
        self.assertEqual(chunks, [b"abcd", b"efgh", b"ij"])


if __name__ == "__main__":
    unittest.main()
