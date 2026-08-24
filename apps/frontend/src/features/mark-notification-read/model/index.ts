import type { Notification } from '../../../entities/notification'

const dateKeyFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Seoul',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
})

const dateLabelFormatter = new Intl.DateTimeFormat('ko-KR', {
  timeZone: 'Asia/Seoul',
  year: 'numeric',
  month: 'long',
  day: 'numeric',
  weekday: 'short',
})

// 알림을 서비스 기준 시간대의 실제 날짜별로 묶어 긴 이력에서도 시점을 명확히 구분한다.
export function groupNotificationsByDate(notifications: Notification[]): Array<{
  dateKey: string
  label: string
  notifications: Notification[]
}> {
  const groups = new Map<string, { label: string; notifications: Notification[] }>()

  notifications.forEach((notification) => {
    const createdAt = new Date(notification.createdAt)
    const dateKey = dateKeyFormatter.format(createdAt)
    const current = groups.get(dateKey)

    if (current) {
      current.notifications.push(notification)
      return
    }

    groups.set(dateKey, {
      label: dateLabelFormatter.format(createdAt),
      notifications: [notification],
    })
  })

  return Array.from(groups, ([dateKey, group]) => ({ dateKey, ...group }))
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

export function formatNotificationTime(iso: string): string {
  return new Intl.DateTimeFormat('ko-KR', {
    timeZone: 'Asia/Seoul',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  }).format(new Date(iso))
}
