# 2주 스프린트 계획

- 인원: (프론트엔드·PM·UI/UX) 1명, (백엔드·DB) 1명, (모델링·AI서버) 1명
- 목표: 폰(PWA)으로 시연 가능한 상태로 완성 — **웹 푸시 알림 포함, 스트레치 아닌 필수 범위. 스코프 컷 없음.**
- 화면 범위: `docs/screens`의 12개 화면 전부 구현(관리자 화면은 애초에 미포함)
- 모바일 전략: PWA로 확정 — manifest+SW 등록+아이콘 완료, 폰 홈 화면 설치 가능
- 프로토콜 기준 문서: [ws-protocol.md](ws-protocol.md) — 세션/turn 컨테이너 개념 없음, `CONVERSATION_MESSAGE` 행 단위 저장 + `generationId` 기반 무효화

## 현재 상태: 프론트엔드·AI서버는 사실상 완료, 백엔드 통합 배선만 남음

12개 화면·음성 대화 파이프라인·척도 채점·TTS·일간 요약·웹 푸시 프론트까지 각 영역(프론트/AI서버)에서 코드는 다 나왔다. **남은 건 전부 백엔드가 이 셋을 실제로 이어붙이는 작업과, 이미 만들어진 기능들의 스위치를 켜는 것(.env 모드 플래그)이다.**

### 완료됨

- **프론트**: 로그인(localStorage 세션 유지)/회원가입, 시니어·보호자 연결 요청·수락·거절·해제, 시니어 대화 화면(WS 실연동, 다슬이 발화 중 끼어들기/barge-in 지원), STT 실시간 반영, TTS 재생 컴포넌트(마이크 오픈 순서·iOS 자동재생 보정 포함), 보호자 대시보드/알림함/일간·주간 리포트, 시니어 이전 대화 기록, 내 정보(기본정보/체크인 알림/알림 임계치), 출석 캘린더, 웹 푸시 구독 등록 플로우(`features/enable-push-notifications`) — 전부 실 API 연동됨
- **AI서버**: STT(OpenAI 우선+whisper 폴백), STT 교정(`corrected_transcript`), 척도 채점(SGDS-K/GAD-7/LSNS-6, 고정 문항 은행), 꼬리질문 생성, TTS(Typecast), UC-06-4 일간 요약·추천행동 생성(`POST /reports/daily-summary`), 문항 커버리지/이전 세션 요약을 받을 Form 필드(`pendingScaleItems`/`prevSessionSummary`, 백엔드가 안 보내도 안전하게 기본값 처리) — 전부 구현 완료
- **백엔드**: 로그인, WS 인증·대화·음성 수신, 정서지수 즉시 재계산 트리거, 웹 푸시 발송 인프라(VAPID·구독 저장·임계치 발송, REST 엔드포인트 전부 존재), WS 리스너 정리 버그 수정

### 남은 작업 (전부 백엔드 담당 시작 시 처리)

