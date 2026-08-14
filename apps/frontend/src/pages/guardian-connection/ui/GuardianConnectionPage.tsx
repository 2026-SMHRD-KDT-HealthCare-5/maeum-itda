import { useNavigate } from 'react-router-dom'
import { SendConnectionRequestAction } from '../../../features/send-connection-request'
import styles from './GuardianConnectionPage.module.css'

// GUARDIAN_LINK_01 (UC-00-1) — 내 정보의 미연결 상태에서 진입하는
// 전용 연결 요청 화면. 요청 폼과 mock 상태 관리는 feature에 위임한다.
export function GuardianConnectionPage() {
  const navigate = useNavigate()

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <button
          type="button"
          className={styles.backButton}
          onClick={() => navigate('/guardian/my-info')}
          aria-label="내 정보로 돌아가기"
        >
          <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="m14.5 6-6 6 6 6" />
          </svg>
        </button>
        <h1 className={styles.title}>시니어 연결</h1>
      </header>

      <section className={styles.intro} aria-labelledby="connection-heading">
        <p className={styles.eyebrow}>어르신과 마음잇기</p>
        <h2 id="connection-heading">돌보실 어르신을 연결해 주세요</h2>
        <p className={styles.description}>
          한 분의 어르신과만 연결할 수 있어요. 요청을 수락하시면 정서 리포트를 받아볼 수 있어요.
        </p>
      </section>

      <ol className={styles.steps} aria-label="어르신 연결 순서">
        <li>
          <span>1</span>
          <p>아이디 입력</p>
        </li>
        <li>
          <span>2</span>
          <p>어르신 수락</p>
        </li>
        <li>
          <span>3</span>
          <p>연결 완료</p>
        </li>
      </ol>

      <SendConnectionRequestAction />
    </main>
  )
}
