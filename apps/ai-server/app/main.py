"""마음잇다 AI 서버 (FastAPI REST)."""

import asyncio
import base64
import json
import logging
from pathlib import Path

from fastapi import FastAPI, File, Form, HTTPException, UploadFile

from app.config import get_settings
from app.schemas import (
    AnswerAnalysis,
    BatchAnalysisResponse,
    DailySummaryRequest,
    DailySummaryResponse,
    TtsSynthesizeRequest,
    TtsSynthesizeResponse,
)
from app.services import emotion as emotion_service
from app.services import llm as llm_service
from app.services import stt as stt_service
from app.services import tts as tts_service
from app.session_manager import SessionState

logging.basicConfig(level=get_settings().log_level)
logger = logging.getLogger("maum_itda")

app = FastAPI(title="마음잇다 AI 서버")


@app.get("/health")
async def health():
    return {"status": "ok"}


@app.post("/analysis/audio/batch", response_model=BatchAnalysisResponse)
async def analyze_audio_batch(
    question_message_id: int = Form(alias="questionMessageId"),
    generation_id: str = Form(alias="generationId"),
    audio_files: list[UploadFile] = File(alias="audioFiles"),
    message_ids: list[int] = Form(alias="messageIds"),
    audio_transfer_ids: list[str] = Form(alias="audioTransferIds"),
    captured_ats: list[str] = Form(alias="capturedAts"),
    end_types: list[str] = Form(alias="endTypes"),
    prev_session_summary: str = Form(alias="prevSessionSummary", default=""),
    pending_scale_items: str = Form(alias="pendingScaleItems", default="{}"),
) -> BatchAnalysisResponse:
    """WebSocket 대신 한 질문의 음성 묶음을 REST로 분석한다.

    prevSessionSummary/pendingScaleItems는 백엔드가 아직 채워 보내지 않으므로
    (8/18 연동 예정) 기본값(빈 문자열/빈 객체)으로도 기존과 동일하게 동작해야 한다.
    """
    lengths = {
        len(audio_files),
        len(message_ids),
        len(audio_transfer_ids),
        len(captured_ats),
        len(end_types),
    }
    if len(lengths) != 1 or not audio_files:
        raise HTTPException(status_code=422, detail="반복 필드 개수가 일치하지 않습니다.")
    if any(end_type not in {"auto", "manual"} for end_type in end_types):
        raise HTTPException(status_code=422, detail="endTypes 값이 올바르지 않습니다.")

    pending_scale_items_dict = _parse_pending_scale_items(pending_scale_items)

    processed_answers: list[dict] = []

    for audio_file, message_id in zip(audio_files, message_ids, strict=True):
        audio_bytes = await audio_file.read()
        audio_format = _resolve_audio_format(audio_file)

        stt_result = await asyncio.to_thread(stt_service.transcribe, audio_bytes, audio_format)
        if not stt_result.ok:
            raise HTTPException(
                status_code=422,
                detail=f"messageId={message_id} STT 실패: {stt_result.reason}",
            )

        emotion = await asyncio.to_thread(
            emotion_service.classify_and_fuse,
            stt_result.text,
            audio_bytes,
            16000,
        )
        processed_answers.append(
            {"message_id": message_id, "text": stt_result.text, "emotion": emotion}
        )

    session = SessionState(
        session_id=generation_id,
        user_id=str(question_message_id),
        prev_session_summary=prev_session_summary,
        pending_scale_items=pending_scale_items_dict,
    )
    llm_result = await asyncio.to_thread(
        llm_service.generate_next_question,
        processed_answers,
        session,
    )
    next_question = llm_result.get("ai_question")
    if not isinstance(next_question, str) or not next_question.strip():
        raise HTTPException(status_code=502, detail="LLM 다음 질문 생성에 실패했습니다.")

    answer_analyses_by_message_id = {
        item["message_id"]: item for item in llm_result.get("answer_analyses", [])
    }
    answers = [
        AnswerAnalysis(
            messageId=answer["message_id"],
            transcript=answer_analyses_by_message_id.get(answer["message_id"], {}).get(
                "corrected_transcript", answer["text"]
            ),
            sentimentLabel=_to_sentiment_label(answer["emotion"]),
            scaleAnalyses=_to_scale_analyses(
                answer_analyses_by_message_id.get(answer["message_id"], {}).get(
                    "scale_analyses", []
                )
            ),
        )
        for answer in processed_answers
    ]

    # 분석·질문 생성과 TTS 장애를 분리한다. Typecast가 실패해도 텍스트 대화는 계속된다.
    tts_audio_base64: str | None = None
    tts_mime_type: str | None = None
    try:
        tts_audio = await tts_service.synthesize_full(next_question)
        if tts_audio:
            audio_format = get_settings().typecast_audio_format.lower()
            tts_audio_base64 = base64.b64encode(tts_audio).decode("ascii")
            tts_mime_type = _tts_mime_type(audio_format)
        else:
            logger.warning("다음 질문 TTS 결과가 비어 있어 텍스트 질문만 반환합니다.")
    except Exception:  # noqa: BLE001
        logger.exception("다음 질문 TTS 생성 실패, 텍스트 질문으로 계속 진행합니다.")

    return BatchAnalysisResponse(
        answers=answers,
        nextQuestion=next_question,
        ttsAudioBase64=tts_audio_base64,
        ttsMimeType=tts_mime_type,
    )


