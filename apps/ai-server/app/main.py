"""마음잇다 AI 서버 (FastAPI REST)."""

import asyncio
import logging
from pathlib import Path

from fastapi import FastAPI, File, Form, HTTPException, UploadFile

from app.config import get_settings
from app.schemas import AnswerAnalysis, BatchAnalysisResponse
from app.services import emotion as emotion_service
from app.services import llm as llm_service
from app.services import stt as stt_service
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
) -> BatchAnalysisResponse:
    """WebSocket 대신 한 질문의 음성 묶음을 REST로 분석한다."""
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

    answers: list[AnswerAnalysis] = []
    transcripts: list[str] = []
    emotions: list[dict[str, float]] = []

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
        transcripts.append(stt_result.text)
        emotions.append(emotion)
        answers.append(
            AnswerAnalysis(
                messageId=message_id,
                transcript=stt_result.text,
                sentimentLabel=_to_sentiment_label(emotion),
                scaleAnalyses=[],
            )
        )

    session = SessionState(session_id=generation_id, user_id=str(question_message_id))
    llm_result = await asyncio.to_thread(
        llm_service.generate_next_question,
        "\n".join(transcripts),
        _average_emotions(emotions),
        session,
    )
    next_question = llm_result.get("ai_question")

    return BatchAnalysisResponse(
        answers=answers,
        nextQuestion=next_question if isinstance(next_question, str) else None,
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


def _average_emotions(items: list[dict[str, float]]) -> dict[str, float]:
    labels = set().union(*(item.keys() for item in items))
    return {
        label: sum(item.get(label, 0.0) for item in items) / len(items)
        for label in labels
    }


if __name__ == "__main__":
    import uvicorn

    settings = get_settings()
    uvicorn.run("app.main:app", host=settings.host, port=settings.port, reload=True)
