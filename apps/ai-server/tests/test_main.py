import base64
import unittest
from unittest.mock import AsyncMock, patch

from fastapi.testclient import TestClient

from app.config import get_settings
from app.main import _tts_mime_type, app
from app.services.emotion import EmotionInferenceError
from app.services.stt import SttResult
from app.session_manager import SessionState


class AudioBatchApiTests(unittest.TestCase):
    def setUp(self):
        self.client = TestClient(app)

    @staticmethod
    def _multipart(*, end_type: str = "manual", audio: bytes = b"RIFF-test"):
        return [
            ("questionMessageId", (None, "101")),
            ("generationId", (None, "550e8400-e29b-41d4-a716-446655440000")),
            ("audioFiles", ("answer.audio", audio, "audio/wav")),
            ("messageIds", (None, "102")),
            ("audioTransferIds", (None, "audio-transfer-001")),
            ("capturedAts", (None, "2026-08-13T00:00:00.000Z")),
            ("endTypes", (None, end_type)),
        ]

    @staticmethod
    def _multipart_batch(entries: list[dict]):
        """답변 여러 건을 한 배치로 묶은 multipart 요청을 만든다 (NestJS가 실제로 보내는 형태)."""
        fields: list[tuple[str, tuple]] = [
            ("questionMessageId", (None, "101")),
            ("generationId", (None, "550e8400-e29b-41d4-a716-446655440000")),
        ]
        for index, entry in enumerate(entries, start=1):
            fields.extend(
                [
                    ("audioFiles", (f"answer-{index}.audio", entry["audio"], "audio/wav")),
                    ("messageIds", (None, str(entry["message_id"]))),
                    ("audioTransferIds", (None, f"audio-transfer-{index:03d}")),
                    ("capturedAts", (None, "2026-08-13T00:00:00.000Z")),
                    ("endTypes", (None, "manual")),
                ]
            )
        return fields

    def test_health(self):
        response = self.client.get("/health")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json(), {"status": "ok"})

    def test_audio_batch_runs_stt_emotion_and_llm(self):
        # 다음 질문 텍스트는 TTS를 기다리지 않고 즉시 반환한다(main.py 참고) — 이 배치
        # 엔드포인트는 더 이상 TTS를 합성하지 않는다. 음성은 백엔드가 별도로
        # POST /tts/synthesize를 호출해 받는다.
        with (
            patch(
                "app.main.stt_service.transcribe",
                return_value=SttResult(ok=True, text="오늘 산책했어요.", engine="mock"),
            ) as transcribe,
            patch(
                "app.main.emotion_service.classify_and_fuse",
                return_value={
                    "happy": 0.8,
                    "sad": 0.05,
                    "angry": 0.05,
                    "anxious": 0.05,
                    "neutral": 0.05,
                },
            ) as classify,
            patch(
                "app.main.llm_service.generate_next_question",
                return_value={"ai_question": "산책하면서 무엇이 좋으셨어요?"},
            ) as generate,
        ):
            response = self.client.post(
                "/analysis/audio/batch",
                files=self._multipart(),
            )

        self.assertEqual(response.status_code, 200, response.text)
        self.assertEqual(
            response.json(),
            {
                "answers": [
                    {
                        "messageId": 102,
                        "transcript": "오늘 산책했어요.",
                        "sentimentLabel": "POSITIVE",
                        "scaleAnalyses": [],
                    }
                ],
                "nextQuestion": "산책하면서 무엇이 좋으셨어요?",
            },
        )
        transcribe.assert_called_once()
        classify.assert_called_once()
        generate.assert_called_once()
        called_answers = generate.call_args[0][0]
        self.assertEqual(
            called_answers,
            [
                {
                    "message_id": 102,
                    "text": "오늘 산책했어요.",
                    "emotion": {
                        "happy": 0.8,
                        "sad": 0.05,
                        "angry": 0.05,
                        "anxious": 0.05,
                        "neutral": 0.05,
                    },
                }
            ],
        )

    def test_audio_batch_handles_multiple_answers_independently(self):
        with (
            patch(
                "app.main.stt_service.transcribe",
                side_effect=[
                    SttResult(ok=True, text="오늘 산책했어요.", engine="mock"),
                    SttResult(ok=True, text="비가 와서 속상해요.", engine="mock"),
                ],
            ),
            patch(
                "app.main.emotion_service.classify_and_fuse",
                side_effect=[
                    {"happy": 0.8, "sad": 0.05, "angry": 0.05, "anxious": 0.05, "neutral": 0.05},
                    {"happy": 0.05, "sad": 0.7, "angry": 0.05, "anxious": 0.15, "neutral": 0.05},
                ],
            ),
            patch(
                "app.main.llm_service.generate_next_question",
                return_value={
                    "ai_question": "다음엔 뭐 하고 싶으세요?",
                    "answer_analyses": [
                        {"message_id": 102, "scale_analyses": []},
                        {
                            "message_id": 103,
                            "scale_analyses": [
                                {
                                    "scale_type": "GAD_7",
                                    "question_number": 1,
                                    "analysis_score": 1,
                                }
                            ],
                        },
                    ],
                },
            ) as generate,
        ):
            response = self.client.post(
                "/analysis/audio/batch",
                files=self._multipart_batch(
                    [
                        {"message_id": 102, "audio": b"RIFF-1"},
                        {"message_id": 103, "audio": b"RIFF-2"},
                    ]
                ),
            )

        self.assertEqual(response.status_code, 200, response.text)
        answers = response.json()["answers"]
        self.assertEqual([answer["messageId"] for answer in answers], [102, 103])
        self.assertEqual(answers[0]["transcript"], "오늘 산책했어요.")
        self.assertEqual(answers[1]["transcript"], "비가 와서 속상해요.")
        self.assertEqual(answers[0]["sentimentLabel"], "POSITIVE")
        self.assertEqual(answers[1]["sentimentLabel"], "NEGATIVE")
        self.assertEqual(answers[0]["scaleAnalyses"], [])
        self.assertEqual(
            answers[1]["scaleAnalyses"],
            [{"scaleType": "GAD_7", "questionNumber": 1, "analysisScore": 1}],
        )

        called_answers = generate.call_args[0][0]
        self.assertEqual([answer["message_id"] for answer in called_answers], [102, 103])

    def test_audio_batch_uses_corrected_transcript_when_present(self):
        with (
            patch(
                "app.main.stt_service.transcribe",
                return_value=SttResult(ok=True, text="오늘 산책핬어요", engine="mock"),
            ),
            patch(
                "app.main.emotion_service.classify_and_fuse",
                return_value={"neutral": 1.0},
            ),
            patch(
                "app.main.llm_service.generate_next_question",
                return_value={
                    "ai_question": "산책은 어떠셨어요?",
                    "answer_analyses": [
                        {
                            "message_id": 102,
                            "corrected_transcript": "오늘 산책했어요.",
                            "scale_analyses": [],
                        }
                    ],
                },
            ),
        ):
            response = self.client.post(
                "/analysis/audio/batch",
                files=self._multipart(),
            )

        self.assertEqual(response.status_code, 200, response.text)
        self.assertEqual(response.json()["answers"][0]["transcript"], "오늘 산책했어요.")

    def test_audio_batch_defaults_session_context_when_backend_omits_it(self):
        """이전 백엔드가 문맥 필드를 생략해도 안전한 기본값으로 동작한다."""
        with (
            patch(
                "app.main.stt_service.transcribe",
                return_value=SttResult(ok=True, text="오늘 산책했어요.", engine="mock"),
            ),
            patch(
                "app.main.emotion_service.classify_and_fuse",
                return_value={"neutral": 1.0},
            ),
            patch(
                "app.main.llm_service.generate_next_question",
                return_value={"ai_question": "산책은 어떠셨어요?"},
            ) as generate,
        ):
            response = self.client.post(
                "/analysis/audio/batch",
                files=self._multipart(),
            )

        self.assertEqual(response.status_code, 200, response.text)
        session = generate.call_args[0][1]
        self.assertIsInstance(session, SessionState)
        self.assertEqual(session.prev_session_summary, "")
        self.assertEqual(session.pending_scale_items, {})
        self.assertEqual(session.conversation_turns, [])

    def test_audio_batch_fills_session_context_from_backend_fields(self):
        with (
            patch(
                "app.main.stt_service.transcribe",
                return_value=SttResult(ok=True, text="오늘 산책했어요.", engine="mock"),
            ),
            patch(
                "app.main.emotion_service.classify_and_fuse",
                return_value={"neutral": 1.0},
            ),
            patch(
                "app.main.llm_service.generate_next_question",
                return_value={"ai_question": "산책은 어떠셨어요?"},
            ) as generate,
        ):
            fields = self._multipart() + [
                ("prevSessionSummary", (None, "어제는 산책을 다녀오셨다고 함")),
                ("pendingScaleItems", (None, '{"SGDS_K": ["1", "2"]}')),
                (
                    "conversationTurns",
                    (
                        None,
                        '[{"speakerType":"AI","content":"오늘 기분은 어떠세요?"}]',
                    ),
                ),
            ]
            response = self.client.post("/analysis/audio/batch", files=fields)

        self.assertEqual(response.status_code, 200, response.text)
        session = generate.call_args[0][1]
        self.assertEqual(session.prev_session_summary, "어제는 산책을 다녀오셨다고 함")
        self.assertEqual(session.pending_scale_items, {"SGDS_K": ["1", "2"]})
        self.assertEqual(
            session.conversation_turns,
            [{"speakerType": "AI", "content": "오늘 기분은 어떠세요?"}],
        )

    def test_audio_batch_rejects_invalid_conversation_turns(self):
        with patch("app.main.stt_service.transcribe") as transcribe:
            fields = self._multipart() + [
                ("conversationTurns", (None, '[{"speakerType":"SYSTEM","content":"x"}]')),
            ]
            response = self.client.post("/analysis/audio/batch", files=fields)

        self.assertEqual(response.status_code, 422)
        transcribe.assert_not_called()

    def test_audio_batch_rejects_malformed_pending_scale_items(self):
        with patch("app.main.stt_service.transcribe") as transcribe:
            fields = self._multipart() + [
                ("pendingScaleItems", (None, "not-json")),
            ]
            response = self.client.post("/analysis/audio/batch", files=fields)

        self.assertEqual(response.status_code, 422)
        transcribe.assert_not_called()

    def test_rejects_invalid_end_type_before_external_services(self):
        with patch("app.main.stt_service.transcribe") as transcribe:
            response = self.client.post(
                "/analysis/audio/batch",
                files=self._multipart(end_type="invalid"),
            )

        self.assertEqual(response.status_code, 422)
        self.assertEqual(response.json()["detail"], "endTypes 값이 올바르지 않습니다.")
        transcribe.assert_not_called()

    def test_stt_failure_returns_422_and_stops_pipeline(self):
        with (
            patch(
                "app.main.stt_service.transcribe",
                return_value=SttResult(ok=False, reason="음성을 인식하지 못했습니다."),
            ),
            patch("app.main.emotion_service.classify_and_fuse") as classify,
            patch("app.main.llm_service.generate_next_question") as generate,
        ):
            response = self.client.post(
                "/analysis/audio/batch",
                files=self._multipart(),
            )

        self.assertEqual(response.status_code, 422)
        self.assertIn("messageId=102 STT 실패", response.json()["detail"])
        classify.assert_not_called()
        generate.assert_not_called()

    def test_emotion_inference_failure_falls_back_to_neutral_instead_of_500(self):
        """텍스트/음성 감정모델이 둘 다 실패해도(EmotionInferenceError) STT가 이미
        성공한 턴은 500으로 죽지 않고 중립 감정으로 대체되어 계속 진행해야 한다."""
        with (
            patch(
                "app.main.stt_service.transcribe",
                return_value=SttResult(ok=True, text="오늘 산책했어요.", engine="mock"),
            ),
            patch(
                "app.main.emotion_service.classify_and_fuse",
                side_effect=EmotionInferenceError("Both emotion models failed"),
            ),
            patch(
                "app.main.llm_service.generate_next_question",
                return_value={"ai_question": "산책은 어떠셨어요?"},
            ) as generate,
        ):
            response = self.client.post(
                "/analysis/audio/batch",
                files=self._multipart(),
            )

        self.assertEqual(response.status_code, 200, response.text)
        self.assertEqual(response.json()["answers"][0]["sentimentLabel"], "NEUTRAL")
        called_answers = generate.call_args[0][0]
        self.assertEqual(
            called_answers[0]["emotion"],
            {"happy": 0.0, "angry": 0.0, "sad": 0.0, "anxious": 0.0, "neutral": 1.0},
        )

    def test_empty_llm_question_returns_502(self):
        with (
            patch(
                "app.main.stt_service.transcribe",
                return_value=SttResult(ok=True, text="오늘 산책했어요.", engine="mock"),
            ),
            patch(
                "app.main.emotion_service.classify_and_fuse",
                return_value={"neutral": 1.0},
            ),
            patch(
                "app.main.llm_service.generate_next_question",
                return_value={"ai_question": "   "},
            ),
        ):
            response = self.client.post(
                "/analysis/audio/batch",
                files=self._multipart(),
            )

        self.assertEqual(response.status_code, 502)
        self.assertEqual(response.json()["detail"], "LLM 다음 질문 생성에 실패했습니다.")


