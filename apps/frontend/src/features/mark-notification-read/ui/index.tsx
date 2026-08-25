import type { KeyboardEvent } from 'react'
import { Link } from 'react-router-dom'
import type { Notification } from '../../../entities/notification'
import daseulNoNotificationImage from '../../../shared/assets/character/character-daseul-no-notification.webp'
import { formatNotificationTime, groupNotificationsByDate, reportLinkPath } from '../model'
import styles from './MarkNotificationReadAction.module.css'

interface MarkNotificationReadActionProps {
  notifications: Notification[]
  onMarkRead: (notification: Notification) => void
  onToggleRead: (notification: Notification) => void
  onMarkAllRead: () => void
}

// GUARDIAN_NOTIFICATION_01 (UC-10, UC-11) — 서버 상태(조회/읽음 처리 mutation)는
// pages/guardian-notification이 소유하고, 이 컴포넌트는 표시와 사용자 조작만 맡는다.
export function MarkNotificationReadAction({
  notifications,
  onMarkRead,
  onToggleRead,
  onMarkAllRead,
}: MarkNotificationReadActionProps) {
  if (notifications.length === 0) {
    return (
      <div className={styles.notificationList}>
        <div className={styles.header}>
          <h1>알림</h1>
          <button type="button" className={styles.markAllButton} disabled>
            모두 읽음
          </button>
        </div>
        <section className={styles.empty} aria-labelledby="empty-notification-title">
          <img src={daseulNoNotificationImage} alt="새로운 소식을 기다리는 다슬" />
          <h2 id="empty-notification-title">아직 도착한 알림이 없어요.</h2>
          <p>새로운 소식이 생기면 이곳에서 알려드릴게요.</p>
        </section>
      </div>
    )
  }

  const dateGroups = groupNotificationsByDate(notifications)
  const unreadCount = notifications.filter((notification) => !notification.isRead).length

  return (
    <div className={styles.notificationList}>
      <div className={styles.header}>
        <h1>알림</h1>
        <button
          type="button"
          className={styles.markAllButton}
          onClick={onMarkAllRead}
          disabled={unreadCount === 0}
        >
          모두 읽음
        </button>
      </div>

      {dateGroups.map((group) => (
        <section key={group.dateKey}>
          <h2 className={styles.groupLabel}>{group.label}</h2>
          <ul className={styles.list}>
            {group.notifications.map((notification) => (
              <NotificationRow
                key={notification.id}
                notification={notification}
                onRead={onMarkRead}
                onToggleRead={onToggleRead}
              />
            ))}
          </ul>
        </section>
      ))}
    </div>
  )
}

function NotificationRow({
  notification,
  onRead,
  onToggleRead,
}: {
  notification: Notification
  onRead: (notification: Notification) => void
  onToggleRead: (notification: Notification) => void
}) {
  const isWarning = notification.title.includes('하락')
  const link = reportLinkPath(notification.target)

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key !== 'Enter' && event.key !== ' ') return
    event.preventDefault()
    onToggleRead(notification)
  }

  return (
    <li>
      <div
        role="button"
        tabIndex={0}
        className={[
          styles.item,
          isWarning ? styles.itemWarning : '',
          !notification.isRead ? styles.itemUnread : '',
        ]
          .filter(Boolean)
          .join(' ')}
        onClick={() => onToggleRead(notification)}
        onKeyDown={handleKeyDown}
        aria-label={`${notification.title}, ${notification.isRead ? '읽음, 다시 누르면 읽지 않음으로' : '읽지 않음'}`}
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
          </span>
          <span className={styles.content}>{notification.content}</span>
          <span className={styles.footer}>
            <span className={styles.date}>{formatNotificationTime(notification.createdAt)}</span>
            <Link
              className={styles.link}
              to={link.to}
              onClick={(event) => {
                event.stopPropagation()
                onRead(notification)
              }}
              onKeyDown={(event) => event.stopPropagation()}
            >
              {link.label} ›
            </Link>
          </span>
        </span>
      </div>
    </li>
  )
}
