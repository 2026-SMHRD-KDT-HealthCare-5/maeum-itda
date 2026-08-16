import type { Notification } from '../../../entities/notification'

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
  if (target.type === 'WEEKLY_REPORT') {
    return {
      label: '주간 리포트 보기',
      to: target.weekStart ? `/guardian/report/weekly/${target.weekStart}` : '/guardian/report',
    }
  }
  return {
    label: '일간 리포트 보기',
    to: target.reportDate ? `/guardian/report?date=${target.reportDate}` : '/guardian/report',
  }
}

export function formatNotificationDate(iso: string): string {
  const parts = new Intl.DateTimeFormat('ko-KR', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(new Date(iso))
  const value = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? ''

  return `${value('year')}.${value('month')}.${value('day')} ${value('hour')}:${value('minute')}`
}
