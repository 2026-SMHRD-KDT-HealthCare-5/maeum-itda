# 백엔드 WebSocket 및 FastAPI 통신 명세

## 1. 서버 전체 구조와 객체 역할

```text
Frontend
  │
  ├─ WebSocket /ws/chats
  │    └→ ChatsGateway                      // WS 연결 및 이벤트 분배
  │         ├→ ChatAuthHandler              // JWT 인증
  │         ├→ ChatStartHandler             // 대화 시작과 최초 질문 전송
  │         ├→ AudioMetadataHandler         // 다음 binary의 metadata 보관
  │         ├→ AudioBinaryHandler           // binary 접수부터 분석·다음 질문까지 조정
  │         └→ ChatEndHandler               // 수동 종료 처리
  │
  └─ REST GET /chats/messages
       └→ ChatsController                   // 과거 메시지 HTTP 요청 진입점
            → ChatsService                  // 조회 업무 순서 관리
            → ConversationMessageRepository // TypeORM 메시지 조회
            → MySQL

AudioBinaryHandler
  ├→ AudioMetadataHandler                  // pending metadata 조회·제거
  ├→ AudioAnswerRepository                 // 답변 메시지와 질문·답변 관계 저장
  ├→ AudioTransferStateService             // 중복 전송 ID와 기존 ACK 임시 보관
  ├→ QuestionAnswerQueueService            // 질문별 답변 확정 (endType 무관, 대기 없이 즉시)
  ├→ AnalysisService                       // 분석 요청과 결과 저장 순서 관리
  │    ├→ TemporaryAudioRepository         // 질문별 음성 Buffer 임시 보관
  │    ├→ AiClient                         // FastAPI REST 요청·응답 검증
  │    └→ AnalysisResultRepository         // STT·감성·척도·다음 질문 DB 저장
  └→ ChatConnectionStateService            // 현재 질문 교체 및 재접속 상태 관리
```

### 1.1 Frontend ↔ NestJS에서 주고받는 데이터

| 방향              | 통신             | 주고받는 내용                                         |
| ----------------- | ---------------- | ----------------------------------------------------- |
| Frontend → NestJS | WebSocket JSON   | JWT, 대화 시작·종료, 음성 metadata                    |
| Frontend → NestJS | WebSocket binary | 브라우저에서 녹음한 음성 원본                         |
| NestJS → Frontend | WebSocket JSON   | 인증 결과, AI 질문, 음성 ACK, 무응답 안내, 종료, 오류 |
| Frontend → NestJS | REST GET         | 과거 메시지 조회 시작 위치와 한 번에 조회할 개수      |
| NestJS → Frontend | REST JSON        | AI·시니어의 메시지 목록과 다음 조회 시작 위치         |

### 1.2 NestJS ↔ FastAPI에서 주고받는 데이터

| 방향             | 통신           | 주고받는 내용                                  |
| ---------------- | -------------- | ---------------------------------------------- |
| NestJS → FastAPI | REST multipart | 질문 ID와 여러 답변의 음성·메시지 ID·녹음 정보 |
| FastAPI → NestJS | REST JSON      | 메시지별 STT·감성·척도 결과와 다음 AI 질문     |

`multipart/form-data`는 일반 JSON 데이터와 실제 음성 파일을 HTTP 요청 하나에 같이 담아 보내는 방식이다. NestJS는 질문 정보, 답변 메시지 ID, 녹음 정보 및 음성 파일을 하나의 HTTP 요청에 담아 FastAPI로 전송한다.

시니어가 같은 질문에 두 번 답변하면 두 답변을 하나의 문장으로 합치지 않는다. 각 답변은 DB에 따로 저장하고 화면에서도 각각의 말풍선으로 보여준다. 다만 FastAPI는 두 답변을 모두 참고해 다음 AI 질문 하나를 만든다.

## 2. 공통 데이터 형식

### 2.1 WebSocket JSON envelope

프론트와 NestJS가 주고받는 모든 JSON 이벤트는 다음 형식을 사용한다.

```json
{
  "event": "이벤트명",
  "payload": {},
  "ts": "2026-08-12T06:00:00.000Z"
}
```

| 변수                | 의미                                                        |
| ------------------- | ----------------------------------------------------------- |
| `event`             | 처리할 WS 이벤트 이름                                       |
| `payload`           | 이벤트별 데이터                                             |
| `ts`                | 송신 시각, UTC ISO 8601                                     |
| `messageId`         | `CONVERSATION_MESSAGE.MESSAGE_ID`, 해당 메시지 자체의 DB ID |
| `questionMessageId` | 시니어 답변이 참조하는 AI 질문의 `messageId`                |
| `generationId`      | AI 질문 한 건의 생성 작업 UUID                              |
| `audioTransferId`   | metadata와 binary 한 건을 연결하고 중복 전송을 확인하는 ID  |
| `seniorId`          | JWT에서 확인하므로 WS payload에서 제외                      |

