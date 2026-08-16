"""백엔드와 AI 서버 사이의 REST 응답 스키마."""

from typing import Literal

from pydantic import BaseModel, Field


class ScaleAnalysis(BaseModel):
    scaleType: Literal["SGDS_K", "GAD_7", "LSNS_6"]
    questionNumber: int
    analysisScore: Literal[0, 1]


class AnswerAnalysis(BaseModel):
    messageId: int
    # STT_CORRECTION_MODE=model이면 LLM이 교정한 문장, 아니면 STT 원문 그대로다
    # (llm.py의 _apply_corrected_transcripts 참고) — 둘 중 어느 쪽이든 이 필드
    # 하나로 나가므로 백엔드/프론트는 교정 여부를 신경 쓸 필요가 없다.
    transcript: str
    sentimentLabel: Literal["POSITIVE", "NEUTRAL", "NEGATIVE"]
    scaleAnalyses: list[ScaleAnalysis] = Field(default_factory=list)


class BatchAnalysisResponse(BaseModel):
    answers: list[AnswerAnalysis]
    nextQuestion: str
    ttsAudioBase64: str
    ttsMimeType: str
