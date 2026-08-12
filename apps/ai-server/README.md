# 마음잇다 AI 서버 (FastAPI)

백엔드(Node.js/Nest.js)가 시니어의 발화 오디오를 보내면, 이 서버가
**STT → 감정분류(텍스트+음성 융합) → LLM 꼬리질문 생성 → TTS** 파이프라인을 돌려서
텍스트/감정/다음 질문/응답 음성을 백엔드로 돌려주는 AI 서버입니다.

## 아키텍처 요약

- **통신**: 백엔드와 단일 WebSocket 연결(`/ws/counsel/{session_id}`) 유지.
  같은 연결 위에서 JSON 컨트롤 프레임과 오디오/TTS 바이너리 프레임을 번갈아 주고받습니다.
- **STT**: OpenAI STT API(`/v1/audio/transcriptions`) 우선 → 실패 시 로컬 `faster-whisper`로 자동 폴백.
  (엔진 선택 기준: 정확도/속도 우선이면 API, 비용·오프라인·음성 유출 방지가 중요하면 로컬)
- **감정분류**: 텍스트 모델 + 음성 모델을 각각 추론한 뒤 `fuse_emotions()`에서 융합.
  (현재 두 모델이 아직 하나로 합쳐지지 않은 상태라 가중평균으로 "합쳤다고 가정"하고
  구성했습니다. 실제 융합 로직이 나오면 `app/services/emotion.py`의 `fuse_emotions()`만
  교체하면 됩니다.)
- **LLM**: OpenAI Chat Completions(JSON 모드)로 SGDS_K/GAD_7/LSNS_6 문항을 유도하는
  공감형 꼬리질문 생성.
- **TTS**: Typecast 스트리밍 API(`/v1/text-to-speech/stream`). 진짜 HTTP chunked transfer로
  오디오가 생성되는 대로 바이트가 그대로 내려옴 → 도착하는 대로 즉시 백엔드에 릴레이(TTFB 최소화).
  요청당 2000자 제한이 있지만 LLM이 만드는 질문은 항상 단문이라 실질적으로 걸리지 않음
  (혹시 모를 초과 상황을 위한 문장 분할 안전장치만 남겨둠).
- **세션 상태**: 이번 통화(세션) 동안의 대화 히스토리는 이 서버가 메모리에서 관리합니다.
  과거 세션 요약은 연결 시작 시 백엔드가 `session_init` 메시지로 1회 제공합니다.
  (참고: 멀티 워커/프로세스로 스케일 아웃하려면 `session_manager.py`의 인메모리 dict를
  Redis 등 외부 스토어로 교체해야 합니다.)

## 디렉터리 구조

```
app/
  main.py              # FastAPI 앱 + WebSocket 엔드포인트 (파이프라인 오케스트레이션)
  config.py            # .env 기반 설정
  schemas.py           # WS 메시지 Pydantic 스키마
  session_manager.py   # 세션별 대화 히스토리 관리 (인메모리)
  services/
    stt.py             # OpenAI STT + 로컬 whisper 폴백
    emotion.py         # 텍스트/음성 감정분류 + 융합
    llm.py             # LLM 꼬리질문 생성 (SGDS_K/GAD_7/LSNS_6 유도)
    tts.py             # Typecast 스트리밍 TTS
input_sound/            # (검증용) STT 테스트 오디오 입력 폴더
output_text/            # (검증용) STT 테스트 결과(.txt/.json) 출력 폴더
input_text/             # (검증용) TTS 테스트 텍스트 입력 폴더
output_sound/           # (검증용) TTS 테스트 결과 오디오 출력 폴더
scripts/
  test_stt.py             # STT 모듈만 단독 검증 (OpenAI/로컬 각각 강제 선택 가능)
  test_tts.py             # TTS 모듈만 단독 검증 (TTFB 측정 포함)
  test_emotion.py         # 감정분류 모듈만 단독 검증
  test_llm.py             # LLM 꼬리질문 생성 모듈만 단독 검증
  mock_backend_client.py  # 백엔드 없이 서버 전체(WS)를 로컬 테스트할 때 쓰는 목업 클라이언트
requirements.txt
.env.example
```

