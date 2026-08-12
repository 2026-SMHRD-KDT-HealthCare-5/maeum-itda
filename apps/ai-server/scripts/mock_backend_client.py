"""
백엔드 없이 AI 서버의 WS 흐름을 확인해보기 위한 목업 클라이언트.

입력/출력 폴더 (프로젝트 루트 기준, test_stt.py / test_tts.py와 동일한 규칙):
    input_sound/   - 발화로 보낼 오디오 파일을 여기에 넣어두면 --audio 없이 자동으로 찾아 씀
    output_text/   - 서버가 돌려준 turn_result(STT 텍스트, 감정, LLM 질문 등)가 .json으로 저장됨
    output_sound/  - 서버가 돌려준 TTS 오디오가 저장됨 (.env의 TYPECAST_AUDIO_FORMAT 확장자 그대로)

사용법:
    # input_sound/ 안에 오디오 파일이 하나만 있으면 --audio 없이 바로 실행 가능
    # (먼저 uvicorn app.main:app 으로 서버를 띄워둔 상태여야 함)
    python scripts/mock_backend_client.py

    # 특정 파일을 지정
    python scripts/mock_backend_client.py --audio my_voice.wav

    # 서버 주소를 다르게 지정
    python scripts/mock_backend_client.py --url ws://localhost:8000/ws/counsel/test-session-1

오디오 파일 하나를 "한 발화"로 취급해서 session_init -> utterance_start -> 오디오 전송까지
수행하고, 서버가 돌려주는 turn_result / tts 청크들을 콘솔에 출력한다.
"""
import argparse
import asyncio
import json
import sys
import uuid
from datetime import datetime
from pathlib import Path

import websockets

PROJECT_ROOT = Path(__file__).resolve().parent.parent
INPUT_SOUND_DIR = PROJECT_ROOT / "input_sound"
OUTPUT_TEXT_DIR = PROJECT_ROOT / "output_text"
OUTPUT_SOUND_DIR = PROJECT_ROOT / "output_sound"

sys.path.insert(0, str(PROJECT_ROOT))

from app.config import get_settings  # noqa: E402

AUDIO_EXTS = {".wav", ".mp3", ".mpga", ".mpeg", ".mp4", ".m4a", ".webm", ".flac", ".ogg", ".opus", ".aac", ".wma"}


def resolve_audio_path(arg: str | None) -> Path:
    """--audio가 없으면 input_sound/ 안에서 오디오 파일을 자동으로 찾는다.
    (test_stt.py와 동일한 규칙: 파일이 정확히 1개일 때만 자동 선택)"""
    if arg:
        given = Path(arg)
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


async def run(url: str, audio_path: Path) -> None:
    session_id = "test-session-1"
    audio_format = audio_path.suffix.lstrip(".").lower() or "wav"
    stamp = datetime.now().strftime("%m%d_%H%M%S")

    async with websockets.connect(url, max_size=None) as ws:
        await ws.send(json.dumps({
            "type": "session_init",
            "session_id": session_id,
            "user_id": "test-user-1",
            "prev_session_summary": "지난주엔 무릎이 아프다고 하셨고, 전반적으로 기분은 안정적이었음.",
            "pending_scale_items": {"SGDS_K": ["Q3"], "GAD_7": [], "LSNS_6": ["Q2"]},
        }))

        utterance_id = str(uuid.uuid4())
        await ws.send(json.dumps({
            "type": "utterance_start",
            "utterance_id": utterance_id,
            "audio_format": audio_format,
            "sample_rate": 16000,
        }))

        with open(audio_path, "rb") as f:
            await ws.send(f.read())

        turn_result: dict | None = None
        tts_bytes = bytearray()

        while True:
            msg = await ws.recv()
            if isinstance(msg, (bytes, bytearray)):
                tts_bytes.extend(msg)
                print(f"[recv] TTS 오디오 청크 {len(msg)} bytes")
                continue

            data = json.loads(msg)
            print("[recv]", data)
            if data.get("type") == "turn_result":
                turn_result = data
            if data.get("type") in ("tts_end", "stt_failed", "error"):
                break

        if turn_result is not None:
            OUTPUT_TEXT_DIR.mkdir(parents=True, exist_ok=True)
            text_path = OUTPUT_TEXT_DIR / f"mock_{audio_path.stem[:30]}_{stamp}.json"
            text_path.write_text(
                json.dumps(turn_result, ensure_ascii=False, indent=2), encoding="utf-8"
            )
            print(f"turn_result 저장: {text_path} (in {OUTPUT_TEXT_DIR.name}/)")

        if tts_bytes:
            settings = get_settings()
            ext = settings.typecast_audio_format or "mp3"
            OUTPUT_SOUND_DIR.mkdir(parents=True, exist_ok=True)
            audio_out_path = OUTPUT_SOUND_DIR / f"mock_tts_{stamp}.{ext}"
            audio_out_path.write_bytes(bytes(tts_bytes))
            print(f"TTS 오디오 저장: {audio_out_path} (in {OUTPUT_SOUND_DIR.name}/)")

        await ws.send(json.dumps({"type": "session_end", "session_id": session_id}))


def main() -> None:
    parser = argparse.ArgumentParser(description="WS 전체 파이프라인 목업 테스트")
    parser.add_argument("--audio", help=f"발화 오디오 파일 경로. 생략 시 {INPUT_SOUND_DIR} 안에서 자동 탐색")
    parser.add_argument("--url", default="ws://localhost:8000/ws/counsel/test-session-1")
    args = parser.parse_args()

    audio_path = resolve_audio_path(args.audio)
    if not audio_path.exists():
        print(f"[오류] 파일을 찾을 수 없습니다: {audio_path}")
        sys.exit(1)

    asyncio.run(run(args.url, audio_path))


if __name__ == "__main__":
    main()
