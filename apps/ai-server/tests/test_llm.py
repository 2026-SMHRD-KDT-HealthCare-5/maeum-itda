import json
import unittest
from unittest.mock import MagicMock, patch

from app.services import llm
from app.session_manager import SessionState


def _session() -> SessionState:
    return SessionState(session_id="session-1", user_id="user-1")


def _answer(message_id: int, text: str = "발화", emotion: dict | None = None) -> dict:
    return {"message_id": message_id, "text": text, "emotion": emotion or {"neutral": 1.0}}


class BuildUserPromptTests(unittest.TestCase):
    def test_includes_each_answer_with_id_text_and_emotion(self):
        answers = [
            _answer(102, "요즘 걱정이 많아요.", {"sad": 0.6, "neutral": 0.4}),
            _answer(103, "그래도 산책은 좋았어요.", {"happy": 0.7, "neutral": 0.3}),
        ]

        prompt = llm.build_user_prompt(answers, _session())

        self.assertIn("messageId=102", prompt)
        self.assertIn("요즘 걱정이 많아요.", prompt)
        self.assertIn("sad:0.60", prompt)
        self.assertIn("messageId=103", prompt)
        self.assertIn("그래도 산책은 좋았어요.", prompt)
        self.assertIn("happy:0.70", prompt)


class ValidateAnswerAnalysesTests(unittest.TestCase):
    def test_passes_when_ids_match_regardless_of_order(self):
        result = llm._validate_answer_analyses(
            [102, 103],
            [
                {"message_id": 103, "scale_analyses": []},
                {"message_id": 102, "scale_analyses": []},
            ],
        )
        self.assertEqual(len(result), 2)

    def test_raises_when_id_missing(self):
        with self.assertRaisesRegex(ValueError, "messageId가 요청과 다릅니다"):
            llm._validate_answer_analyses(
                [102, 103],
                [{"message_id": 102, "scale_analyses": []}],
            )

    def test_raises_when_unrequested_id_present(self):
        with self.assertRaisesRegex(ValueError, "messageId가 요청과 다릅니다"):
            llm._validate_answer_analyses(
                [102],
                [
                    {"message_id": 102, "scale_analyses": []},
                    {"message_id": 999, "scale_analyses": []},
                ],
            )


class StubAnswerAnalysesTests(unittest.TestCase):
    def test_returns_empty_scale_analyses_per_message_id(self):
        answers = [_answer(102), _answer(103)]
        self.assertEqual(
            llm._stub_answer_analyses(answers),
            [
                {"message_id": 102, "scale_analyses": []},
                {"message_id": 103, "scale_analyses": []},
            ],
        )


class GenerateNextQuestionTests(unittest.TestCase):
    def _mock_client(self, content: str) -> MagicMock:
        client = MagicMock()
        client.chat.completions.create.return_value = MagicMock(
            choices=[MagicMock(message=MagicMock(content=content))]
        )
        return client

    def test_returns_stub_answer_analyses_matching_requested_ids(self):
        answers = [_answer(102), _answer(103)]
        content = json.dumps({"ai_question": "오늘 기분은 어떠셨어요?"})

        with patch.object(llm, "_get_openai_client", return_value=self._mock_client(content)):
            result = llm.generate_next_question(answers, _session())

        self.assertEqual(result["ai_question"], "오늘 기분은 어떠셨어요?")
        self.assertEqual(
            {item["message_id"] for item in result["answer_analyses"]}, {102, 103}
        )
        for item in result["answer_analyses"]:
            self.assertEqual(item["scale_analyses"], [])

    def test_fallback_on_openai_failure_still_returns_answer_analyses_for_all_ids(self):
        answers = [_answer(102), _answer(103)]
        client = MagicMock()
        client.chat.completions.create.side_effect = RuntimeError("OpenAI unavailable")

        with patch.object(llm, "_get_openai_client", return_value=client):
            result = llm.generate_next_question(answers, _session())

        self.assertEqual(result["empathy_note"], "fallback")
        self.assertEqual(
            {item["message_id"] for item in result["answer_analyses"]}, {102, 103}
        )


if __name__ == "__main__":
    unittest.main()
