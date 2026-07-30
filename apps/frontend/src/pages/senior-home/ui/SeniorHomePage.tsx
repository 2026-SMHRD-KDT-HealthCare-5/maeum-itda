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
      <BottomTabBar items={SENIOR_TAB_ITEMS} />
    </main>
  )
}
