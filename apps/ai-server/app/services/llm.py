"""
LLM 서비스: (텍스트 + 감정 + 대화 문맥)을 받아 다음 꼬리질문을 생성한다.

요구사항정의서 FR-01-04 기준:
- 오늘 아직 채점되지 않은 SGDS_K / GAD_7 / LSNS_6 문항을 자연스럽게 유도하는
  공감형 꼬리질문을 생성해야 함.
- 감정 상태에 공감 반응을 먼저 보이고, 이어서 자연스럽게 척도 문항을 유도하도록 프롬프트 설계.

OpenAI Chat Completions를 JSON 모드로 호출해서 다음 구조로 받는다:
{
  "ai_question": "...",
  "target_scale": "SGDS_K" | "GAD_7" | "LSNS_6" | null,
  "target_item": "Q3" | null,
  "empathy_note": "..."   # 내부 로깅/디버깅용, 굳이 프론트에 노출 안 해도 됨
}

구조 변경(2026-08-14, feature/ai-llm-turn-analysis — 구조만):
- 같은 질문에 답변이 여러 개(배치) 묶여 올 수 있어, 텍스트·감정을 messageId별로
  구분해서 프롬프트에 넣는다(`answers: list[{message_id, text, emotion}]`).
- 백엔드 응답 계약에 필요한 `answer_analyses`(messageId별 척도 채점) 필드는
  이번 단계에서 구조(입출력 형태)만 맞춘다 — 실제 채점 프롬프트는 아직 작성하지
  않았고, `SCALE_ANALYSIS_MODE`(emotion.py의 `EMOTION_MODE`와 같은 패턴)에 따라
  `test`면 답변마다 고정 목업 채점(`TEST_SCALE_ANALYSIS_ITEM`)을, `empty`면 빈
  `scale_analyses`를 채우는 stub으로 대체한다. 실제 프롬프트 내용은
  `llm_prompts.py`의 TODO에 남겨뒀고 2단계에서 반영한다.
- `_validate_answer_analyses`는 돌려받은 messageId 집합이 요청과 정확히 일치하는지
  검증한다. 지금은 stub이 요청 그대로를 되돌려주므로 항상 통과하지만, 2단계에서
  실제 LLM 출력으로 교체되면 이 검증이 잘못된/누락된 messageId(환각)를 잡아낸다.
"""
import json
import logging
from functools import lru_cache

from openai import OpenAI

from app.config import get_settings
from app.services.llm_prompts import SYSTEM_PROMPT
from app.session_manager import SessionState

logger = logging.getLogger(__name__)
settings = get_settings()


@lru_cache
def _get_openai_client() -> OpenAI:
    return OpenAI(api_key=settings.openai_api_key, timeout=settings.openai_llm_timeout_sec)


def _format_emotion(emotion: dict[str, float]) -> str:
    return ", ".join(f"{k}:{v:.2f}" for k, v in sorted(emotion.items(), key=lambda kv: -kv[1]))


def build_user_prompt(
    answers: list[dict],
    session: SessionState,
) -> str:
    pending_str = json.dumps(session.pending_scale_items, ensure_ascii=False)
    answer_blocks = "\n\n".join(
        f"[답변 {index + 1}] (messageId={answer['message_id']})\n"
        f"발화: {answer['text']}\n"
        f"감정: {_format_emotion(answer['emotion'])}"
        for index, answer in enumerate(answers)
    )

    return f"""\
[이전 세션 요약]
{session.prev_session_summary or "(없음)"}

[오늘 대화 중 아직 채점되지 않은 척도 문항]
{pending_str}

[이번 세션 최근 대화 히스토리]
{session.history_as_text() or "(아직 없음, 이번 발화가 첫 턴)"}

[시니어의 방금 발화들(STT 결과, 같은 질문에 대한 답변 묶음)]
{answer_blocks}

위 정보를 참고해서 다음 AI 질문을 JSON으로 생성하세요."""


# 백엔드 DB의 CHECK 제약(SCALE_QUESTION_ANALYSIS 테이블)과 정확히 같은 범위를 써서,
# AI서버를 통과한 값이 DB 저장 단계에서 다시 튕겨나가는 일이 없게 한다.
SCALE_QUESTION_RANGES = {
    "SGDS_K": range(1, 16),  # 1~15
    "GAD_7": range(1, 8),  # 1~7
    "LSNS_6": range(1, 7),  # 1~6
}


