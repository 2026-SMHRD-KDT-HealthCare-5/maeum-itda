# WebSocket 대화 프로토콜 설계안

## 1. 문서 목적과 상태

시니어 브라우저, NestJS 백엔드, FastAPI AI 서버 사이의 실시간 대화 규격을 정리한다.
기술 멘토링에서는 이 문서의 **검토 요청 사항**을 중심으로 확인한다.

문서 상태: 백엔드 기준 설계안

- 확정: 팀에서 방향을 정한 내용
- 확인 필요: 프론트엔드·FastAPI·기술 멘토와 최종 합의할 내용
- 구현 예정: 설계는 정했지만 아직 코드에 반영하지 않은 내용

## 2. 핵심 결정 요약

| 구분 | 결정 내용 | 상태 |
|---|---|---|
| 브라우저 통신 | 순수 WebSocket, NestJS `WsAdapter` 사용 | 확정 |
| AI 서버 통신 | NestJS에서 FastAPI로 REST API 요청 | 확정 |
| 이벤트 형식 | `event / payload / ts` | 프론트 최종 확인 필요 |
| 음성 전송 | metadata JSON 다음에 바이너리 프레임 전송 | 확정 |
| 원본 음성 | 분석에만 사용하고 DB에 저장하지 않음 | 확정 |
| 대화 저장 | AI 질문과 시니어 답변을 각각 메시지 행으로 저장 | 확정 |
| 대화 세션 | 시작·종료 시각으로 메시지를 묶는 세션 개념 사용 안 함 | 확정 |
| 일간 리포트 | 시니어 답변 메시지의 생성 시각을 기준으로 집계 | 정확한 일간 범위 확인 필요 |
| 추가 발화 | 질문 생성 중이면 재요청, TTS 출력 중이면 다음 생성에 반영 | 확정 |
| 처리 화면 | 응답 대기·응답 듣기·질문 생성의 세 상태 | 확정 |
| 재연결 | 미확인 음성 재전송 및 마지막 질문 TTS 재생 | 프론트 최종 확인 필요 |

## 3. 전체 구조

```text
시니어 브라우저 <-- WebSocket --> NestJS <-- REST API --> FastAPI
                                      |
                                      +--> Repository --> MySQL
```

- 실시간 질문·답변·TTS는 브라우저와 NestJS 사이의 WebSocket으로 전달한다.
- 과거 대화와 리포트 조회는 REST API로 처리한다.
- NestJS가 인증, 메시지 저장, 현재 대화 상태와 요청 유효성을 관리한다.
- FastAPI가 STT, 감정 분석, 다음 질문 생성, TTS 기능을 담당하는 방향으로 협의한다.

## 4. 식별자

| 이름 | 구분 대상 | 생성 주체 | DB 저장 |
|---|---|---|---|
| `messageId` | DB에 저장된 개별 메시지 행 | MySQL | 저장 |
| `aiQuestionMessageId` | `messageId` 중 현재 AI 질문을 가리키는 WS 필드 | MySQL·NestJS | 별도 컬럼 없음 |
| `generationId` | 현재 유효한 AI 질문 단위 | NestJS | 저장하지 않음 |
| `captureId` | 시니어 발화 한 건 | 프론트엔드 | 현재 저장하지 않음 |
| `seniorId` | 인증된 시니어 사용자 | MySQL | 저장 |
| `capturedAt` | 클라이언트에서 발화 녹음이 끝난 시각 | 프론트엔드 | 현재 저장하지 않음 |

### 4.1 messageId와 aiQuestionMessageId

`messageId`는 `CONVERSATION_MESSAGE.MESSAGE_ID`를 의미한다. AI와 시니어 메시지는 각각 별도의 행으로 저장되며 모두 자신의 `messageId`를 가진다.

```text
MESSAGE_ID  SPEAKER_TYPE  CONTENT
101         AI            오늘 하루는 어땠나요?
102         SENIOR        친구를 만났어요.
103         SENIOR        같이 산책도 했어요.
```

