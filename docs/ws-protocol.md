## 1. 서버 전체 구조

```text
Frontend
  │
  ├─ WebSocket /ws/chats
  │    └→ ChatsGateway
  │         ├→ ChatAuthHandler
  │         ├→ ChatStartHandler
  │         ├→ AudioMetadataHandler
  │         ├→ AudioBinaryHandler
  │         └→ ChatEndHandler
  │
  └─ REST GET /chats/messages
       └→ ChatsController → ChatsService → ConversationMessageRepository → MySQL

AudioBinaryHandler
  → QuestionAnswerQueueService
  → AnalysisService
  → AiClient
  → REST POST FastAPI /analysis/audio/batch
  → AnalysisResultRepository → MySQL
  → WebSocket ai:question
```

### 책임 구분

- 프론트엔드: 녹음, `audio:metadata`와 binary 전송, ACK 전 Blob 보관, 화면 이벤트 처리
- NestJS: JWT 인증, WS 이벤트 분배, 메시지·관계 저장, 답변 큐, FastAPI REST 호출, 분석 결과 저장
- FastAPI: 메시지별 STT·감성·척도 분석, 전체 답변 통합, 다음 질문 생성
- MySQL: 대화 메시지, 메시지 관계, 분석 결과 영속화

## 2. WebSocket 공통 JSON 규격

JSON 이벤트는 모두 다음 envelope를 사용한다. 음성 binary frame에는 이 envelope를 사용하지 않는다.

```json
{
  "event": "audio:metadata",
  "payload": {},
  "ts": "2026-08-12T06:00:00.000Z"
}
```

| 변수      | 의미               |
| --------- | ------------------ |
| `event`   | 처리할 이벤트 이름 |
| `payload` | 이벤트별 데이터    |
| `ts`      | 송신 시각, UTC ISO |

## 4. 전체 WebSocket 이벤트 흐름

```text
Frontend                                                    NestJS
  │                                                           │
  ├─ WS /ws/chats 연결 ───────────────────────────────────────→│
  ├─ auth ────────────────────────────────────────────────────→│ JWT·SENIOR 검증
  │←──────────────────────────────────────────── auth:success ┤
  │                                                           │
  ├─ chat:start ──────────────────────────────────────────────→│ 최초 AI 질문 DB 저장
  │←─────────────────────────────────────────── chat:started ─┤
  │←──────────────────────────────────────────── ai:question ─┤
  │                                                           │
  ├─ audio:metadata ──────────────────────────────────────────→│ metadata 임시 보관
  ├─ Binary frame ────────────────────────────────────────────→│ 답변·관계 DB 저장 및 큐 등록
  │←─────────────────────────────────────────────── audio:ack ┤
  │                                                           │
  │                마지막 답변부터 10초 추가 답변 대기         │
  │                FastAPI REST 분석 및 메시지별 결과 저장     │
  │←──────────────────────────────────────────── ai:question ─┤
  │                                                           │
  ├─ chat:end ────────────────────────────────────────────────→│ 남은 큐 확정·상태 정리
  │←──────────────────────────────────────────── chat:ended ──┤
  │                  WebSocket 연결은 유지                     │
```

인증부터 `chat:end`까지 전체 흐름을 포함한다. 지원하지 않는 JSON 이벤트는 공통 `error`로 응답한다.

## 5. 이벤트별 JSON 계약

### 5.1 `auth`

연결 직후 첫 메시지는 반드시 인증 이벤트여야 한다.

```json
{
  "event": "auth",
  "payload": { "accessToken": "JWT_ACCESS_TOKEN" },
  "ts": "2026-08-12T06:00:00.000Z"
}
```

성공:

```json
{
  "event": "auth:success",
  "payload": { "userId": 7, "role": "SENIOR" },
  "ts": "2026-08-12T06:00:00.100Z"
}
```

