import { SetNotificationThresholdAction } from '../../../features/set-notification-threshold'
import { BottomTabBar, GUARDIAN_TAB_ITEMS } from '../../../widgets/bottom-tab-bar'

// 화면설계서 본문에 화면ID 미배정 (UC-12) — docs/page-pdf/보호자 알림 설정.pdf 참고
export function GuardianNotificationSettingsPage() {
  return (
    <main>
      <h1>알림 설정</h1>
      <SetNotificationThresholdAction />
      <BottomTabBar items={GUARDIAN_TAB_ITEMS} />
    </main>
  )
}
