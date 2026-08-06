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
- 실시간 끼어들기로 AI 음성을 중단하는 기능은 MVP에서 제외합니다.
- TTS 결과는 청크 단위로 WebSocket을 통해 스트리밍합니다.
- 발화 종료 후 첫 TTS 청크 재생까지 목표 지연 시간은 3.5초 이내입니다.

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
imports: [AuthModule]
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
controllers: [ChatsController]
```

#### `providers`

NestJS DI 컨테이너가 객체를 생성·주입·관리할 클래스를 등록합니다.

```typescript
providers: [ChatsGateway, ChatsService]
```

개발자가 직접 `new ChatsService()`를 작성하지 않아도 DI 컨테이너가 생성자를 확인해 필요한 객체를 주입합니다.

#### `exports`

현재 모듈의 Provider를 다른 NestJS 모듈에서도 주입받을 수 있게 공개합니다.

```typescript
exports: [ChatsService]
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

- 역할: 채팅 기능의 Gateway·Service·Repository 등록
- 연결: `AuthModule`, `AnalysisModule`, `ChatsGateway`, `ChatsService`
- 이후 흐름: Gateway 생성자에 인증·대화 객체 주입

### `chats.gateway.ts`

- 역할: `/ws/chats` 연결·종료 및 WebSocket 이벤트 수신
- 연결: `AuthService`, `ChatsService`
- 이후 흐름: 인증은 `AuthService`, 대화는 `ChatsService` 호출

### `chats.service.ts`

- 역할: 대화 업무 처리 순서 관리
- 연결: Repository, `AnalysisService`
- 이후 흐름: DB 저장 또는 AI 분석 요청

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
브라우저 ↔ ChatsGateway → ChatsService
                         ├→ Repository → MySQL
                         └→ AnalysisService → AiClient → FastAPI
```

### JWT 인증

```text
브라우저
→ ChatsGateway
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
- `ChatsGateway`에 `AuthService`, `ChatsService` 의존성 주입
- `ChatsService → AnalysisService → AiClient` 의존성 주입
- 대화 메시지에서 대화 세션 ID 제거

### 다음 구현

- `senior:authenticate` 이벤트 수신
- 연결별 인증 사용자 상태 관리
- 인증 성공 이벤트 전송
- 인증 성공 후 AI 최초 질문 요청
- WebSocket 단일 연결의 텍스트 이벤트·음성 바이너리 구분 규칙 정의
- 시니어 음성 답변 수신과 ACK 처리
- Repository를 통한 메시지 저장
- FastAPI STT·척도 채점·acoustic 특징·감성분석 REST API 호출
- 원본 음성 분석 완료 후 즉시 폐기
- 직전 STT 결과와 다음 AI 질문 동시 전송
- TTS 청크 WebSocket 스트리밍
- 연결 상태·재연결·중복 음성 재전송 처리

## 문서 확인이 필요한 미결 사항

- 요구사항정의서는 수치형 음성 점수를 사용하지 않지만 기획서와 테이블명세서에는 `VOICE_EMOTION_SCORE`가 남아 있습니다.
- 요구사항정의서의 무한 스크롤은 “페이지네이션 없이”라고 표현되어 있으나 서버 구현은 cursor 기반 분할 조회가 필요합니다.
- 요구사항정의서에는 관리자 역할이 있지만 현재 DB와 MVP 역할은 시니어·보호자만 지원합니다.
- 요구사항정의서는 실제 푸시 발송을 요구하지만 팀 MVP 결정은 알림함 REST 조회까지만 구현하는 것입니다.

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
