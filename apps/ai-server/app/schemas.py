"""
백엔드 <-> AI 서버 WebSocket 프로토콜 메시지 정의.

같은 WS 연결 위에서 "텍스트(JSON) 컨트롤 프레임"과 "바이너리(오디오) 프레임"을
번갈아 주고받는다. 순서 규약은 README.md의 "WS 메시지 시퀀스" 참고.
"""
from typing import Literal, Optional
from pydantic import BaseModel, Field


# ---------- 백엔드 -> AI 서버 ----------

class SessionInit(BaseModel):
    """연결 직후 백엔드가 가장 먼저 보내는 컨트롤 메시지."""
    type: Literal["session_init"] = "session_init"
    session_id: str
    user_id: str
    prev_session_summary: str = ""          # 이전 세션들 요약 (백엔드가 최초 1회 제공)
    pending_scale_items: dict[str, list[str]] = Field(default_factory=dict)
    # 예: {"SGDS_K": ["Q3","Q7"], "GAD_7": ["Q2"], "LSNS_6": []}
    # 오늘 아직 채점되지 않은 문항 목록. LLM이 꼬리질문 유도 시 참고.


class UtteranceStart(BaseModel):
    """발화(오디오) 바이너리 프레임 직전에 보내는 메타데이터."""
    type: Literal["utterance_start"] = "utterance_start"
    utterance_id: str
    audio_format: str = "webm"     # webm/opus, wav, pcm16 등
    sample_rate: int = 16000


class SessionEnd(BaseModel):
    type: Literal["session_end"] = "session_end"
    session_id: str


# ---------- AI 서버 -> 백엔드 ----------

class SttFailed(BaseModel):
    type: Literal["stt_failed"] = "stt_failed"
    utterance_id: str
    reason: str


class TurnResult(BaseModel):
    """STT + 감정분류 + LLM 질문 생성까지 끝났을 때 한 번에 내려주는 결과.
    요구사항상 '변환된 텍스트는 다음 질문이 생성되는 시점에 함께 노출'해야 하므로
    user_text와 ai_question을 한 메시지에 묶어서 보낸다."""
    type: Literal["turn_result"] = "turn_result"
    utterance_id: str
    user_text: str
    emotion: dict[str, float]           # 예: {"happy":0.1, "sad":0.6, ...}
    dominant_emotion: str
    ai_question: str
    target_scale: Optional[str] = None  # 예: "SGDS_K", "GAD_7", "LSNS_6", 없으면 None
    target_item: Optional[str] = None   # 예: "Q3"


class TtsChunkMeta(BaseModel):
    """TTS 오디오 바이너리 프레임 직전에 보내는 메타데이터."""
    type: Literal["tts_chunk_meta"] = "tts_chunk_meta"
    utterance_id: str
    chunk_index: int


class TtsEnd(BaseModel):
    type: Literal["tts_end"] = "tts_end"
    utterance_id: str


class ErrorMsg(BaseModel):
    type: Literal["error"] = "error"
    utterance_id: Optional[str] = None
    detail: str
