import { MarkNotificationReadAction } from '../../../features/mark-notification-read'
import { BottomTabBar, GUARDIAN_TAB_ITEMS } from '../../../widgets/bottom-tab-bar'

// GUARDIAN_NOTIFICATION_01 (UC-11)
export function GuardianNotificationPage() {
  return (
    <main>
      <h1>알림함</h1>
      <MarkNotificationReadAction />
      <BottomTabBar items={GUARDIAN_TAB_ITEMS} />
    </main>
  )
}
