// GUARDIAN_NOTIFICATION_01 (UC-10, UC-11) — GET /notifications 실계약 기준.
// 정서지수 하락/안부 대화 미완료 등 알림 유형과 무관하게 target은 이동할 리포트
// 종류(일간/주간)만 구분한다 — 백엔드 NotificationTargetDto와 동일한 모양.
export interface Notification {
  id: number
  title: string
  content: string
  isRead: boolean
  createdAt: string
  target:
    | { type: 'DAILY_REPORT'; reportId: number | null; reportDate: string | null }
    | { type: 'WEEKLY_REPORT'; weeklyReportId: number | null; weekStart: string | null }
}