- JWT 서명·만료와 `SENIOR` 역할을 검증한다.
- 실패하면 `auth:error` 전송 후 close code `1008`로 연결을 종료한다.
- 단기 재접속 상태가 있으면 인증 뒤 `chat:restored`와 기존 `ai:question`을 전송한다.

### 5.2 `chat:start`, `chat:started`, `ai:question`

```json
{
  "event": "chat:start",
  "payload": {},
  "ts": "2026-08-12T06:00:01.000Z"
}
```

```json
{
  "event": "chat:started",
  "payload": {},
  "ts": "2026-08-12T06:00:01.100Z"
}
```

```json
{
  "event": "ai:question",
  "payload": {
    "messageId": 101,
    "generationId": "550e8400-e29b-41d4-a716-446655440000",
    "content": "오늘 하루는 어떠셨어요?"
  },
  "ts": "2026-08-12T06:00:01.200Z"
}
```

- `chat:start`는 최초 질문 저장과 대화 시작을 요청한다.
- DB 저장 성공 후 `chat:started`, `ai:question` 순서로 전송한다.
- 진행 중인 질문이 있으면 `CHAT_ALREADY_STARTED`로 거부한다.
- `chat:started.payload`는 빈 객체를 유지한다.
- `generationId`는 대화 단위가 아니라 질문 생성 작업 단위이다.

### 5.3 `audio:metadata`와 binary frame

프론트는 metadata를 먼저 보내고 다음 WS 메시지로 해당 음성 binary를 보낸다.

```json
{
  "event": "audio:metadata",
  "payload": {
    "audioTransferId": "audio-transfer-001",
    "questionMessageId": 101,
    "generationId": "550e8400-e29b-41d4-a716-446655440000",
    "mimeType": "audio/webm;codecs=opus",
    "capturedAt": "2026-08-12T06:00:03.500Z",
    "endType": "auto"
  },
  "ts": "2026-08-12T06:00:04.000Z"
}
```

| 필드                | 설명                                          |
| ------------------- | --------------------------------------------- |
| `audioTransferId`   | 음성 한 건의 전송 ID                          |
| `questionMessageId` | 답변 대상 AI 질문 ID                          |
| `generationId`      | 대상 질문의 생성 작업 ID                      |
| `mimeType`          | `audio/`로 시작하는 브라우저 녹음 형식        |
| `capturedAt`        | 녹음 시각, UTC                                |
| `endType`           | `auto`: 묵음 감지, `manual`: 사용자 녹음 종료 |

- metadata 없이 binary가 오면 거부한다.
- pending metadata의 binary를 받기 전에는 새 metadata를 받지 않는다.
- 현재 또는 같은 연결에서 이미 전달한 질문 ID와 generation ID가 일치해야 한다.
- binary 한 건은 빈 값이 아니어야 하며 최대 10MB이다.
- 유효한 metadata 수신 시 30초/2분 무응답 타이머를 해제한다.

### 5.4 `audio:ack`

```json
{
  "event": "audio:ack",
  "payload": {
    "audioTransferId": "audio-transfer-001",
    "messageId": 102
  },
  "ts": "2026-08-12T06:00:04.200Z"
}
```

- 시니어 답변 메시지와 질문·답변 관계를 DB에 저장한 직후 전송한다.
- FastAPI 분석 완료까지 기다리지 않는다.
- 같은 `audioTransferId`가 다시 오면 DB에 중복 저장하지 않고 기존 ACK를 다시 전송한다.
- ACK 전까지 음성 Blob을 보관하고 재전송하는 책임은 프론트에 있다.

### 5.5 `chat:idle-warning`

```json
{
  "event": "chat:idle-warning",
  "payload": {
    "message": "천천히 생각하시고 편하게 말씀해 주세요.",
    "remainingSeconds": 90
  },
  "ts": "2026-08-12T06:00:31.200Z"
}
```