- `messageId = 101`: AI 질문 행의 PK
- `messageId = 102`: 첫 번째 시니어 답변 행의 PK
- `messageId = 103`: 추가 시니어 답변 행의 PK
- `MESSAGE_ID`는 순서처럼 보이지만 정확한 역할은 메시지 행을 고유하게 구분하는 기본키이다.
- 시간순 조회는 `CREATED_AT`과 `MESSAGE_ID`를 함께 사용한다.

`aiQuestionMessageId`는 새로운 DB 컬럼이 아니다. 현재 질문이 AI 메시지임을 WebSocket에서 명확히 나타내기 위해 `messageId`에 역할 이름을 붙인 것이다.

```text
DB: CONVERSATION_MESSAGE.MESSAGE_ID = 101
WS: aiQuestionMessageId = 101
```

AI 질문 전송:

```json
{
  "event": "ai:question",
  "payload": {
    "aiQuestionMessageId": 101,
    "generationId": "generation-001",
    "content": "오늘 하루는 어땠나요?"
  },
  "ts": "2026-08-07T10:00:00.000Z"
}
```

해당 질문에 대한 시니어 발화 전송:

```json
{
  "event": "audio:metadata",
  "payload": {
    "captureId": "capture-001",
    "aiQuestionMessageId": 101,
    "generationId": "generation-001",
    "mimeType": "audio/webm;codecs=opus",
    "capturedAt": "2026-08-07T10:00:03.500Z",
    "endType": "auto"
  },
  "ts": "2026-08-07T10:00:04.000Z"
}
```

두 이벤트의 `aiQuestionMessageId = 101`은 동일한 AI 질문 메시지를 가리킨다.

### 4.2 generationId

`generationId`는 DB 메시지 ID가 아니라 현재 유효한 AI 질문 단위를 구분하는 UUID이다. 최초 고정 질문에도 NestJS가 발급하고, 이후 FastAPI에 다음 질문 생성을 요청할 때마다 새로 발급한다.

```text
발화 A 수신
    -> generationId G1으로 다음 질문 생성 시작
    -> 생성 중 추가 발화 B 수신
    -> G1 결과 무효화
    -> A와 B를 포함하여 generationId G2로 재요청
    -> G1이 늦게 도착하면 폐기
    -> G2 결과만 AI 질문 메시지로 DB 저장
```

- 서버는 발화 한 건이 끝나면 질문 생성을 시작한다.
- 질문 생성 중 추가 발화가 들어오면 새 `generationId`를 발급한다.
- 오래된 결과는 DB에 저장하거나 프론트에 전송하지 않는다.
- `generationId`가 무효화되어도 이미 DB에 저장된 메시지를 삭제하지 않는다.
- 서버가 보관한 현재 `generationId`를 기준으로 응답 유효성을 판단한다.

### 4.3 메시지 관계 저장

```text
AI 질문 aiQuestionMessageId
    -> MESSAGE_RELATIONSHIP.SOURCE_MESSAGE_ID

DB 저장 후 생성된 시니어 답변 messageId
    -> MESSAGE_RELATIONSHIP.TARGET_MESSAGE_ID
```

- 첫 번째 답변은 `ANSWER`로 연결한다.
- 같은 질문에 대한 추가 발화는 `ADDITIONAL_ANSWER`로 연결한다.

## 5. 공통 이벤트 형식

```json
{
  "event": "이벤트 이름",
  "payload": {},
  "ts": "2026-08-07T10:00:00.000Z"
}
```

- `event`: 이벤트 이름
- `payload`: 이벤트별 데이터
- `ts`: 이벤트를 보낸 주체의 전송 시각
- 처리 순서는 `ts`가 아니라 NestJS의 수신 순서를 우선한다.
- NestJS는 공통 `emitEvent()`를 사용해 응답 형식을 통일한다.

## 6. 이벤트 목록

### 프론트엔드에서 NestJS로 전송

| 이벤트 | 목적 |
|---|---|
| `auth` | JWT 인증 |
| `chat:start` | 실시간 대화 시작 |
| `chat:resume` | 연결 복구 요청 |
| `audio:metadata` | 발화 정보 전송 |
| 바이너리 프레임 | 실제 시니어 음성 전송 |
| `tts:playback-ended` | TTS 실제 재생 완료 알림 |
| `chat:end` | 대화 화면 종료 요청 |

