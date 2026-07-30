import { useNavigate } from 'react-router-dom'
import { BottomTabBar, SENIOR_TAB_ITEMS } from '../../../widgets/bottom-tab-bar'
import { useSession } from '../../../entities/user'

// 화면설계서 메뉴구성에 '내 정보'가 시니어/보호자 화면 트리 아래 이름만
// 나와 있고, 화면 ID·UC·목업이 없음 — 이 화면만 다른 pages/*와 달리
// 근거 자료가 없어서 로그아웃 정도만 실제로 동작하는 최소 골격으로 둠.
// 실제 화면 설계가 나오면 그에 맞춰 다시 만들 것.
export function SeniorMyInfoPage() {
  const { session, logout } = useSession()
  const navigate = useNavigate()

  function handleLogout() {
    logout()
    navigate('/login')
  }

  return (
    <main>
      <h1>내 정보</h1>
      <p>{session?.userId}</p>
      <button onClick={handleLogout}>로그아웃</button>
      <BottomTabBar items={SENIOR_TAB_ITEMS} />
    </main>
  )
}