- AI 질문 후 첫 발화가 30초 동안 없을 때 한 번 전송한다.
- 경고보다는 시니어가 부담을 느끼지 않는 안내 문구를 사용한다.
- metadata가 정상 접수되면 무응답 타이머를 취소한다.

### 5.6 `chat:end`, `chat:ended`

수동 종료 요청:

```json
{
  "event": "chat:end",
  "payload": { "reason": "USER_REQUESTED" },
  "ts": "2026-08-12T06:05:00.000Z"
}
```

종료 응답:

```json
{
  "event": "chat:ended",
  "payload": {
    "reason": "USER_REQUESTED",
    "endedAt": "2026-08-12T06:05:00.100Z"
  },
  "ts": "2026-08-12T06:05:00.100Z"
}
```

- 수동 종료 사유는 `USER_REQUESTED`이다.
- AI 질문 후 총 2분 무응답이면 서버가 `INACTIVITY_TIMEOUT`으로 자동 종료한다.
- 종료 시 남은 답변 큐는 즉시 확정해 STT·감성·척도 결과까지 저장한다.
- 종료 후 다음 AI 질문은 저장하거나 전송하지 않는다.
- DB에 별도의 대화 세션 또는 종료 기록을 추가하지 않는다.
- 종료 후에도 WS 연결은 유지하고 화면을 나갈 때 프론트가 연결을 닫는다.

### 5.7 `chat:restored`

```json
{
  "event": "chat:restored",
  "payload": {
    "questionMessageId": 105,
    "generationId": "7c9f2f95-f607-4b45-b915-845467bd8c88"
  },
  "ts": "2026-08-12T06:07:00.000Z"
}
```

- 같은 NestJS 프로세스에 단기 재접속하면 마지막 현재 질문을 새 연결에 복원한다.
- 이어서 같은 `messageId`의 `ai:question`을 다시 보내며 프론트는 ID로 중복 표시를 막는다.
- 서버 재시작 후 진행 중 큐까지 복구하는 기능은 MVP 이후 Redis 적용 범위이다.

### 5.8 공통 `error`

```json
{
  "event": "error",
  "payload": {
    "code": "QUESTION_MISMATCH",
    "message": "현재 질문과 일치하지 않는 음성입니다.",
    "requestEvent": "audio:metadata",
    "retryable": false
  },
  "ts": "2026-08-12T06:00:04.100Z"
}
```

- `code`: 프론트 분기용 오류 코드
- `message`: 사용자 또는 개발자에게 보여줄 설명
- `requestEvent`: 오류가 발생한 요청 이벤트
- `retryable`: 같은 요청을 다시 시도할 수 있는지 여부

주요 코드: `INVALID_EVENT`, `INTERNAL_ERROR`, `AUDIO_METADATA_PENDING`, `QUESTION_MISMATCH`, `INVALID_AUDIO_METADATA`, `AUDIO_METADATA_MISSING`, `EMPTY_AUDIO_BINARY`, `AUDIO_TOO_LARGE`, `AUDIO_SAVE_FAILED`, `AUDIO_ANALYSIS_FAILED`, `CHAT_ALREADY_STARTED`, `ANSWER_SEGMENT_LIMIT_EXCEEDED`, `ANSWER_AUDIO_SIZE_LIMIT_EXCEEDED`.

## 6. 질문별 추가 답변 큐 정책

```text
AI 질문 messageId=101
  ├→ 시니어 답변 messageId=102, 관계 ANSWER
  └→ 시니어 추가 답변 messageId=103, 관계 ADDITIONAL_ANSWER
       → 마지막 음성부터 10초 대기
       → 질문별 답변 묶음 확정
       → FastAPI에 두 음성과 두 messageId 전달
```