class TtsSynthesizeApiTests(unittest.TestCase):
    def setUp(self):
        self.client = TestClient(app)

    def test_synthesizes_first_question(self):
        with patch(
            "app.main.tts_service.synthesize_full",
            new=AsyncMock(return_value=b"mock-mp3"),
        ) as synthesize:
            response = self.client.post(
                "/tts/synthesize",
                json={"text": "오늘 하루는 어땠나요?"},
            )

        self.assertEqual(response.status_code, 200, response.text)
        self.assertEqual(
            response.json(),
            {
                "ttsAudioBase64": base64.b64encode(b"mock-mp3").decode("ascii"),
                "ttsMimeType": _tts_mime_type(
                    get_settings().typecast_audio_format.lower()
                ),
            },
        )
        synthesize.assert_awaited_once_with("오늘 하루는 어땠나요?")

    def test_rejects_blank_text(self):
        response = self.client.post("/tts/synthesize", json={"text": "   "})

        self.assertEqual(response.status_code, 422)
        self.assertEqual(response.json()["detail"], "TTS 변환 문장이 비어 있습니다.")

    def test_rejects_text_longer_than_2000_characters(self):
        response = self.client.post("/tts/synthesize", json={"text": "가" * 2001})

        self.assertEqual(response.status_code, 422)

    def test_typecast_failure_returns_502(self):
        with patch(
            "app.main.tts_service.synthesize_full",
            new=AsyncMock(side_effect=RuntimeError("Typecast unavailable")),
        ):
            response = self.client.post("/tts/synthesize", json={"text": "첫 질문"})

        self.assertEqual(response.status_code, 502)
        self.assertEqual(response.json()["detail"], "TTS 음성 생성에 실패했습니다.")

    def test_empty_audio_returns_502(self):
        with patch(
            "app.main.tts_service.synthesize_full",
            new=AsyncMock(return_value=b""),
        ):
            response = self.client.post("/tts/synthesize", json={"text": "첫 질문"})

        self.assertEqual(response.status_code, 502)
        self.assertEqual(response.json()["detail"], "TTS 음성 결과가 비어 있습니다.")


