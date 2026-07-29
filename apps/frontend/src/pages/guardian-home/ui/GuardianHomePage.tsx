import { BottomTabBar } from '../../../widgets/bottom-tab-bar'
import { EmotionTrendChart } from '../../../widgets/emotion-trend-chart'

// GUARDIAN_HOME_01 (UC-08)
// 참고: 화면설계서 메뉴구성에는 '내 정보' 탭도 있으나 이번 스캐폴딩
// 요청 범위(pages 목록)에는 없어 탭바에서 제외함 — 별도 화면 요청 시 추가.
export function GuardianHomePage() {
  return (
    <main>
      <h1>보호자 홈</h1>
      <EmotionTrendChart />
      <BottomTabBar
        items={[
          { label: '홈', to: '/guardian' },
          { label: '리포트', to: '/guardian/report' },
          { label: '알림', to: '/guardian/notifications' },
        ]}
      />
    </main>
  )
}
