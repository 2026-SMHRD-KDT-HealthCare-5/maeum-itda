"""
LLM 서비스: (텍스트 + 감정 + 대화 문맥)을 받아 다음 꼬리질문을 생성한다.

요구사항정의서 FR-01-04 기준:
- 오늘 아직 채점되지 않은 SGDS-K / GAD-7 / LSNS-6 문항을 자연스럽게 유도하는
  공감형 꼬리질문을 생성해야 함.
- 감정 상태에 공감 반응을 먼저 보이고, 이어서 자연스럽게 척도 문항을 유도하도록 프롬프트 설계.

OpenAI Chat Completions를 JSON 모드로 호출해서 다음 구조로 받는다:
{
  "ai_question": "...",
  "target_scale": "SGDS-K" | "GAD-7" | "LSNS-6" | null,
  "target_item": "Q3" | null,
  "empathy_note": "..."   # 내부 로깅/디버깅용, 굳이 프론트에 노출 안 해도 됨
}
"""
import json
import logging
from functools import lru_cache

from openai import OpenAI

from app.config import get_settings
from app.session_manager import SessionState

logger = logging.getLogger(__name__)
settings = get_settings()

SYSTEM_PROMPT = """\
당신은 고령층(시니어) 정신건강을 살피는 AI 안부 대화 상담원 '마음잇다'입니다.
목표는 두 가지입니다.
1) 시니어가 방금 한 말과 감정 상태에 공감하며 자연스럽고 따뜻하게 반응한다.
2) 대화가 부자연스럽게 느껴지지 않는 선에서, 오늘 아직 채점되지 않은 심리 척도
   문항(SGDS-K: 한국형 노인우울척도, GAD-7: 범불안장애 척도, LSNS-6: 사회적 고립척도)
   중 하나를 유도하는 질문을 자연스러운 일상 대화체로 던진다.

규칙:
- 존댓말, 짧고 쉬운 문장, 노인 친화적 어휘를 사용한다.
- 절대 "우울척도 검사를 하겠습니다" 같은 임상적/기계적 표현을 쓰지 않는다.
- 한 턴에 질문은 하나만 한다.
- 오늘 채점할 문항이 하나도 남지 않았다면 target_scale/target_item은 null로 하고
  일상적인 안부 질문을 생성한다.
- suicidal/자해 등 위험 신호로 보이는 발화가 감지되면 즉시 공감과 안전 확인을
  우선하는 질문으로 전환한다 (척도 유도보다 우선순위 높음).

아래 JSON 스키마로만 응답한다 (다른 텍스트 금지):
{"ai_question": "...", "target_scale": "SGDS-K|GAD-7|LSNS-6|null", "target_item": "...|null", "empathy_note": "..."}
"""


@lru_cache
def _get_openai_client() -> OpenAI:
    return OpenAI(api_key=settings.openai_api_key, timeout=settings.openai_llm_timeout_sec)


def build_user_prompt(
    user_text: str,
    emotion: dict[str, float],
    session: SessionState,
) -> str:
    emotion_str = ", ".join(f"{k}:{v:.2f}" for k, v in sorted(emotion.items(), key=lambda kv: -kv[1]))
    pending_str = json.dumps(session.pending_scale_items, ensure_ascii=False)

    return f"""\
[이전 세션 요약]
{session.prev_session_summary or "(없음)"}

[오늘 대화 중 아직 채점되지 않은 척도 문항]
{pending_str}

[이번 세션 최근 대화 히스토리]
{session.history_as_text() or "(아직 없음, 이번 발화가 첫 턴)"}

[시니어의 방금 발화(STT 결과)]
{user_text}

[방금 발화에서 추정된 감정 분포]
{emotion_str}

위 정보를 참고해서 다음 AI 질문을 JSON으로 생성하세요."""


def generate_next_question(
    user_text: str,
    emotion: dict[str, float],
    session: SessionState,
) -> dict:
    client = _get_openai_client()
    user_prompt = build_user_prompt(user_text, emotion, session)

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
        return data
    except Exception as e:  # noqa: BLE001
        logger.error("LLM 질문 생성 실패, 기본 질문으로 대체: %s", e)
        return {
            "ai_question": "그러셨군요. 오늘 하루는 어떻게 지내셨어요?",
            "target_scale": None,
            "target_item": None,
            "empathy_note": "fallback",
        }