class TtsSynthesizeStreamApiTests(unittest.TestCase):
    def setUp(self):
        self.client = TestClient(app)

    @staticmethod
    async def _chunks(*parts: bytes):
        for part in parts:
            yield part

    def test_streams_audio_chunks_as_they_are_generated(self):
        with patch(
            "app.main.tts_service.synthesize_stream",
            return_value=self._chunks(b"chunk-1", b"chunk-2"),
        ) as synthesize:
            response = self.client.post(
                "/tts/synthesize/stream",
                json={"text": "산책은 어떠셨어요?"},
            )

        self.assertEqual(response.status_code, 200, response.text)
        self.assertEqual(response.content, b"chunk-1chunk-2")
        self.assertEqual(
            response.headers["content-type"],
            _tts_mime_type(get_settings().typecast_audio_format.lower()),
        )
        synthesize.assert_called_once_with("산책은 어떠셨어요?")

    def test_rejects_blank_text(self):
        response = self.client.post(
            "/tts/synthesize/stream", json={"text": "   "}
        )

        self.assertEqual(response.status_code, 422)
        self.assertEqual(response.json()["detail"], "TTS 변환 문장이 비어 있습니다.")

    def test_empty_stream_returns_502(self):
        with patch(
            "app.main.tts_service.synthesize_stream",
            return_value=self._chunks(),
        ):
            response = self.client.post(
                "/tts/synthesize/stream", json={"text": "첫 질문"}
            )

        self.assertEqual(response.status_code, 502)
        self.assertEqual(response.json()["detail"], "TTS 음성 결과가 비어 있습니다.")

    def test_failure_before_first_chunk_returns_502(self):
        async def _failing():
            raise RuntimeError("Typecast unavailable")
            yield b""  # pragma: no cover - 도달하지 않음, 제너레이터 형태를 위해 필요

        with patch(
            "app.main.tts_service.synthesize_stream",
            return_value=_failing(),
        ):
            response = self.client.post(
                "/tts/synthesize/stream", json={"text": "첫 질문"}
            )

        self.assertEqual(response.status_code, 502)
        self.assertEqual(response.json()["detail"], "TTS 음성 생성에 실패했습니다.")


