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
  않았고, 요청받은 messageId마다 빈 `scale_analyses`를 채우는 stub으로 대체한다.
  실제 프롬프트 내용은 `llm_prompts.py`의 TODO에 남겨뒀고 2단계에서 반영한다.
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


def _validate_answer_analyses(
    requested_ids: list[int], answer_analyses: list[dict]
) -> list[dict]:
    """돌려받은 answer_analyses의 messageId가 요청과 정확히 일치하는지 검증한다.

    지금은 _stub_answer_analyses가 요청을 그대로 되돌려주므로 항상 통과하지만,
    2단계에서 실제 LLM 출력으로 교체되면 잘못되거나 누락된 messageId(환각)를 잡아낸다.
    """
    returned_ids = [item["message_id"] for item in answer_analyses]
    if sorted(returned_ids) != sorted(requested_ids):
        raise ValueError(
            "척도 분석 결과의 messageId가 요청과 다릅니다: "
            f"요청={sorted(requested_ids)}, 응답={sorted(returned_ids)}"
        )
    return answer_analyses


def _stub_answer_analyses(answers: list[dict]) -> list[dict]:
    """실제 척도 채점 프롬프트가 작성되기 전까지, 요청받은 messageId마다 빈 scale_analyses를 채운다."""
    return [{"message_id": answer["message_id"], "scale_analyses": []} for answer in answers]


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