1. **`.env` 모드 플래그 설정 — 제일 먼저, 제일 저렴함.** `apps/ai-server/.env`에 `OPENAI_API_KEY`/`TYPECAST_API_KEY`/`TYPECAST_VOICE_ID`는 있지만 `SCALE_ANALYSIS_MODE`/`STT_CORRECTION_MODE`/`DAILY_SUMMARY_MODE`가 전부 없어서 코드 기본값(`test`)대로 아직도 고정 목업만 나온다. 셋 다 `.env`에 `=model`로 추가하면 그 즉시 실제로 동작한다. **이거 하나 안 하면 나머지 다 완성해도 데모에서 티 안 나는 스텁 값이 계속 나옴.**
2. **문항 커버리지/이전 세션 요약 연동** — `audio-analysis.contract.ts`(`QuestionAnswerBatch`)에 `pendingScaleItems`/`prevSessionSummary` 필드 추가, DB에서 오늘 채점된 문항·최근 요약 조회해서 AI서버 호출 시 실어 보내기. AI서버는 이미 받을 준비 끝남.
3. **TTS 배관** — `audio-analysis.contract.ts`/검증기에 `ttsAudioBase64`/`ttsMimeType` 반영, `tts:audio` WS 이벤트 실제 emit. 프론트는 이미 이 이벤트를 받아 재생하는 코드가 있음(목업으로만 테스트됨). `docs/ws-protocol.md` §6.2/§8도 이 방식(배치 base64)으로 갱신 — 지금 §8 "MVP 이후"에 TTS binary 전송이라고 잘못 남아있음.
4. **UC-06-4 연동** — AI서버 `POST /reports/daily-summary` 호출해서 받은 결과를 `ReportsService.generateDailyReport()`에서 저장하도록 연결. **필드명 불일치 주의**: AI서버 응답과 프론트 `entities/report/model`은 `conversationSummary`를 쓰는데, 백엔드 엔티티/DTO(`DailyEmotionReport`, `daily-report-response.dto.ts`)는 아직 `oneLineSummary`임 — 연동하면서 `conversationSummary`로 이름을 맞출지 결정 필요.
5. **감정분석 실모델(`EMOTION_MODE=model`)** — `models/text_emotion`, `models/voice_emotion` 폴더가 비어 있어 체크포인트 파일 자체가 없음. API 키 문제가 아니라 모델 파일 소싱이 필요(AI서버 담당 몫). `EMOTION_MODE=test`로 둬도 나머지 파이프라인은 정상 동작하니 데모를 막는 요인은 아님.
6. (낮은 우선순위) `SCALE_QUESTION_ANALYSIS` 테이블에 스펙 문서(`테이블명세서_마음잇다.pdf`)엔 있는 `IS_MATCHED` 컬럼이 실제 엔티티/스키마엔 없음 — TextScore 계산엔 영향 없어서 보류 중.

### 최종 확인할 것 (위 1~4 끝난 뒤)

로그인→WS인증→마이크 답변→STT반영→척도채점→질문생성→TTS재생→리포트갱신(일간요약 포함)→위험 알림 발생 시 푸시 수신까지 전체 흐름을, **노트북 브라우저와 모바일(PWA 설치) 둘 다**로 완주 확인. 모바일에서는 특히 묵음 감지(`AudioContext` suspended 이슈)와 TTS 자동재생이 실제로 되는지 확인 — 코드상 보정은 들어가 있지만 실기기 확인은 아직.

## 화면 우선순위 (docs/screens 기준, 12개 전부 구현)

| 티어                   | 화면                                                                                                                  | 비고                                                                                                                                          |
| ---------------------- | --------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| 1 (골든패스, 최우선)   | 로그인, 시니어 홈, **시니어 대화 화면**, 보호자 대시보드, 보호자 일간 리포트 조회                                     | 전부 실연동 완료                              |
| 2 (데모에 있으면 좋음) | 회원가입, 시니어-보호자 연결 화면(2개), 보호자 알림함, 보호자 주간 리포트 조회                                        | 전부 실연동 완료                                                                                                                   |
| 3 (여유 있으면)        | 시니어 내 정보, 보호자 내 정보, 시니어 이전 대화 기록 조회                                                            | 전부 실연동 완료                 |

Redis 기반 완전 재연결 복구, 위험 키워드 실시간 감지(자해/자살 신호 등 실시간 알림 트리거), 관리자 화면은 이번 스프린트 범위에서 완전히 제외.

## 작업 방식

- 매일 스탠드업(비동기 가능)에서 "남은 작업" 목록 기준으로 진행 상황 공유
- **BE↔AI 프로토콜은 합의하는 즉시 `docs/ws-protocol.md`(또는 별도 REST 계약 문서)에 문서화** — 말로만 합의하고 각자 다르게 구현하는 상황 재발 방지(과거 한 번 이런 드리프트가 실제로 있었음)
- 특정 항목이 늦어질 조짐이 보이면 조용히 빼지 말고 스탠드업에서 바로 공유해서 인력 재배치

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
