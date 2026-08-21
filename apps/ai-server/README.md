# 마음잇다 AI 서버 (FastAPI REST)

백엔드가 전달한 시니어 발화 음성을 분석하는 AI 서버입니다.

기존 STT → LLM 감정 판단·꼬리질문 생성 → TTS 로직은 유지하고, 백엔드와의
통신 방식만 WebSocket에서 REST로 변경했습니다.

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
  "nextQuestion": "산책하면서 무엇이 가장 좋으셨어요?",
  "ttsAudioBase64": "SUQzBAAAAA...",
  "ttsMimeType": "audio/mpeg"
}
```

- 감성 라벨: `POSITIVE`, `NEUTRAL`, `NEGATIVE`
- 척도명: `SGDS_K`, `GAD_7`, `LSNS_6`
- 현재 척도 채점 로직은 연결 전이므로 `scaleAnalyses`는 빈 배열을 반환합니다.
- `ttsAudioBase64`는 `nextQuestion`을 Typecast로 합성한 음성을 Base64로 인코딩한 값입니다.
- `ttsMimeType`은 기본 `audio/mpeg`이며 `.env`의 `TYPECAST_AUDIO_FORMAT`을 따릅니다.
- LLM 질문 또는 TTS 생성에 실패하면 부분 응답 대신 HTTP `502`를 반환합니다.

## 설치 및 실행

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
Copy-Item .env.example .env
uvicorn app.main:app --reload --port 8000
```

환경변수는 `.env.example`을 참고해 설정합니다.

## 감정 판단

2026-08-21부터 별도 감정 분류 모델(KLUE 텍스트·Kresnik 음성)을 쓰지 않습니다.
`app/services/audio_features.py`가 numpy만으로 답변 음성에서 가벼운 지표
(발화길이/평균음량/무음비율/피치변동폭)를 뽑고, STT 텍스트와 함께 `llm.py`의
같은 LLM 호출(꼬리질문 생성)에 넘겨 감정(`sentiment_label`: POSITIVE/NEUTRAL/
NEGATIVE)까지 그 호출 결과로 받습니다. 별도 체크포인트나 네트워크 의존성이
없습니다 — `models/` 아래 옛 체크포인트(`text_emotion/`, `voice_emotion/`)는
더 이상 로딩되지 않는 과거 산출물입니다.

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

응답은 `output_text/mock_rest_{시각}.json`에, 디코딩한 TTS 음성은
`output_sound/mock_rest_tts_{시각}.{포맷}`에 저장됩니다.

## 개별 모듈 테스트

```powershell
python scripts/test_stt.py --audio input_sound/sample.webm
python scripts/test_llm.py `
  --text "요즘 밤에 잠을 잘 못 자요" `
  --voice-features "duration_sec:4.2,rms_energy:0.03,silence_ratio:0.18,pitch_variation_hz:12.4" `
  --pending "SGDS_K:Q3,Q7;GAD_7:Q2"
python scripts/test_tts.py --text "오늘 하루는 어떻게 보내셨어요?"
python scripts/test_tts.py --text "오늘 하루는 어떻게 보내셨어요?" --stream
```

## 프로젝트 구조

```text
app/
  main.py              FastAPI REST 엔드포인트와 파이프라인 호출
  schemas.py           REST 응답 스키마
  session_manager.py   LLM 전달용 대화 문맥 자료구조
  services/
    stt.py             OpenAI STT와 로컬 Whisper 폴백
    audio_features.py  답변 음성에서 가벼운 수치 지표 추출
    llm.py             다음 꼬리질문 생성 및 감정 판단
    tts.py             다음 질문 TTS 생성
scripts/
  mock_backend_client.py  REST API 확인용 목 클라이언트
  test_stt.py
  test_llm.py
  test_tts.py
```
