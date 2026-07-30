import { BottomTabBar, GUARDIAN_TAB_ITEMS } from '../../../widgets/bottom-tab-bar'
import { EmotionTrendChart } from '../../../widgets/emotion-trend-chart'

// GUARDIAN_HOME_01 (UC-08)
export function GuardianHomePage() {
  return (
    <main>
      <h1>보호자 홈</h1>
      <EmotionTrendChart />
      <BottomTabBar items={GUARDIAN_TAB_ITEMS} />
    </main>
  )
}
