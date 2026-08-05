import { Link } from 'react-router-dom'
import { BottomTabBar, SENIOR_TAB_ITEMS } from '../../../widgets/bottom-tab-bar'
import { StartConversationAction } from '../../../features/start-conversation'

// SENIOR_HOME_01 (UC-01)
export function SeniorHomePage() {
  return (
    <main>
      <h1>시니어 홈</h1>
      <StartConversationAction />
      <p>
        <Link to="/senior/conversation">안부 대화 시작</Link>
      </p>
      {/* 화면ID 미배정(신규, 결정사항 로그 §5) — 탭바 추가 여부는 미정이라 우선 홈 링크로만 진입 */}
      <p>
        <Link to="/senior/daily-record">일간 기록 보기</Link>
      </p>
      <BottomTabBar items={SENIOR_TAB_ITEMS} />
    </main>
  )
}