- DB 컬럼은 `MESSAGE_ID`, TypeScript 속성은 `messageId`처럼 표기한다.

### 2.2 공통 오류 JSON

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

| 변수           | 의미                                   |
| -------------- | -------------------------------------- |
| `code`         | 프론트 분기용 오류 코드                |
| `message`      | 오류 설명                              |
| `requestEvent` | 오류가 발생한 요청 이벤트              |
| `retryable`    | 같은 요청을 다시 시도할 수 있는지 여부 |

## 3. 전체 통신 흐름

흐름을 대화 시작, 답변 처리, 종료의 세 구간으로 나눈다.

### 3.1 연결·인증·대화 시작

```text
[1. WebSocket 연결]
Frontend
  └─ WS /ws/chats 연결 요청
       → NestJS ChatsGateway
       → WebSocket 연결 완료

[2. WebSocket 인증]
Frontend
  └─ auth { token }
       → NestJS ChatAuthHandler
       → JWT 검증
       → SENIOR 역할 확인
       → auth:success
       → Frontend


[3. 대화 시작 및 최초 질문 저장]
Frontend
  └─ chat:start
       → NestJS ChatStartHandler
       → ChatsService
       → generationId 생성
       → 최초 AI 질문 생성
       → ConversationMessageRepository
       → MySQL CONVERSATION_MESSAGE 저장
       → 저장된 messageId 반환
       → StartedChat 반환
          {
            messageId,
            generationId,
            content
          }

[4. 대화 시작 결과 전송]
NestJS ChatStartHandler
  ├─ chat:started
  │    → Frontend
  │    → 대화 시작 완료 알림
  │
  └─ ai:question
       → Frontend
       → 최초 AI 질문 전달
          {
            messageId,
            generationId,
            content
          }
```

### 3.2 음성 답변·FastAPI 분석·다음 질문

```text
[1. 음성 metadata 전달]
Frontend
  → audio:metadata
  → NestJS AudioMetadataHandler
  → metadata 형식 검증
  → 현재 질문의 questionMessageId·generationId 비교
  → pending metadata 임시 보관


[2. 음성 binary 전달]
Frontend
  → binary frame
  → NestJS AudioBinaryHandler
  → pending metadata 조회·제거
  → metadata와 binary 결합
  → 음성 크기·중복 전송 검사


[3. 음성 수신 확인]
NestJS AudioBinaryHandler
  → tempAnswerId 발급(프로세스 메모리 전용 일련번호, 아직 DB 저장 없음)
  → QuestionAnswerQueueService에 등록
  → audio:ack
  → Frontend

audio:ack payload
{
  "audioTransferId": "audio-uuid"
}

[결정사항] 이 시점엔 CONVERSATION_MESSAGE에 아무것도 저장하지 않는다 — 분석이
실패하면 DB에 흔적을 남기지 않기 위해서다(그래서 messageId도 아직 없다).


[4. 질문별 답변 확정]
NestJS QuestionAnswerQueueService
  → 같은 questionMessageId의 답변을 큐에 추가
  → endType(auto/manual) 무관하게 대기 없이 그 자리에서 즉시 질문별 답변 묶음 확정
      ([2026-08-19] 원래 auto는 추가로 3초를 더 기다렸으나 실측 결과 턴당 지연의
      대부분을 차지해 이미 3초→즉시로 좁힌 바 있다.
      [2026-08-21] 그 남은 3초조차 화면 표시 지연에 그대로 얹혀 다시 없앴다 —
      프론트가 이미 3초 무음을 확인한 뒤에만 auto가 발생하므로, 그 위에 서버가
      또 기다릴 이유가 없다. 후속 발화가 짧은 간격으로 이어져도 더 이상 같은
      묶음에 합쳐지지 않고 각각 별도 답변으로 즉시 처리된다 — 대신 그만큼
      다음 질문이 더 빨리 온다)


[5. FastAPI 분석 요청]
NestJS AnalysisService
  → TemporaryAudioRepository에서 음성 조회
  → AiClient
  → POST /analysis/audio/batch
  → FastAPI

전송 데이터(messageIds는 tempAnswerId를 그대로 보낸다 — FastAPI 계약 필드명은 그대로 유지)
{
  "seniorId": 1,
  "questionMessageId": 50,
  "generationId": "generation-uuid",
  "answers": [
    {
      "messageId": 1,
      "audioTransferId": "audio-uuid-1",
      "audio": "binary"
    },
    {
      "messageId": 2,
      "audioTransferId": "audio-uuid-2",
      "audio": "binary"
    }
  ]
}


[6. FastAPI 분석 응답]
FastAPI
  → 메시지별 STT·감성·척도 분석
  → 전체 답변을 참고해 다음 AI 질문 생성
  → JSON 응답(요청받은 messageId를 그대로 echo)
  → NestJS AiClient


[7a. 분석 성공 — 이 시점에 처음 저장]
NestJS AnalysisService
  → AnalysisResultRepository
  → MySQL CONVERSATION_MESSAGE에 시니어 답변 메시지 새로 저장 → 실제 messageId 발급
  → MySQL MESSAGE_RELATIONSHIP에 AI 질문과 답변 관계 저장
  → MySQL에 감정 태그·척도 결과 저장(방금 발급된 messageId 기준)
  → MySQL CONVERSATION_MESSAGE에 다음 AI 질문 저장
  → audio:transcript(방금 저장된 실제 messageId 포함) → Frontend
  → ai:question → Frontend (TTS 합성을 기다리지 않고 텍스트부터 보낸다, 2026-08-20 변경)
  → (비동기) NestJS QuestionDeliveryService.deliverTtsToken() → tts:audio(streamPath 포함) → Frontend
  → Frontend가 streamPath로 GET /chats/tts-stream 요청 → NestJS가 FastAPI POST /tts/synthesize/stream 응답을 그대로 중계(2026-08-21부로 base64 일괄 전달 → 실시간 스트리밍으로 전환, §6.4 참고)

[7b. 분석 실패 — 아무것도 저장하지 않음]
NestJS AnalysisService
  → 저장 없이 그대로 예외 전파
  → NestJS AudioBinaryHandler
  → error(code: AUDIO_ANALYSIS_FAILED) → Frontend
  → Frontend는 배너로 실패를 안내하고 같은 질문에 대한 녹음을 곧바로 다시 연다
```

