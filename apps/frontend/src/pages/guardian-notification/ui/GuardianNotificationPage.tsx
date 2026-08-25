import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { MarkNotificationReadAction } from '../../../features/mark-notification-read'
import {
  fetchNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  markNotificationUnread,
  NOTIFICATIONS_QUERY_KEY,
  type Notification,
} from '../../../entities/notification'
import { extractApiErrorMessage } from '../../../shared/api'
import { useDelayedPending } from '../../../shared/lib'
import { ErrorState, LoadingSpinner } from '../../../shared/ui'
import { BottomTabBar, GUARDIAN_TAB_ITEMS } from '../../../widgets/bottom-tab-bar'
import styles from './GuardianNotificationPage.module.css'

// GUARDIAN_NOTIFICATION_01 (UC-11) — GET /notifications, PATCH .../read 실연동.
export function GuardianNotificationPage() {
  const queryClient = useQueryClient()

  const notificationsQuery = useQuery({
    queryKey: NOTIFICATIONS_QUERY_KEY,
    queryFn: fetchNotifications,
  })

  const markReadMutation = useMutation({
    mutationFn: (notification: Notification) => markNotificationRead(notification.id),
    onSuccess: (_data, notification) => {
      queryClient.setQueryData<Awaited<ReturnType<typeof fetchNotifications>>>(
        NOTIFICATIONS_QUERY_KEY,
        (current) =>
          current && {
            unreadCount: notification.isRead
              ? current.unreadCount
              : Math.max(0, current.unreadCount - 1),
            notifications: current.notifications.map((item) =>
              item.id === notification.id ? { ...item, isRead: true } : item,
            ),
          },
      )
    },
  })

  const markUnreadMutation = useMutation({
    mutationFn: (notification: Notification) => markNotificationUnread(notification.id),
    onSuccess: (_data, notification) => {
      queryClient.setQueryData<Awaited<ReturnType<typeof fetchNotifications>>>(
        NOTIFICATIONS_QUERY_KEY,
        (current) =>
          current && {
            unreadCount: notification.isRead ? current.unreadCount + 1 : current.unreadCount,
            notifications: current.notifications.map((item) =>
              item.id === notification.id ? { ...item, isRead: false } : item,
            ),
          },
      )
    },
  })

  const markAllReadMutation = useMutation({
    mutationFn: markAllNotificationsRead,
    onSuccess: () => {
      queryClient.setQueryData<Awaited<ReturnType<typeof fetchNotifications>>>(
        NOTIFICATIONS_QUERY_KEY,
        (current) =>
          current && {
            unreadCount: 0,
            notifications: current.notifications.map((item) => ({ ...item, isRead: true })),
          },
      )
    },
  })

  const showSpinner = useDelayedPending(notificationsQuery.isPending)

  return (
    <>
      <main className={styles.page}>
        {showSpinner && <LoadingSpinner overlay label="알림을 불러오고 있어요" />}

        {!showSpinner && notificationsQuery.isError && (
          <ErrorState
            message={extractApiErrorMessage(notificationsQuery.error, '알림을 불러오지 못했어요.')}
            onRetry={() => void notificationsQuery.refetch()}
            isRetrying={notificationsQuery.isFetching}
          />
        )}

        {!showSpinner && notificationsQuery.data && (
          <MarkNotificationReadAction
            notifications={notificationsQuery.data.notifications}
            onMarkRead={(notification) => {
              if (!notification.isRead) markReadMutation.mutate(notification)
            }}
            onToggleRead={(notification) => {
              if (notification.isRead) markUnreadMutation.mutate(notification)
              else markReadMutation.mutate(notification)
            }}
            onMarkAllRead={() => markAllReadMutation.mutate()}
          />
        )}
      </main>
      <BottomTabBar items={GUARDIAN_TAB_ITEMS} />
    </>
  )
}
