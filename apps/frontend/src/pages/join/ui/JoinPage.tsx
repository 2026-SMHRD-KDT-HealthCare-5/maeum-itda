import { Link } from 'react-router-dom'
import { RegisterAccountAction } from '../../../features/register-account'
import { Card } from '../../../shared/ui'
import styles from './JoinPage.module.css'

// JOIN_01 (UC-00)
export function JoinPage() {
  return (
    <main className={styles.page}>
      <section className={styles.container} aria-labelledby="join-title">
        <header className={styles.header}>
          <Link className={styles.backLink} to="/login" aria-label="로그인 화면으로 돌아가기">
            <span aria-hidden="true">←</span>
          </Link>
          <p className={styles.brand}>마음잇다</p>
          <h1 id="join-title">회원가입</h1>
          <p>마음을 잇는 따뜻한 안부를 시작해요.</p>
        </header>

        <div className={styles.formCard}>
          <Card>
            <RegisterAccountAction />
          </Card>
        </div>

        <p className={styles.loginPrompt}>
          이미 계정이 있으신가요? <Link to="/login">로그인</Link>
        </p>
      </section>
    </main>
  )
}