위 그림에서 FastAPI는 별도 서버다. 가운데 REST 화살표의 실제 방향은 `NestJS → FastAPI 요청`, `FastAPI → NestJS 응답`이다.

### 3.3 수동·자동 종료

```text
수동 종료
Frontend ── chat:end ──→ NestJS
Frontend ←─ chat:ended ─ NestJS

자동 종료
AI 질문 후 30초 무응답
Frontend ←─ chat:idle-warning ─ NestJS

AI 질문 후 총 10분 무응답
Frontend ←─ chat:ended(reason=INACTIVITY_TIMEOUT) ─ NestJS
```

종료 후에도 WebSocket은 유지한다. 프론트가 대화 화면을 나갈 때 연결을 닫는다.

## 4. Frontend ↔ NestJS WebSocket 이벤트별 계약

### 4.1 `auth` / `auth:success` / `auth:error`

| 구분      | 내용                                              |
| --------- | ------------------------------------------------- |
| 요청 주체 | Frontend                                          |
| 처리 주체 | NestJS `ChatAuthHandler`                          |
| 성공 응답 | NestJS → Frontend `auth:success`                  |
| 실패 응답 | NestJS → Frontend `auth:error`, close code `1008` |

Frontend → NestJS:

```json
{
  "event": "auth",
  "payload": { "accessToken": "JWT_ACCESS_TOKEN" },
  "ts": "2026-08-12T06:00:00.000Z"
}
```

NestJS → Frontend:

```json
{
  "event": "auth:success",
  "payload": { "userId": 7, "role": "SENIOR" },
  "ts": "2026-08-12T06:00:00.100Z"
}
```

- WS 연결 직후 첫 메시지는 반드시 `auth`이다.
- JWT 서명·만료와 `SENIOR` 역할을 검증한다.
- 단기 재접속 상태가 있으면 인증 뒤 `chat:restored`와 기존 `ai:question`을 보낸다.

### 4.2 `chat:start` / `chat:started` / `ai:question`

| 구분      | 내용                                                                     |
| --------- | ------------------------------------------------------------------------ |
| 요청 주체 | Frontend                                                                 |
| 처리 주체 | NestJS `ChatStartHandler → ChatsService → ConversationMessageRepository` |
| 응답 주체 | NestJS                                                                   |

Frontend → NestJS:

```json
{
  "event": "chat:start",
  "payload": {},
  "ts": "2026-08-12T06:00:01.000Z"
}
```

NestJS → Frontend:

```json
{
  "event": "chat:started",
  "payload": {},
  "ts": "2026-08-12T06:00:01.100Z"
}
```

**[2026-08-21 변경] `tts:audio`는 더 이상 합성된 오디오 자체(base64)를 담지 않는다** — 최초 질문·후속 질문 모두 순서가 동일하게 통일됐다: `ai:question`(최초 질문은 `chat:started` 다음)을 먼저 보내고, `tts:audio`는 오디오를 스트리밍으로 받아올 수 있는 짧은 인증 토큰(`streamPath`)만 담아 비동기로 뒤이어 보낸다(`QuestionDeliveryService.deliverTtsToken()`, fire-and-forget). `messageId`로 어느 질문의 음성인지 연결한다:

