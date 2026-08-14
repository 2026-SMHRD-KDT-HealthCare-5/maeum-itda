"""마음잇다 AI 서버 (FastAPI REST)."""

import asyncio
import base64
import logging
from pathlib import Path

from fastapi import FastAPI, File, Form, HTTPException, UploadFile

from app.config import get_settings
from app.schemas import AnswerAnalysis, BatchAnalysisResponse
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

    session = SessionState(session_id=generation_id, user_id=str(question_message_id))
    llm_result = await asyncio.to_thread(
        llm_service.generate_next_question,
        processed_answers,
        session,
    )
    next_question = llm_result.get("ai_question")
    if not isinstance(next_question, str) or not next_question.strip():
        raise HTTPException(status_code=502, detail="LLM 다음 질문 생성에 실패했습니다.")

    analyses_by_message_id = {
        item["message_id"]: item["scale_analyses"]
        for item in llm_result.get("answer_analyses", [])
    }
    answers = [
        AnswerAnalysis(
            messageId=answer["message_id"],
            transcript=answer["text"],
            sentimentLabel=_to_sentiment_label(answer["emotion"]),
            scaleAnalyses=_to_scale_analyses(
                analyses_by_message_id.get(answer["message_id"], [])
            ),
        )
        for answer in processed_answers
    ]

    try:
        tts_audio = await tts_service.synthesize_full(next_question)
    except Exception as exc:  # noqa: BLE001
        logger.exception("TTS 생성 실패: %s", exc)
        raise HTTPException(status_code=502, detail="TTS 음성 생성에 실패했습니다.") from exc

    if not tts_audio:
        raise HTTPException(status_code=502, detail="TTS 음성 결과가 비어 있습니다.")

    audio_format = get_settings().typecast_audio_format.lower()

    return BatchAnalysisResponse(
        answers=answers,
        nextQuestion=next_question,
        ttsAudioBase64=base64.b64encode(tts_audio).decode("ascii"),
        ttsMimeType=_tts_mime_type(audio_format),
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
