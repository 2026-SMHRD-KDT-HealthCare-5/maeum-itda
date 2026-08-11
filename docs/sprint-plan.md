# 2주 스프린트 계획

- 인원: (프론트엔드·PM·UI/UX) 1명, (백엔드·DB) 1명, (모델링·AI서버) 1명
- 기간: 영업일 기준 10일
- 목표: 폰(PWA)으로 시연 가능한 상태로 마무리 — **실시간 웹 푸시 알림 포함, 스트레치 아닌 필수 범위**
- 화면 범위: `docs/screens`에 있는 12개 화면 전부 구현 (팀 확정 — 밀리면 티어 3부터 "조회만 되는" 축소 버전으로)
- 모바일 전략: PWA로 확정 (Flutter WebView+FCM 하이브리드는 졸업 이후 단계로 보류)
- 프로토콜 기준 문서: [ws-protocol.md](ws-protocol.md) — 세션/turn 컨테이너 개념 없음, `CONVERSATION_MESSAGE` 행 단위 저장 + `generationId` 기반 무효화가 현재 백엔드 설계

> **2026-08-10 업데이트**: `packages/shared-types`가 아직 옛 모델(`ConversationTurn`, `VoiceCapturedEvent` 등 `type` 판별 유니언 이벤트)이라 `ws-protocol.md`(event/payload/ts, 메시지 행 모델)와 불일치 상태였음을 확인. 프론트 3개 파일(`SeniorDailyRecordPage.tsx`, `entities/conversation/ui`, `entities/conversation/model`)이 옛 계약을 참조 중. **이 계약 재정비를 Day 0/Day 1 최우선 작업으로 승격**.

## Day 0 (킥오프, 반나절)

전원 함께 — 이 계약들이 없으면 3명이 각자 구현해도 Day 5에 연결 안 됨:

**FE ↔ NestJS**
- `event/payload/ts` 공통 형식 최종 확정 (`ws-protocol.md` 5장 기준)
- `audio:metadata` JSON 필드, 바이너리 전송 순서, `audio:ack` 시점
- 음성 MIME 타입, 오류 코드 목록, TTS 바이너리 전달 방식
- `aiQuestionMessageId`/`generationId`/`captureId` 이름과 의미 프론트와 합의

**NestJS ↔ FastAPI**
- REST URL, `multipart/form-data` 필드명, 요청·응답 DTO
- STT와 분석(감정분석+척도채점+꼬리질문)을 한 번에 처리할지 여부
- TTS를 같은 요청에서 받을지, 타임아웃, `generationId` 처리 책임 소재

**공통**
- `packages/shared-types`를 `ws-protocol.md` 기준으로 재정비 (BE 주도, FE 리뷰) — `ConversationTurn`/`VoiceCapturedEvent` 등 옛 타입을 메시지 행 모델로 교체
- 골든 시나리오 확정: 시니어 음성 대화 1턴 이상 → STT → 척도 채점 → TextScore 산출 → 보호자가 리포트 확인
- 프론트 담당이 `docs/screens` 12개 화면 중 이미 반영된 것과 뼈대만 있는 것 실제 점검
- OpenAI/Typecast API 키, PWA 배포용 HTTPS 호스팅(Vercel 등) 확보

## 화면 우선순위 (docs/screens 기준, 12개 전부 구현)

| 티어 | 화면 | 비고 |
|---|---|---|
| 1 (골든패스, 최우선) | 로그인, 시니어 홈, **시니어 대화 화면**, 보호자 대시보드, 보호자 일간 리포트 조회 | 대화 화면이 가장 복잡(실시간 WS + 음성 + TTS UI) |
| 2 (데모에 있으면 좋음) | 회원가입, 시니어-보호자 연결 화면(2개: senior-connection/guardian-connection), 보호자 알림함, 보호자 주간 리포트 조회 | 상대적으로 단순한 폼/리스트 |
| 3 (여유 있으면) | 시니어 내 정보, 보호자 내 정보, 시니어 이전 대화 기록 조회 | 내 정보 2개는 폼 구조 유사 → 공통 컴포넌트로 시간 절약. 이전 대화 기록은 `widgets/conversation-timeline` 재사용. **가장 먼저 스코프 컷 대상** |

## Week 1 (Day 1-5)

