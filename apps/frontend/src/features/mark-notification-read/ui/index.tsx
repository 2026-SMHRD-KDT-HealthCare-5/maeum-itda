import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { Notification } from '../../../entities/notification'
import { groupByDay, mockNotifications, reportLinkPath } from '../model'
import styles from './MarkNotificationReadAction.module.css'

// GUARDIAN_NOTIFICATION_01 (UC-10, UC-11)
export function MarkNotificationReadAction() {
  const [notifications, setNotifications] = useState<Notification[]>(mockNotifications)
  const navigate = useNavigate()

  function markAllRead() {
    setNotifications((current) =>
      current.map((notification) => ({ ...notification, isRead: true })),
    )
  }

  function openNotification(notification: Notification) {
    setNotifications((current) =>
      current.map((item) => (item.id === notification.id ? { ...item, isRead: true } : item)),
    )
    navigate(reportLinkPath(notification.target).to)
  }

  if (notifications.length === 0) {
    return <p className={styles.empty}>아직 도착한 알림이 없어요.</p>
  }

  const { today, earlier } = groupByDay(notifications)

  return (
    <div>
      <div className={styles.header}>
        <button type="button" className={styles.markAllButton} onClick={markAllRead}>
          모두 읽음
        </button>
      </div>

      {today.length > 0 && (
        <section>
          <h2 className={styles.groupLabel}>오늘</h2>
          <ul className={styles.list}>
            {today.map((notification) => (
              <NotificationRow
                key={notification.id}
                notification={notification}
                onOpen={openNotification}
              />
            ))}
          </ul>
        </section>
      )}

      {earlier.length > 0 && (
        <section>
          <h2 className={styles.groupLabel}>이전</h2>
          <ul className={styles.list}>
            {earlier.map((notification) => (
              <NotificationRow
                key={notification.id}
                notification={notification}
                onOpen={openNotification}
              />
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}

function NotificationRow({
  notification,
  onOpen,
}: {
  notification: Notification
  onOpen: (notification: Notification) => void
}) {
  const isWarning = notification.title.includes('하락')
  const link = reportLinkPath(notification.target)

  return (
    <li>
      <button
        type="button"
        className={[
          styles.item,
          isWarning ? styles.itemWarning : '',
          !notification.isRead ? styles.itemUnread : '',
        ]
          .filter(Boolean)
          .join(' ')}
        onClick={() => onOpen(notification)}
      >
        <span
          className={[styles.icon, isWarning ? styles.iconWarning : styles.iconReport].join(' ')}
          aria-hidden="true"
        >
          {isWarning ? '!' : '☰'}
        </span>
        <span className={styles.body}>
          <span className={styles.titleRow}>
            <strong>{notification.title}</strong>
            {!notification.isRead && <span className={styles.dot} aria-hidden="true" />}
          </span>
          <span className={styles.content}>{notification.content}</span>
          <span className={styles.footer}>
            <span className={styles.date}>
              {new Date(notification.createdAt).toLocaleString('ko-KR')}
            </span>
            <span className={styles.link}>{link.label} ›</span>
          </span>
        </span>
      </button>
    </li>
  )
}
