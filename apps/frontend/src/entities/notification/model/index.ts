// GUARDIAN_NOTIFICATION_01 (UC-11) 기준.
// target 스키마는 결정사항 로그 §2에서 아직 미결 — 화면 목업엔 알림 유형이
// 3종 이상(정서지수 하락/안부 대화 미완료/일간 리포트 도착) 보이지만 API
// 명세는 dailyReport 하나만 정의되어 있음. 유형별 target 확장 시 이 타입도
// 갱신해야 함.
export interface Notification {
  id: string
  title: string
  content: string
  isRead: boolean
  createdAt: string
  target: { type: 'dailyReport'; reportId: string }
}