class DailySummaryApiTests(unittest.TestCase):
    def setUp(self):
        self.client = TestClient(app)

    def test_generates_summary_from_conversation_turns(self):
        with patch(
            "app.main.llm_service.generate_daily_summary",
            return_value={
                "conversation_summary": "오늘은 산책 이야기를 나누셨어요.",
                "recommended_action": "안부 전화를 드려보세요.",
            },
        ) as generate:
            response = self.client.post(
                "/reports/daily-summary",
                json={
                    "seniorId": 7,
                    "reportDate": "2026-08-17",
                    "turns": [
                        {"speakerType": "AI", "content": "오늘 하루 어떠셨어요?"},
                        {
                            "speakerType": "SENIOR",
                            "content": "산책 다녀왔어요.",
                            "sentimentLabel": "POSITIVE",
                        },
                    ],
                },
            )

        self.assertEqual(response.status_code, 200, response.text)
        self.assertEqual(
            response.json(),
            {
                "conversationSummary": "오늘은 산책 이야기를 나누셨어요.",
                "recommendedAction": "안부 전화를 드려보세요.",
            },
        )
        called_turns = generate.call_args[0][0]
        self.assertEqual(
            called_turns,
            [
                {"speaker_type": "AI", "content": "오늘 하루 어떠셨어요?", "sentiment_label": None},
                {
                    "speaker_type": "SENIOR",
                    "content": "산책 다녀왔어요.",
                    "sentiment_label": "POSITIVE",
                },
            ],
        )

    def test_returns_null_fields_when_generation_skipped(self):
        with patch(
            "app.main.llm_service.generate_daily_summary",
            return_value={"conversation_summary": None, "recommended_action": None},
        ):
            response = self.client.post(
                "/reports/daily-summary",
                json={
                    "seniorId": 7,
                    "reportDate": "2026-08-17",
                    "turns": [{"speakerType": "AI", "content": "오늘 하루 어떠셨어요?"}],
                },
            )

        self.assertEqual(response.status_code, 200, response.text)
        self.assertEqual(
            response.json(), {"conversationSummary": None, "recommendedAction": None}
        )

    def test_rejects_invalid_speaker_type(self):
        response = self.client.post(
            "/reports/daily-summary",
            json={
                "seniorId": 7,
                "reportDate": "2026-08-17",
                "turns": [{"speakerType": "GUARDIAN", "content": "..."}],
            },
        )

        self.assertEqual(response.status_code, 422)


if __name__ == "__main__":
    unittest.main()
