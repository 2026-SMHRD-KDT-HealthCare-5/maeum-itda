"""NestJS 없이 AI 서버의 REST 배치 API를 호출하는 테스트 클라이언트."""

import argparse
import json
import sys
import uuid
from datetime import datetime, timezone
from pathlib import Path

import httpx

PROJECT_ROOT = Path(__file__).resolve().parent.parent
INPUT_SOUND_DIR = PROJECT_ROOT / "input_sound"
OUTPUT_TEXT_DIR = PROJECT_ROOT / "output_text"
AUDIO_EXTS = {
    ".wav", ".mp3", ".mpga", ".mpeg", ".mp4", ".m4a", ".webm",
    ".flac", ".ogg", ".opus", ".aac", ".wma",
}
MIME_BY_EXT = {
    ".wav": "audio/wav",
    ".mp3": "audio/mpeg",
    ".mpga": "audio/mpeg",
    ".mpeg": "audio/mpeg",
    ".mp4": "audio/mp4",
    ".m4a": "audio/mp4",
    ".webm": "audio/webm",
    ".flac": "audio/flac",
    ".ogg": "audio/ogg",
    ".opus": "audio/opus",
    ".aac": "audio/aac",
}


def resolve_audio_paths(values: list[str] | None) -> list[Path]:
    if values:
        paths = []
        for value in values:
            path = Path(value)
            if not path.exists():
                path = INPUT_SOUND_DIR / path.name
            paths.append(path)
        return paths

    candidates = sorted(
        path
        for path in INPUT_SOUND_DIR.iterdir()
        if path.is_file() and path.suffix.lower() in AUDIO_EXTS
    )
    if not candidates:
        raise ValueError("input_sound에 오디오를 넣거나 --audio로 파일을 지정하세요.")
    return candidates


def main() -> None:
    parser = argparse.ArgumentParser(description="AI 서버 REST 배치 API 테스트")
    parser.add_argument(
        "--audio",
        action="append",
        help="오디오 경로. 여러 건이면 --audio를 반복해서 사용합니다.",
    )
    parser.add_argument(
        "--url",
        default="http://localhost:8000/analysis/audio/batch",
    )
    args = parser.parse_args()

    try:
        audio_paths = resolve_audio_paths(args.audio)
    except ValueError as exc:
        print(f"[오류] {exc}")
        sys.exit(1)

    missing = [path for path in audio_paths if not path.exists()]
    if missing:
        print("[오류] 파일을 찾을 수 없습니다:")
        for path in missing:
            print(f"  - {path}")
        sys.exit(1)

    question_message_id = 101
    generation_id = str(uuid.uuid4())
    captured_at = datetime.now(timezone.utc).isoformat()
    data: list[tuple[str, str]] = [
        ("questionMessageId", str(question_message_id)),
        ("generationId", generation_id),
    ]
    files = []
    opened_files = []

    try:
        for index, audio_path in enumerate(audio_paths, start=1):
            message_id = question_message_id + index
            transfer_id = str(uuid.uuid4())
            data.extend(
                [
                    ("messageIds", str(message_id)),
                    ("audioTransferIds", transfer_id),
                    ("capturedAts", captured_at),
                    ("endTypes", "manual"),
                ]
            )
            audio_file = audio_path.open("rb")
            opened_files.append(audio_file)
            files.append(
                (
                    "audioFiles",
                    (
                        audio_path.name,
                        audio_file,
                        MIME_BY_EXT.get(audio_path.suffix.lower(), "application/octet-stream"),
                    ),
                )
            )

        response = httpx.post(args.url, data=data, files=files, timeout=120)
        response.raise_for_status()
    finally:
        for audio_file in opened_files:
            audio_file.close()

    result = response.json()
    print(json.dumps(result, ensure_ascii=False, indent=2))

    OUTPUT_TEXT_DIR.mkdir(parents=True, exist_ok=True)
    stamp = datetime.now().strftime("%m%d_%H%M%S")
    output_path = OUTPUT_TEXT_DIR / f"mock_rest_{stamp}.json"
    output_path.write_text(
        json.dumps(result, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )
    print(f"결과 저장: {output_path}")


if __name__ == "__main__":
    main()
