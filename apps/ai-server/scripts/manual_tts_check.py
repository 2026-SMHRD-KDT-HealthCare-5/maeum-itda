"""
TTS 모듈 단독 검증용 CLI.

app/services/tts.py를 서버 실행 없이 그대로 불러와서 실행합니다.

기본 실행은 REST 배치 분석과 동일한 synthesize_full()을 호출합니다. `--stream`을
사용하면 synthesize_stream()으로 Typecast 스트리밍과 TTFB도 따로 확인할 수 있습니다.
.env에 실제 TYPECAST_API_KEY / TYPECAST_VOICE_ID를 채운 뒤 실행하세요.

입력/출력 폴더 (프로젝트 루트 기준, 기본값):
    input_text/    - 합성할 텍스트를 .txt 파일로 넣어두면 --text 없이 자동으로 읽어서 씀
    output_sound/  - 합성된 오디오가 여기 저장됨 (.mp3 또는 .wav, TYPECAST_AUDIO_FORMAT 설정 따름)

사용법:
    # input_text/ 안에 .txt 파일이 하나만 있으면 --text 없이 그 내용을 그대로 합성
    python scripts/manual_tts_check.py

    # 텍스트를 직접 지정 (TTFB 등 측정값은 항상 출력됨)
    python scripts/manual_tts_check.py --text "오늘 하루는 어떻게 보내셨어요?"

    # 저장 경로를 직접 지정하고 싶을 때
    python scripts/manual_tts_check.py --text "..." --out output_sound/my_test.mp3

    # 보유 보이스 목록만 확인하고 싶을 때
    python scripts/manual_tts_check.py --list-voices

TTFB(첫 청크 도달 시간)는 요구사항정의서 FR-01-05가 요구하는 지표(~200ms)라
이 스크립트가 특히 그 값을 눈에 띄게 출력합니다.
"""
import argparse
import asyncio
import sys
import time
from datetime import datetime
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parent.parent
INPUT_TEXT_DIR = PROJECT_ROOT / "input_text"
OUTPUT_SOUND_DIR = PROJECT_ROOT / "output_sound"

sys.path.insert(0, str(PROJECT_ROOT))

from app.config import get_settings  # noqa: E402
from app.services import tts as tts_service  # noqa: E402


def resolve_text(arg: str | None) -> str:
    """--text가 없으면 input_text/ 안의 .txt 파일 하나를 자동으로 읽는다."""
    if arg:
        return arg

    if not INPUT_TEXT_DIR.exists():
        print(f"[오류] --text가 없고 {INPUT_TEXT_DIR} 폴더도 없습니다. 텍스트를 지정하세요.")
        sys.exit(1)

    candidates = sorted(INPUT_TEXT_DIR.glob("*.txt"))
    if not candidates:
        print(f"[오류] {INPUT_TEXT_DIR} 안에 .txt 파일이 없습니다. 파일을 넣거나 --text로 지정하세요.")
        sys.exit(1)
    if len(candidates) > 1:
        print(f"[오류] {INPUT_TEXT_DIR} 안에 .txt 파일이 여러 개입니다. --text로 직접 지정하세요:")
        for c in candidates:
            print(f"  - {c.name}")
        sys.exit(1)

    print(f"(자동 선택) {INPUT_TEXT_DIR.name}/{candidates[0].name}")
    return candidates[0].read_text(encoding="utf-8").strip()


def resolve_out_path(arg: str | None) -> Path:
    if arg:
        return Path(arg)
    settings = get_settings()
    ext = settings.typecast_audio_format or "mp3"
    stamp = datetime.now().strftime("%m%d_%H%M%S")
    return OUTPUT_SOUND_DIR / f"tts_{stamp}.{ext}"


async def run_synthesize(text: str, out_path: Path, stream: bool) -> None:
    print(f"텍스트({len(text)}자): {text}")
    print("-" * 50)

    started = time.perf_counter()
    first_chunk_at = None
    chunk_count = 0
    total_bytes = 0
    audio = bytearray()

    if stream:
        async for chunk in tts_service.synthesize_stream(text):
            if first_chunk_at is None:
                first_chunk_at = time.perf_counter()
            chunk_count += 1
            total_bytes += len(chunk)
            audio.extend(chunk)
    else:
        audio.extend(await tts_service.synthesize_full(text))
        first_chunk_at = time.perf_counter()
        chunk_count = 1
        total_bytes = len(audio)

    finished_at = time.perf_counter()

    if first_chunk_at is None:
        print("[오류] 오디오 청크를 하나도 받지 못했습니다.")
        sys.exit(1)

    ttfb_ms = int((first_chunk_at - started) * 1000)
    total_ms = int((finished_at - started) * 1000)

    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_bytes(bytes(audio))

    if stream:
        print(f"TTFB(첫 청크까지): {ttfb_ms}ms   <- FR-01-05 기준 ~200ms 목표")
    else:
        print("모드: REST와 동일한 완성 오디오 생성")
    print(f"전체 합성 시간: {total_ms}ms")
    print(f"청크 수: {chunk_count}, 총 용량: {total_bytes:,} bytes")
    print(f"저장: {out_path}")


async def run_list_voices() -> None:
    voices = await tts_service.list_voices()
    print(f"보유 보이스 {len(voices)}개:")
    for v in voices:
        vid = v.get("voice_id") or v.get("id") or "?"
        name = v.get("voice_name") or v.get("name") or "?"
        print(f"  - {vid}  {name}")


def main() -> None:
    parser = argparse.ArgumentParser(description="TTS 모듈 단독 테스트")
    parser.add_argument("--text", help=f"합성할 텍스트. 생략 시 {INPUT_TEXT_DIR} 안의 .txt 파일을 자동으로 읽음")
    parser.add_argument("--out", help=f"저장할 오디오 파일 경로. 생략 시 {OUTPUT_SOUND_DIR}에 타임스탬프로 저장")
    parser.add_argument("--list-voices", action="store_true", help="보유 보이스 목록만 조회")
    parser.add_argument("--stream", action="store_true", help="스트리밍 TTFB 테스트 모드")
    args = parser.parse_args()

    if args.list_voices:
        asyncio.run(run_list_voices())
        return

    text = resolve_text(args.text)
    out_path = resolve_out_path(args.out)
    asyncio.run(run_synthesize(text, out_path, args.stream))


if __name__ == "__main__":
    main()
