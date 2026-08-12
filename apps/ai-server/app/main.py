"""
마음잇다 AI 서버 (FastAPI + WebSocket)

백엔드(Node/Nest.js) <-> 이 서버 간 단일 WebSocket 연결에서:
  1. 백엔드가 세션 시작 정보(session_init)와 발화별 오디오를 보내면
  2. STT -> 텍스트/음성 감정분류(+융합) -> LLM 꼬리질문 생성 -> TTS 스트리밍
  3. 결과(user_text, emotion, ai_question)와 TTS 오디오 청크를 백엔드로 돌려준다.

WS 메시지 시퀀스는 README.md 참고.
"""
import asyncio
import json
import logging

from fastapi import FastAPI, WebSocket, WebSocketDisconnect

from app.config import get_settings
from app.schemas import (
    SessionInit,
    UtteranceStart,
    SttFailed,
    TurnResult,
    TtsChunkMeta,
    TtsEnd,
    ErrorMsg,
)
from app.session_manager import session_manager, Turn, SessionState
from app.services import stt as stt_service
from app.services import emotion as emotion_service
from app.services import llm as llm_service
from app.services import tts as tts_service

logging.basicConfig(level=get_settings().log_level)
logger = logging.getLogger("maum_itda")

app = FastAPI(title="마음잇다 AI 서버")


@app.get("/health")
async def health():
    return {"status": "ok"}


@app.websocket("/ws/counsel/{session_id}")
async def counsel_ws(websocket: WebSocket, session_id: str):
    await websocket.accept()
    logger.info("[%s] WS 연결 수립", session_id)

    session: SessionState | None = None
    pending_meta: UtteranceStart | None = None

    try:
        while True:
            message = await websocket.receive()

            if message["type"] == "websocket.disconnect":
                break

            # ---- JSON 컨트롤 프레임 ----
            if message.get("text") is not None:
                try:
                    data = json.loads(message["text"])
                except json.JSONDecodeError:
                    await _send_error(websocket, None, "invalid_json")
                    continue

                mtype = data.get("type")

                if mtype == "session_init":
                    init = SessionInit(**data)
                    session = session_manager.create(
                        session_id=init.session_id,
                        user_id=init.user_id,
                        prev_summary=init.prev_session_summary,
                        pending_scale_items=init.pending_scale_items,
                    )
                    logger.info("[%s] 세션 초기화 완료 (user=%s)", init.session_id, init.user_id)

                elif mtype == "utterance_start":
                    pending_meta = UtteranceStart(**data)

                elif mtype == "session_end":
                    logger.info("[%s] 세션 종료 요청 수신", session_id)
                    break

                else:
                    logger.warning("[%s] 알 수 없는 메시지 타입: %s", session_id, mtype)

            # ---- 바이너리(오디오) 프레임 ----
            elif message.get("bytes") is not None:
                audio_bytes = message["bytes"]

                if session is None:
                    await _send_error(websocket, None, "session_not_initialized")
                    continue
                if pending_meta is None:
                    await _send_error(websocket, None, "utterance_start_missing")
                    continue

                meta = pending_meta
                pending_meta = None
                await handle_utterance(websocket, session, meta, audio_bytes)

    except WebSocketDisconnect:
        logger.info("[%s] WS 연결 끊김", session_id)
    except Exception as e:  # noqa: BLE001
        logger.exception("[%s] WS 처리 중 예외: %s", session_id, e)
        try:
            await _send_error(websocket, None, f"internal_error: {e}")
        except Exception:  # noqa: BLE001
            pass
    finally:
        if session is not None:
            session_manager.remove(session.session_id)
        logger.info("[%s] 세션 정리 완료", session_id)


async def handle_utterance(
    websocket: WebSocket,
    session: SessionState,
    meta: UtteranceStart,
    audio_bytes: bytes,
) -> None:
    """한 발화(utterance)에 대한 전체 파이프라인 처리."""

    # 1) STT (블로킹 작업이므로 스레드풀에서 실행)
    stt_result = await asyncio.to_thread(stt_service.transcribe, audio_bytes, meta.audio_format)
    if not stt_result.ok:
        await websocket.send_json(
            SttFailed(utterance_id=meta.utterance_id, reason=stt_result.reason).model_dump()
        )
        return

    user_text = stt_result.text

    # 2) 텍스트+음성 감정분류 -> 융합
    emotion = await asyncio.to_thread(
        emotion_service.classify_and_fuse, user_text, audio_bytes, meta.sample_rate
    )
    dominant = emotion_service.dominant_emotion(emotion)

    # 3) LLM 꼬리질문 생성 (텍스트 + 감정 + 세션 히스토리 + 이전 세션 요약)
    llm_result = await asyncio.to_thread(
        llm_service.generate_next_question, user_text, emotion, session
    )
    ai_question = llm_result["ai_question"]

    # 세션 히스토리에 반영
    session.add_turn(
        Turn(
            utterance_id=meta.utterance_id,
            user_text=user_text,
            emotion=emotion,
            ai_question=ai_question,
        )
    )

    # 4) 텍스트/감정/다음질문 결과를 먼저 전송
    #    (요구사항: STT 텍스트는 다음 질문 생성 시점에 함께 노출)
    await websocket.send_json(
        TurnResult(
            utterance_id=meta.utterance_id,
            user_text=user_text,
            emotion=emotion,
            dominant_emotion=dominant,
            ai_question=ai_question,
            target_scale=llm_result.get("target_scale"),
            target_item=llm_result.get("target_item"),
        ).model_dump()
    )

    # 5) TTS 스트리밍 - 청크가 생성되는 대로 바로 전송 (TTFB 최소화)
    try:
        chunk_index = 0
        async for chunk in tts_service.synthesize_stream(ai_question):
            await websocket.send_json(
                TtsChunkMeta(utterance_id=meta.utterance_id, chunk_index=chunk_index).model_dump()
            )
            await websocket.send_bytes(chunk)
            chunk_index += 1
        await websocket.send_json(TtsEnd(utterance_id=meta.utterance_id).model_dump())
    except Exception as e:  # noqa: BLE001
        logger.error("[%s] TTS 스트리밍 실패: %s", meta.utterance_id, e)
        await _send_error(websocket, meta.utterance_id, f"tts_failed: {e}")


async def _send_error(websocket: WebSocket, utterance_id: str | None, detail: str) -> None:
    await websocket.send_json(ErrorMsg(utterance_id=utterance_id, detail=detail).model_dump())


if __name__ == "__main__":
    import uvicorn

    settings = get_settings()
    uvicorn.run("app.main:app", host=settings.host, port=settings.port, reload=True)