### FE/PM/UX — 화면 단위로 "디자인 적용 → 데이터 연동"까지 끝내고 다음 화면으로 이동

| Day | 작업 |
|---|---|
| 1 | PWA 셸(manifest+SW) + 로그인 화면 디자인 적용·연동. **+ shared-types 재정비에 맞춰 `entities/conversation`(ui/model) 및 `SeniorDailyRecordPage.tsx`의 옛 계약(`ConversationTurn`/`VoiceCapturedEvent`) 참조 부분 마이그레이션** |
| 2 | 시니어 홈 화면 디자인 적용·연동 |
| 3-4 | 시니어 대화 화면 디자인 적용 (mic UI, 말풍선, TTS 재생 컨트롤) — 우선 mock WS로, **새 계약(`chat:start`/`audio:metadata`/`ai:question` 등) 기준** |
| 5 | **팀 통합 체크포인트**: 시니어 대화 화면 실제 WS로 교체, 끝까지 연결 확인 |

### BE/DB — 이미 완료된 부분(WsAdapter, JWT 인증, `chat:start`+최초 질문 저장, `audio:metadata` 검증) 제외하고 남은 작업 위주

| Day | 작업 |
|---|---|
| 1 | shared-types 재정비 주도 + 음성 바이너리 Handler 구현, metadata와 바이너리 매칭, `audio:ack` 구현. **+ VAPID 키 생성, 웹 푸시 구독(PushSubscription) 저장 API 스켈레톤** |
| 2 | 시니어 답변 메시지 저장 상태 처리(`CONVERSATION_MESSAGE`), `AnalysisService`→`AiClient` 연결, FastAPI mock 응답으로 전체 흐름 선테스트 |
| 3 | 실제 음성 REST 전송, STT 결과 수신, 오류·타임아웃 처리 (AI서버와 함께) |
| 4 | 다음 AI 질문 생성 연결, `ai:question` 전송, TTS 결과 전달 — 최소 1턴 전체 흐름 완성 |
| 5 | **통합 체크포인트**: 마이크→`audio:metadata`→음성 바이너리→STT→다음 질문→TTS→DB 저장까지. 리포트는 여기 강제로 안 넣음 — 1턴 완주가 우선 |

### AI서버 — 우선순위: STT → 다음 질문 생성 → TTS → 감정분석 → 척도채점 → 최적화

| Day | 작업 |
|---|---|
| 1 | Day 0 계약 확정 참여 + faster-whisper STT 엔드포인트 구현 시작 (GPU 없으면 CPU 폴백) |
| 2 | STT 엔드포인트 완성, 고정된 분석 응답 DTO 제공(척도 결과는 임시값), Typecast TTS 프로토타입 |
| 3 | 실제 음성 수신→STT 결과 반환 BE와 REST 연동 테스트, 오류/타임아웃 처리 |
| 4 | 다음 질문 생성 실제 연결, TTS 실제 연결 — 최소 1턴 흐름 완성에 기여 |
| 5 | **통합 체크포인트** 대응 |

**Day 5의 목표는 "리포트까지 완성"이 아니라 "실제 음성 대화 1턴 완주"입니다.** 여기서 마이크→STT→질문생성→TTS→DB 저장이 안 되면 Week 2 계획을 재조정해야 합니다.

## Week 2 (Day 6-10)

### FE/PM/UX

| Day | 작업 |
|---|---|
| 6 | 보호자 대시보드 디자인 적용·연동. **+ 알림 권한 요청 UI + service worker 푸시 구독 등록 플로우** |
| 7 | 보호자 일간 리포트 조회 디자인 적용·연동 |
| 8 | 회원가입 + 연결 화면(시니어/보호자 2개) — 단순 폼이라 하루에 묶음 |
| 9 | 보호자 알림함 + 보호자 주간 리포트 조회 |
| 10 | 시니어 내 정보 + 보호자 내 정보(공통 컴포넌트) + 이전 대화 기록 조회 + 전체 리허설 |

### BE/DB

