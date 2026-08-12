"""
LLM(꼬리질문 생성) 모듈 단독 검증용 CLI.

app/services/llm.py를 서버(WS) 없이 그대로 불러와서 실행합니다.
.env에 실제 OPENAI_API_KEY를 채운 뒤 실행하세요.

사용법:
    # 감정 없이(중립으로 채워서) 텍스트만으로 테스트
    python scripts/test_llm.py --text "요즘 밤에 잠을 잘 못 자요"

    # 감정도 같이 넘기고 싶으면 --emotion으로 "라벨:값" 쌍을 콤마로
    python scripts/test_llm.py --text "요즘 밤에 잠을 잘 못 자요" \\
        --emotion "sad:0.6,anxious:0.25,neutral:0.1,happy:0.03,angry:0.02"

    # 오늘 아직 채점 안 된 척도 문항도 흉내내고 싶으면
    python scripts/test_llm.py --text "요즘 밤에 잠을 잘 못 자요" \\
        --pending "SGDS_K:Q3,Q7;GAD_7:Q2"
"""
import argparse
import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.services import llm as llm_service  # noqa: E402
from app.session_manager import SessionState  # noqa: E402


def parse_emotion(raw: str | None) -> dict[str, float]:
    if not raw:
        return {"neutral": 1.0}
    result = {}
    for pair in raw.split(","):
        k, _, v = pair.partition(":")
        if k and v:
            result[k.strip()] = float(v.strip())
    return result or {"neutral": 1.0}


def parse_pending(raw: str | None) -> dict[str, list[str]]:
    if not raw:
        return {}
    result: dict[str, list[str]] = {}
    for scale_block in raw.split(";"):
        scale, _, items = scale_block.partition(":")
        if not scale:
            continue
        result[scale.strip()] = [i.strip() for i in items.split(",") if i.strip()]
    return result


def main() -> None:
    parser = argparse.ArgumentParser(description="LLM 꼬리질문 생성 모듈 단독 테스트")
    parser.add_argument("--text", required=True, help="시니어의 발화(STT 결과라고 가정)")
    parser.add_argument("--emotion", help='예: "sad:0.6,anxious:0.25,neutral:0.15" (생략 시 중립 100%%)')
    parser.add_argument("--prev-summary", default="", help="이전 세션 요약 (생략 가능)")
    parser.add_argument("--pending", help='예: "SGDS_K:Q3,Q7;GAD_7:Q2" (생략 시 없음)')
    args = parser.parse_args()

    emotion = parse_emotion(args.emotion)
    pending = parse_pending(args.pending)

    session = SessionState(
        session_id="test-session",
        user_id="test-user",
        prev_session_summary=args.prev_summary,
        pending_scale_items=pending,
    )

    print(f"발화: {args.text}")
    print(f"감정: {emotion}")
    print(f"미채점 척도 문항: {pending or '(없음)'}")
    print("-" * 50)

    started = time.perf_counter()
    result = llm_service.generate_next_question(args.text, emotion, session)
    elapsed_ms = int((time.perf_counter() - started) * 1000)

    print(f"소요 시간: {elapsed_ms}ms")
    print(f"AI 질문: {result.get('ai_question')}")
    print(f"타깃 척도: {result.get('target_scale')} / {result.get('target_item')}")
    if result.get("empathy_note"):
        print(f"공감 메모(내부용): {result.get('empathy_note')}")


if __name__ == "__main__":
    main()
