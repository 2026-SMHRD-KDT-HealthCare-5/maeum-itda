import { Link } from 'react-router-dom'
import { BottomTabBar } from '../../../widgets/bottom-tab-bar'
import { StartConversationAction } from '../../../features/start-conversation'

// SENIOR_HOME_01 (UC-01)
// 참고: 화면설계서 메뉴구성에는 '내 정보' 탭도 있으나 이번 스캐폴딩
// 요청 범위(pages 목록)에는 없어 탭바에서 제외함 — 별도 화면 요청 시 추가.
export function SeniorHomePage() {
  return (
    <main>
      <h1>시니어 홈</h1>
      <StartConversationAction />
      <p>
        <Link to="/senior/conversation">안부 대화 시작</Link>
      </p>
      <BottomTabBar
        items={[
          { label: '홈', to: '/senior' },
          { label: '안부 대화', to: '/senior/conversation' },
        ]}
      />
    </main>
  )
}