@app.post("/tts/synthesize", response_model=TtsSynthesizeResponse)
async def synthesize_tts(request: TtsSynthesizeRequest) -> TtsSynthesizeResponse:
    """NestJS가 저장한 첫 질문을 Typecast 음성으로 변환한다.

    첫 질문은 음성 분석 요청 전에 생성되므로 `/analysis/audio/batch`와 분리한다.
    이 API가 실패하면 NestJS는 텍스트 질문으로 대화를 계속한다.
    """
    text = request.text.strip()
    if not text:
        raise HTTPException(status_code=422, detail="TTS 변환 문장이 비어 있습니다.")

    try:
        tts_audio = await tts_service.synthesize_full(text)
    except Exception as exc:  # noqa: BLE001
        logger.exception("첫 질문 TTS 생성 실패: %s", exc)
        raise HTTPException(status_code=502, detail="TTS 음성 생성에 실패했습니다.") from exc

    if not tts_audio:
        raise HTTPException(status_code=502, detail="TTS 음성 결과가 비어 있습니다.")

    audio_format = get_settings().typecast_audio_format.lower()
    return TtsSynthesizeResponse(
        ttsAudioBase64=base64.b64encode(tts_audio).decode("ascii"),
        ttsMimeType=_tts_mime_type(audio_format),
    )


@app.post("/reports/daily-summary", response_model=DailySummaryResponse)
async def generate_daily_summary(request: DailySummaryRequest) -> DailySummaryResponse:
    """UC-06-4(FR-03-06): 하루치 대화로 일간 요약·추천 행동을 생성한다.

    백엔드가 그날(reportDate) 시니어·AI 발화 전체를 시간순으로 모아 보내면,
    유효한 시니어 발화가 있을 때만 LLM으로 conversationSummary/recommendedAction을
    만든다(없으면 대안흐름 A1에 따라 생성을 생략하고 둘 다 null). seniorId/
    reportDate는 아직 로깅 이상의 용도로 쓰지 않는다 — 프롬프트에는 대화
    내용만 넣는다.
    """
    turns = [
        {
            "speaker_type": turn.speakerType,
            "content": turn.content,
            "sentiment_label": turn.sentimentLabel,
        }
        for turn in request.turns
    ]
    result = await asyncio.to_thread(llm_service.generate_daily_summary, turns)
    return DailySummaryResponse(
        conversationSummary=result["conversation_summary"],
        recommendedAction=result["recommended_action"],
    )


def _to_sentiment_label(emotion: dict[str, float]) -> str:
    positive = sum(emotion.get(key, 0.0) for key in ("happy", "joy", "positive"))
    neutral = emotion.get("neutral", 0.0)
    negative = sum(
        emotion.get(key, 0.0)
        for key in ("sad", "angry", "anxious", "fear", "disgust", "negative")
    )
    return max(
        {"POSITIVE": positive, "NEUTRAL": neutral, "NEGATIVE": negative},
        key=lambda label: {"POSITIVE": positive, "NEUTRAL": neutral, "NEGATIVE": negative}[label],
    )


def _parse_pending_scale_items(raw: str) -> dict[str, list[str]]:
    """`{"SGDS_K": ["1", "3"], ...}` 형태의 JSON 문자열을 파싱한다.

    백엔드가 아직 이 필드를 보내지 않는 동안은 기본값("{}")이 그대로 들어와
    빈 dict가 되고, llm.py의 프롬프트 구성은 이전처럼 "채점된 문항 없음"으로 취급한다.
    """
    try:
        parsed = json.loads(raw) if raw else {}
    except json.JSONDecodeError as exc:
        raise HTTPException(
            status_code=422, detail="pendingScaleItems가 올바른 JSON이 아닙니다."
        ) from exc

    if not isinstance(parsed, dict) or not all(
        isinstance(scale_type, str)
        and isinstance(items, list)
        and all(isinstance(item, str) for item in items)
        for scale_type, items in parsed.items()
    ):
        raise HTTPException(
            status_code=422,
            detail="pendingScaleItems는 {scaleType: [questionNumber, ...]} 형태의 JSON 객체여야 합니다.",
        )
    return parsed


def _resolve_audio_format(audio_file: UploadFile) -> str:
    """백엔드의 `.audio` 파일명은 Content-Type을 기준으로 실제 포맷을 판별한다."""
    suffix = Path(audio_file.filename or "").suffix.lower().lstrip(".")
    if suffix and suffix != "audio":
        return suffix

    mime_subtype = (audio_file.content_type or "").partition("/")[2].partition(";")[0]
    return {
        "mpeg": "mp3",
        "x-wav": "wav",
    }.get(mime_subtype, mime_subtype or "webm")


def _to_scale_analyses(raw_items: list[dict]) -> list[dict]:
    """LLM이 snake_case로 반환한 척도 분석 항목을 백엔드 계약(camelCase)으로 변환한다."""
    return [
        {
            "scaleType": item["scale_type"],
            "questionNumber": item["question_number"],
            "analysisScore": item["analysis_score"],
        }
        for item in raw_items
    ]


def _tts_mime_type(audio_format: str) -> str:
    return {
        "mp3": "audio/mpeg",
        "wav": "audio/wav",
        "ogg": "audio/ogg",
    }.get(audio_format, f"audio/{audio_format}")


if __name__ == "__main__":
    import uvicorn

    settings = get_settings()
    uvicorn.run("app.main:app", host=settings.host, port=settings.port, reload=True)
