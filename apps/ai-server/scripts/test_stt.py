"""
STT 모듈 단독 검증용 CLI.

app/services/stt.py를 서버 실행 없이 그대로 불러와서 실행합니다.
.env에 실제 OPENAI_API_KEY를 채운 뒤 실행하세요.

입력/출력 폴더 (프로젝트 루트 기준, 기본값):
    input_sound/   - 테스트할 오디오 파일을 여기에 넣어두면 --audio 없이 자동으로 찾아 씀
    output_text/   - 변환 결과(.txt + .json)가 여기 저장됨

사용법:
    # input_sound/ 안에 오디오 파일이 하나만 있으면 --audio 생략 가능 (자동 폴백 경로 그대로 테스트)
    python scripts/test_stt.py

    # 특정 파일을 지정 (input_sound/ 안의 파일명만 써도 되고, 다른 경로의 전체 경로여도 됨)
    python scripts/test_stt.py --audio my_voice.mp3
    python scripts/test_stt.py --audio "C:\\Users\\...\\아무데나\\sample.wav"

    # OpenAI 경로만 강제로 테스트 (로컬 폴백 안 탐)
    python scripts/test_stt.py --engine openai

    # 로컬 faster-whisper만 강제로 테스트 (API 키 없어도 됨, 첫 실행은 모델 다운로드로 느림)
    python scripts/test_stt.py --engine local

    # output_text/에 저장하지 않고 화면 출력만
    python scripts/test_stt.py --no-save
"""
import argparse
import json
import sys
import time
from datetime import datetime
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parent.parent
INPUT_SOUND_DIR = PROJECT_ROOT / "input_sound"
OUTPUT_TEXT_DIR = PROJECT_ROOT / "output_text"

sys.path.insert(0, str(PROJECT_ROOT))

from app.services import stt as stt_service  # noqa: E402

AUDIO_EXTS = {".wav", ".mp3", ".mpga", ".mpeg", ".mp4", ".m4a", ".webm", ".flac", ".ogg", ".opus", ".aac", ".wma"}


def resolve_audio_path(arg: str | None) -> Path:
    """--audio가 없으면 input_sound/ 안에서 오디오 파일을 자동으로 찾는다.
    --audio가 파일명만 있으면 input_sound/ 기준으로, 경로 구분자가 있으면 그대로 해석한다."""
    if arg:
        given = Path(arg)
        # 파일명만 주어졌으면 input_sound/ 안에서 찾아본다
        if given.parent == Path(".") and not given.exists():
            candidate = INPUT_SOUND_DIR / given.name
            if candidate.exists():
                return candidate
        return given

    if not INPUT_SOUND_DIR.exists():
        print(f"[오류] --audio가 없고 {INPUT_SOUND_DIR} 폴더도 없습니다. 오디오 파일 경로를 지정하세요.")
        sys.exit(1)

    candidates = sorted(p for p in INPUT_SOUND_DIR.iterdir() if p.is_file() and p.suffix.lower() in AUDIO_EXTS)
    if not candidates:
        print(f"[오류] {INPUT_SOUND_DIR} 안에 오디오 파일이 없습니다. 파일을 넣거나 --audio로 경로를 지정하세요.")
        sys.exit(1)
    if len(candidates) > 1:
        print(f"[오류] {INPUT_SOUND_DIR} 안에 오디오 파일이 여러 개입니다. --audio로 하나를 지정하세요:")
        for c in candidates:
            print(f"  - {c.name}")
        sys.exit(1)

    print(f"(자동 선택) {INPUT_SOUND_DIR.name}/{candidates[0].name}")
    return candidates[0]


def main() -> None:
    parser = argparse.ArgumentParser(description="STT 모듈 단독 테스트")
    parser.add_argument("--audio", help=f"오디오 파일 경로. 생략 시 {INPUT_SOUND_DIR} 안에서 자동 탐색")
    parser.add_argument(
        "--engine", choices=["auto", "openai", "local"], default="auto",
        help="auto=transcribe()의 기본 폴백 로직 그대로 / openai=OpenAI만 강제 / local=로컬 whisper만 강제",
    )
    parser.add_argument("--no-save", action="store_true", help=f"{OUTPUT_TEXT_DIR}에 결과 저장 안 함")
    args = parser.parse_args()

    audio_path = resolve_audio_path(args.audio)
    if not audio_path.exists():
        print(f"[오류] 파일을 찾을 수 없습니다: {audio_path}")
        sys.exit(1)

    audio_bytes = audio_path.read_bytes()
    audio_format = audio_path.suffix.lstrip(".") or "wav"
    print(f"오디오: {audio_path} ({len(audio_bytes):,} bytes, format={audio_format})")
    print(f"엔진: {args.engine}")
    print("-" * 50)

    started = time.perf_counter()

    if args.engine == "auto":
        result = stt_service.transcribe(audio_bytes, audio_format)
    elif args.engine == "openai":
        try:
            text = stt_service._transcribe_openai(audio_bytes, audio_format)  # noqa: SLF001
            result = stt_service.SttResult(ok=bool(text), text=text, engine="openai")
        except Exception as e:  # noqa: BLE001
            result = stt_service.SttResult(ok=False, reason=str(e), engine="openai")
    else:  # local
        try:
            text = stt_service._transcribe_local(audio_bytes, audio_format)  # noqa: SLF001
            result = stt_service.SttResult(ok=bool(text), text=text, engine="local_whisper")
        except Exception as e:  # noqa: BLE001
            result = stt_service.SttResult(ok=False, reason=str(e), engine="local_whisper")

    elapsed_ms = int((time.perf_counter() - started) * 1000)

    print(f"결과: {'성공' if result.ok else '실패'}")
    print(f"엔진: {result.engine}")
    print(f"소요 시간: {elapsed_ms}ms")

    if not result.ok:
        print(f"실패 사유: {result.reason}")
        sys.exit(1)

    print(f"텍스트: {result.text}")

    if not args.no_save:
        OUTPUT_TEXT_DIR.mkdir(parents=True, exist_ok=True)
        stamp = datetime.now().strftime("%m%d_%H%M%S")
        stem = audio_path.stem[:30]
        txt_path = OUTPUT_TEXT_DIR / f"{stem}_{stamp}.txt"
        json_path = OUTPUT_TEXT_DIR / f"{stem}_{stamp}.json"

        txt_path.write_text(result.text, encoding="utf-8")
        json_path.write_text(
            json.dumps(
                {
                    "source_audio": str(audio_path),
                    "engine": result.engine,
                    "elapsed_ms": elapsed_ms,
                    "text": result.text,
                },
                ensure_ascii=False, indent=2,
            ),
            encoding="utf-8",
        )
        print(f"저장: {txt_path.name}, {json_path.name} (in {OUTPUT_TEXT_DIR})")


if __name__ == "__main__":
    main()
