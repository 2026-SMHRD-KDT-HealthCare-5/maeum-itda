import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import {
  CONNECTION_QUERY_KEY,
  fetchMyConnection,
  type Connection,
} from '../../../entities/connection'
import { useSession } from '../../../entities/user'
import { StartConversationAction } from '../../../features/start-conversation'
import { ViewAttendanceCalendarAction } from '../../../features/view-attendance-calendar'
import { BottomTabBar, SENIOR_TAB_ITEMS } from '../../../widgets/bottom-tab-bar'
import styles from './SeniorHomePage.module.css'

function connectionSummaryText(connection: Connection | undefined): string {
  if (!connection) return '보호자 연결 상태를 불러오는 중이에요'
  if (connection.status === 'CONNECTED') {
    return `${connection.counterpart?.name ?? '보호자'}님과 연결되어 있어요`
  }
  if (connection.status === 'REQUESTED') {
    return '보호자님의 연결 요청이 도착했어요'
  }
  return '아직 연결된 보호자가 없어요'
}

// SENIOR_HOME_01 (UC-01, UC-13)
export function SeniorHomePage() {
  const { session } = useSession()
  const connectionQuery = useQuery({ queryKey: CONNECTION_QUERY_KEY, queryFn: fetchMyConnection })

  return (
    <>
      <main className={styles.page}>
        <section className={styles.content}>
          <header className={styles.greeting}>
            <p className={styles.eyebrow}>마음잇다가 오늘도 함께할게요</p>
            <h1>
              {session?.name} 어르신,
              <span>
                오늘도 좋은 하루 <span className={styles.noBreak}>보내세요! 🌿</span>
              </span>
            </h1>
          </header>

          <StartConversationAction />

          <Link className={styles.connection} to="/senior/connection">
            <span className={styles.connectionIcon} aria-hidden="true">
              <svg viewBox="0 0 24 24">
                <circle cx="9" cy="8" r="3" />
                <circle cx="16.5" cy="9.5" r="2.5" />
                <path d="M3.5 19c.5-3.6 2.3-5.5 5.5-5.5s5 1.9 5.5 5.5M14 14.5c3.5-.7 5.7.9 6.5 4.5" />
              </svg>
            </span>
            <span>
              <strong>보호자 연결 상태를 확인해 주세요</strong>
              <small>{connectionSummaryText(connectionQuery.data)}</small>
            </span>
            <span className={styles.chevron} aria-hidden="true">
              ›
            </span>
          </Link>

          <ViewAttendanceCalendarAction />
        </section>
      </main>
      <BottomTabBar items={SENIOR_TAB_ITEMS} />
    </>
  )
}
