import { NavLink } from 'react-router-dom'

export interface TabItem {
  label: string
  to: string
}

// 시니어/보호자 각각의 모든 탭 화면(SeniorHome/SeniorMyInfo,
// GuardianHome/Report/Notification/MyInfo)에서 동일하게 써야 하는 목록이라
// 여기 한 곳에 고정한다 — pages끼리 서로 import하지 않고도 pages가 공유할
// 수 있는 가장 가까운 하위 레이어가 widgets이기 때문.
export const SENIOR_TAB_ITEMS: TabItem[] = [
  { label: '홈', to: '/senior' },
  { label: '안부 대화', to: '/senior/conversation' },
  { label: '내 정보', to: '/senior/my-info' },
]

export const GUARDIAN_TAB_ITEMS: TabItem[] = [
  { label: '홈', to: '/guardian' },
  { label: '리포트', to: '/guardian/report' },
  { label: '알림', to: '/guardian/notifications' },
  { label: '내 정보', to: '/guardian/my-info' },
]

// SENIOR_HOME_01 (#5) / GUARDIAN_HOME_01 (#6) 하단 탭바.
// 시니어/보호자용 탭 목록이 서로 달라서, 이 위젯은 role을 모르고 pages가
// items를 주입해주는 방식으로 둔다 (widgets는 features/entities를
// 조합하지만, role 분기 자체는 pages 책임).
export function BottomTabBar({ items }: { items: TabItem[] }) {
  return (
    <nav>
      {items.map((item) => (
        <NavLink key={item.to} to={item.to}>
          {item.label}
        </NavLink>
      ))}
    </nav>
  )
}
