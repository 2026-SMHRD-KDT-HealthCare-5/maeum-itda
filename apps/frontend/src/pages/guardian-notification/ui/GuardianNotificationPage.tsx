import { MarkNotificationReadAction } from '../../../features/mark-notification-read'
import { BottomTabBar, GUARDIAN_TAB_ITEMS } from '../../../widgets/bottom-tab-bar'
import styles from './GuardianNotificationPage.module.css'

// GUARDIAN_NOTIFICATION_01 (UC-11)
export function GuardianNotificationPage() {
  return (
    <>
      <main className={styles.page}>
        <h1 className={styles.title}>알림</h1>
        <MarkNotificationReadAction />
      </main>
      <BottomTabBar items={GUARDIAN_TAB_ITEMS} />
    </>
  )
}