### NestJS에서 프론트엔드로 전송

| 이벤트 | 목적 |
|---|---|
| `auth:success`, `auth:error` | 인증 결과 |
| `chat:started`, `chat:resumed` | 시작·복구 결과 |
| `audio:ack` | 음성 수신 확인 |
| `analysis:processing` | 답변 처리 중 안내 |
| `ai:question` | AI 질문 텍스트 전송 |
| `tts:start`, 바이너리, `tts:end` | TTS 음성 전송 |
| `chat:ended` | 종료 완료 |
| `error` | 백엔드 오류 |

## 7. 정상 대화 흐름

```text
WebSocket 연결
    -> auth
    -> JWT 및 SENIOR 역할 확인
    -> auth:success
    -> chat:start
    -> NestJS가 generationId 발급
    -> 최초 고정 AI 질문 DB 저장
    -> chat:started
    -> ai:question
    -> tts:start
    -> TTS 바이너리
    -> tts:end
    -> tts:playback-ended
    -> 시니어 발화 수집
    -> audio:metadata
    -> 음성 바이너리
    -> audio:ack
    -> analysis:processing
    -> STT·감정 분석·다음 질문 생성
    -> 다음 ai:question
```

인증 실패 시 `auth:error`를 전송하고 Close Code `1008`로 연결을 종료한다.

## 8. 화면 상태와 서버 상태

### 프론트 화면 상태

| 상태 | 실제 상황 | 표시 예시 |
|---|---|---|
| `AWAITING_ANSWER` | AI 질문 후 답변 대기 | 편하게 말씀해 주세요 |
| `LISTENING_ANSWER` | 시니어 발화 녹음 중 | 듣고 있어요 |
| `GENERATING_QUESTION` | 답변 분석 및 질문 생성 중 | 답변을 분석하고 있어요 |

```text
AWAITING_ANSWER
    -> LISTENING_ANSWER
    -> GENERATING_QUESTION
    -> AI 질문 출력
    -> AWAITING_ANSWER
```

- `LISTENING_ANSWER`는 프론트의 녹음 상태이다.
- `analysis:processing`을 받으면 `GENERATING_QUESTION`으로 표시한다.
- TTS 출력 중에는 새로운 화면 상태를 추가하지 않고 AI 질문 내용을 표시한다.

### NestJS 내부 상태

```typescript
interface RealtimeChatState {
  status: 'AWAITING_ANSWER' | 'GENERATING_QUESTION';
  isTtsPlaying: boolean;
  currentGenerationId: string | null;
}
```

- `tts:start` 전송 시 `isTtsPlaying = true`
- `tts:end`는 서버의 바이너리 전송 완료이며 실제 재생 완료가 아님
- `tts:playback-ended` 수신 시 `isTtsPlaying = false`
- 프론트의 상태값을 그대로 신뢰하지 않고 NestJS의 상태를 기준으로 처리

## 9. 음성 처리

```text
audio:metadata JSON
    -> 동일 captureId의 음성 바이너리
    -> audio:ack
```

- `captureId`: 발화 한 건의 중복 수신 방지
- `aiQuestionMessageId`: 어떤 AI 질문에 대한 발화인지 연결
- `generationId`: 프론트가 인지한 질문 생성 요청 ID이며 서버 판단의 참고값
- `endType`: `auto` 또는 `manual`
- `durationMs`: 전송하지 않음
- 원본 음성, `captureId`, `capturedAt`은 현재 DB에 저장하지 않음
- 원본 음성은 STT와 감정 분석에 사용한 뒤 폐기
- DB에는 STT 텍스트와 음성 분석 결과만 저장

## 10. 추가 발화 처리

추가 발화가 들어온 시점에 따라 처리 방법을 구분한다.

### 질문 생성 중 수신

```text
질문 생성 중 추가 발화 수신
    -> pendingAnswers에 저장
    -> 진행 중 요청 취소 또는 결과 무효화
    -> 새 generationId 발급
    -> 기존 답변과 추가 답변을 포함하여 재요청
```