- 같은 질문인지 여부는 감정 결과가 아니라 `questionMessageId`로 판단한다.
- 첫 답변은 `ANSWER`, 이후 답변은 `ADDITIONAL_ANSWER` 관계로 저장한다.
- 각 음성은 별도 `messageId`를 가진다.
- 추가 답변이 올 때마다 10초 타이머를 다시 시작한다.
- 질문 하나에 최대 5개, 음성 한 건 최대 10MB, 전체 최대 30MB이다.
- FastAPI는 메시지별 STT·감성·척도를 반환하고 NestJS는 각 `messageId`에 저장한다.
- 감성이 서로 달라도 복합 감정이나 감정 변화일 수 있으므로 오류로 처리하지 않는다.
- 다음 질문은 모든 transcript와 개별 분석 결과를 통합해 한 번 생성한다.
- 분석 시작 뒤 늦게 온 답변도 ACK·저장·분석한다.
- 이미 다음 질문이 전송됐다면 늦은 답변으로 새 질문을 다시 생성하지 않는다.
- 같은 질문의 분석 요청이 겹치면 `processingByQuestionMessageId`에서 순서대로 처리한다.

### 시간 기준 구분

| 기준                  | 의미                         | 담당   |
| --------------------- | ---------------------------- | ------ |
| 질문 후 30초          | 첫 발화 전 생각 시간 후 안내 | NestJS |
| 발화 중 10초 묵음     | 녹음 한 건 자동 종료         | 프론트 |
| 음성 접수 후 10초     | 추가 답변 큐 확정            | NestJS |
| 질문 후 총 2분 무응답 | 대화 자동 종료               | NestJS |

## 7. NestJS에서 FastAPI REST로 전환되는 흐름

```text
[WebSocket]
audio:metadata → binary → AudioBinaryHandler
  → AudioAnswerRepository → MySQL → audio:ack
  → QuestionAnswerQueueService

[NestJS 내부]
10초 후 질문별 묶음 확정
  → AnalysisService.enqueueAnswerBatch()
  → TemporaryAudioRepository
  → VOICE_ANALYSIS_STATUS = WAITING

[REST]
AnalysisService.processPendingAnswerBatch()
  → AiClient
  → POST FastAPI /analysis/audio/batch

[DB 및 다시 WebSocket]
AnalysisResultRepository → 메시지별 결과 저장
  → 다음 질문 DB 저장
  → ChatConnectionStateService
  → ai:question
```

### FastAPI 요청

```http
POST /analysis/audio/batch
Content-Type: multipart/form-data
```

| 필드                | 형태      | 설명                     |
| ------------------- | --------- | ------------------------ |
| `questionMessageId` | 단일 값   | 답변 대상 AI 질문 ID     |
| `generationId`      | 단일 값   | 질문 생성 작업 ID        |
| `audioFiles`        | 반복 파일 | 질문에 속한 음성들       |
| `messageIds`        | 반복 값   | 각 음성의 답변 메시지 ID |
| `audioTransferIds`  | 반복 값   | 각 음성 전송 ID          |
| `capturedAts`       | 반복 값   | 녹음 시각                |
| `endTypes`          | 반복 값   | `auto` 또는 `manual`     |

### FastAPI 응답

```json
{
  "answers": [
    {
      "messageId": 102,
      "transcript": "오늘 아들이 집에 왔어요.",
      "sentimentLabel": "POSITIVE",
      "scaleAnalyses": []
    },
    {
      "messageId": 103,
      "transcript": "그런데 금방 가서 서운했어요.",
      "sentimentLabel": "NEGATIVE",
      "scaleAnalyses": []
    }
  ],
  "nextQuestion": "아드님이 금방 돌아가셔서 많이 서운하셨군요."
}
```

- 요청의 모든 `messageId`와 응답의 ID가 정확히 일치해야 한다.
- NestJS는 메시지별 transcript·감성·척도를 각각 저장한다.
- 각 transcript는 별도 메시지로 저장되어 프론트에서 각각의 말풍선으로 표시한다.
- FastAPI는 여러 답변의 전체 맥락을 내부적으로 함께 참고해 `nextQuestion` 하나를 생성한다.
- `nextQuestion`은 문자열 또는 `null`이다.
- 네트워크·타임아웃·HTTP 502/503/504는 500ms 후 한 번 재시도한다.
- 4xx와 응답 계약 오류는 재시도하지 않는다.

