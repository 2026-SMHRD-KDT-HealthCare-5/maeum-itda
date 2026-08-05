// 결정사항 로그(§5, 2026-08-05) — 일간 리포트 귀속은 대화(conversation) 단위가 아니라
// turn 단위다. "대화 세션" 컨테이너 개념(시작/종료 시각으로 여러 turn을 묶는 것)은
// 폐기됐으므로, turn 하나하나가 자신의 발생 시각(createdAt)을 직접 가지고
// 독립적인 이력 레코드로 취급된다. frontend/backend 양쪽이 이 필드 이름과
// 의미를 그대로 공유해야 하므로 여기(shared-types)에 고정한다.
export interface ConversationTurn {
  id: string
  seniorId: string
  // 이 turn(질문)이 생성된 시각(ISO 8601, UTC) — 무한 스크롤 정렬/페이지네이션
  // 기준. 일간 리포트 귀속 기준이 아니다(아래 answeredAt 참고).
  createdAt: string
  question: string
  answer: string | null
  // 시니어가 실제로 답변한 시각(ISO 8601, UTC) — **일간 리포트 귀속은 이 값
  // 기준**이다(무응답 turn만 createdAt으로 대체 귀속). 하루의 경계는 서비스
  // 기준 시간대(Asia/Seoul)의 [00:00, 다음날 00:00) 반개구간이며, 자정을
  // 넘겨 진행된 통화라도 turn별로 각자의 귀속 시각이 속한 날짜에 개별
  // 귀속된다(예전처럼 통화 시작일에 전체가 묶이지 않음). 질문은 23:59에
  // 생성됐지만 답변이 00:01에 들어온 경우, createdAt이 아니라 answeredAt
  // 기준으로 "오늘" 리포트에 잡혀야 한다 — 이게 실제 시니어 감정 신호가
  // 발생한 시점이기 때문이다.
  answeredAt: string | null
  // UC-04에서 같은 LLM 호출의 Structured Output으로 생성, UC-07에서 저장.
  sentimentLabel: string | null
  sentimentNote: string | null
}

// 결정사항 로그(§5) — 시니어 안부 대화 화면(SENIOR_CONVERSATION_01)의
// 이전 대화 이력 무한 스크롤용 cursor pagination 계약. cursor는 (createdAt, id)
// 조합이어야 동일 시각 turn이 여러 개일 때도 순서가 어긋나지 않는다.
export interface ConversationHistoryCursor {
  createdAt: string
  id: string
}

export interface ConversationHistoryQuery {
  seniorId: string
  // null/undefined면 최신 turn부터 조회(최초 진입 시).
  cursor?: ConversationHistoryCursor | null
  limit: number
}

export interface ConversationHistoryPage {
  // 최신순(createdAt desc) 정렬.
  turns: ConversationTurn[]
  // 다음 페이지(더 과거) 요청 시 넘길 cursor. 더 이전 이력이 없으면 null.
  nextCursor: ConversationHistoryCursor | null
}

// 결정사항 로그(§5) — 질문 생성/출력 중 응답 유실 방지(barge-in) 처리(UC-02).
// generationId는 질문 생성 요청마다 새로 발급되는 식별자로, 취소된 이전 요청의
// 결과가 뒤늦게 도착해도 클라이언트/서버 양쪽이 무시할 수 있게 해준다.
export type QuestionTurnPhase = 'generatingQuestion' | 'playingQuestion' | 'awaitingAnswer'

export interface QuestionGenerationStartedEvent {
  type: 'questionGenerationStarted'
  generationId: string
}

export interface QuestionGenerationCancelledEvent {
  type: 'questionGenerationCancelled'
  generationId: string
}

export interface QuestionReadyEvent {
  type: 'questionReady'
  generationId: string
  question: string
}

export interface QuestionPlaybackEndedEvent {
  type: 'questionPlaybackEnded'
  generationId: string
}

// 시니어 음성 한 건이 STT를 거쳐 수집된 결과. 오디오 payload 자체의
// 인코딩/스트리밍 방식은 STT 파이프라인 확정 시 별도로 정의하고, 우선은
// 텍스트 결과(transcript)와 재전송 중복 방지용 captureId만 고정한다.
export interface CapturedAnswer {
  captureId: string
  capturedAt: string
  transcript?: string
  audioRef?: string
}

// 시니어 음성이 수집됐을 때 클라이언트 → 서버로 보내는 이벤트. phase/generationId는
// 클라이언트가 인지한 상태를 실어 보내는 힌트일 뿐이다 — **서버는 이 값을 그대로
// 신뢰하지 말고, 자신이 들고 있는 generationId 상태로 최종 판단해야 한다**(클라이언트
// 상태가 지연/유실됐을 수 있으므로). 서버가 판단한 결과에 따라 (1) 생성 중이었다면
// 해당 generationId 요청을 취소하고 이 답변을 포함해 재요청하고, (2) 출력 중이었다면
// 다음 질문 생성 요청에 포함하도록 구분해서 처리한다.
export interface VoiceCapturedEvent {
  type: 'voiceCaptured'
  answer: CapturedAnswer
  phase: QuestionTurnPhase
  generationId: string | null
}