## WS 메시지 시퀀스

```
[연결 수립]
백엔드 -> AI서버 : {"type":"session_init", "session_id":"...", "user_id":"...",
                    "prev_session_summary":"...",
                    "pending_scale_items":{"SGDS_K":["Q3"],"GAD_7":[],"LSNS_6":["Q2"]}}

[발화 1턴]
백엔드 -> AI서버 : {"type":"utterance_start","utterance_id":"u1","audio_format":"webm","sample_rate":16000}
백엔드 -> AI서버 : <binary: 오디오 바이트 전체>

AI서버 -> 백엔드 : {"type":"turn_result","utterance_id":"u1",
                    "user_text":"...", "emotion":{"happy":0.1,...},
                    "dominant_emotion":"sad",
                    "ai_question":"...", "target_scale":"SGDS_K","target_item":"Q3"}
AI서버 -> 백엔드 : {"type":"tts_chunk_meta","utterance_id":"u1","chunk_index":0}
AI서버 -> 백엔드 : <binary: TTS 오디오 바이트 조각 0 (mp3, Typecast가 생성하는 대로 내려온 실제 스트림 조각)>
AI서버 -> 백엔드 : {"type":"tts_chunk_meta","utterance_id":"u1","chunk_index":1}
AI서버 -> 백엔드 : <binary: TTS 오디오 바이트 조각 1>
   ... (오디오 생성이 끝날 때까지 계속, 보통 한 질문당 수십~수백 바이트 단위 조각 여러 개) ...
AI서버 -> 백엔드 : {"type":"tts_end","utterance_id":"u1"}

[다음 턴 반복: utterance_start -> binary -> turn_result -> tts_chunk... -> tts_end]

[세션 종료]
백엔드 -> AI서버 : {"type":"session_end","session_id":"..."}
(또는 그냥 WS 연결 종료)
```

- STT 실패(무음/잡음 등)면 `turn_result` 대신 `{"type":"stt_failed","utterance_id":"u1","reason":"..."}`
  를 보내고 그 턴은 종료됩니다. (FR-01-08 대응, 백엔드가 재녹음 요청 UI를 띄우면 됨)
- 그 외 처리 중 예외는 `{"type":"error","utterance_id":"...","detail":"..."}`로 내려갑니다.

## 실제로 연결하기 전에 채워야 할 것들

1. **`.env`** (`.env.example` 복사해서 작성)
   - `OPENAI_API_KEY` (STT + LLM 공용)
   - `TYPECAST_API_KEY`, `TYPECAST_VOICE_ID` (`list_voices()` 헬퍼로 보유 보이스 목록 조회 가능)
   - `TEXT_EMOTION_MODEL_PATH`, `VOICE_EMOTION_MODEL_PATH` : 실제 학습된 체크포인트 경로
   - `EMOTION_LABELS` : 실제 모델이 출력하는 감정 라벨/순서에 맞게 수정

2. **`app/services/emotion.py`**
   - `_get_text_model()` / `_get_voice_model()` : 실제 체크포인트 로딩 코드로 교체
     (지금은 텍스트=HuggingFace 시퀀스분류, 음성=`torch.load` 가정한 예시 뼈대입니다)
   - `classify_voice_emotion()` 내부 전처리(MFCC 등)를 실제 학습 때 쓴 전처리와 동일하게 맞춰야 함

