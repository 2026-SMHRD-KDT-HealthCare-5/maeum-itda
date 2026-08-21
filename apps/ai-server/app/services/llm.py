"""
LLM 서비스: (텍스트 + 음성 특징 + 대화 문맥)을 받아 다음 꼬리질문과 감정 판단을
생성한다.

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

구조 변경(2026-08-14, feat/ai-llm-turn-analysis):
- 같은 질문에 답변이 여러 개(배치) 묶여 올 수 있어, 텍스트·음성 특징을 messageId별로
  구분해서 프롬프트에 넣는다(`answers: list[{message_id, text, voice_features}]`).
- 백엔드 응답 계약에 필요한 `answer_analyses`(messageId별 척도 채점)는 같은 LLM
  호출의 SYSTEM_PROMPT(`llm_prompts.py`)에 채점 규칙을 포함시켜 실채점을 받는다.
  `SCALE_ANALYSIS_MODE`가 `model`이면 이 실채점 결과를 쓰고, `test`/`empty`면
  여전히 stub(`_stub_answer_analyses`)로 대체한다 — 로컬 개발/테스트에서 OpenAI
  호출 없이도 파이프라인을 돌려볼 수 있게.
- `_validate_answer_analyses`는 돌려받은 messageId 집합이 요청과 정확히 일치하는지,
  sentiment_label과 각 scale_analyses 항목 값이 유효한지 검증한다. `model` 모드에서
  LLM이 messageId를 잘못 세거나(환각) 범위를 벗어난 값을 주면 이 검증이 ValueError를
  던지고, 바깥 try/except가 안전한 기본 질문 + stub 채점으로 폴백시킨다.

구조 변경(2026-08-21): 별도 KLUE/Kresnik 5감정 분류 모델(구 emotion.py)을
폐기했다 — 감정 판단(sentiment_label: POSITIVE/NEUTRAL/NEGATIVE)을 이 LLM 호출이
직접 answer_analyses에 채워서 반환한다. 입력으로는 STT 텍스트와
`audio_features.py`가 뽑은 가벼운 음성 지표(발화길이/음량/무음비율/피치변동폭)를
그대로 넘긴다.
"""
import json
import logging
from functools import lru_cache

from openai import OpenAI

from app.config import get_settings
from app.services.audio_features import format_features_for_prompt
from app.services.llm_prompts import DAILY_SUMMARY_SYSTEM_PROMPT, SYSTEM_PROMPT
from app.session_manager import SessionState

SENTIMENT_LABELS = ("POSITIVE", "NEUTRAL", "NEGATIVE")

logger = logging.getLogger(__name__)
settings = get_settings()


@lru_cache
def _get_openai_client() -> OpenAI:
    return OpenAI(api_key=settings.openai_api_key, timeout=settings.openai_llm_timeout_sec)


