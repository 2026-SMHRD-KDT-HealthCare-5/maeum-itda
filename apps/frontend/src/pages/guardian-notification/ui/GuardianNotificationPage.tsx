import { MarkNotificationReadAction } from '../../../features/mark-notification-read'
import { BottomTabBar, GUARDIAN_TAB_ITEMS } from '../../../widgets/bottom-tab-bar'
import styles from './GuardianNotificationPage.module.css'

// GUARDIAN_NOTIFICATION_01 (UC-11)
export function GuardianNotificationPage() {
  return (
    <>
      <main className={styles.page}>
        <MarkNotificationReadAction />
      </main>
      <BottomTabBar items={GUARDIAN_TAB_ITEMS} />
    </>
  )
}
