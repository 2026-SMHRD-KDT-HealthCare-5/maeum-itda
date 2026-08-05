import { NavLink } from 'react-router-dom'
import styles from './BottomTabBar.module.css'

export interface TabItem {
  label: string
  to: string
  icon: 'home' | 'chat' | 'report' | 'notification' | 'user'
}

function TabIcon({ icon }: { icon: TabItem['icon'] }) {
  const paths = {
    home: (
      <>
        <path d="m3 11 9-7 9 7" />
        <path d="M5.5 10v9h13v-9M9.5 19v-5h5v5" />
      </>
    ),
    chat: (
      <>
        <path d="M5 17.5 3.5 21l4-1.5A9 9 0 1 0 5 17.5Z" />
        <path d="M8 12h.01M12 12h.01M16 12h.01" />
      </>
    ),
    report: (
      <>
        <rect x="5" y="3" width="14" height="18" rx="2" />
        <path d="M8.5 8h7M8.5 12h7M8.5 16h4" />
      </>
    ),
    notification: (
      <>
        <path d="M6 17h12l-1.5-2.5V10a4.5 4.5 0 0 0-9 0v4.5L6 17Z" />
        <path d="M10 20h4" />
      </>
    ),
    user: (
      <>
        <circle cx="12" cy="8" r="3.5" />
        <path d="M5.5 20c.6-4 2.8-6 6.5-6s5.9 2 6.5 6" />
      </>
    ),
  }

  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      {paths[icon]}
    </svg>
  )
}

// SENIOR_HOME_01 (#5) / GUARDIAN_HOME_01 (#6) 하단 탭바.
// 시니어/보호자용 탭 목록이 서로 달라서, 이 위젯은 role을 모르고 pages가
// items를 주입해주는 방식으로 둔다 (widgets는 features/entities를
// 조합하지만, role 분기 자체는 pages 책임).
export function BottomTabBar({ items }: { items: TabItem[] }) {
  return (
    <nav className={styles.nav} aria-label="주요 메뉴">
      {items.map((item) => (
        <NavLink
          className={({ isActive }) => `${styles.link} ${isActive ? styles.active : ''}`}
          end={item.to === '/senior' || item.to === '/guardian'}
          key={item.to}
          to={item.to}
        >
          <TabIcon icon={item.icon} />
          <span>{item.label}</span>
        </NavLink>
      ))}
    </nav>
  )
}
