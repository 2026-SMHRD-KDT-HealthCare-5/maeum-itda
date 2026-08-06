import { Link } from 'react-router-dom'
import { StartConversationAction } from '../../../features/start-conversation'
import { ViewAttendanceCalendarAction } from '../../../features/view-attendance-calendar'
import { BottomTabBar, SENIOR_TAB_ITEMS } from '../../../widgets/bottom-tab-bar'
import styles from './SeniorHomePage.module.css'

// SENIOR_HOME_01 (UC-01, UC-13)
export function SeniorHomePage() {
  return (
    <>
      <main className={styles.page}>
        <section className={styles.content}>
          <header className={styles.greeting}>
            <h1>어르신,</h1>
            <p>
              오늘도 좋은 하루 보내세요! <span aria-hidden="true">🌿</span>
            </p>
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
              <small>연결된 보호자 정보는 서비스 연동 후 표시돼요</small>
            </span>
            <span className={styles.chevron} aria-hidden="true">
              ›
            </span>
          </Link>

          <ViewAttendanceCalendarAction />

          <button className={styles.reminder} type="button" disabled>
            <span className={styles.reminderIcon} aria-hidden="true">
              <svg viewBox="0 0 24 24">
                <circle cx="12" cy="12" r="8" />
                <path d="M12 7v5l3 2" />
              </svg>
            </span>
            <span>
              <strong>안부 알림 시간을 설정해 보세요</strong>
              <small>서비스 연결 후 원하는 시간으로 바꿀 수 있어요</small>
            </span>
            <span className={styles.chevron} aria-hidden="true">
              ›
            </span>
          </button>
        </section>
      </main>
      <BottomTabBar items={SENIOR_TAB_ITEMS} />
    </>
  )
}
