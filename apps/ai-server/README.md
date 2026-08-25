# 마음잇다 AI 서버 (FastAPI REST)

백엔드가 전달한 시니어 발화 음성을 분석하는 AI 서버입니다.

확정 답변의 배치 분석은 REST로 처리하고, 말하는 중 부분 전사는 WebSocket으로
중계합니다. 기본 STT는 OpenAI `gpt-live-transcribe`이며 키 무효·쿼터 소진 때만
로컬 faster-whisper로 폴백합니다.

## API

### 헬스체크

```http
GET /health
```

```json
{"status":"ok"}
```

### 음성 배치 분석

```http
POST /analysis/audio/batch
Content-Type: multipart/form-data
```

요청 필드:

| 필드 | 형태 | 설명 |
| --- | --- | --- |
| `questionMessageId` | 단일 정수 | 답변 대상 AI 질문 ID |
| `generationId` | 단일 문자열 | 질문 생성 작업 ID |
| `audioFiles` | 반복 파일 | 질문에 연결된 음성 파일 |
| `messageIds` | 반복 정수 | 각 음성의 메시지 ID |
| `audioTransferIds` | 반복 문자열 | 각 음성 전송 ID |
| `capturedAts` | 반복 문자열 | 각 음성 녹음 시각 |
| `endTypes` | 반복 문자열 | `auto` 또는 `manual` |
| `prevSessionSummary` | 단일 문자열, 선택 | 최근 3일치 리포트 요약(오래된 순서로 이어붙인 텍스트) |
| `pendingScaleItems` | 단일 문자열(JSON), 선택 | 오늘 아직 채점되지 않은 척도 문항 맵, 예: `{"SGDS_K":["1","3"],"GAD_7":["2"]}` |
| `conversationTurns` | 단일 문자열(JSON), 선택 | 오늘 대화 전체(질문 시점까지, 화자·발화 배열) |

반복 필드는 개수와 순서가 모두 일치해야 합니다.

응답 예시:

```json
{
  "answers": [
    {
      "messageId": 102,
      "transcript": "오늘 산책을 다녀왔어요.",
      "sentimentLabel": "POSITIVE",
      "scaleAnalyses": []
    }
  ],
  "nextQuestion": "산책하면서 무엇이 가장 좋으셨어요?"
}
```

- 감성 라벨: `POSITIVE`, `NEUTRAL`, `NEGATIVE`
- 척도명: `SGDS_K`, `GAD_7`, `LSNS_6`
- `SCALE_ANALYSIS_MODE=empty`(테스트용)이면 `scaleAnalyses`는 항상 빈 배열입니다. 기본값 `test`는 고정 목업 점수(GAD_7 문항4=1)를 반환하며, `model`이어야 실제 LLM 채점을 씁니다.
- **[2026-08-20 변경] 이 응답에는 TTS가 포함되지 않습니다.** 다음 질문 텍스트를 합성 대기 없이 먼저 반환하기 위해서입니다 — TTS는 아래 별도 엔드포인트로 분리되어 있습니다.
- LLM 질문 생성에 실패하면 부분 응답 대신 HTTP `502`를 반환합니다.

### 실시간 부분 전사

```text
WebSocket /analysis/stt/live
```

NestJS가 PCM16 mono 24kHz 청크를 전달하면 OpenAI Realtime transcription 세션을
프록시해 부분/완료 전사를 돌려줍니다. 부분 전사는 화면 자막용이며 DB에는 저장하지
않고, 확정 메시지 저장은 배치 분석 성공 후 NestJS가 처리합니다.

### TTS 합성

| 엔드포인트 | 요청 | 응답 |
| --- | --- | --- |
| `POST /tts/synthesize/stream` | `{ "text": "..." }` | HTTP 청크 스트림(`Content-Type: audio/mpeg`, 설정과 무관하게 항상 mp3 — wav 헤더 버그로 스트리밍 경로는 고정함) |
| `POST /tts/synthesize` | `{ "text": "..." }` | `{ "ttsAudioBase64": "...", "ttsMimeType": "audio/mpeg" }` (배치, 비스트리밍) |

### 일간 대화 요약 (UC-06-4)

```http
POST /reports/daily-summary
```

`seniorId`, `reportDate`, `turns[]`(오늘 대화 전체)를 받아 `{ "conversationSummary": "...", "recommendedAction": "..." }`(둘 다 nullable)을 반환합니다. `DAILY_SUMMARY_MODE`가 `test`/`model`에 따라 고정 목업/실제 LLM 호출로 전환됩니다.

