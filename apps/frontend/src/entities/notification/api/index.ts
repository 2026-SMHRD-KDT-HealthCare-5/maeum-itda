import type { NotificationItemDto } from '@maeum-itda/api-client'
import { apiClient } from '../../../shared/api'
import type { Notification } from '../model'

// reportId/reportDate/weeklyReportId/weekStart는 백엔드 DTO에 명시적 타입이 없어
// swagger-typescript-api가 object | null로 생성한다(entities/connection과 동일한
// 이슈) — 실제 런타임 값은 number/string이므로 여기서만 좁힌다.
function toNotification(dto: NotificationItemDto): Notification {
  const target =
    dto.target.type === 'WEEKLY_REPORT'
      ? {
          type: 'WEEKLY_REPORT' as const,
          weeklyReportId: dto.target.weeklyReportId as number | null,
          weekStart: dto.target.weekStart as string | null,
        }
      : {
          type: 'DAILY_REPORT' as const,
          reportId: dto.target.reportId as number | null,
          reportDate: dto.target.reportDate as string | null,
        }

  return {
    id: dto.alertId,
    title: dto.title,
    content: dto.content,
    isRead: dto.isRead,
    createdAt: dto.createdAt,
    target,
  }
}

// 커서 기반 페이지네이션은 백엔드 NotificationListQueryDto에 Swagger 타입 힌트가
// 없어 생성 클라이언트가 아직 query 파라미터를 못 받는다(백엔드 작업 필요) —
// 지금은 첫 페이지(기본 30건)만 가져온다.
export interface NotificationList {
  notifications: Notification[]
  unreadCount: number
}

export async function fetchNotifications(): Promise<NotificationList> {
  const { data } = await apiClient.notifications.notificationsControllerGetNotifications()
  return {
    notifications: data.notifications.map(toNotification),
    unreadCount: data.unreadCount,
  }
}

export async function markNotificationRead(alertId: number): Promise<void> {
  await apiClient.notifications.notificationsControllerMarkAsRead(alertId)
}

export async function markNotificationUnread(alertId: number): Promise<void> {
  await apiClient.notifications.notificationsControllerMarkAsUnread(alertId)
}

export async function markAllNotificationsRead(): Promise<void> {
  await apiClient.notifications.notificationsControllerMarkAllAsRead()
}