| Day | 작업 |
|---|---|
| 6-7 | 분석 결과 DB 저장, 일간 리포트 집계, 보호자 리포트 REST API, 보호자 화면 연동 지원, Swagger 문서화. **+ 위험 감지→알림 생성 로직(위험응답비율 기준) 구현하고, 알림함 DB 기록과 동시에 `web-push` 라이브러리로 저장된 구독에 실제 웹 푸시 발송까지 연결 — DB 기록만으로 끝내지 않음** |
| 8 | `chat:end`, 침묵 종료, 오류 처리, JWT 만료 처리 |
| 9 | 전체 통합 테스트(여러 차례 질문-답변 왕복), 외부 API 실패 대응, 최소한의 재연결 처리, 보안 점검 |
| 10 | 버그 수정, 데모용 시드 데이터, 코드 프리즈 |

### AI서버

| Day | 작업 |
|---|---|
| 6-7 | 감정분석 실제 반영, 척도 1개(GAD-7 등 우선순위 1순위) 실제 채점 반영 — 나머지 척도는 동일 응답 구조에 임시값 |
| 8 | 나머지 2개 척도(SGDS-K/LSNS-6) 실제 채점 반영, 무응답/침묵 처리 |
| 9 | 통합 테스트 대응, 지연시간 재측정·최적화 |
| 10 | 코드 프리즈 |

## 스코프 컷 우선순위 (밀리면 이 순서로 버리기)

**실시간 웹 푸시 알림은 필수 범위로 확정 — 컷 대상 아님.** 밀리면 아래 순서로 버리기:

1. 티어 3 화면(내 정보 2개, 이전 대화 기록 조회) → 완전 누락보다 "조회만 되고 수정 불가" 상태로 남기기
2. 3개 척도 전부 → Day 8까지도 안 되면 GAD-7/SGDS-K 2개만이라도 완결, LSNS-6는 임시값 유지
3. 회원가입/온보딩 플로우 → 시드 계정으로 데모 우회

## 작업 방식

- 매일 15분 스탠드업 (비동기도 가능)
- Day 5가 사실상의 스프린트 리뷰 — 여기서 스코프 재협상
- AI서버 담당이 가장 리스크 큰 자리(3개 벤더 통합 + 프롬프트 엔지니어링 동시) — 막히면 BE 담당이 페어링
- **Day 0 계약(FE↔BE, BE↔AI) 확정 전에는 각자 화면/기능 구현에 깊이 들어가지 않기** — 계약 없이 병렬로 짜면 Day 5에 연결이 안 될 위험이 큼

## Claude → Codex 작업 인수인계 규칙

프론트 화면은 Claude가 1차 구현 후 Codex로 디자인을 보완하는 흐름을 씁니다.

- **스타일 위치**: 시각적 값(색상/spacing/폰트 크기)은 tsx에 인라인으로 넣지 않고 해당 컴포넌트의 `.module.css`에 둔다 (기존 코드베이스 컨벤션 유지)
- **마크업**: Figma 스펙 반영에 필요한 만큼만 — 새 wrapper 컴포넌트를 미리 만들지 않는다
- **클래스명**: 의미 기반 네이밍(`.scoreBadge`, `.avatarWrapper` 등)으로, Codex가 요소를 정확히 찾아 수정할 수 있게 한다
- **인수인계 노트** (PR 설명에 포함, 별도 문서 만들지 않음):
  - 이번에 건드린 파일 목록 (tsx + module.css)
  - 참고한 Figma 레퍼런스 경로(`docs/screens/.../screen-*.png`)와 반영 못 한 `states/` 케이스
  - **스코프 가드**: "이 파일들의 로직(WS 핸들러, API 호출, 상태관리)은 건드리지 말고 className/마크업/CSS 값만 수정" 명시
- Codex 작업 완료 후 `git diff`로 `.module.css`/마크업 외 로직 파일이 바뀌었는지 확인
- BE/AI서버의 핵심 로직(채점 알고리즘, 인증, WS 이벤트 처리)은 Claude 구현 후 Codex에게 검증(버그/보안) 요청하는 용도로 사용 — 디자인 보완과는 별개 트랙

## 날짜별 실행 프롬프트

팀원 각자 자기 Claude Code 세션에 그대로 입력하면 되는 프롬프트입니다. 이 저장소를 열어둔 상태에서 입력하면 `docs/sprint-plan.md`, `docs/ws-protocol.md`, `docs/screens`, `packages/shared-types`를 참고해서 작업합니다.

### Day 0

