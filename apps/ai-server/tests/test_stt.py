"""
app/services/stt.py의 한국어 환각(hallucination) 방어 로직을 검증한다.
무음·잡음 입력에 OpenAI STT가 다른 언어로 엉뚱한 문장을 지어내는 사례
("Hello, world!", "Tienes que estudiar." 등)가 있어, 결과 텍스트의 한글
비율로 실제 답변인지 판별한다.
"""
import unittest
from unittest.mock import patch

from app.services.stt import SttResult, _is_plausible_korean_answer, transcribe


class IsPlausibleKoreanAnswerTests(unittest.TestCase):
    def test_pure_korean_text_passes(self):
        self.assertTrue(_is_plausible_korean_answer("오늘 하루는 산책을 했어요."))

    def test_english_hallucination_fails(self):
        self.assertFalse(_is_plausible_korean_answer("Hello, world!"))

    def test_spanish_hallucination_fails(self):
        self.assertFalse(_is_plausible_korean_answer("Tienes que estudiar."))

    def test_empty_text_fails(self):
        self.assertFalse(_is_plausible_korean_answer(""))

    def test_digits_and_symbols_only_fails(self):
        self.assertFalse(_is_plausible_korean_answer("123!!"))

    def test_majority_korean_with_some_latin_passes(self):
        self.assertTrue(_is_plausible_korean_answer("커피(coffee) 한 잔 마셨어요."))

    def test_majority_latin_with_some_korean_fails(self):
        self.assertFalse(_is_plausible_korean_answer("Thank you very much 감사"))


class TranscribeHallucinationGuardTests(unittest.TestCase):
    def test_openai_non_korean_result_falls_back_to_local_korean_result(self):
        with (
            patch("app.services.stt._transcribe_openai", return_value="Hello, world!"),
            patch("app.services.stt._transcribe_local", return_value="오늘 산책했어요."),
        ):
            result = transcribe(b"fake-audio", "webm")

        self.assertEqual(
            result,
            SttResult(ok=True, text="오늘 산책했어요.", engine="local_whisper"),
        )

    def test_both_engines_non_korean_fails(self):
        with (
            patch("app.services.stt._transcribe_openai", return_value="Hello, world!"),
            patch("app.services.stt._transcribe_local", return_value="Tienes que estudiar."),
        ):
            result = transcribe(b"fake-audio", "webm")

        self.assertFalse(result.ok)
        self.assertIn("non_korean_transcript", result.reason)

    def test_openai_korean_result_used_directly(self):
        with (
            patch("app.services.stt._transcribe_openai", return_value="네, 괜찮아요."),
            patch("app.services.stt._transcribe_local") as local_mock,
        ):
            result = transcribe(b"fake-audio", "webm")

        local_mock.assert_not_called()
        self.assertEqual(
            result,
            SttResult(ok=True, text="네, 괜찮아요.", engine="openai"),
        )

    def test_empty_audio_short_circuits_before_any_engine_call(self):
        result = transcribe(b"", "webm")
        self.assertEqual(result, SttResult(ok=False, reason="empty_audio"))


if __name__ == "__main__":
    unittest.main()