## 8. 과거 메시지 조회 REST API

과거 대화를 스크롤로 조회하는 기능은 WebSocket이 아닌 REST API로 처리한다.

```http
GET /chats/messages?cursor=150&limit=30
Authorization: Bearer JWT_ACCESS_TOKEN
```

```json
{
  "messages": [
    {
      "messageId": 121,
      "speakerType": "AI",
      "content": "오늘 하루는 어떠셨어요?",
      "sttStatus": "NOT_REQUIRED",
      "createdAt": "2026-08-12T06:00:01.000Z"
    }
  ],
  "nextCursor": 121
}
```

- JWT의 시니어 ID로 본인 메시지만 조회한다.
- 기본 `limit`은 30, 최대 100이다.
- `cursor` 이전 메시지를 조회해 무한 스크롤에 사용한다.

## 9. 재접속 및 상태 복원

```text
재접속 → JWT 인증
  ├→ REST /chats/messages로 과거 메시지 복원
  └→ 서버 메모리에 현재 질문이 있으면
       chat:restored → ai:question 재전송
```

- DB의 과거 메시지와 연결별 진행 상태는 서로 다른 개념이다.
- 현재 구현은 같은 서버 프로세스에 대한 단기 재접속만 지원한다.
- 서버가 재시작되면 `Map`·`WeakMap`의 질문, metadata, 큐, ACK 상태가 사라진다.
- ACK 전 Blob은 프론트가 보관하고 재접속 후 같은 `audioTransferId`로 재전송한다.
- Redis 기반 다중 서버·서버 재시작 복구는 MVP 이후로 보류한다.

## 10. 구현 상태

### 구현 완료

- WS 연결과 JWT `SENIOR` 인증
- `chat:start`, 최초 질문 저장, `chat:started`, `ai:question`
- metadata 검증과 binary 결합
- 답변 메시지·관계 트랜잭션 저장
- `audio:ack`과 중복 전송 기존 ACK 재전송
- 질문별 10초 추가 답변 큐와 용량·개수 제한
- 메시지별 분석 저장과 통합 다음 질문 계약
- FastAPI REST Client, 응답 검증, 일시 오류 1회 재시도
- 수동 종료, 30초 안내, 2분 자동 종료
- 늦은 답변 저장·분석과 중복 다음 질문 차단
- 과거 메시지 cursor REST API
- 같은 서버 내 단기 현재 질문 복원
- 단위 테스트와 Mock FastAPI 포함 E2E 테스트

### 외부 연동 전

- 실제 프론트의 녹음 포맷과 metadata/binary 전송
- 프론트의 ACK 전 Blob 보관·재전송
- 실제 FastAPI multipart 요청·응답 일치 확인
- 분석 실패와 무응답 안내 화면 UX

### MVP 이후

- Redis 기반 진행 상태·큐·ACK 복구
- 서버 재시작 및 다중 인스턴스 환경 복구
- TTS binary 전송
- 런타임 검증 스키마의 프론트·백엔드 완전 공유

## 11. 멘토링 확인 사항

- 시니어 대상 추가 답변 대기 10초와 총 2분 무응답 종료가 적절한가?
- 늦은 답변은 저장·분석하되 이미 보낸 다음 질문은 재생성하지 않는 정책이 적절한가?
- 메시지별 분석 저장과 전체 답변 기반 다음 질문 생성 방식이 적절한가?
- 실시간 동작은 WS, 과거 기록은 REST로 분리한 구조가 적절한가?
- 단기 복원은 메모리로 처리하고 완전 복구를 MVP 이후 Redis로 미루는 것이 적절한가?
- FastAPI 일시 오류에 한 번만 자동 재시도하는 정책이 적절한가?
