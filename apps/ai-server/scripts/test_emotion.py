"""
감정분류 모듈 단독 검증용 CLI.

app/services/emotion.py를 서버 실행 없이 그대로 불러와서 실행합니다.

주의: 아직 TEXT_EMOTION_MODEL_PATH / VOICE_EMOTION_MODEL_PATH에 실제 체크포인트가
연결되지 않았다면, 모델 로딩이 실패하고 "균등분포"(모든 감정이 똑같은 확률)가 나옵니다.
이건 버그가 아니라 emotion.py가 일부러 그렇게 설계된 것입니다(파이프라인이 죽지 않게).
실제 모델을 연결한 뒤 이 스크립트로 "균등분포가 아니라 실제 값이 나오는지"를 확인하세요.

사용법:
    # 텍스트만
    python scripts/test_emotion.py --text "요즘 잠을 잘 못 자요"

    # 텍스트 + 음성 (융합 결과까지 확인)
    python scripts/test_emotion.py --text "요즘 잠을 잘 못 자요" --audio sample.wav
"""
import argparse
import logging
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

logging.basicConfig(level=logging.INFO, format="%(levelname)s: %(message)s")

from app.services import emotion as emotion_service  # noqa: E402


def print_probs(label: str, probs: dict[str, float]) -> None:
    print(f"[{label}]")
    is_uniform = len(set(round(v, 4) for v in probs.values())) <= 1
    for k, v in sorted(probs.items(), key=lambda kv: -kv[1]):
        bar = "#" * int(v * 40)
        print(f"  {k:10s} {v:.4f} {bar}")
    if is_uniform:
        print("  ※ 모든 값이 동일 = 모델이 아직 안 붙어있어서 균등분포로 대체된 상태로 보입니다.")


def main() -> None:
    parser = argparse.ArgumentParser(description="감정분류 모듈 단독 테스트")
    parser.add_argument("--text", required=True, help="감정을 분류할 텍스트")
    parser.add_argument("--audio", help="(선택) 감정을 분류할 오디오 파일 경로")
    parser.add_argument("--sample-rate", type=int, default=16000)
    args = parser.parse_args()

    text_probs = emotion_service.classify_text_emotion(args.text)
    print_probs("텍스트 감정", text_probs)
    print(f"  -> dominant: {emotion_service.dominant_emotion(text_probs)}")
    print()

    if args.audio:
        audio_path = Path(args.audio)
        if not audio_path.exists():
            print(f"[오류] 오디오 파일을 찾을 수 없습니다: {audio_path}")
            sys.exit(1)
        audio_bytes = audio_path.read_bytes()

        voice_probs = emotion_service.classify_voice_emotion(audio_bytes, sample_rate=args.sample_rate)
        print_probs("음성 감정", voice_probs)
        print(f"  -> dominant: {emotion_service.dominant_emotion(voice_probs)}")
        print()

        fused = emotion_service.fuse_emotions(text_probs, voice_probs)
        print_probs("융합 감정 (텍스트+음성 가중평균)", fused)
        print(f"  -> dominant: {emotion_service.dominant_emotion(fused)}")


if __name__ == "__main__":
    main()
