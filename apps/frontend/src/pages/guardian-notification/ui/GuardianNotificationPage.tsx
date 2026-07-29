import { MarkNotificationReadAction } from '../../../features/mark-notification-read'

// GUARDIAN_NOTIFICATION_01 (UC-11)
export function GuardianNotificationPage() {
  return (
    <main>
      <h1>알림함</h1>
      <MarkNotificationReadAction />
    </main>
  )
}