def build_user_prompt(
    answers: list[dict],
    session: SessionState,
) -> str:
    pending_str = json.dumps(session.pending_scale_items, ensure_ascii=False)
    answer_blocks = "\n\n".join(
        f"[답변 {index + 1}] (messageId={answer['message_id']})\n"
        f"발화: {answer['text']}\n"
        f"음성 특징: {format_features_for_prompt(answer['voice_features'])}"
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
    """돌려받은 answer_analyses의 messageId, sentiment_label, scale_analyses 값을 검증한다.

    SCALE_ANALYSIS_MODE=test/empty의 stub 출력은 항상 통과하고, model 모드의 실제
    LLM 출력은 여기서 잘못되거나 누락된 messageId(환각), 잘못된 sentiment_label,
    잘못된 scale_type/question_number/analysis_score를 잡아낸다. 답변 하나의
    항목이라도 잘못되면 이 함수가 예외를 던지고, 호출부(generate_next_question)의
    바깥 try/except가 안전한 기본 질문 + 전체 빈 scaleAnalyses/NEUTRAL로
    폴백시킨다(배치 전체 단위 — 일부만 부분 수용하는 정책은 아직 미정,
    feature/ai-error-handling에서 다룬다).
    """
    returned_ids = [item["message_id"] for item in answer_analyses]
    if sorted(returned_ids) != sorted(requested_ids):
        raise ValueError(
            "척도 분석 결과의 messageId가 요청과 다릅니다: "
            f"요청={sorted(requested_ids)}, 응답={sorted(returned_ids)}"
        )
    for answer_analysis in answer_analyses:
        if answer_analysis.get("sentiment_label") not in SENTIMENT_LABELS:
            raise ValueError(
                f"sentiment_label이 올바르지 않음: {answer_analysis.get('sentiment_label')!r}"
            )
        for scale_item in answer_analysis["scale_analyses"]:
            _validate_scale_analysis_item(scale_item)
    return answer_analyses


# SCALE_ANALYSIS_MODE=test일 때 답변마다 채우는 고정 목업 채점 — 실제 프롬프트
# 없이도 척도 채점이 있는 상태로 파이프라인 전체(main.py 매핑, 백엔드 응답 검증
# 등)를 끝까지 돌려볼 수 있게 한다.
TEST_SCALE_ANALYSIS_ITEM = {"scale_type": "GAD_7", "question_number": 4, "analysis_score": 1}


def _stub_answer_analyses(answers: list[dict]) -> list[dict]:
    """실제 척도 채점 프롬프트가 작성되기 전까지, SCALE_ANALYSIS_MODE에 따라
    요청받은 messageId마다 고정 목업 채점(test) 또는 빈 scale_analyses(empty)를
    채운다. sentiment_label도 척도 채점과 같은 게이트를 타므로(둘 다 같은 LLM
    JSON에서 나오는 값이라 신뢰 여부를 분리할 이유가 없다) 여기서는 항상
    NEUTRAL로 고정한다 — SCALE_ANALYSIS_MODE=model일 때만 LLM이 실제로 판단한
    sentiment_label을 쓴다(_extract_answer_analyses 참고)."""
    mode = settings.scale_analysis_mode.strip().lower()
    if mode == "test":
        scale_analyses = [dict(TEST_SCALE_ANALYSIS_ITEM)]
    elif mode == "empty":
        scale_analyses = []
    else:
        raise ValueError("SCALE_ANALYSIS_MODE must be one of: test, empty")
    return [
        {
            "message_id": answer["message_id"],
            "sentiment_label": "NEUTRAL",
            "scale_analyses": [dict(item) for item in scale_analyses],
        }
        for answer in answers
    ]


def _normalize_sentiment_label(value: object) -> object:
    """LLM이 대소문자를 다르게 반환해도(예: "Positive") 받아들인다.

    `response_format={"type": "json_object"}`는 JSON 문법만 보장할 뿐 enum 값
    자체는 강제하지 않으므로, 이후 _validate_answer_analyses의 엄격한 검증
    전에 흔한 케이싱 편차만 정규화한다. 문자열이 아니거나 정규화 후에도
    유효한 라벨이 아니면 그대로 돌려줘서 검증이 실패·폴백하게 한다.
    """
    return value.strip().upper() if isinstance(value, str) else value


def _extract_answer_analyses(data: dict) -> list[dict]:
    """SCALE_ANALYSIS_MODE=model일 때 LLM 응답에서 answer_analyses를 그대로 꺼낸다.

    구조만 정규화하고(dict가 아닌 항목은 버림, sentiment_label 케이싱과
    scale_analyses의 명시적 null을 흔한 LLM 편차로 보정) messageId 누락/초과나
    진짜 잘못된 채점값은 여기서 미리 걸러내지 않는다 — _validate_answer_analyses에
    그대로 넘겨서 환각을 잡아내고 generate_next_question의 폴백으로 이어지게 한다.
    """
    return [
        {
            "message_id": item.get("message_id"),
            "sentiment_label": _normalize_sentiment_label(item.get("sentiment_label")),
            "scale_analyses": item.get("scale_analyses") or [],
        }
        for item in data.get("answer_analyses", [])
        if isinstance(item, dict)
    ]


def _extract_corrected_transcripts(data: dict) -> dict[int, str]:
    """LLM 응답에서 messageId별 corrected_transcript만 뽑아 dict로 돌려준다.

    SCALE_ANALYSIS_MODE와 무관하게 LLM 호출 자체는 항상 일어나므로(다음 질문
    생성을 위해), 이 함수는 STT_CORRECTION_MODE가 "model"일 때만 호출된다 —
    별도의 검증은 하지 않고 형식이 이상한 항목(messageId 누락, 빈 문자열 등)은
    조용히 건너뛴다. 최종적으로 쓸지 말지는 _resolve_corrected_transcript가
    STT 원문과 비교해 결정한다.
    """
    result: dict[int, str] = {}
    for item in data.get("answer_analyses", []):
        if not isinstance(item, dict):
            continue
        message_id = item.get("message_id")
        corrected = item.get("corrected_transcript")
        if isinstance(message_id, int) and isinstance(corrected, str) and corrected.strip():
            result[message_id] = corrected
    return result


def _resolve_corrected_transcript(corrected: str | None, original_text: str) -> str:
    """STT_CORRECTION_MODE=model일 때 messageId 하나의 최종 transcript를 정한다.

    LLM이 그 messageId를 교정하지 않고 빠뜨렸으면(_extract_corrected_transcripts가
    걸러낸 경우) STT 원문을 그대로 쓴다 — 교정 누락이 발화 자체의 유실로 이어지면
    안 된다.
    """
    return corrected if corrected is not None else original_text


def _apply_corrected_transcripts(
    answer_analyses: list[dict], answers: list[dict], data: dict
) -> list[dict]:
    """answer_analyses 각 항목에 corrected_transcript를 채워 넣는다.

    STT_CORRECTION_MODE가 "model"이 아니면(기본값 "test") LLM이 뭐라고 답했든
    무시하고 STT 원문을 그대로 쓴다 — 로컬에서 교정 품질을 신뢰하기 전까지
    안전한 기본값을 유지하기 위함(scale_analysis_mode와 같은 패턴).
    """
    mode = settings.stt_correction_mode.strip().lower()
    original_text_by_id = {answer["message_id"]: answer["text"] for answer in answers}
    corrected_by_id = _extract_corrected_transcripts(data) if mode == "model" else {}
    return [
        {
            **item,
            "corrected_transcript": _resolve_corrected_transcript(
                corrected_by_id.get(item["message_id"]),
                original_text_by_id.get(item["message_id"], ""),
            ),
        }
        for item in answer_analyses
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
        mode = settings.scale_analysis_mode.strip().lower()
        raw_answer_analyses = (
            _extract_answer_analyses(data) if mode == "model" else _stub_answer_analyses(answers)
        )
        validated_answer_analyses = _validate_answer_analyses(requested_ids, raw_answer_analyses)
        data["answer_analyses"] = _apply_corrected_transcripts(
            validated_answer_analyses, answers, data
        )
        return data
    except Exception as e:  # noqa: BLE001
        logger.error("LLM 질문 생성 실패, 기본 질문으로 대체: %s", e)
        # 실패 경로는 SCALE_ANALYSIS_MODE와 무관하게 항상 빈 채점으로 안전하게
        # 대체한다 — _stub_answer_analyses는 "test"/"empty"만 알고 "model"에서는
        # 예외를 던지므로(위 정상 경로용), 여기서 재사용하면 model 모드에서
        # 실패가 실패를 낳는다.
        return {
            "ai_question": "그러셨군요. 오늘 하루는 어떻게 지내셨어요?",
            "target_scale": None,
            "target_item": None,
            "empathy_note": "fallback",
            "answer_analyses": [
                {
                    "message_id": answer["message_id"],
                    "corrected_transcript": answer["text"],
                    "sentiment_label": "NEUTRAL",
                    "scale_analyses": [],
                }
                for answer in answers
            ],
        }


# DAILY_SUMMARY_MODE=test일 때 반환하는 고정 목업 — 실제 프롬프트 없이도
# main.py의 응답 매핑과 백엔드 계약을 끝까지 돌려볼 수 있게 한다. conversation_summary는
# 실제 정책(200~300자, 3~4문장)과 비슷한 분량으로 맞춰서 test 모드에서도 화면
# 레이아웃(글자 수)을 현실적으로 확인할 수 있게 한다.
DAILY_SUMMARY_STUB = {
    "conversation_summary": (
        "오늘은 어르신과 산책 이야기를 나눴어요. 날씨가 좋아서 오랜만에 동네를 "
        "한 바퀴 도셨다고 하셨고, 걷는 동안 기분이 한결 가벼워지셨다고 말씀하셨어요. "
        "최근 잠은 잘 주무시는 편이라고 하셨지만, 가끔 저녁에 혼자 계실 때 조금 "
        "적적하다고도 하셨어요. 전반적으로는 밝은 톤으로 대화를 이어가셨습니다."
    ),
    "recommended_action": "오늘 나눈 이야기에 대해 안부 전화를 한 통 드려보시는 건 어떨까요?",
}


def _has_senior_turn(turns: list[dict]) -> bool:
    return any(turn.get("speaker_type") == "SENIOR" for turn in turns)


def _format_daily_turn(turn: dict) -> str:
    sentiment = turn.get("sentiment_label")
    suffix = f" (감정: {sentiment})" if sentiment else ""
    return f"[{turn['speaker_type']}] {turn['content']}{suffix}"


def build_daily_summary_user_prompt(turns: list[dict]) -> str:
    turn_lines = "\n".join(_format_daily_turn(turn) for turn in turns)
    return f"""\
[오늘 하루 대화 전체(시간 순서)]
{turn_lines}

위 대화를 참고해서 conversation_summary와 recommended_action을 JSON으로 생성하세요."""


def generate_daily_summary(turns: list[dict]) -> dict:
    """UC-06-4(FR-03-06): 하루치 대화로 conversationSummary/recommendedAction을 생성한다.

    turns: [{"speaker_type": "SENIOR"|"AI", "content": str, "sentiment_label": str|None}, ...]
    유효한 시니어 발화가 하나도 없으면(대안흐름 A1) LLM을 호출하지 않고 곧바로
    둘 다 None을 돌려준다.
    """
    if not _has_senior_turn(turns):
        return {"conversation_summary": None, "recommended_action": None}

    mode = settings.daily_summary_mode.strip().lower()
    if mode == "test":
        return dict(DAILY_SUMMARY_STUB)
    if mode != "model":
        raise ValueError("DAILY_SUMMARY_MODE must be one of: test, model")

    client = _get_openai_client()
    user_prompt = build_daily_summary_user_prompt(turns)
    try:
        resp = client.chat.completions.create(
            model=settings.openai_llm_model,
            response_format={"type": "json_object"},
            messages=[
                {"role": "system", "content": DAILY_SUMMARY_SYSTEM_PROMPT},
                {"role": "user", "content": user_prompt},
            ],
            temperature=0.5,
        )
        data = json.loads(resp.choices[0].message.content)
        summary = data.get("conversation_summary")
        action = data.get("recommended_action")
        return {
            "conversation_summary": summary if isinstance(summary, str) and summary.strip() else None,
            "recommended_action": action if isinstance(action, str) and action.strip() else None,
        }
    except Exception as e:  # noqa: BLE001
        logger.error("일간 요약 생성 실패, null로 대체: %s", e)
        return {"conversation_summary": None, "recommended_action": None}
