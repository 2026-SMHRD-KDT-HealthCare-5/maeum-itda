"""마음잇다 AI 서버 (FastAPI REST)."""

import asyncio
import base64
import json
import logging
import time
from pathlib import Path

from fastapi import FastAPI, File, Form, HTTPException, UploadFile, WebSocket, WebSocketDisconnect
from fastapi.responses import StreamingResponse

from app.config import get_settings
from app.schemas import (
    AnswerAnalysis,
    BatchAnalysisResponse,
    DailySummaryRequest,
    DailySummaryResponse,
    TtsSynthesizeRequest,
    TtsSynthesizeResponse,
)
from app.services import audio_features
from app.services import llm as llm_service
from app.services import stt as stt_service
from app.services import stt_live
from app.services import tts as tts_service
from app.session_manager import SessionState

logging.basicConfig(level=get_settings().log_level)
logger = logging.getLogger("maum_itda")

app = FastAPI(title="마음잇다 AI 서버")

# conversationTurns 페이로드 크기 안전장치 — 실제 프롬프트 사용량 제한이 아니다(위
# _parse_conversation_turns 참고).
MAX_CONVERSATION_TURNS = 200


@app.get("/health")
async def health():
    return {"status": "ok"}


@app.websocket("/analysis/stt/live")
async def stt_live_proxy(client_ws: WebSocket):
    """안부 대화 중 PCM 청크를 gpt-live-transcribe 세션으로 중계한다.

    NestJS ↔ FastAPI ↔ OpenAI Realtime. 클라이언트 JSON:
      {"type":"append","audio":"<base64 pcm16>"} | {"type":"commit"} | {"type":"close"}
    서버 JSON:
      {"type":"delta","delta":"..."} | {"type":"completed","transcript":"..."}
      | {"type":"error","reason":"...","unavailable":bool}
    """
    import websockets

    await client_ws.accept()
    settings = get_settings()
    if not settings.openai_api_key:
        await client_ws.send_json(
            {"type": "error", "reason": "OPENAI_API_KEY missing", "unavailable": True}
        )
        await client_ws.close()
        return

    openai_ws = None
    pump_task = None
    try:
        openai_ws = await websockets.connect(
            stt_live.OPENAI_REALTIME_URL,
            additional_headers={"Authorization": f"Bearer {settings.openai_api_key}"},
            open_timeout=10,
            close_timeout=5,
        )
        await openai_ws.send(
            json.dumps(
                stt_live.build_session_update(
                    language=settings.openai_stt_language,
                    prompt=settings.openai_stt_prompt,
                    delay=settings.openai_stt_delay,
                )
            )
        )

        async def pump_openai_events() -> None:
            assert openai_ws is not None
            async for raw in openai_ws:
                event = json.loads(raw)
                kind, text = stt_live.classify_realtime_event(event)
                if kind == "delta" and text:
                    await client_ws.send_json({"type": "delta", "delta": text})
                elif kind == "completed":
                    await client_ws.send_json({"type": "completed", "transcript": text})
                elif kind == "unavailable":
                    await client_ws.send_json(
                        {"type": "error", "reason": text, "unavailable": True}
                    )
                elif kind == "error":
                    await client_ws.send_json(
                        {"type": "error", "reason": text, "unavailable": False}
                    )

        pump_task = asyncio.create_task(pump_openai_events())

        while True:
            message = await client_ws.receive_json()
            msg_type = message.get("type")
            if msg_type == "append":
                audio = message.get("audio")
                if isinstance(audio, str) and audio:
                    await openai_ws.send(
                        json.dumps({"type": "input_audio_buffer.append", "audio": audio})
                    )
            elif msg_type == "commit":
                await openai_ws.send(json.dumps(stt_live.build_audio_commit()))
            elif msg_type == "close":
                break
    except WebSocketDisconnect:
        logger.info("live STT 클라이언트 연결 종료")
    except Exception as exc:  # noqa: BLE001
        logger.exception("live STT 프록시 실패: %s", exc)
        try:
            status = getattr(exc, "status_code", None) or getattr(exc, "status", None)
            unavailable = status in {401, 403}
            await client_ws.send_json(
                {
                    "type": "error",
                    "reason": str(exc),
                    "unavailable": unavailable,
                }
            )
        except Exception:  # noqa: BLE001
            pass
    finally:
        if pump_task is not None:
            pump_task.cancel()
            try:
                await pump_task
            except asyncio.CancelledError:
                pass
            except Exception:  # noqa: BLE001
                pass
        if openai_ws is not None:
            await openai_ws.close()
        try:
            await client_ws.close()
        except Exception:  # noqa: BLE001
            pass


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
    conversation_turns: str = Form(alias="conversationTurns", default="[]"),
) -> BatchAnalysisResponse:
    """WebSocket 대신 한 질문의 음성 묶음을 REST로 분석한다.

    세 문맥 필드는 백엔드가 DB에서 조회해 JSON 문자열로 전달한다. 기본값은 이전
    클라이언트와의 호환을 위해 유지한다.
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
    conversation_turns_list = _parse_conversation_turns(conversation_turns)

    # 임시 지연 진단 로그 — 구간별 소요시간을 questionMessageId로 상관지어 남긴다.
    # 원인 파악 끝나면 지울 것.
    t_request_start = time.monotonic()
    processed_answers: list[dict] = []

    t_stt_start = time.monotonic()
    for audio_file, message_id in zip(audio_files, message_ids, strict=True):
        audio_bytes = await audio_file.read()
        audio_format = _resolve_audio_format(audio_file)

        stt_result = await asyncio.to_thread(stt_service.transcribe, audio_bytes, audio_format)
        if not stt_result.ok:
            raise HTTPException(
                status_code=422,
                detail=f"messageId={message_id} STT 실패: {stt_result.reason}",
            )

        try:
            voice_features = await asyncio.to_thread(
                audio_features.extract_features,
                audio_bytes,
                16000,
            )
        except audio_features.AudioFeatureExtractionError:
            # 오디오 디코딩이 실패한 경우(손상된 파일 등)만 발생한다. STT는 이미
            # 성공했으니 이 턴 전체를 500으로 죽이는 대신 빈 음성 지표로 대체하고
            # 계속 진행한다 — 감정 판단은 LLM이 STT 텍스트만으로도 이어서 할 수 있다.
            logger.warning(
                "messageId=%s 음성 지표 추출이 실패해 빈 값으로 대체합니다.",
                message_id,
            )
            voice_features = dict(audio_features.EMPTY_FEATURES)

        processed_answers.append(
            {
                "message_id": message_id,
                "text": stt_result.text,
                "voice_features": voice_features,
            }
        )

    t_stt_end = time.monotonic()

    session = SessionState(
        session_id=generation_id,
        user_id=str(question_message_id),
        prev_session_summary=prev_session_summary,
        pending_scale_items=pending_scale_items_dict,
        conversation_turns=conversation_turns_list,
    )
    t_llm_start = time.monotonic()
    llm_result = await asyncio.to_thread(
        llm_service.generate_next_question,
        processed_answers,
        session,
    )
    t_llm_end = time.monotonic()
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
            sentimentLabel=answer_analyses_by_message_id.get(answer["message_id"], {}).get(
                "sentiment_label", "NEUTRAL"
            ),
            scaleAnalyses=_to_scale_analyses(
                answer_analyses_by_message_id.get(answer["message_id"], {}).get(
                    "scale_analyses", []
                )
            ),
        )
        for answer in processed_answers
    ]

    # 임시 지연 진단 로그 — 원인 파악 끝나면 지울 것.
    t_request_end = time.monotonic()
    logger.info(
        "[LATENCY] questionMessageId=%s stt=%.0fms llm=%.0fms ai_server_total=%.0fms",
        question_message_id,
        (t_stt_end - t_stt_start) * 1000,
        (t_llm_end - t_llm_start) * 1000,
        (t_request_end - t_request_start) * 1000,
    )

    # 다음 질문 텍스트는 TTS 합성을 기다리지 않고 곧바로 반환한다 — 화면 표시가
    # TTS 생성 시간만큼 불필요하게 지연되지 않게 하기 위함이다. 백엔드가 이 텍스트를
    # 먼저 전달한 뒤 별도로 POST /tts/synthesize를 호출해 음성을 뒤이어 전달한다.
    return BatchAnalysisResponse(
        answers=answers,
        nextQuestion=next_question,
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


@app.post("/tts/synthesize/stream")
async def synthesize_tts_stream(request: TtsSynthesizeRequest) -> StreamingResponse:
    """질문 텍스트를 실제 HTTP chunked transfer로 스트리밍 응답한다(TTFB 약 200ms,
    FR-01-05). 백엔드의 GET /chats/tts-stream이 이 응답을 그대로 프론트에 중계한다.

    첫 청크가 나올 때까지는 여기서 직접 기다린다 — StreamingResponse를 반환한
    뒤에는(응답 헤더가 이미 나간 뒤라) 제너레이터 안에서 발생한 예외를 더 이상
    깨끗한 HTTP 오류로 바꿀 수 없기 때문이다. 그래서 초반 실패(인증/네트워크 등)만
    502로 응답하고, 이미 시작된 스트리밍 중 실패는(드묾) 응답이 중간에 끊기는
    형태로 남는다.
    """
    text = request.text.strip()
    if not text:
        raise HTTPException(status_code=422, detail="TTS 변환 문장이 비어 있습니다.")

    generator = tts_service.synthesize_stream(text)
    try:
        first_chunk = await generator.__anext__()
    except StopAsyncIteration as exc:
        raise HTTPException(status_code=502, detail="TTS 음성 결과가 비어 있습니다.") from exc
    except Exception as exc:  # noqa: BLE001
        logger.exception("TTS 스트리밍 생성 실패: %s", exc)
        raise HTTPException(status_code=502, detail="TTS 음성 생성에 실패했습니다.") from exc

    async def _stream_from_first_chunk():
        yield first_chunk
        async for chunk in generator:
            yield chunk

    # tts_service.synthesize_stream()은 TYPECAST_AUDIO_FORMAT 설정과 무관하게 항상
    # mp3를 요청한다(app/services/tts.py 모듈 docstring 참고) — media_type도 그에 맞춰
    # 고정한다. 여기서 설정값을 그대로 읽으면 실제 바이트(mp3)와 선언한 Content-Type
    # (예: audio/wav)이 어긋나 브라우저가 디코딩에 실패한다.
    return StreamingResponse(_stream_from_first_chunk(), media_type="audio/mpeg")


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


def _parse_conversation_turns(raw: str) -> list[dict[str, str]]:
    """NestJS가 전달한 오늘 대화 전체를 프롬프트용 안전한 형태로 검증한다.

    2026-08-20부터 백엔드(AnalysisContextRepository)가 최근 5개 제한 없이 오늘
    대화 전체를 보낸다 — 여기 상한(MAX_CONVERSATION_TURNS)은 실제 사용량 제한이
    아니라 비정상적으로 큰 페이로드를 막는 안전장치일 뿐이다. [2026-08-21] 예전엔
    session_manager.history_as_text()가 이 중 최근 8개로 다시 잘랐으나, 그 축소가
    같은 날 앞서 나온 질문을 잊고 반복하는 원인이었음이 실제 대화 기록에서
    확인돼 제거했다 — 이제 여기서 통과된 전체가 그대로 프롬프트에 실린다."""
    try:
        parsed = json.loads(raw) if raw else []
    except json.JSONDecodeError as exc:
        raise HTTPException(
            status_code=422, detail="conversationTurns가 올바른 JSON이 아닙니다."
        ) from exc

    if not isinstance(parsed, list) or len(parsed) > MAX_CONVERSATION_TURNS:
        raise HTTPException(
            status_code=422,
            detail=f"conversationTurns는 최대 {MAX_CONVERSATION_TURNS}개의 JSON 배열이어야 합니다.",
        )

    validated: list[dict[str, str]] = []
    for turn in parsed:
        if not isinstance(turn, dict):
            raise HTTPException(status_code=422, detail="대화 항목은 JSON 객체여야 합니다.")
        speaker_type = turn.get("speakerType")
        content = turn.get("content")
        if (
            speaker_type not in {"AI", "SENIOR"}
            or not isinstance(content, str)
            or not content.strip()
            or len(content) > 4000
        ):
            raise HTTPException(
                status_code=422,
                detail="대화 항목에는 올바른 speakerType과 content가 필요합니다.",
            )
        validated.append({"speakerType": speaker_type, "content": content.strip()})
    return validated


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
