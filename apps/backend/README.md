# 마음잇다 Backend

## 문서 목적

이 문서는 백엔드의 NestJS 구조와 현재 구현 흐름을 빠르게 확인하기 위한 문서입니다.

나중에 루트 `README.md`로 옮기기 쉽도록 백엔드 내용만 정리합니다. 날짜별 작업 과정은 Notion에서 관리하고, 이 문서에는 현재 기준의 구조와 사용 방법만 기록합니다.

## README 작성 기준

백엔드 README는 다음 순서로 관리합니다.

1. 문서 목적
2. 통신 및 호출 구조
3. TypeScript와 NestJS 개념 구분
4. 핵심 파일 역할
5. 현재 구현 상태
6. 실행 및 검증 방법

## 통신 구조

```text
시니어 브라우저
    ↕ WebSocket
NestJS 백엔드
    ↕ REST API
FastAPI AI 서버

NestJS Service
    ↕ Repository
MySQL
```

- 브라우저와 NestJS의 실시간 대화는 WebSocket을 사용합니다.
- 음성 데이터와 텍스트 이벤트는 하나의 WebSocket 연결에서 멀티플렉싱합니다.
- 운영 환경에서는 암호화된 `wss` 연결을 사용합니다.
- 과거 대화·리포트 조회는 REST API를 사용합니다.
- NestJS와 FastAPI 사이는 REST API를 사용합니다.
- DB 조회·저장은 Service에서 Repository를 거쳐 처리합니다.
- 대화 세션 ID는 사용하지 않으며 메시지는 `SENIOR_ID`를 기준으로 관리합니다.
- 연결 중 문맥은 MVP 단일 서버 인스턴스의 메모리에서 관리합니다.
- 원본 음성은 STT와 acoustic 특징 추출 후 즉시 폐기하며 DB에 저장하지 않습니다.

## 최신 기능 방향

### 실시간 대화

```text
대화 시작 버튼
→ WSS 연결 및 JWT 인증
→ AI 첫 질문·TTS 청크 전송
→ 시니어 발화 캡처
→ 자동 무음 감지 또는 수동 종료
→ 완성된 음성을 동일 WebSocket으로 전송
→ NestJS ACK
→ FastAPI STT·척도 채점·감성분석·다음 질문 생성
→ 직전 STT 결과와 다음 질문을 함께 전송
→ 반복
```

- AI 재생 중에도 시니어 음성을 계속 캡처하며 브라우저 AEC를 적용합니다.
- 실시간 끼어들기로 AI 음성을 중단하는 기능은 MVP에서 제외합니다(버튼 클릭 기반 "질문 건너뛰기"는 있음, 음성감지 기반 끼어들기는 에코 오탐 문제로 제거함).
- **[2026-08-21 변경] TTS 오디오 자체는 더 이상 WebSocket으로 전송하지 않습니다.** `tts:audio` WS 이벤트는 짧은 인증 토큰이 붙은 스트리밍 URL(`streamPath`)만 담아 보내고, 프론트가 그 URL로 별도 인증 HTTP GET(`/chats/tts-stream`)을 열어 FastAPI의 실시간 스트림(mp3 청크)을 그대로 재생합니다 — base64 일괄 전달 방식은 폐기했습니다. 상세 계약은 `docs/ws-protocol.md` §4.2/§6.4 참고.
- **[2026-08-24 변경] 발화 중에는 PCM 오디오를 실시간으로 중계해 부분 전사(자막)를 제공합니다.** 프론트가 녹음 중 `audio:pcm`(PCM16 mono 24kHz 청크)을 보내면 `AudioLiveHandler`가 이를 FastAPI `/analysis/stt/live`(OpenAI Realtime transcription 세션 프록시)로 그대로 중계하고, 돌아온 부분/완료 전사를 `audio:partial`로 클라이언트에 전달합니다. 이 부분 전사는 화면 자막용일 뿐 DB에 저장되지 않으며, 확정 답변 말풍선·저장은 여전히 배치 분석 성공 후의 `audio:transcript`(§6.3) 기준입니다. 상세 계약은 `docs/ws-protocol.md` §4.3.1 참고.

