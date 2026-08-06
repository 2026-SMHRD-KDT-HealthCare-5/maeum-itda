import { RespondConnectionRequestAction } from '../../../features/respond-connection-request'
import { BottomTabBar, SENIOR_TAB_ITEMS } from '../../../widgets/bottom-tab-bar'

// SENIOR_LINK_01 (UC-00-1)
export function SeniorConnectionPage() {
  return (
    <main>
      <h1>보호자 연결</h1>
      <RespondConnectionRequestAction />
      <BottomTabBar items={SENIOR_TAB_ITEMS} />
    </main>
  )
}
