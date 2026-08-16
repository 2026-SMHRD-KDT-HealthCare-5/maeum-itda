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


class ExtractCorrectedTranscriptsTests(unittest.TestCase):
    def test_collects_valid_corrections_by_message_id(self):
        data = {
            "answer_analyses": [
                {"message_id": 102, "corrected_transcript": "오늘 산책했어요."},
                {"message_id": 103, "corrected_transcript": "비가 와서 속상해요."},
            ]
        }
        self.assertEqual(
            llm._extract_corrected_transcripts(data),
            {102: "오늘 산책했어요.", 103: "비가 와서 속상해요."},
        )

    def test_skips_missing_or_blank_corrections(self):
        data = {
            "answer_analyses": [
                {"message_id": 102, "corrected_transcript": ""},
                {"message_id": 103},
                {"message_id": 104, "corrected_transcript": "   "},
                "garbage",
            ]
        }
        self.assertEqual(llm._extract_corrected_transcripts(data), {})

    def test_skips_items_without_int_message_id(self):
        data = {"answer_analyses": [{"message_id": "102", "corrected_transcript": "텍스트"}]}
        self.assertEqual(llm._extract_corrected_transcripts(data), {})


class ApplyCorrectedTranscriptsTests(unittest.TestCase):
    def test_test_mode_ignores_llm_output_and_uses_original_text(self):
        answers = [_answer(102, "오늘 산책핬어요")]
        data = {"answer_analyses": [{"message_id": 102, "corrected_transcript": "오늘 산책했어요."}]}
        with patch.object(llm.settings, "stt_correction_mode", "test"):
            result = llm._apply_corrected_transcripts(
                [{"message_id": 102, "scale_analyses": []}], answers, data
            )
        self.assertEqual(result[0]["corrected_transcript"], "오늘 산책핬어요")

    def test_model_mode_uses_llm_correction(self):
        answers = [_answer(102, "오늘 산책핬어요")]
        data = {"answer_analyses": [{"message_id": 102, "corrected_transcript": "오늘 산책했어요."}]}
        with patch.object(llm.settings, "stt_correction_mode", "model"):
            result = llm._apply_corrected_transcripts(
                [{"message_id": 102, "scale_analyses": []}], answers, data
            )
        self.assertEqual(result[0]["corrected_transcript"], "오늘 산책했어요.")

    def test_model_mode_falls_back_to_original_when_llm_omits_correction(self):
        answers = [_answer(102, "오늘 산책핬어요")]
        data = {"answer_analyses": [{"message_id": 102}]}
        with patch.object(llm.settings, "stt_correction_mode", "model"):
            result = llm._apply_corrected_transcripts(
                [{"message_id": 102, "scale_analyses": []}], answers, data
            )
        self.assertEqual(result[0]["corrected_transcript"], "오늘 산책핬어요")

    def test_preserves_existing_keys(self):
        answers = [_answer(102)]
        with patch.object(llm.settings, "stt_correction_mode", "test"):
            result = llm._apply_corrected_transcripts(
                [{"message_id": 102, "scale_analyses": [llm.TEST_SCALE_ANALYSIS_ITEM]}],
                answers,
                {},
            )
        self.assertEqual(result[0]["scale_analyses"], [llm.TEST_SCALE_ANALYSIS_ITEM])


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

    def test_default_stt_correction_mode_ignores_llm_correction(self):
        answers = [_answer(102, "오늘 산책핬어요")]
        content = json.dumps(
            {
                "ai_question": "산책하면서 무엇이 좋으셨어요?",
                "answer_analyses": [
                    {"message_id": 102, "corrected_transcript": "오늘 산책했어요."}
                ],
            }
        )

        with patch.object(llm, "_get_openai_client", return_value=self._mock_client(content)):
            result = llm.generate_next_question(answers, _session())

        self.assertEqual(result["answer_analyses"][0]["corrected_transcript"], "오늘 산책핬어요")

    def test_model_stt_correction_mode_uses_llm_correction(self):
        answers = [_answer(102, "오늘 산책핬어요"), _answer(103, "비가 와서 속상해요")]
        content = json.dumps(
            {
                "ai_question": "산책하면서 무엇이 좋으셨어요?",
                "answer_analyses": [
                    {"message_id": 102, "corrected_transcript": "오늘 산책했어요."},
                    {"message_id": 103, "scale_analyses": []},
                ],
            }
        )

        with patch.object(llm.settings, "stt_correction_mode", "model"), patch.object(
            llm, "_get_openai_client", return_value=self._mock_client(content)
        ):
            result = llm.generate_next_question(answers, _session())

        by_id = {
            item["message_id"]: item["corrected_transcript"] for item in result["answer_analyses"]
        }
        self.assertEqual(by_id[102], "오늘 산책했어요.")
        # 103은 LLM이 교정을 생략했으니 원문 그대로 유지된다.
        self.assertEqual(by_id[103], "비가 와서 속상해요")

    def test_fallback_on_openai_failure_uses_original_text_as_transcript(self):
        answers = [_answer(102, "오늘 산책핬어요")]
        client = MagicMock()
        client.chat.completions.create.side_effect = RuntimeError("OpenAI unavailable")

        with patch.object(llm, "_get_openai_client", return_value=client):
            result = llm.generate_next_question(answers, _session())

        self.assertEqual(result["answer_analyses"][0]["corrected_transcript"], "오늘 산책핬어요")