### 정서 분석과 리포트

- 응답마다 SGDS-K·GAD-7·LSNS-6 해당 문항을 즉시 채점합니다.
- 정서지수는 날짜별 3개 척도의 위험 응답 비율만으로 계산합니다.
- 음성 톤·피치·발화 속도와 실시간 감성 라벨은 정서지수 계산에 포함하지 않습니다.
- 척도 합산 응답이 5문항 미만이면 `데이터 부족`으로 처리합니다.
- 같은 날 다시 대화하면 해당 날짜 전체 응답으로 정서지수를 재계산해 일간 리포트를 갱신합니다.
- 일간 기준은 응답 발생 시각의 00:00~24:00입니다.

### 종료와 재연결

- 종료 버튼 또는 AI의 목표 대화 완료 시 정상 종료합니다.
- 마지막 발화 이후 10분 동안 재연결되지 않으면 메모리의 대화 상태를 종료하고 일간 정서지수 재계산을 실행합니다.
- ACK 이전에 연결이 끊기면 클라이언트가 보관한 음성 버퍼를 재연결 후 다시 전송합니다.
- MVP는 동일한 백엔드 인스턴스로 재연결되는 단일 서버 구성을 전제로 합니다.

## TypeScript와 NestJS 구분

### TypeScript `import`와 `export`

```typescript
import { ChatsService } from './chats.service';

export class ChatsModule {}
```

- `import`: 다른 파일이 공개한 클래스·함수·변수를 현재 파일로 가져옵니다.
- `export`: 현재 파일의 클래스·함수·변수를 다른 파일에서 가져갈 수 있게 공개합니다.
- 파일과 파일 사이에서 코드를 사용하기 위한 TypeScript 문법입니다.

### NestJS `@Module()`

```typescript
@Module({
  imports: [AuthModule],
  controllers: [ChatsController],
  providers: [ChatsGateway, ChatsService],
  exports: [ChatsService],
})
export class ChatsModule {}
```

`@Module()`은 NestJS가 모듈의 구성과 객체 연결 관계를 확인하는 메타데이터입니다.

#### `imports`

다른 NestJS 모듈이 `exports`로 공개한 Provider를 현재 모듈에서 사용하도록 연결합니다.

```typescript
imports: [AuthModule];
```

TypeScript의 `import`와 역할이 다릅니다.

```typescript
import { AuthModule } from '../auth/auth.module';
```

- TypeScript `import`: 파일에서 `AuthModule` 클래스를 가져옵니다.
- NestJS `imports`: `AuthModule`이 공개한 기능을 현재 모듈에 연결합니다.

#### `controllers`

HTTP REST API 요청을 받을 Controller를 등록합니다.

```typescript
controllers: [ChatsController];
```

#### `providers`

NestJS DI 컨테이너가 객체를 생성·주입·관리할 클래스를 등록합니다.

```typescript
providers: [ChatsGateway, ChatsService];
```

개발자가 직접 `new ChatsService()`를 작성하지 않아도 DI 컨테이너가 생성자를 확인해 필요한 객체를 주입합니다.

#### `exports`

현재 모듈의 Provider를 다른 NestJS 모듈에서도 주입받을 수 있게 공개합니다.

```typescript
exports: [ChatsService];
```

TypeScript의 `export class ChatsModule {}`과 역할이 다릅니다.

- TypeScript `export`: 다른 파일에서 클래스를 가져갈 수 있게 공개합니다.
- NestJS `exports`: 다른 모듈에서 Provider 객체를 주입받을 수 있게 공개합니다.

## NestJS DI 흐름