def _validate_scale_analysis_item(item: dict) -> None:
    """scale_analyses 항목 하나의 scale_type/question_number/analysis_score 값을 검증한다."""
    scale_type = item.get("scale_type")
    question_number = item.get("question_number")
    analysis_score = item.get("analysis_score")

    if scale_type not in SCALE_QUESTION_RANGES:
        raise ValueError(f"알 수 없는 scale_type: {scale_type!r}")
    if not isinstance(question_number, int) or isinstance(question_number, bool):
        raise ValueError(f"question_number가 정수가 아님: {question_number!r}")
    if question_number not in SCALE_QUESTION_RANGES[scale_type]:
        raise ValueError(f"{scale_type}의 question_number 범위 초과: {question_number}")
    if isinstance(analysis_score, bool) or analysis_score not in (0, 1):
        raise ValueError(f"analysis_score가 0/1이 아님: {analysis_score!r}")


def _validate_answer_analyses(
    requested_ids: list[int], answer_analyses: list[dict]
) -> list[dict]:
    """돌려받은 answer_analyses의 messageId와 각 scale_analyses 항목 값을 검증한다.

    지금은 _stub_answer_analyses가 항상 빈 scale_analyses로 요청을 그대로 되돌려주므로
    항상 통과하지만, 2단계에서 실제 LLM 출력으로 교체되면 잘못되거나 누락된
    messageId(환각), 잘못된 scale_type/question_number/analysis_score를 잡아낸다.
    답변 하나의 항목이라도 잘못되면 이 함수가 예외를 던지고, 호출부(generate_next_question)의
    바깥 try/except가 안전한 기본 질문 + 전체 빈 scaleAnalyses로 폴백시킨다(배치 전체 단위 —
    일부만 부분 수용하는 정책은 아직 미정, feature/ai-error-handling에서 다룬다).
    """
    returned_ids = [item["message_id"] for item in answer_analyses]
    if sorted(returned_ids) != sorted(requested_ids):
        raise ValueError(
            "척도 분석 결과의 messageId가 요청과 다릅니다: "
            f"요청={sorted(requested_ids)}, 응답={sorted(returned_ids)}"
        )
    for answer_analysis in answer_analyses:
        for scale_item in answer_analysis["scale_analyses"]:
            _validate_scale_analysis_item(scale_item)
    return answer_analyses


# SCALE_ANALYSIS_MODE=test일 때 답변마다 채우는 고정 목업 채점. emotion.py의
# TEST_EMOTION과 같은 역할 — 실제 프롬프트 없이도 척도 채점이 있는 상태로
# 파이프라인 전체(main.py 매핑, 백엔드 응답 검증 등)를 끝까지 돌려볼 수 있게 한다.
TEST_SCALE_ANALYSIS_ITEM = {"scale_type": "GAD_7", "question_number": 4, "analysis_score": 1}


def _stub_answer_analyses(answers: list[dict]) -> list[dict]:
    """실제 척도 채점 프롬프트가 작성되기 전까지, SCALE_ANALYSIS_MODE에 따라
    요청받은 messageId마다 고정 목업 채점(test) 또는 빈 scale_analyses(empty)를 채운다."""
    mode = settings.scale_analysis_mode.strip().lower()
    if mode == "test":
        scale_analyses = [dict(TEST_SCALE_ANALYSIS_ITEM)]
    elif mode == "empty":
        scale_analyses = []
    else:
        raise ValueError("SCALE_ANALYSIS_MODE must be one of: test, empty")
    return [
        {"message_id": answer["message_id"], "scale_analyses": [dict(item) for item in scale_analyses]}
        for answer in answers
    ]


def generate_next_question(
    answers: list[dict],
    session: SessionState,
) -> dict:
    client = _get_openai_client()
    user_prompt = build_user_prompt(answers, session)
    requested_ids = [answer["message_id"] for answer in answers]

    try:
        resp = client.chat.completions.create(
            model=settings.openai_llm_model,
            response_format={"type": "json_object"},
            messages=[
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user", "content": user_prompt},
            ],
            temperature=0.7,
        )
        content = resp.choices[0].message.content
        data = json.loads(content)
        # 최소 필드 보정
        data.setdefault("ai_question", "오늘 하루는 어떻게 보내셨어요?")
        data.setdefault("target_scale", None)
        data.setdefault("target_item", None)
        if data.get("target_scale") == "null":
            data["target_scale"] = None
        if data.get("target_item") == "null":
            data["target_item"] = None
        data["answer_analyses"] = _validate_answer_analyses(
            requested_ids, _stub_answer_analyses(answers)
        )
        return data
    except Exception as e:  # noqa: BLE001
        logger.error("LLM 질문 생성 실패, 기본 질문으로 대체: %s", e)
        return {
            "ai_question": "그러셨군요. 오늘 하루는 어떻게 지내셨어요?",
            "target_scale": None,
            "target_item": None,
            "empathy_note": "fallback",
            "answer_analyses": _stub_answer_analyses(answers),
        }