3. **`app/services/stt.py` / `app/services/tts.py`**
   - STT 호출 로직은 2026-08-05에 별도로 검증했던 프로젝트(OpenAI API vs 로컬 faster-whisper)의
     실전 구현을 그대로 가져와 통합 완료.
   - TTS는 위 원본 프로젝트가 테스트했던 것은 비-스트리밍 배치 엔드포인트(`/v1/text-to-speech`)였는데,
     Typecast 공식 문서를 다시 확인해 실제 스트리밍 전용 엔드포인트(`/v1/text-to-speech/stream`,
     진짜 HTTP chunked transfer)로 교체함. 인증(X-API-KEY)/페이로드 구조는 원본과 동일하게 유지.
   - 두 서비스 모두 엔드포인트/인증/페이로드는 실제 스펙 기준으로 맞춰져 있으므로 API 키/voice_id만
     채우면 바로 동작하나, 실제 API 키로 한 번도 호출 테스트는 안 해봤으므로(스텁 기반 스모크
     테스트만 완료) `.env` 채운 뒤 `scripts/mock_backend_client.py`로 실제 호출 확인 필요.

4. **`app/services/llm.py`**
   - 시스템 프롬프트의 척도 유도 로직/위험 신호(자살·자해 등) 대응 문구는 상담 파트와
     함께 검수 필요 (임상적으로 민감한 부분)

## 로컬 실행

```bash
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env   # 값 채우기
uvicorn app.main:app --reload --port 8000
```

헬스체크: `GET http://localhost:8000/health`

## 모듈 단위 검증 (STT/TTS/감정분류/LLM 각각 따로 테스트)

전체 WS 서버를 띄우지 않고, 모듈 하나씩 실제 API 키로 동작을 확인하고 싶을 때 씁니다.
`.env`를 채운 뒤(`cp .env.example .env`) 아래처럼 실행하세요. 모두 `app/services/*`의
실제 코드를 그대로 불러와서 실행하는 것이라, 여기서 통과하면 서버에 연결해도 같은 동작을 합니다.

STT/TTS는 프로젝트 루트의 아래 폴더를 기본 입출력 위치로 씁니다(직접 만들 필요 없음, 없으면
출력 폴더는 자동 생성됨). 파일 경로를 `--audio`/`--text`로 매번 안 넘겨도 되도록 하기 위함입니다.

```
input_sound/   - STT 테스트용 오디오 파일을 넣어두는 곳 (--audio 생략 시 여기서 자동으로 찾음)
output_text/   - STT 결과(.txt + .json)가 저장되는 곳
input_text/    - TTS 테스트용 텍스트(.txt)를 넣어두는 곳 (--text 생략 시 여기서 자동으로 읽음)
output_sound/  - TTS 결과(오디오)가 저장되는 곳
```

각 폴더 안에 파일이 정확히 1개일 때만 자동으로 골라 씁니다. 0개거나 2개 이상이면 어떤 파일을
쓸지 알려달라는 안내를 출력합니다(그럴 땐 `--audio`/`--text`로 직접 지정).

```bash
# STT: input_sound/ 에 오디오 파일 하나만 넣어두면 인자 없이 바로 테스트 가능
python scripts/test_stt.py
python scripts/test_stt.py --audio my_voice.mp3          # input_sound/ 안의 특정 파일 지정
python scripts/test_stt.py --audio "C:\...\sample.wav"   # 다른 위치의 파일도 가능(전체 경로)
python scripts/test_stt.py --engine openai                # OpenAI만 강제 (로컬 폴백 안 탐)
python scripts/test_stt.py --engine local                 # 로컬 whisper만 강제
python scripts/test_stt.py --no-save                      # output_text/에 저장하지 않고 화면 출력만

# TTS: input_text/ 에 .txt 파일 하나만 넣어두면 인자 없이 바로 테스트 가능
# TTFB(첫 청크까지 걸린 시간, FR-01-05 목표치 ~200ms)를 항상 출력합니다.
python scripts/test_tts.py
python scripts/test_tts.py --text "오늘 하루는 어떻게 보내셨어요?"
python scripts/test_tts.py --text "..." --out output_sound/my_test.mp3
python scripts/test_tts.py --list-voices   # 보유 보이스 ID 확인용

# 감정분류: 텍스트(+음성)로 감정 확률 분포 확인. 모델 체크포인트가 아직 없으면
# "균등분포"가 나오는 게 정상입니다(파이프라인이 안 죽게 설계된 대로 동작하는 것).
python scripts/test_emotion.py --text "요즘 잠을 잘 못 자요"
python scripts/test_emotion.py --text "요즘 잠을 잘 못 자요" --audio input_sound/my_voice.mp3

# LLM: 발화(+감정+미채점 척도문항)로 다음 꼬리질문 생성 확인
python scripts/test_llm.py --text "요즘 밤에 잠을 잘 못 자요" \
    --emotion "sad:0.6,anxious:0.25,neutral:0.15" \
    --pending "SGDS_K:Q3,Q7;GAD_7:Q2"
```