### TTS 출력 중 수신

```text
TTS 출력 중 추가 발화 수신
    -> 현재 TTS 출력 유지
    -> pendingAnswers에 저장
    -> 다음 질문 생성 요청에 포함
```

- 발화마다 다른 `captureId`를 사용한다.
- 같은 AI 질문의 발화는 같은 `aiQuestionMessageId`를 사용한다.
- 서버는 `currentGenerationId`와 `isTtsPlaying`으로 처리 방법을 판단한다.

## 11. 재연결과 TTS

```text
WebSocket 재연결
    -> auth
    -> auth:success
    -> chat:resume { pendingCaptureIds }
    -> 서버가 수신 여부 확인
    -> 미수신 음성만 재전송
    -> chat:resumed
    -> 마지막 AI 질문 TTS 재전송
```

- 프론트는 `audio:ack` 전까지 metadata와 음성 Blob을 임시 보관한다.
- 재연결 시 대화 전체가 아니라 마지막 AI 질문 TTS만 처음부터 재생한다.
- NestJS는 시니어별 마지막 TTS 한 건을 메모리에 최대 10분 보관한다.
- 다음 질문 생성, 답변 완료, 대화 종료 또는 10분 초과 시 캐시를 삭제한다.
- 동일한 `seniorId`의 활성 WebSocket 연결은 한 개만 허용한다.

## 12. chat:started와 일간 리포트 시간

`chat:started`는 세션 ID와 세션 시작 시각을 전달하지 않는다.

```json
{
  "event": "chat:started",
  "payload": {},
  "ts": "2026-08-07T10:00:00.000Z"
}
```

이유:

- 여러 질문·답변을 하나의 시작·종료 시간으로 묶는 대화 세션 개념을 삭제했다.
- AI 질문과 시니어 답변을 독립적인 메시지 행으로 저장한다.
- 일간 리포트는 통화 시작 시각이 아니라 시니어 답변 메시지의 생성 시각을 기준으로 집계하는 방향이다.
- 정확한 일간 집계 시작·종료 시각은 아직 정하지 않았으며 팀 및 기술 멘토와 확인한다.

### 서버 시간대 설정

시간대 값은 코드 여러 곳에 직접 작성하지 않고 환경설정으로 관리한다.

```env
SERVICE_TIME_ZONE=Asia/Seoul
```

현재 시간 처리 원칙:

```text
서비스 기준 시간대: Asia/Seoul
DB 저장 시간대: UTC
일간 집계 범위: 미확정
```

- NestJS는 확정된 서비스 시간대를 기준으로 리포트 조회 범위를 계산한다.
- 계산한 범위를 UTC로 변환한 뒤 DB의 메시지 생성 시각과 비교한다.
- MySQL `DATETIME`에는 시간대 정보가 없으므로 DB에 저장한 시간은 UTC로 해석한다는 규칙을 유지한다.
- 정확한 집계 범위가 확정되면 시작 시각 이상, 종료 시각 미만의 반개구간으로 조회한다.

```text
리포트 기준일과 집계 범위 입력
    -> Asia/Seoul 기준 시작·종료 시각 계산
    -> UTC로 변환
    -> 해당 범위의 시니어 답변 메시지 조회
```

### 답변 시각 저장 검토 필요

현재 DB에는 `CONVERSATION_MESSAGE.CREATED_AT`만 있고 별도의 `ANSWERED_AT`은 없다.
MVP 제안은 음성 수신 직후 시니어 답변 메시지 행을 만들고 그 행의 `CREATED_AT`을 답변 발생 시각으로 사용하는 것이다.

하지만 현재 DB Check 조건은 일반 메시지의 `CONTENT`가 반드시 존재하도록 제한한다. STT 전에는 `CONTENT`가 없으므로 아래 두 방안 중 하나를 결정해야 한다.

1. `STT_STATUS`가 `WAITING`, `PROCESSING`, `FAILED`이면 `CONTENT = NULL`을 허용한다.
2. STT 완료 후 메시지를 저장하고 별도의 `ANSWERED_AT` 또는 `CAPTURED_AT`을 저장한다.

