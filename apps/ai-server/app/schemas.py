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
    # STT·척도·다음 질문은 성공하고 TTS만 실패한 경우 두 필드는 함께 null이다.
    ttsAudioBase64: str | None
    ttsMimeType: str | None


class TtsSynthesizeRequest(BaseModel):
    text: str = Field(min_length=1, max_length=2000)


class TtsSynthesizeResponse(BaseModel):
    ttsAudioBase64: str
    ttsMimeType: str


# UC-06-4(FR-03-06): 하루치 대화 한 턴. speakerType은 백엔드 SpeakerType과 맞춘다.
class DailyConversationTurn(BaseModel):
    speakerType: Literal["SENIOR", "AI"]
    content: str
    sentimentLabel: Literal["POSITIVE", "NEUTRAL", "NEGATIVE"] | None = None


class DailySummaryRequest(BaseModel):
    seniorId: int
    reportDate: str  # YYYY-MM-DD(Asia/Seoul 업무일), 프롬프트에는 노출하지 않고 로깅용
    turns: list[DailyConversationTurn]


# 유효한 시니어 발화가 없으면(FR-03-06 대안흐름 A1) 생성을 생략하고 둘 다 null이다 —
# 백엔드 DB의 RECOMMENDED_ACTION 컬럼도 nullable이라 그대로 맞는다.
# conversationSummary: "한 줄 요약"(oneLineSummary) 결정이 취소되어 200~300자
# (3~4문장) 분량으로 바뀌었다 — 필드명도 프론트 entities/report/model이 이미 쓰는
# conversationSummary로 맞춘다. 백엔드 DB의 ONE_LINE_SUMMARY 컬럼명·길이 제약
# (varchar 500)도 이에 맞춰 갱신이 필요하지만, 그건 별도 백엔드 작업이다.
class DailySummaryResponse(BaseModel):
    conversationSummary: str | None
    recommendedAction: str | None


# 재진입 시 오늘 마지막 메시지가 시니어 답변으로 끝난 경우(주로 chat:end 중
# 처리 중이던 답변만 저장되고 다음 질문은 저장되지 않은 경우), 새 음성 답변 없이
# 기존 문맥만으로 이어갈 질문을 생성할 때 쓴다. speakerType/content만 필요하고
# sentimentLabel은 쓰지 않아 DailyConversationTurn과는 별도 모델로 둔다.
class ResumeConversationTurn(BaseModel):
    speakerType: Literal["SENIOR", "AI"]
    content: str


class NextQuestionRequest(BaseModel):
    seniorId: int
    prevSessionSummary: str = ""
    pendingScaleItems: dict[str, list[str]] = Field(default_factory=dict)
    conversationTurns: list[ResumeConversationTurn] = Field(default_factory=list)


class NextQuestionResponse(BaseModel):
    question: str
    ttsAudioBase64: str | None
    ttsMimeType: str | None