- **전원**: "오늘은 Day 0 킥오프야. `docs/ws-protocol.md`를 기준으로 FE↔NestJS, NestJS↔FastAPI 계약(이벤트 필드, DTO, 타임아웃 등)을 확정하고, `packages/shared-types`를 이 문서 기준으로 재정비해줘. 옛 타입(`ConversationTurn`, `VoiceCapturedEvent` 등)을 참조하는 프론트 파일도 찾아서 마이그레이션 대상으로 목록화해줘."

### Day 1

- **FE/PM/UX**: "오늘은 PWA 셸(manifest+SW) + 로그인 화면 디자인 적용 및 연동을 할 거야. `docs/screens/로그인 화면/screen-login.png` 참고해서 구현해줘. 그리고 `entities/conversation`(ui/model)과 `SeniorDailyRecordPage.tsx`가 옛 shared-types 계약을 쓰고 있으면 새 계약으로 마이그레이션해줘. 완료 후 Codex 인수인계 노트도 정리해줘."
- **BE/DB**: "오늘은 shared-types 재정비를 마무리하고, 음성 바이너리 Handler를 구현할 거야. `audio:metadata`와 바이너리 프레임을 `captureId`로 매칭하고 `audio:ack`를 전송하게 구현해줘. `chat-start.handler.ts`/`audio-metadata.handler.ts`는 이미 있으니 그 위에 이어서 작업해줘. 시간 남으면 VAPID 키 생성이랑 웹 푸시 구독(PushSubscription) 저장 API 스켈레톤도 만들어줘 — 이건 스트레치가 아니라 이번 스프린트 필수 범위야."
- **AI서버**: "오늘은 Day 0 계약 확정에 참여하고, faster-whisper STT 엔드포인트를 구현할 거야. GPU 없으면 CPU로 폴백되게 구현해줘."

### Day 2

- **FE/PM/UX**: "오늘은 시니어 홈 화면 디자인 적용 및 연동을 할 거야. `docs/screens/시니어 홈 화면/screen-senior-home.png` 참고해서 구현해줘."
- **BE/DB**: "오늘은 시니어 답변 메시지를 `CONVERSATION_MESSAGE`에 저장하는 로직과, `AnalysisService`→`AiClient` 연결을 구현할 거야. FastAPI가 아직 준비 안 됐으면 mock 응답으로 전체 흐름을 먼저 테스트해줘."
- **AI서버**: "오늘은 STT 엔드포인트를 완성하고, 감정분석·척도채점 응답 DTO를 고정해서 우선 임시값으로 반환하게 만들 거야. Typecast TTS 스트리밍 프로토타입도 붙여줘."

### Day 3

- **FE/PM/UX**: "오늘은 시니어 대화 화면 디자인 적용을 시작할 거야. `docs/screens/시니어 대화 화면/screen-senior-conversation.png` 참고해서 mic UI, 말풍선, TTS 재생 컨트롤 구현해줘. WS는 새로 정리된 계약 기준으로 mock 붙여줘."
- **BE/DB**: "오늘은 AI서버로 실제 음성을 REST로 전송하고 STT 결과를 받는 걸 구현할 거야. 오류·타임아웃 처리도 같이 해줘."
- **AI서버**: "오늘은 백엔드와 실제 REST 연동 테스트를 할 거야. 음성 수신→STT 결과 반환이 실제로 되는지 확인하고 오류 케이스 처리해줘."

### Day 4

- **FE/PM/UX**: "어제 이어서 시니어 대화 화면 디자인 적용 마무리할 거야. mock WS 기준으로 전체 흐름(질문 표시→답변 녹음→응답 재생)까지 완성해줘."
- **BE/DB**: "오늘은 다음 AI 질문 생성 결과를 받아 `ai:question`으로 전송하고, TTS 결과도 전달하는 걸 구현할 거야. 최소 1턴 전체 흐름이 끝까지 되게 해줘."
- **AI서버**: "오늘은 다음 질문 생성과 TTS를 백엔드에 실제로 연결할 거야. 최소 1턴 흐름이 끝까지 동작하는 데 집중해줘."

### Day 5 — 통합 체크포인트

