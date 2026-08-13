import type { Notification } from '../../../entities/notification'

// TEMP mock (UC-10/UC-11 실제 알림 API 연동 전) — 오늘/이전 그룹핑을 화면에서
// 확인할 수 있도록 오늘 기준 상대 날짜로 createdAt을 만든다.
function daysAgoIso(days: number): string {
  const date = new Date()
  date.setDate(date.getDate() - days)
  return date.toISOString()
}

export const mockNotifications: Notification[] = [
  {
    id: 'noti-1',
    title: '정서지수 하락 감지',
    content: '어르신의 오늘 정서지수가 38점으로 임계치(50)보다 낮아요.',
    isRead: false,
    createdAt: daysAgoIso(0),
    target: { type: 'dailyReport', reportId: 'report-today' },
  },
  {
    id: 'noti-2',
    title: '주간 리포트가 도착했어요',
    content: '지난 주 대화 6건이 분석되었어요.',
    isRead: false,
    createdAt: daysAgoIso(4),
    target: { type: 'weeklyReport', weekStart: '2026-08-03' },
  },
  {
    id: 'noti-3',
    title: '정서지수 하락 감지',
    content: '어르신의 어제 정서지수가 42점으로 임계치(50)보다 낮았어요.',
    isRead: true,
    createdAt: daysAgoIso(1),
    target: { type: 'dailyReport', reportId: 'report-yesterday' },
  },
]

export function groupByDay(notifications: Notification[]): {
  today: Notification[]
  earlier: Notification[]
} {
  const today = new Date()
  const isToday = (iso: string) => {
    const date = new Date(iso)
    return (
      date.getFullYear() === today.getFullYear() &&
      date.getMonth() === today.getMonth() &&
      date.getDate() === today.getDate()
    )
  }

  return {
    today: notifications.filter((notification) => isToday(notification.createdAt)),
    earlier: notifications.filter((notification) => !isToday(notification.createdAt)),
  }
}

export function reportLinkPath(target: Notification['target']): { label: string; to: string } {
  if (target.type === 'weeklyReport') {
    return { label: '주간 리포트 보기', to: `/guardian/report/weekly/${target.weekStart}` }
  }
  return { label: '일간 리포트 보기', to: '/guardian/report' }
}