이 항목은 기술 멘토에게 검토를 요청한다.

## 13. 오류 처리

### 프론트 로컬 오류

- `MIC_PERMISSION_DENIED`
- `NETWORK_FAILED`

### 백엔드 오류 이벤트

- `STT_FAILED`
- `AUTH_EXPIRED`
- `INTERNAL_ERROR`
- `CONNECTION_REPLACED`

오류 코드 목록은 구현 과정에서 실제 사례가 생길 때 갱신한다.

## 14. 현재 구현 상태

| 항목 | 상태 |
|---|---|
| `WsAdapter`와 `/ws/chats` 경로 | 구현 완료 |
| WebSocket 연결·종료 감지 | 구현 완료 |
| 첫 메시지 JWT 인증 및 SENIOR 역할 확인 | 구현 완료 |
| `AnalysisService -> AiClient` 호출 구조 | 구현 완료 |
| `event / payload / ts` 공통 형식 | 구현 완료 |
| `chat:start`와 최초 고정 질문 저장·전송 | 구현 완료 |
| 음성 metadata·바이너리 페어링 | 구현 전 |
| DB 메시지·관계 저장 | 구현 전 |
| FastAPI 실제 HTTP 요청 | DTO 합의 전 |
| 추가 발화·재연결·TTS 캐시 | 구현 전 |

현재 Gateway는 `event / payload / ts` 공통 형식을 사용한다.

## 15. 담당자별 결정 사항

### 프론트엔드와 결정

- [ ] `event / payload / ts` 공통 형식 최종 확정
- [ ] `aiQuestionMessageId`, `generationId`, `captureId` 이름과 의미 확인
- [ ] 전체 이벤트 이름과 payload 최종 확정
- [ ] `pendingCaptureIds`와 ACK 전 음성 Blob 보관 방식
- [ ] 미수신 음성 확인 응답 형식
- [ ] `tts:playback-ended` 전송 기준
- [ ] 마지막 AI 질문 TTS 처음부터 재생
- [ ] `CONNECTION_REPLACED` 안내 UI

### FastAPI 담당자와 결정

- [ ] 분석 요청 URL과 HTTP 메서드
- [ ] 음성 전달 형식과 MIME 타입
- [ ] STT·감정 분석·질문 생성 요청 DTO
- [ ] 정상 응답 및 오류 응답 DTO
- [ ] `generationId` 요청 전달 및 응답 반환 여부
- [ ] 진행 중 요청 취소 가능 여부
- [ ] 취소 불가 시 오래된 결과 폐기 방식
- [ ] 단계별 처리 상태 제공 가능 여부
- [ ] TTS 생성 주체와 바이너리 반환 방식
- [ ] 제한시간과 재시도 기준

### 기술 멘토에게 검토 요청

1. `messageId`와 `aiQuestionMessageId`를 구분한 방식이 적절한가?
2. `generationId`로 오래된 AI 결과를 무효화하는 방식이 적절한가?
3. 추가 발화 큐와 질문 재생성 기준이 적절한가?
4. 재연결용 음성과 TTS를 메모리에 최대 10분 보관하는 범위가 적절한가?
5. 시니어 답변 메시지 생성 시점과 `CONTENT NULL` 처리 방안 중 무엇이 적절한가?
6. 단일 NestJS 인스턴스 MVP에서 메모리 상태 관리가 적절한가?
7. 일간 리포트의 정확한 집계 시작·종료 시각을 어떻게 정할 것인가?

## 16. 구현 순서

```text
1. 프론트·FastAPI·멘토 검토 사항 확정
2. 공통 event/payload/ts 파싱·전송 구현
3. JWT 인증 이벤트 형식 변경
4. chat:start와 최초 AI 질문 구현
5. audio:metadata와 바이너리 페어링 구현
6. audio:ack와 captureId 중복 처리 구현
7. 메시지·관계 DB 저장 구현
8. FastAPI 실제 연동
9. 추가 발화 큐와 generationId 유효성 처리
10. 재연결과 TTS 캐시 구현
11. 오류 처리와 통합 테스트
```