## 설치 및 실행

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
Copy-Item .env.example .env
uvicorn app.main:app --reload --port 8000
```

환경변수는 `.env.example`을 참고해 설정합니다. 특히 아래 세 모드 플래그는 각각 독립적으로 `test`/`model`(`SCALE_ANALYSIS_MODE`만 `empty`도 가능)을 가지며, 실제 LLM/외부 API를 쓰려면 셋 다 `model`로 설정해야 합니다 — 별도의 `EMOTION_MODE`는 없습니다(감정 판단은 `SCALE_ANALYSIS_MODE`와 같은 LLM 호출 결과를 공유).

| 변수 | 기본값 | 의미 |
| --- | --- | --- |
| `SCALE_ANALYSIS_MODE` | `test` | `test`: 고정 목업 점수, `empty`: 빈 배열, `model`: 실제 LLM 채점 |
| `STT_CORRECTION_MODE` | `test` | STT 결과 LLM 교정 여부 |
| `DAILY_SUMMARY_MODE` | `test` | 일간 요약·추천행동 생성 여부 |

## 감정 판단

2026-08-21부터 별도 감정 분류 모델(KLUE 텍스트·Kresnik 음성)을 쓰지 않습니다.
`app/services/audio_features.py`가 numpy만으로 답변 음성에서 가벼운 지표
(발화길이/평균음량/무음비율/피치변동폭)를 뽑고, STT 텍스트와 함께 `llm.py`의
같은 LLM 호출(꼬리질문 생성)에 넘겨 감정(`sentiment_label`: POSITIVE/NEUTRAL/
NEGATIVE)까지 그 호출 결과로 받습니다. 별도 체크포인트나 네트워크 의존성이
없습니다 — 옛 체크포인트(`models/text_emotion/`, `models/voice_emotion/`)와
관련 코드(`app/services/emotion.py`, `EMOTION_MODE` 설정, `torch`/`transformers`
의존성)는 전부 삭제했습니다.

## REST 연결 확인

서버를 실행한 상태에서 별도 터미널을 엽니다.

```powershell
python scripts/mock_backend_client.py --audio input_sound/sample.webm
```

복수 음성을 한 번에 보내려면 `--audio`를 반복합니다.

```powershell
python scripts/mock_backend_client.py `
  --audio input_sound/answer-1.webm `
  --audio input_sound/answer-2.webm
```

다른 서버 주소를 사용할 수도 있습니다.

```powershell
python scripts/mock_backend_client.py `
  --url http://localhost:8000/analysis/audio/batch `
  --audio input_sound/sample.webm
```

응답은 `output_text/mock_rest_{시각}.json`에 저장됩니다. **[2026-08-20 변경]** `/analysis/audio/batch`는 더 이상 TTS를 합성하지 않으므로(질문 텍스트를 합성 대기 없이 즉시 반환하기 위한 구조 변경) 이 스크립트는 TTS 음성을 따로 저장하지 않습니다 — `nextQuestion`을 실제 음성으로 듣고 싶으면 `scripts/manual_tts_check.py`를 별도로 실행하세요.

## 개별 모듈 테스트

```powershell
python scripts/manual_stt_check.py --audio input_sound/sample.webm
python scripts/manual_llm_check.py `
  --text "요즘 밤에 잠을 잘 못 자요" `
  --voice-features "duration_sec:4.2,rms_energy:0.03,silence_ratio:0.18,pitch_variation_hz:12.4" `
  --pending "SGDS_K:Q3,Q7;GAD_7:Q2"
python scripts/manual_tts_check.py --text "오늘 하루는 어떻게 보내셨어요?"
python scripts/manual_tts_check.py --text "오늘 하루는 어떻게 보내셨어요?" --stream
```

## 자동 테스트

`tests/`에 pytest 기반 단위 테스트가 있습니다(`test_audio_features.py`, `test_config.py`, `test_llm.py`, `test_main.py`, `test_stt.py`, `test_stt_live.py`). `scripts/*.py`(위 REST/개별 모듈 확인용 목 클라이언트)와는 별개입니다.

```powershell
pytest
```

## 프로젝트 구조

```text
app/
  main.py              FastAPI REST 엔드포인트(/health, /analysis/audio/batch,
                        /tts/synthesize, /tts/synthesize/stream, /reports/daily-summary)
  config.py             .env 로드, 모드 플래그 오타 시 기동 경고
  schemas.py            REST 요청/응답 스키마
  session_manager.py    LLM 전달용 대화 문맥 자료구조
  services/
    stt.py              gpt-live-transcribe 배치 전사와 로컬 Whisper 제한적 폴백
    stt_live.py         Realtime transcription 이벤트·PCM 청크 계약
    audio_features.py   답변 음성에서 가벼운 수치 지표 추출(numpy·av, ML 모델 없음)
    llm.py               다음 꼬리질문 생성 및 감정 판단(같은 호출)
    llm_prompts.py       LLM 시스템 프롬프트
    tts.py               Typecast 배치·스트리밍 합성
tests/                   pytest 단위 테스트
scripts/
  mock_backend_client.py  REST API 확인용 목 클라이언트
  manual_stt_check.py
  manual_llm_check.py
  manual_tts_check.py
```
