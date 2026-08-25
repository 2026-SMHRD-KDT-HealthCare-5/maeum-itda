"""NestJS 없이 AI 서버의 REST 배치 API를 호출하는 테스트 클라이언트."""

import argparse
import binascii
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
SENTIMENT_LABELS = {"POSITIVE", "NEUTRAL", "NEGATIVE"}
SCALE_TYPES = {"SGDS_K", "GAD_7", "LSNS_6"}


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


def build_nestjs_multipart(
    audio_paths: list[Path],
    question_message_id: int,
    generation_id: str,
    captured_at: str,
) -> tuple[list[tuple[str, tuple]], list[object], list[int]]:
    """NestJS AiClient.createFormData()와 같은 필드·순서로 multipart를 만든다."""
    multipart: list[tuple[str, tuple]] = [
        ("questionMessageId", (None, str(question_message_id))),
        ("generationId", (None, generation_id)),
    ]
    opened_files: list[object] = []
    message_ids: list[int] = []

    for index, audio_path in enumerate(audio_paths, start=1):
        message_id = question_message_id + index
        transfer_id = str(uuid.uuid4())
        mime_type = MIME_BY_EXT.get(
            audio_path.suffix.lower(),
            "application/octet-stream",
        )
        audio_file = audio_path.open("rb")
        opened_files.append(audio_file)
        message_ids.append(message_id)

        # apps/backend/src/analysis/ai.client.ts createFormData()와 동일한 순서다.
        multipart.extend(
            [
                (
                    "audioFiles",
                    (f"{transfer_id}.audio", audio_file, mime_type),
                ),
                ("messageIds", (None, str(message_id))),
                ("audioTransferIds", (None, transfer_id)),
                ("capturedAts", (None, captured_at)),
                ("endTypes", (None, "manual")),
            ]
        )

    return multipart, opened_files, message_ids


def validate_nestjs_response(result: object, requested_ids: list[int]) -> dict:
    """NestJS AiClient.validateResponse()가 요구하는 JSON 계약을 동일하게 확인한다."""
    if not isinstance(result, dict):
        raise ValueError("FastAPI 응답이 객체 형식이 아닙니다.")

    answers = result.get("answers")
    next_question = result.get("nextQuestion")
    if not isinstance(answers, list) or not (
        next_question is None or isinstance(next_question, str)
    ):
        raise ValueError("FastAPI 질문별 분석 응답 형식이 올바르지 않습니다.")

    response_ids: list[int] = []
    for answer in answers:
        if not isinstance(answer, dict):
            raise ValueError("답변 분석 결과가 객체 형식이 아닙니다.")
        message_id = answer.get("messageId")
        transcript = answer.get("transcript")
        sentiment_label = answer.get("sentimentLabel")
        scale_analyses = answer.get("scaleAnalyses")
        if (
            not isinstance(message_id, int)
            or isinstance(message_id, bool)
            or not isinstance(transcript, str)
            or not transcript.strip()
            or sentiment_label not in SENTIMENT_LABELS
            or not isinstance(scale_analyses, list)
        ):
            raise ValueError("답변 분석 결과 형식이 올바르지 않습니다.")

        for scale in scale_analyses:
            if not isinstance(scale, dict):
                raise ValueError("척도 분석 결과가 객체 형식이 아닙니다.")
            question_number = scale.get("questionNumber")
            if (
                scale.get("scaleType") not in SCALE_TYPES
                or not isinstance(question_number, int)
                or isinstance(question_number, bool)
                or scale.get("analysisScore") not in {0, 1}
            ):
                raise ValueError("척도 분석 결과 형식이 올바르지 않습니다.")
        response_ids.append(message_id)

    if sorted(requested_ids) != sorted(response_ids):
        raise ValueError("FastAPI 응답의 메시지 ID가 요청과 일치하지 않습니다.")
    return result


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
    except (binascii.Error, ValueError) as exc:
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
    multipart, opened_files, requested_ids = build_nestjs_multipart(
        audio_paths,
        question_message_id,
        generation_id,
        captured_at,
    )

    try:
        response = httpx.post(args.url, files=multipart, timeout=120)
        response.raise_for_status()
    finally:
        for audio_file in opened_files:
            audio_file.close()

    result = validate_nestjs_response(response.json(), requested_ids)
    print(json.dumps(result, ensure_ascii=False, indent=2))

    OUTPUT_TEXT_DIR.mkdir(parents=True, exist_ok=True)
    stamp = datetime.now().strftime("%m%d_%H%M%S")
    output_path = OUTPUT_TEXT_DIR / f"mock_rest_{stamp}.json"
    output_path.write_text(
        json.dumps(result, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )
    print(f"결과 저장: {output_path}")
    # /analysis/audio/batch는 더 이상 TTS를 합성하지 않는다(질문 텍스트를
    # TTS 생성을 기다리지 않고 즉시 반환하기 위한 구조 변경) — nextQuestion을
    # 실제 음성으로 듣고 싶으면 scripts/manual_tts_check.py를 별도로 실행할 것.


if __name__ == "__main__":
    main()