```text
애플리케이션 시작
→ AppModule 확인
→ 하위 Module의 @Module() 메타데이터 확인
→ imports·controllers·providers·exports 등록
→ Provider 생성자와 의존 관계 확인
→ 필요한 Provider 객체 생성
→ 생성된 객체를 생성자에 주입
→ Controller·Gateway 객체 생성
→ REST 경로와 WebSocket 경로 등록
→ 요청 수신 준비 완료
```

예를 들어 `ChatsGateway`가 생성자에서 `AuthService`를 요구하면 NestJS DI 컨테이너가 `AuthService` 객체를 찾아 전달합니다.

## 모듈 구성

`app.module.ts`가 등록하는 기능 모듈은 아래 표와 같습니다. 이 문서의 "핵심 파일 흐름"은 실시간 대화 경로(`auth`/`chats`/`analysis`) 위주로 상세히 설명하고, 나머지 모듈은 REST 조회/조작 중심이라 여기서는 목록만 남깁니다 — 각 모듈 내부 구조는 소스를 직접 참고하세요.

| 모듈 | 역할 |
| --- | --- |
| `auth` | 로그인/회원가입, JWT 발급·검증, TTS 스트림 전용 단기 토큰 |
| `users` | 사용자 조회(`GET /users/me`) |
| `chats` | 실시간 대화 WS 게이트웨이, 실시간 부분 전사 중계, 과거 메시지 cursor 조회, TTS 스트림 중계 |
| `analysis` | FastAPI 분석 요청·응답 처리, 정서지수 재계산 트리거 |
| `connections` | 시니어-보호자 연결 요청·수락·거절·해제 |
| `reports` | 일간/주간 리포트 생성·조회, 일간 요약 API 호출 |
| `notifications` | 알림함, 웹 푸시(VAPID·`PushSubscription`·임계치 발송), 안부 알림 리마인더 |
| `guardian-dashboard` | 보호자 대시보드 집계 데이터 |
| `profile-settings` | 내 정보 조회/수정, 알림 임계치 설정 |

## 핵심 파일 흐름

### `main.ts`

- 역할: NestJS 서버 시작 및 WebSocket 어댑터 등록
- 연결: `AppModule`, `WsAdapter`
- 이후 흐름: 기능 모듈과 Gateway 초기화

### `app.module.ts`

- 역할: 환경설정·DB·기능 모듈 등록
- 연결: `ConfigModule`, `TypeOrmModule`, `AuthModule`, `ChatsModule`
- 이후 흐름: NestJS가 하위 모듈의 Provider 생성·주입

### `chats.module.ts`

- 역할: 채팅 기능의 Gateway·Handler·Service·Repository 등록
- 연결: `AuthModule`, `AnalysisModule`, `ChatsGateway`, `ChatAuthHandler`, `ChatStartHandler`, `ChatsService`
- 이후 흐름: Gateway에 Handler를 주입하고 Handler에 업무 Service 주입

### `chats.gateway.ts`

- 역할: `/ws/chats` 연결·종료 및 WebSocket 이벤트 수신
- 연결: `ChatAuthHandler`, `ChatStartHandler`
- 이후 흐름: 첫 메시지는 인증 Handler, 인증 이후 메시지는 대화 시작 Handler 호출

### `chat-auth.handler.ts`

- 역할: `auth` 이벤트 형식 확인과 JWT 인증
- 연결: `AuthService`, WebSocket 연결 객체
- 이후 흐름: `AuthService.verifyAccessToken()` 호출 후 `auth:success` 또는 `auth:error` 전송

### `chat-start.handler.ts`

- 역할: `chat:start` 검증과 최초 질문 응답
- 연결: `ChatsService`, 인증된 사용자 정보
- 이후 흐름: 고정 질문 저장 후 `chat:started`, `ai:question` 순서로 전송

### `audio-metadata.handler.ts`

- 역할: `audio:metadata` 필수값 검증과 연결별 임시 보관
- 연결: `ChatConnectionStateService`, 인증된 사용자 정보
- 이후 흐름: 현재 질문 식별정보 확인 후 다음 음성 바이너리 수신 대기

