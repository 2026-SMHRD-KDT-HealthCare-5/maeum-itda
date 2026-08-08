import { Link } from 'react-router-dom'
import styles from './ReportPeriodTabs.module.css'

interface ReportPeriodTabsProps {
  active: 'daily' | 'weekly'
  weekStart: string
}

// 결정사항 로그 §6/§7 — 보호자 일간/주간 리포트 화면이 공유하는 탭 pill.
// 두 화면 PNG가 동일한 탭 컴포넌트를 그리고 있어, 페이지는 분리된 채로 두고
// 이 위젯만 양쪽에서 렌더링해 시각적으로 하나의 셸처럼 보이게 한다.
export function ReportPeriodTabs({ active, weekStart }: ReportPeriodTabsProps) {
  return (
    <nav className={styles.tabs} aria-label="리포트 기간 선택">
      <Link
        to="/guardian/report"
        className={[styles.tab, active === 'daily' ? styles.active : ''].filter(Boolean).join(' ')}
        aria-current={active === 'daily' ? 'page' : undefined}
      >
        일간
      </Link>
      <Link
        to={`/guardian/report/weekly/${weekStart}`}
        className={[styles.tab, active === 'weekly' ? styles.active : ''].filter(Boolean).join(' ')}
        aria-current={active === 'weekly' ? 'page' : undefined}
      >
        주간
      </Link>
    </nav>
  )
}
