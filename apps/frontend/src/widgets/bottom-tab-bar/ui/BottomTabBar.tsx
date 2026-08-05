import { NavLink } from 'react-router-dom'

export interface TabItem {
  label: string
  to: string
}

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