STT 테스트용 샘플 오디오가 없다면 예전에 STT만 따로 검증했던 프로젝트의 파일을 `input_sound/`에
복사해서 써도 됩니다: `깃허브/test/STT-20260805-12-38-v2-로컬-fasterwhisper/test_0805_094749.mp3`

## 전체 파이프라인 테스트 (백엔드 없이 WS 흐름 전체 확인)

`scripts/mock_backend_client.py`로 실제 백엔드 없이 WS 흐름을 확인할 수 있습니다.
(먼저 `uvicorn app.main:app`으로 서버를 띄워둔 상태여야 합니다)

입력/출력 폴더는 `test_stt.py`/`test_tts.py`와 동일한 규칙을 따릅니다.

- `input_sound/` — 발화 오디오. `--audio` 생략 시 여기서 파일 하나를 자동으로 찾아 씀
- `output_text/` — 서버가 돌려준 `turn_result`(STT 텍스트, 감정, LLM 질문)를 `.json`으로 저장
- `output_sound/` — 서버가 돌려준 TTS 오디오를 `.env`의 `TYPECAST_AUDIO_FORMAT` 확장자 그대로 저장

```bash
# input_sound/ 안에 오디오 파일이 하나만 있으면 --audio 없이 바로 실행
python scripts/mock_backend_client.py

# 특정 파일 지정
python scripts/mock_backend_client.py --audio my_voice.wav
```

## 다음에 논의하면 좋을 것

- 감정분류 실제 융합 로직(가중평균 -> 학습된 fusion layer로 교체 시점)
- 실제 Typecast/OpenAI API 키로 end-to-end 호출 테스트 (지금까지는 스텁 기반 테스트만 완료)
- 위험 발화(자살/자해 신호) 감지 시 보호자/관리자 알림 흐름을 이 AI 서버에서 트리거할지,
  아니면 백엔드가 `turn_result`의 감정/텍스트를 보고 판단할지 역할 분담
- 멀티 워커 배포 시 세션 상태 저장소(Redis 등) 전환
- 로컬 whisper 폴백은 추론이 블로킹이라 `asyncio.to_thread`로 감싸져 있지만, 동시 세션이
  많아지면 `_local_infer_lock`(Semaphore(1))이 병목이 될 수 있음 — 필요 시 워커 프로세스 분리 고려
- TTS 오디오 포맷을 wav로 바꾸는 경우: 스트리밍 응답의 첫 청크에 담긴 44바이트 WAV 헤더는
  size 필드가 무효값(`0xFFFFFFFF`)이라 재생 측에서 이를 인지하고 처리해야 함(`app/services/tts.py`의
  `_stream_one_segment()`가 헤더를 잘라 PCM만 내보내도록 처리해뒀지만, 프론트/백엔드에서 재생 시
  샘플레이트(32000Hz)·비트뎁스(16bit)·채널(mono)을 알고 있어야 함). mp3 기본값 유지 시 이 문제 없음