def _turn(speaker_type: str, content: str, sentiment_label: str | None = None) -> dict:
    return {"speaker_type": speaker_type, "content": content, "sentiment_label": sentiment_label}


class GenerateDailySummaryTests(unittest.TestCase):
    def _mock_client(self, content: str) -> MagicMock:
        client = MagicMock()
        client.chat.completions.create.return_value = MagicMock(
            choices=[MagicMock(message=MagicMock(content=content))]
        )
        return client

    def test_no_senior_turn_skips_generation_without_calling_llm(self):
        turns = [_turn("AI", "오늘 하루는 어떠셨어요?")]

        with patch.object(llm, "_get_openai_client") as get_client:
            result = llm.generate_daily_summary(turns)

        get_client.assert_not_called()
        self.assertEqual(result, {"conversation_summary": None, "recommended_action": None})

    def test_empty_turns_skips_generation(self):
        result = llm.generate_daily_summary([])
        self.assertEqual(result, {"conversation_summary": None, "recommended_action": None})

    def test_default_mode_returns_fixed_stub(self):
        turns = [_turn("SENIOR", "오늘 산책했어요.", "POSITIVE")]

        with patch.object(llm, "_get_openai_client") as get_client:
            result = llm.generate_daily_summary(turns)

        get_client.assert_not_called()
        self.assertEqual(result, llm.DAILY_SUMMARY_STUB)

    def test_model_mode_uses_llm_output(self):
        turns = [_turn("SENIOR", "오늘 산책했어요.", "POSITIVE")]
        content = json.dumps(
            {
                "conversation_summary": "오늘은 산책 이야기를 즐겁게 나누셨어요.",
                "recommended_action": "산책 다녀오신 걸 칭찬해 주시는 건 어떨까요?",
            }
        )

        with patch.object(llm.settings, "daily_summary_mode", "model"), patch.object(
            llm, "_get_openai_client", return_value=self._mock_client(content)
        ):
            result = llm.generate_daily_summary(turns)

        self.assertEqual(result["conversation_summary"], "오늘은 산책 이야기를 즐겁게 나누셨어요.")
        self.assertEqual(result["recommended_action"], "산책 다녀오신 걸 칭찬해 주시는 건 어떨까요?")

    def test_model_mode_falls_back_to_none_on_llm_failure(self):
        turns = [_turn("SENIOR", "오늘 산책했어요.")]
        client = MagicMock()
        client.chat.completions.create.side_effect = RuntimeError("OpenAI unavailable")

        with patch.object(llm.settings, "daily_summary_mode", "model"), patch.object(
            llm, "_get_openai_client", return_value=client
        ):
            result = llm.generate_daily_summary(turns)

        self.assertEqual(result, {"conversation_summary": None, "recommended_action": None})

    def test_model_mode_treats_blank_fields_as_none(self):
        turns = [_turn("SENIOR", "오늘 산책했어요.")]
        content = json.dumps({"conversation_summary": "   ", "recommended_action": ""})

        with patch.object(llm.settings, "daily_summary_mode", "model"), patch.object(
            llm, "_get_openai_client", return_value=self._mock_client(content)
        ):
            result = llm.generate_daily_summary(turns)

        self.assertEqual(result, {"conversation_summary": None, "recommended_action": None})

    def test_invalid_mode_fails_fast(self):
        turns = [_turn("SENIOR", "오늘 산책했어요.")]
        with patch.object(llm.settings, "daily_summary_mode", "invalid"):
            with self.assertRaisesRegex(
                ValueError, "DAILY_SUMMARY_MODE must be one of: test, model"
            ):
                llm.generate_daily_summary(turns)


if __name__ == "__main__":
    unittest.main()