```json
{
  "event": "tts:audio",
  "payload": {
    "ttsTransferId": "8f14e45f-...",
    "messageId": 101,
    "streamPath": "/chats/tts-stream?messageId=101&token=<30초 TTL 단기 JWT>"
  },
  "ts": "2026-08-12T06:00:01.150Z"
}
```

프론트는 이 `streamPath`를 `<audio src>`에 그대로 꽂아 실제 오디오 바이트를 받는다 — 오디오 자체는 WebSocket이 아니라 별도 인증 HTTP GET으로 전달된다(§6.4).

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

- 최초 질문을 DB에 저장한 뒤 `chat:started`, `ai:question` 순서로 먼저 보내고, `tts:audio`(streamPath)는 비동기로 뒤이어 보낸다.
- 활성 질문이 있는데 다시 시작하면 `CHAT_ALREADY_STARTED` 오류를 보낸다.
- `generationId`는 질문 생성 작업 단위다.
- Typecast 호출이 실패하면 `tts:audio` 자체를 보내지 않는다 — 텍스트 질문으로 대화는 계속된다(프론트는 TTS 재생 없이 곧바로 마이크를 연다).

### 4.3 `audio:metadata` / binary / `audio:ack`

| 구분      | 내용                                                |
| --------- | --------------------------------------------------- |
| 요청 주체 | Frontend                                            |
| 처리 주체 | NestJS `AudioMetadataHandler`, `AudioBinaryHandler` |
| 응답 주체 | NestJS                                              |

Frontend → NestJS metadata:

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

Frontend → NestJS 다음 프레임:

```text
WebSocket binary frame: 음성 원본
```

NestJS → Frontend:

```json
{
  "event": "audio:ack",
  "payload": {
    "audioTransferId": "audio-transfer-001"
  },
  "ts": "2026-08-12T06:00:04.200Z"
}
```

- metadata 다음에 해당 binary를 전송한다.
- metadata 없이 binary가 오거나 pending metadata가 있는데 새 metadata가 오면 거부한다.
- 질문 ID와 `generationId`가 현재 또는 같은 연결에서 전달한 질문과 일치해야 한다.
- 음성 한 건은 최대 10MB이다.
- **[결정사항] 답변 메시지는 이 시점에 DB에 저장되지 않는다** — `audio:ack`는 바이너리를 정상적으로 접수해 질문별 큐에 등록했다는 확인일 뿐이며, `messageId`를 포함하지 않는다(분석이 성공하기 전에는 실제 DB ID가 존재하지 않는다). 실제 메시지는 §6.3의 `audio:transcript`로 분석 성공이 확정된 시점에야 처음 생성된다.
- 같은 `audioTransferId`를 재전송하면 큐에 다시 등록하지 않고 기존 ACK를 다시 보낸다.

### 4.4 `chat:idle-warning`

| 구분      | 내용                           |
| --------- | ------------------------------ |
| 발생 주체 | NestJS `ChatInactivityService` |
| 수신 주체 | Frontend                       |

NestJS → Frontend:

```json
{
  "event": "chat:idle-warning",
  "payload": {
    "message": "천천히 생각하시고 편하게 말씀해 주세요.",
    "remainingSeconds": 570
  },
  "ts": "2026-08-12T06:00:31.200Z"
}
```

- AI 질문 후 30초 동안 첫 발화가 없으면 한 번 보낸다.
- 유효한 metadata가 접수되면 무응답 타이머를 취소한다.

### 4.5 `chat:end` / `chat:ended`

| 구분           | 내용                                                 |
| -------------- | ---------------------------------------------------- |
| 수동 요청 주체 | Frontend                                             |
| 처리 주체      | NestJS `ChatEndHandler` 또는 `ChatInactivityService` |
| 응답 주체      | NestJS                                               |

Frontend → NestJS:

```json
{
  "event": "chat:end",
  "payload": { "reason": "USER_REQUESTED" },
  "ts": "2026-08-12T06:05:00.000Z"
}
```

NestJS → Frontend:

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

- 수동 종료는 `USER_REQUESTED`, 총 10분 무응답 종료는 `INACTIVITY_TIMEOUT`이다.
- 남은 큐는 분석하지만 종료 후 다음 질문은 저장·전송하지 않는다.
- 별도 대화 세션·종료 레코드는 저장하지 않는다.

### 4.6 `chat:restored`

| 구분      | 내용                                |
| --------- | ----------------------------------- |
| 발생 주체 | NestJS `ChatConnectionStateService` |
| 수신 주체 | Frontend                            |

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

