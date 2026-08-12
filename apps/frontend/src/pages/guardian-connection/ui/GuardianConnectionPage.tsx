import { SendConnectionRequestAction } from '../../../features/send-connection-request'
import { BottomTabBar, GUARDIAN_TAB_ITEMS } from '../../../widgets/bottom-tab-bar'
import styles from './GuardianConnectionPage.module.css'

// GUARDIAN_LINK_01 (UC-00-1)
export function GuardianConnectionPage() {
  return (
    <>
      <main className={styles.page}>
        <h1 className={styles.title}>시니어 연결</h1>
        <p className={styles.description}>
          한 분의 어르신과만 연결할 수 있어요. 요청을 수락하시면 정서 리포트를 받아볼 수 있어요.
        </p>
        <SendConnectionRequestAction />
      </main>
      <BottomTabBar items={GUARDIAN_TAB_ITEMS} />
    </>
  )
}