### `audio-live.handler.ts`

- 역할: `audio:pcm` 수신 후 FastAPI `/analysis/stt/live`로 중계, 부분/완료 전사를 `audio:partial`로 전달
- 연결: FastAPI Realtime transcription 세션(WebSocket 프록시)
- 이후 흐름: 확정 답변 저장과는 무관 — 화면 자막용 부분 전사만 왕복

### `chat-connection-state.service.ts`

- 역할: WebSocket 연결별 현재 `aiQuestionMessageId`, `generationId` 관리
- 연결: `ChatStartHandler`, `AudioMetadataHandler`, `ChatsGateway`
- 이후 흐름: 대화 시작 시 저장하고 metadata 수신 시 현재 질문과 비교

### `chats.service.ts`

- 역할: 대화 업무 처리 순서 관리
- 연결: `ConversationMessageRepository`, `AnalysisService`
- 이후 흐름: Repository에 DB 저장 또는 `AnalysisService`에 AI 분석 요청

### `conversation-message.repository.ts`

- 역할: 대화 메시지 Entity 생성과 `CONVERSATION_MESSAGE` 저장
- 연결: TypeORM `Repository<ConversationMessage>`
- 이후 흐름: TypeORM의 `create()`와 `save()`를 거쳐 MySQL 처리

### `auth.module.ts`

- 역할: JWT 기능과 인증 Provider 등록
- 연결: `ConfigService`, `JwtModule`, `UsersModule`, `AuthService`
- 이후 흐름: `AuthService`를 `ChatsModule`에 공개

### `auth.service.ts`

- 역할: Access Token 검증과 인증 업무 처리
- 연결: `JwtService`, `UsersService`
- 이후 흐름: JWT 검증은 `JwtService`, 사용자 조회는 `UsersService` 호출

### `analysis.service.ts`

- 역할: FastAPI 요청 데이터 가공 및 응답 처리
- 연결: `AiClient`
- 이후 흐름: `AiClient`에 AI 분석 요청

### `ai.client.ts`

- 역할: FastAPI REST API 통신
- 연결: FastAPI AI 서버
- 이후 흐름: STT·감정 분석 결과를 `AnalysisService`에 반환

## 전체 호출 흐름

### WebSocket과 AI 분석

```text
브라우저 ↔ ChatsGateway → ChatStartHandler → ChatsService
                                             ├→ ConversationMessageRepository → TypeORM → MySQL
                                             └→ AnalysisService → AiClient → FastAPI
```

### JWT 인증

```text
브라우저
→ ChatsGateway
→ ChatAuthHandler
→ AuthService.verifyAccessToken()
→ JwtService.verifyAsync()
→ 검증 결과 반환
```

### WebSocket 연결·종료

```text
연결: 브라우저 → WsAdapter → ChatsGateway.handleConnection()
종료: 브라우저 → WsAdapter → ChatsGateway.handleDisconnect()
```

## 현재 구현 상태

### 구현 완료

- `WsAdapter` 등록
- WebSocket 경로 `/ws/chats` 등록
- WebSocket 연결·종료 감지 메서드 작성
- `AuthModule` JWT 설정
- `AuthService.verifyAccessToken()` 작성
- `ChatsGateway`에 `ChatAuthHandler`, `ChatStartHandler` 의존성 주입
- `ChatAuthHandler → AuthService → JwtService` 인증 흐름 구현
- `ChatStartHandler → ChatsService → ConversationMessageRepository` 최초 질문 저장 흐름 구현
- `auth:success`, `auth:error`, `chat:started`, `ai:question` 전송
- `audio:metadata` 검증과 연결별 pending metadata 저장
- 현재 AI 질문과 metadata의 `aiQuestionMessageId`, `generationId` 일치 여부 확인
- `ChatsService → AnalysisService → AiClient` 의존성 주입
- 대화 메시지에서 대화 세션 ID 제거