- 같은 서버 프로세스에 단기 재접속하면 현재 질문을 복원한다.
- 이어서 같은 질문의 `ai:question`을 다시 보낸다.
- 프론트는 `messageId`를 기준으로 중복 말풍선을 만들지 않는다.

## 5. 질문별 답변 확정

```text
AI 질문 messageId=101
  ├→ 답변 messageId=102, 관계 ANSWER → 도착 즉시 답변 묶음 확정, FastAPI 전달
  └→ 추가 답변 messageId=103, 관계 ADDITIONAL_ANSWER → 별도 묶음으로 도착 즉시 확정,
       FastAPI 전달(늦은 답변 경로, §6.3 참고 — 101에 대한 다음 질문이 이미 나갔다면
       새 질문은 만들지 않고 STT 결과만 audio:transcript로 전달)
```

- 답변마다 별도 DB 메시지와 별도 프론트 말풍선을 사용한다.
- 같은 질문인지 여부는 감정이 아니라 `questionMessageId`로 판단한다.
- **[2026-08-21] `endType`(`auto`/`manual`) 무관하게 답변이 도착하는 즉시 확정한다 —
  더 이상 대기하지 않는다.** 원래 `auto`(묵음 자동 종료)는 추가 발화를 기다리려고
  3초를 더 대기했었다(`manual`은 2026-08-19부터 이미 즉시 확정). 하지만 `auto`
  자체가 프론트에서 이미 3초 무음을 확인한 뒤에만 발생하므로, 그 위에 서버가 또
  기다리는 건 화면 표시 지연에 그대로 얹히는 중복 대기였다 — 실측 결과 이 대기가
  텍스트·다음 질문이 화면에 뜨기까지의 지연 대부분을 차지해 완전히 없앴다. 부작용:
  후속 발화가 짧은 간격으로 이어져도 더 이상 같은 답변 묶음으로 합쳐지지 않고
  각각 독립된 답변(그리고 각각의 FastAPI 호출)으로 처리된다.
- 질문 하나당 최대 5개, 음성 한 건 최대 10MB, 전체 최대 30MB이다(더 이상 대기 창
  안에서만 세지 않고, 질문 하나에 대해 지금까지 들어온 답변 전체를 누적해서 센다).
- FastAPI는 메시지별 STT·감성·척도 결과를 반환한다.
- 감성이 서로 달라도 복합 감정 또는 감정 변화로 보고 오류로 처리하지 않는다.
- FastAPI는 모든 답변의 맥락을 참고해 다음 질문 하나를 생성한다.
- 분석이 시작된 뒤 늦게 온 답변도 ACK·저장·분석한다.
- 이미 다음 질문을 보냈다면 늦은 답변으로 새 질문을 다시 만들지 않는다.

### 시간 정책

| 기준                                       | 의미                                 | 담당     |
| ------------------------------------------ | ------------------------------------ | -------- |
| 질문 후 30초                               | 첫 발화 전 안내                      | NestJS   |
| 말하는 중 3초 동안 묵음                    | 현재 음성 녹음 종료                  | Frontend |
| 음성 답변(`endType: auto`) 수신 후 3초 동안 추가 전송 없음 | 답변 수집을 끝내고 FastAPI 분석 시작 | NestJS   |
| 음성 답변이 `endType: manual`로 도착 | 대기 없이 즉시 답변 수집을 끝내고 FastAPI 분석 시작 | NestJS |
| 질문 후 총 10분 무응답                     | 대화 자동 종료                       | NestJS   |

## 6. NestJS ↔ FastAPI REST 계약

이 구간에는 WebSocket 이벤트명이 없다. NestJS가 FastAPI에 HTTP 요청을 보내고 JSON 응답을 받는다.

### 6.1 NestJS → FastAPI 요청

```http
POST /analysis/audio/batch
Content-Type: multipart/form-data
```

| 필드                 | 형태      | 설명                                                                 |
| -------------------- | --------- | --------------------------------------------------------------------- |
| `questionMessageId`  | 단일 값   | 답변 대상 AI 질문 ID                                                   |
| `generationId`       | 단일 값   | 질문 생성 작업 ID                                                      |
| `audioFiles`         | 반복 파일 | 질문에 속한 음성들                                                     |
| `messageIds`         | 반복 값   | 각 음성의 답변 메시지 ID                                               |
| `audioTransferIds`   | 반복 값   | 각 음성 전송 ID                                                        |
| `capturedAts`        | 반복 값   | 녹음 시각                                                              |
| `endTypes`           | 반복 값   | `auto` 또는 `manual`                                                   |
| `prevSessionSummary` | 단일 값, 선택 | 리포트가 있는 최근 3일치 요약을 `[날짜] 요약` 형식으로 오래된 순서로 이어붙인 텍스트(`AnalysisContextRepository.buildPrevSessionSummary`, 2026-08-20부터 직전 1일 → 최근 3일로 확장) |
| `pendingScaleItems`  | 단일 값(JSON 문자열), 선택 | 오늘 아직 채점되지 않은 척도 문항 맵, 예: `{"SGDS_K": ["1", "3"], "GAD_7": ["2"]}` |
| `conversationTurns`  | 단일 값(JSON 문자열), 선택 | 오늘 대화 전체(질문 시점까지, 화자·발화 배열) — 2026-08-20부터 최근 5개 제한을 없앰 |

