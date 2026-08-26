import { useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { Button, Card } from '../../../shared/ui'
import { LoginForm } from '../../../features/login-with-credentials'
import brandImage from './logo-daseul.webp'
import styles from './LoginPage.module.css'

const EASTER_EGG_CLICK_COUNT = 5
const EASTER_EGG_WINDOW_MS = 2000

// LOGIN_01 (UC-00)
export function LoginPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const notice = (location.state as { notice?: string } | null)?.notice
  const [logoClickCount, setLogoClickCount] = useState(0)
  const lastLogoClickAt = useRef(0)

  // 브랜드 로고를 2초 안에 5번 연속 클릭하면 에러 화면 미리보기(이스터에그)로 이동.
  const handleLogoClick = () => {
    const now = Date.now()
    const withinWindow = now - lastLogoClickAt.current < EASTER_EGG_WINDOW_MS
    lastLogoClickAt.current = now
    const nextCount = withinWindow ? logoClickCount + 1 : 1
    setLogoClickCount(nextCount)
    if (nextCount >= EASTER_EGG_CLICK_COUNT) {
      navigate('/debug/errors')
    }
  }

  return (
    <main className={styles.page}>
      <section className={styles.hero} aria-label="마음잇다 소개">
        <div className={styles.brand}>
          <img
            src={brandImage}
            alt="마음잇다 — 마음을 연결하는 따뜻한 안부"
            className={styles.brandImage}
            width={700}
            height={700}
            onClick={handleLogoClick}
          />
        </div>
      </section>

      <section className={styles.loginCard} aria-label="로그인">
        <Card>
          {notice && (
            <p className={styles.notice} role="status">
              {notice}
            </p>
          )}
          <LoginForm />

          <div className={styles.divider}>
            <span>또는</span>
          </div>

          <Button type="button" variant="outline" onClick={() => navigate('/join')}>
            회원가입
          </Button>
        </Card>
      </section>
    </main>
  )
}