위 목록은 초기 스캐폴딩 시점 스냅샷입니다. 이후 아래도 전부 구현·연동 완료됐습니다(자세한 계약은 `docs/ws-protocol.md` 참고):

- 음성 바이너리 수신과 metadata 페어링, `audio:ack` 전송과 중복 전송 재확인
- Repository를 통한 메시지 저장(분석 성공 시점에야 저장 — 실패 시 흔적을 남기지 않음)
- FastAPI STT·척도 채점·감성분석 REST API 호출(`/analysis/audio/batch`)
- 원본 음성 분석 완료 후 즉시 폐기
- 직전 STT 결과(`audio:transcript`)와 다음 AI 질문(`ai:question`) 전송, TTS는 스트리밍 URL(`tts:audio`)로 비동기 전달
- 발화 중 실시간 부분 전사 중계(`audio:pcm` → FastAPI `/analysis/stt/live` → `audio:partial`)
- 무응답 안내(30초)·자동 종료(10분), 같은 서버 프로세스 내 단기 재접속 복원
- 웹 푸시 발송 인프라(VAPID, `PushSubscription` 저장, 임계치 하락 알림 발송)
- 일간/주간 리포트 생성·조회, 일간 대화 요약(UC-06-4)
- 시니어-보호자 연결 요청·수락·거절·해제

### 아직 남은 것

- Redis 기반 서버 재시작·다중 인스턴스 상태 복원(MVP는 단일 인스턴스 메모리 전제)
- 다중 기기(탭) 동시 접속 시 시니어 ID 단위 잠금(현재는 WebSocket 연결 단위라 듀얼탭 동시 시작을 완전히 막지 못함)

## 문서 확인이 필요한 미결 사항

- 요구사항정의서는 수치형 음성 점수를 사용하지 않지만 기획서와 테이블명세서에는 `VOICE_EMOTION_SCORE`가 남아 있습니다.
- 요구사항정의서의 무한 스크롤은 “페이지네이션 없이”라고 표현되어 있으나 서버 구현은 cursor 기반 분할 조회가 필요합니다.
- 요구사항정의서에는 관리자 역할이 있지만 현재 DB와 MVP 역할은 시니어·보호자만 지원합니다.

## 코드 주석 기준

상세 개념은 이 README에 작성하고, 소스 코드에는 흐름이 실제로 바뀌는 위치만 짧게 설명합니다.

- `@Module()`의 모듈·Provider 등록
- 생성자의 DI 객체 주입
- `@WebSocketGateway()`의 연결 경로
- `handleConnection()`, `handleDisconnect()`의 자동 호출 시점
- Gateway에서 Service를 호출하는 위치
- Service에서 Repository·AnalysisService를 호출하는 위치
- `AuthService`에서 `JwtService`를 호출하는 위치
- `AiClient`에서 FastAPI를 호출하는 위치

## 환경변수

`.env`(gitignore 대상, `.env.example` 없음)에 설정합니다.

| 변수 | 용도 |
| --- | --- |
| `AI_BASE_URL` | FastAPI AI 서버 주소 |
| `DB_HOST`/`DB_PORT`/`DB_USERNAME`/`DB_PASSWORD`/`DB_DATABASE` | MySQL 연결 |
| `JWT_SECRET`/`JWT_EXPIRES_IN` | 로그인 access token 서명·만료 |
| `VAPID_PUBLIC_KEY`/`VAPID_PRIVATE_KEY`/`VAPID_SUBJECT` | 웹 푸시(Push API) 발송 |

## 실행 및 검증

저장소 루트에서 실행합니다.

```bash
# 개발 서버
pnpm --filter backend dev

# 빌드
pnpm --filter backend build

# 단위 테스트
pnpm --filter backend test

# E2E 테스트
pnpm --filter backend test:e2e

# 린트
pnpm --filter backend lint
```

기본 서버 주소는 `http://localhost:3000`이고 Swagger 문서는 `http://localhost:3000/api-docs`에서 확인합니다.
