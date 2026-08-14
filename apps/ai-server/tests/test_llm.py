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

    def test_passes_with_valid_scale_analysis_items(self):
        result = llm._validate_answer_analyses(
            [102],
            [
                {
                    "message_id": 102,
                    "scale_analyses": [
                        {"scale_type": "GAD_7", "question_number": 4, "analysis_score": 1}
                    ],
                }
            ],
        )
        self.assertEqual(result[0]["scale_analyses"][0]["analysis_score"], 1)

    def test_raises_on_unknown_scale_type(self):
        with self.assertRaisesRegex(ValueError, "알 수 없는 scale_type"):
            llm._validate_answer_analyses(
                [102],
                [
                    {
                        "message_id": 102,
                        "scale_analyses": [
                            {"scale_type": "SGDS-K", "question_number": 1, "analysis_score": 0}
                        ],
                    }
                ],
            )

    def test_raises_when_question_number_out_of_range_for_scale(self):
        with self.assertRaisesRegex(ValueError, "question_number 범위 초과"):
            llm._validate_answer_analyses(
                [102],
                [
                    {
                        "message_id": 102,
                        "scale_analyses": [
                            {"scale_type": "GAD_7", "question_number": 10, "analysis_score": 0}
                        ],
                    }
                ],
            )

    def test_raises_when_question_number_not_int(self):
        with self.assertRaisesRegex(ValueError, "question_number가 정수가 아님"):
            llm._validate_answer_analyses(
                [102],
                [
                    {
                        "message_id": 102,
                        "scale_analyses": [
                            {"scale_type": "GAD_7", "question_number": "4", "analysis_score": 0}
                        ],
                    }
                ],
            )

    def test_raises_when_analysis_score_not_zero_or_one(self):
        with self.assertRaisesRegex(ValueError, "analysis_score가 0/1이 아님"):
            llm._validate_answer_analyses(
                [102],
                [
                    {
                        "message_id": 102,
                        "scale_analyses": [
                            {"scale_type": "GAD_7", "question_number": 4, "analysis_score": 2}
                        ],
                    }
                ],
            )

    def test_raises_when_analysis_score_is_bool(self):
        with self.assertRaisesRegex(ValueError, "analysis_score가 0/1이 아님"):
            llm._validate_answer_analyses(
                [102],
                [
                    {
                        "message_id": 102,
                        "scale_analyses": [
                            {"scale_type": "GAD_7", "question_number": 4, "analysis_score": True}
                        ],
                    }
                ],
            )


class StubAnswerAnalysesTests(unittest.TestCase):
    def test_test_mode_returns_fixed_scale_analysis_per_message_id(self):
        answers = [_answer(102), _answer(103)]
        with patch.object(llm.settings, "scale_analysis_mode", "test"):
            result = llm._stub_answer_analyses(answers)
        self.assertEqual(
            result,
            [
                {"message_id": 102, "scale_analyses": [llm.TEST_SCALE_ANALYSIS_ITEM]},
                {"message_id": 103, "scale_analyses": [llm.TEST_SCALE_ANALYSIS_ITEM]},
            ],
        )

    def test_empty_mode_returns_empty_scale_analyses_per_message_id(self):
        answers = [_answer(102), _answer(103)]
        with patch.object(llm.settings, "scale_analysis_mode", "empty"):
            result = llm._stub_answer_analyses(answers)
        self.assertEqual(
            result,
            [
                {"message_id": 102, "scale_analyses": []},
                {"message_id": 103, "scale_analyses": []},
            ],
        )

    def test_invalid_scale_analysis_mode_fails_fast(self):
        with patch.object(llm.settings, "scale_analysis_mode", "invalid"):
            with self.assertRaisesRegex(
                ValueError, "SCALE_ANALYSIS_MODE must be one of: test, empty"
            ):
                llm._stub_answer_analyses([_answer(102)])

    def test_mutating_returned_item_does_not_affect_other_answers(self):
        with patch.object(llm.settings, "scale_analysis_mode", "test"):
            result = llm._stub_answer_analyses([_answer(102), _answer(103)])
        result[0]["scale_analyses"][0]["analysis_score"] = 0
        self.assertEqual(result[1]["scale_analyses"][0]["analysis_score"], 1)


class ExtractAnswerAnalysesTests(unittest.TestCase):
    def test_normalizes_shape_from_llm_response(self):
        data = {
            "answer_analyses": [
                {
                    "message_id": 102,
                    "scale_analyses": [
                        {"scale_type": "GAD_7", "question_number": 4, "analysis_score": 1}
                    ],
                },
                {"message_id": 103, "scale_analyses": []},
            ]
        }
        result = llm._extract_answer_analyses(data)
        self.assertEqual(
            result,
            [
                {
                    "message_id": 102,
                    "scale_analyses": [
                        {"scale_type": "GAD_7", "question_number": 4, "analysis_score": 1}
                    ],
                },
                {"message_id": 103, "scale_analyses": []},
            ],
        )

    def test_missing_answer_analyses_key_returns_empty_list(self):
        self.assertEqual(llm._extract_answer_analyses({}), [])

    def test_drops_non_dict_items(self):
        data = {"answer_analyses": [{"message_id": 102, "scale_analyses": []}, "garbage", None]}
        result = llm._extract_answer_analyses(data)
        self.assertEqual(result, [{"message_id": 102, "scale_analyses": []}])


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
            self.assertEqual(item["scale_analyses"], [llm.TEST_SCALE_ANALYSIS_ITEM])

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

    def test_model_mode_uses_real_llm_scale_analyses_instead_of_stub(self):
        answers = [_answer(102), _answer(103)]
        content = json.dumps(
            {
                "ai_question": "요즘 잠은 잘 주무세요?",
                "answer_analyses": [
                    {
                        "message_id": 102,
                        "scale_analyses": [
                            {"scale_type": "SGDS_K", "question_number": 3, "analysis_score": 1}
                        ],
                    },
                    {"message_id": 103, "scale_analyses": []},
                ],
            }
        )

        with patch.object(llm.settings, "scale_analysis_mode", "model"), patch.object(
            llm, "_get_openai_client", return_value=self._mock_client(content)
        ):
            result = llm.generate_next_question(answers, _session())

        by_id = {item["message_id"]: item["scale_analyses"] for item in result["answer_analyses"]}
        self.assertEqual(
            by_id[102], [{"scale_type": "SGDS_K", "question_number": 3, "analysis_score": 1}]
        )
        self.assertEqual(by_id[103], [])

    def test_model_mode_falls_back_when_llm_omits_a_requested_message_id(self):
        answers = [_answer(102), _answer(103)]
        content = json.dumps(
            {
                "ai_question": "요즘 잠은 잘 주무세요?",
                "answer_analyses": [{"message_id": 102, "scale_analyses": []}],
            }
        )

        with patch.object(llm.settings, "scale_analysis_mode", "model"), patch.object(
            llm, "_get_openai_client", return_value=self._mock_client(content)
        ):
            result = llm.generate_next_question(answers, _session())

        self.assertEqual(result["empathy_note"], "fallback")
        self.assertEqual(
            {item["message_id"] for item in result["answer_analyses"]}, {102, 103}
        )


if __name__ == "__main__":
    unittest.main()
