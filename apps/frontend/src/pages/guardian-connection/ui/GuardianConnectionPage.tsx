import { SendConnectionRequestAction } from '../../../features/send-connection-request'
import { BottomTabBar, GUARDIAN_TAB_ITEMS } from '../../../widgets/bottom-tab-bar'

// GUARDIAN_LINK_01 (UC-00-1)
export function GuardianConnectionPage() {
  return (
    <main>
      <h1>시니어 연결</h1>
      <SendConnectionRequestAction />
      <BottomTabBar items={GUARDIAN_TAB_ITEMS} />
    </main>
  )
}
