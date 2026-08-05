// 결정사항 로그(§5, 2026-08-05) — 일간 리포트 귀속은 대화(conversation) 단위가 아니라
// turn 단위다. "대화 세션" 컨테이너 개념(시작/종료 시각으로 여러 turn을 묶는 것)은
// 폐기됐으므로, turn 하나하나가 자신의 발생 시각(createdAt)을 직접 가지고
// 독립적인 이력 레코드로 취급된다. frontend/backend 양쪽이 이 필드 이름과
// 의미를 그대로 공유해야 하므로 여기(shared-types)에 고정한다.
export interface ConversationTurn {
  id: string
  seniorId: string
  // 이 turn이 발생한 시각(ISO 8601, UTC) — 정렬 기준이자 일간 리포트 귀속 기준.
  // 하루의 경계는 서비스 기준 시간대의 [00:00, 다음날 00:00) 반개구간이며,
  // 자정을 넘겨 진행된 통화라도 turn별로 각자의 createdAt이 속한 날짜에
  // 개별 귀속된다(예전처럼 통화 시작일에 전체가 묶이지 않음).
  createdAt: string
  question: string
  answer: string | null
  answeredAt: string | null
  // UC-04에서 같은 LLM 호출의 Structured Output으로 생성, UC-07에서 저장.
  sentimentLabel: string | null
  sentimentNote: string | null
}
