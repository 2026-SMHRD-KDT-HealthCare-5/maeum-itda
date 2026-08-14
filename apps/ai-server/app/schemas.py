"""백엔드와 AI 서버 사이의 REST 응답 스키마."""

from typing import Literal

from pydantic import BaseModel, Field


class ScaleAnalysis(BaseModel):
    scaleType: Literal["SGDS_K", "GAD_7", "LSNS_6"]
    questionNumber: int
    analysisScore: Literal[0, 1]


class AnswerAnalysis(BaseModel):
    messageId: int
    transcript: str
    sentimentLabel: Literal["POSITIVE", "NEUTRAL", "NEGATIVE"]
    scaleAnalyses: list[ScaleAnalysis] = Field(default_factory=list)


class BatchAnalysisResponse(BaseModel):
    answers: list[AnswerAnalysis]
    nextQuestion: str
    ttsAudioBase64: str
    ttsMimeType: str