multipart를 JSON 형태로 표현하면 다음과 같다. 실제 요청은 JSON이 아니라 파일을 포함한 multipart다.

```json
{
  "questionMessageId": 101,
  "generationId": "550e8400-e29b-41d4-a716-446655440000",
  "audioFiles": ["<binary-1>", "<binary-2>"],
  "messageIds": [102, 103],
  "audioTransferIds": ["audio-transfer-001", "audio-transfer-002"],
  "capturedAts": ["2026-08-12T06:00:03.500Z", "2026-08-12T06:00:10.500Z"],
  "endTypes": ["auto", "manual"],
  "prevSessionSummary": "[2026-08-11] 어제는 산책 다녀오신 이야기를 나눴어요.",
  "pendingScaleItems": "{\"SGDS_K\":[\"1\",\"3\"],\"GAD_7\":[\"2\"],\"LSNS_6\":[]}",
  "conversationTurns": "[{\"speakerType\":\"AI\",\"content\":\"오늘 하루는 어떠셨어요?\"},{\"speakerType\":\"SENIOR\",\"content\":\"오늘 아들이 집에 왔어요.\"}]"
}
```

### 6.2 FastAPI → NestJS 응답

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
      "transcript": "그런데 금방 가버려서 서운했어요.",
      "sentimentLabel": "NEGATIVE",
      "scaleAnalyses": [
        {
          "scaleType": "SGDS_K",
          "questionNumber": 2,
          "analysisScore": 1
        }
      ]
    }
  ],
  "nextQuestion": "아드님이 금방 돌아가셔서 많이 서운하셨군요."
}
```

- `answers[]`의 각 결과를 해당 `messageId`에 개별 저장한다.
- transcript 두 개는 합치지 않고 프론트에서 각각 말풍선으로 표시한다.
- 요청과 응답의 `messageId` 집합이 정확히 일치해야 한다.
- `nextQuestion`은 문자열 또는 `null`이다.
- **[2026-08-20 변경] 이 응답에는 더 이상 TTS가 포함되지 않는다.** 예전에는 AI 서버가 `nextQuestion`의 Typecast 합성 결과를 `ttsAudioBase64`/`ttsMimeType`으로 같은 응답에 채워 보냈지만, 그러면 화면에 다음 질문 텍스트가 뜨는 시점이 TTS 합성 시간만큼 밀렸다. 지금은 이 배치 응답이 텍스트만 담아 즉시 돌아오고, 백엔드가 텍스트 전달 후 별도로 `POST /tts/synthesize/stream`(바로 아래 표 참고)을 호출해 스트리밍 음성을 받아 `tts:audio`(streamPath)로 뒤이어 전달한다(§6.3/§6.4).
- 네트워크·타임아웃·HTTP 502/503/504는 500ms 후 한 번 재시도한다.
- HTTP 4xx와 응답 계약 오류는 재시도하지 않는다.

**TTS 합성 엔드포인트는 FastAPI에 두 개가 존재한다** (`/analysis/audio/batch` 응답에는 포함되지 않음):

| 엔드포인트 | 요청 | 응답 |
| --- | --- | --- |
| `POST /tts/synthesize/stream` | `{ "text": "..." }` | HTTP 청크 스트림, `Content-Type: audio/mpeg`(설정과 무관하게 항상 mp3, 940f6f4). `ChatStartHandler`(최초 질문)·`QuestionDeliveryService.deliverTtsToken()`(후속 질문) 모두 이 엔드포인트로 통일됐다(§6.4) |
| `POST /tts/synthesize` | `{ "text": "..." }` | `{ "ttsAudioBase64": "...", "ttsMimeType": "audio/mpeg" }` — 배치(비스트리밍) 합성. **현재 NestJS 쪽에서 이 경로를 호출해 WS 페이로드에 싣는 코드가 확인되지 않는다** — 최초 질문 경로도 스트리밍으로 통일됐으므로 실제로는 안 쓰이는 legacy 엔드포인트일 가능성이 있다(확인 필요, `apps/backend`에서 `ttsAudioBase64` 참조 여부로 재확인할 것) |

### 6.3 FastAPI 응답 이후 NestJS → Frontend

FastAPI 응답을 검증하고 DB 저장까지 완료한 뒤 NestJS는 TTS 합성을 기다리지 않고 곧바로 `ai:question`을 보낸다(`AudioBinaryHandler.processBatchAndSendNextQuestion` → `QuestionDeliveryService.deliverQuestion`). 이후 별도로 `QuestionDeliveryService.deliverTtsToken()`이 같은 `messageId`로 `tts:audio`(streamPath, §4.2/§6.4 참고)를 비동기로 뒤이어 보낸다 — 프론트가 그 `streamPath`로 실제 요청을 보내는 시점에 이미 다음 질문으로 넘어갔거나 대화가 끝났으면 늦게 온 음성은 조용히 버린다.

```json
{
  "event": "ai:question",
  "payload": {
    "messageId": 104,
    "generationId": "8d073a92-d19b-4d70-a156-eedc204fac41",
    "content": "아드님이 금방 돌아가셔서 많이 서운하셨군요."
  },
  "ts": "2026-08-12T06:00:22.000Z"
}
```

`ai:question` 직전(또는 늦은 답변이라 다음 질문이 없는 경우 단독으로) STT(LLM 교정 포함) 결과를 `audio:transcript`로 보낸다. **[결정사항] 여기 담긴 `messageId`는 이 이벤트를 보내는 시점에 막 DB에 처음 저장된 실제 메시지 ID다** — `audio:metadata`/`audio:binary`/`audio:ack` 어디에도 메시지 ID가 없었던 이유가 이것이다. 프론트는 이 이벤트를 받아야 비로소 시니어 답변 말풍선을 대화 목록에 추가한다(그 전까지는 화면에 아무 말풍선도 없다 — "답변을 보내드렸어요" 같은 낙관적 placeholder를 먼저 보여주지 않는다):

```json
{
  "event": "audio:transcript",
  "payload": {
    "transcripts": [{ "messageId": 102, "content": "오늘 산책했어요." }]
  },
  "ts": "2026-08-12T06:00:21.500Z"
}
```

**분석 자체가 실패한 경우**(예: 무음 녹음이라 STT 결과가 없음, FastAPI 5xx 재시도 소진 등)엔 **아무것도 저장되지 않으므로 `audio:transcript` 자체를 보내지 않는다** — 실패한 답변은 애초에 메시지로 존재한 적이 없다. `error`(`code: "AUDIO_ANALYSIS_FAILED"`) 이벤트만으로 실패를 알린다. 프론트(시니어 녹음 화면)는 이 이벤트를 받으면 배너로 실패를 안내하고, 같은 질문에 대한 녹음을 곧바로 다시 열어 처음 화면 진입 때와 같은 "답변 대기" 상태로 돌아간다(무한 대기하거나 실패 말풍선이 남지 않는다).

### 6.4 TTS 오디오 전달 — `GET /chats/tts-stream` (2026-08-21 신설)

`tts:audio`(§4.2)가 실어보내는 `streamPath`가 가리키는 실제 엔드포인트다. `<audio src>`가 헤더를 붙일 수 없으므로, 일반 `Authorization` 헤더 대신 쿼리 파라미터에 담긴 전용 단기 JWT로 인증한다.

```http
GET /chats/tts-stream?messageId=104&token=<30초 TTL 단기 JWT>
```

- 토큰은 `AuthService.signTtsStreamToken(messageId, seniorId)`가 발급하며 payload는 `{ purpose: 'tts-stream', messageId, seniorId }`, TTL은 30초(`TTS_STREAM_TOKEN_TTL`)다. 일반 로그인 access token과는 별개이며 이 엔드포인트 전용이다.
- NestJS `TtsStreamController`가 `TtsClient.synthesizeStream(text)`로 FastAPI `POST /tts/synthesize/stream`(§6.1 하단 참고)을 호출하고, 그 응답 스트림을 그대로 1:1 중계한다(`Content-Type`도 업스트림 값을 그대로 전달, 항상 `audio/mpeg`).
- **[2026-08-23 수정, a916206]** 업스트림 스트림이 중간에 끊기면(`Readable`의 `error` 이벤트) 이전에는 처리되지 않은 예외로 NestJS 프로세스 전체가 죽었다 — 지금은 헤더 전송 전이면 HTTP 502로, 이미 스트리밍 중이면 `res.destroy()`로 정리한다.
- FastAPI `AI_BASE_URL` 요청의 타임아웃은 45초다(`TTS_STREAM_TIMEOUT_MS`, a508be1에서 Render 콜드스타트 여유를 두려고 30초→45초로 상향). 첫 바이트를 이미 스트리밍하기 시작한 뒤에는 재시도하지 않는다(브라우저에 이미 일부가 전달됐기 때문).

## 7. Frontend ↔ NestJS 과거 메시지 REST API

과거 대화 전체를 한 번에 불러오지 않고 cursor 기반 REST API로 일정 개수씩 나누어 조회한다.

- `cursor`: 다음 조회를 어디서부터 시작할지 나타내는 메시지 ID
- `limit`: 한 번에 조회할 메시지 개수
- `messages`: AI·시니어 말풍선을 구성할 메시지 목록
- `nextCursor`: 더 오래된 메시지를 다음에 조회할 때 사용할 값. 모두 조회했다면 `null`

Frontend → NestJS:

```http
GET /chats/messages?cursor=150&limit=30
Authorization: Bearer JWT_ACCESS_TOKEN
```

위 예시는 메시지 ID 150보다 이전에 작성된 메시지를 최대 30개 조회한다는 뜻이다.

NestJS → Frontend:

```json
{
  "messages": [
    {
      "messageId": 121,
      "speakerType": "SENIOR",
      "content": "오늘 아들이 집에 왔어요.",
      "sttStatus": "COMPLETED",
      "createdAt": "2026-08-12T06:00:04.000Z"
    },
    {
      "messageId": 122,
      "speakerType": "SENIOR",
      "content": "그런데 금방 가버려서 서운했어요.",
      "sttStatus": "COMPLETED",
      "createdAt": "2026-08-12T06:00:11.000Z"
    }
  ],
  "nextCursor": 121
}
```

- 각 메시지가 별도 배열 원소이므로 프론트는 메시지별 말풍선을 만든다.
- JWT의 시니어 ID를 사용해 본인의 메시지만 조회한다.
- 기본 `limit`은 30, 최대 100이다.

## 8. 구현 상태와 확인할 부분

### 구현 완료

- JWT WS 인증과 이벤트 분배
- 대화 시작·수동 종료·무응답 자동 종료
- metadata와 binary 결합, 질문별 큐 등록과 `audio:ack`
- 질문별 답변 확정(endType 무관, 대기 없이 즉시 — 2026-08-19에 10초→3초, 2026-08-21에 3초→즉시로 축소)
- FastAPI multipart Client와 응답 계약 검증
- **[결정사항] 답변 메시지는 분석 성공 시점에야 처음 DB에 저장된다** — 분석 실패 시 아무것도 저장하지 않고 `error`(`AUDIO_ANALYSIS_FAILED`)만 보낸다(§4.3, §6.3)
- 메시지별 분석 결과 저장과 다음 질문 WS 전송
- 질문(최초·후속 공통)마다 Typecast 실시간 TTS 스트리밍과 프론트 재생까지 연결 완료 — 순서는 최초·후속 공통으로 `ai:question`(또는 `chat:started`+`ai:question`)을 먼저 보내고 `tts:audio`(streamPath)는 비동기로 뒤이어 보낸다(§4.2/§6.3). **[2026-08-21 변경]** 오디오 자체는 더 이상 base64로 WS에 실리지 않고, 프론트가 `streamPath`로 별도 인증 HTTP GET(`/chats/tts-stream`, §6.4)을 열어 FastAPI `POST /tts/synthesize/stream`의 청크를 그대로 받는다
- 질문 생성 문맥(오늘 미채점 문항·최근 3일 요약·오늘 대화 전체) DB 조회 후 AI 서버 호출 시 전달 완료(§6.1)
- 중복 전송 기존 ACK 재전송
- 과거 메시지 cursor REST API
- 같은 서버 프로세스의 단기 현재 질문 복원
- Mock FastAPI를 사용한 단위·E2E 테스트
- **안정성 보강(2026-08-22~23)**: TTS 스트림 중계 중 처리되지 않은 `error`로 서버 전체가 죽던 문제(a916206), AI서버 TTS 스트리밍이 wav 설정 시 헤더 없는 PCM을 내보내 재생 불가능하던 문제(940f6f4, 스트리밍 경로는 이제 설정과 무관하게 항상 mp3 고정), 로컬 Whisper 폴백의 `requests` 암묵 의존성 누락(dc4e410), `process.on('unhandledRejection'/'uncaughtException')` 안전망과 FastAPI 호출 타임아웃 30초→45초 상향(콜드스타트 여유, a508be1) — 전부 수정·병합 완료

### Frontend와 맞춰야 할 부분

- 브라우저 녹음 MIME 형식
- metadata와 binary 전송 순서
- ACK 전 Blob 보관과 재전송
- 메시지별 말풍선 표시
- 30초 안내·10분 종료 UI

### FastAPI와 맞춰야 할 부분

- multipart 반복 필드 이름과 배열 순서
- 메시지별 STT·감성·척도 응답 형식
- 여러 답변을 참고한 `nextQuestion` 생성 방식
- HTTP 오류와 분석 오류 응답 규격

### MVP 이후

- Redis 기반 서버 재시작·다중 인스턴스 상태 복원
- 프론트·백엔드·FastAPI 런타임 스키마 공유