- **FE/PM/UX**: "오늘은 시니어 대화 화면을 mock WS에서 실제 백엔드 WS로 교체할 거야. 팀 통합 테스트니까 연결 안 되는 부분 있으면 바로 알려줘."
- **BE/DB**: "오늘은 프론트-백엔드-AI서버 통합 체크포인트야. 마이크→audio:metadata→음성 바이너리→STT→다음 질문→TTS→DB 저장까지 확인해줘. 리포트는 오늘 목표에서 빼도 돼, 1턴 완주가 우선이야."
- **AI서버**: "오늘은 통합 체크포인트야. 실제 파이프라인으로 백엔드에서 호출됐을 때 에러 나는 지점 있으면 로그 확인해서 고쳐줘."

### Day 6

- **FE/PM/UX**: "오늘은 보호자 대시보드 디자인 적용 및 연동을 할 거야. `docs/screens/보호자 대시보드/screen-guardian-home.png` 참고해서 구현해줘. 그리고 알림 권한 요청 UI랑 service worker 푸시 구독 등록 플로우도 붙여줘 — 백엔드 구독 저장 API에 등록되게."
- **BE/DB**: "오늘은 분석 결과 DB 저장이랑 일간 리포트 집계 로직, 보호자 리포트 REST API를 구현할 거야. 그리고 위험 감지→알림 생성 로직(위험응답비율 기준)을 만들고, 알림함 DB 기록과 동시에 저장된 구독으로 실제 웹 푸시까지 발송되게 연결해줘."
- **AI서버**: "오늘은 감정분석을 실제로 반영하고, 척도 하나(GAD-7 우선)를 실제 채점 로직으로 구현할 거야. 나머지 척도는 응답 구조는 그대로 두고 임시값 반환해줘."

### Day 7

- **FE/PM/UX**: "오늘은 보호자 일간 리포트 조회 화면 디자인 적용 및 연동을 할 거야. `docs/screens/보호자 일간 리포트 조회/screen-guardian-report.png` 참고해서 구현해줘."
- **BE/DB**: "오늘은 보호자 리포트 REST API를 마무리하고 Swagger 문서화할 거야."
- **AI서버**: "오늘은 어제 이어서 감정분석/척도 채점 정확도를 다듬을 거야."

### Day 8

- **FE/PM/UX**: "오늘은 회원가입 화면 + 시니어/보호자 연결 화면(2개) 디자인 적용 및 연동을 할 거야. `docs/screens/회원가입 화면`, `docs/screens/시니어 및 보호자 연결 화면` 참고해서 구현해줘."
- **BE/DB**: "오늘은 `chat:end`, 침묵 종료, 오류 처리, JWT 만료 처리를 구현할 거야."
- **AI서버**: "오늘은 나머지 2개 척도(SGDS-K, LSNS-6)를 실제 채점 로직으로 구현하고, 무응답/침묵 답변 처리를 할 거야."

### Day 9

- **FE/PM/UX**: "오늘은 보호자 알림함 + 보호자 주간 리포트 조회 화면 디자인 적용 및 연동을 할 거야. `docs/screens/보호자 알림함`, `docs/screens/보호자 주간 리포트 조회` 참고해서 구현해줘."
- **BE/DB**: "오늘은 전체 통합 테스트(여러 차례 질문-답변 왕복)와 외부 API 실패 대응, 최소한의 재연결 처리, 보안 점검(JWT 만료, 비밀값 노출 여부)을 할 거야. 완료 후 Codex로 보안 검증 요청할 수 있게 핵심 변경 파일과 확인 포인트 정리해줘."
- **AI서버**: "오늘은 지연시간 재측정하고 최적화할 거야. 병목 지점 찾아서 개선해줘."

### Day 10

- **FE/PM/UX**: "오늘은 시니어 내 정보 + 보호자 내 정보(공통 컴포넌트로) + 시니어 이전 대화 기록 조회 화면(widgets/conversation-timeline 재사용) 디자인 적용 및 연동을 할 거야. 끝나면 전체 화면 리허설도 같이 체크해줘."
- **BE/DB**: "오늘은 버그 수정하고 데모용 시드 데이터를 준비한 뒤 코드 프리즈할 거야."
- **AI서버**: "오늘은 코드 프리즈할 거야. 마지막으로 전체 파이프라인 한 번 더 돌려서 이상 없는지 확인해줘."
