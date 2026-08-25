import { Navigate } from 'react-router-dom'
import { useSession } from '../../../entities/user'
import splashImage from './splash-daseul.webp'
import styles from './SplashPage.module.css'

// 화면ID 미배정(신규, 결정사항 로그 §5) — 단순 브랜딩용 화면인지 목적은 아직
// 확정되지 않았지만, "/"에서 빠져나갈 방법이 없는 건 실제 결함이라 즉시
// 리다이렉트한다. 세션 복원(localStorage accessToken)이 생긴 뒤로는 무조건
// /login이 아니라 복원된 세션의 역할별 홈으로 보낸다.
export function SplashPage() {
  const { session, isRestoring } = useSession()

  if (isRestoring) {
    return (
      <main className={styles.page}>
        <img src={splashImage} alt="마음잇다 — 마음을 잇는 따뜻한 대화" className={styles.image} />
      </main>
    )
  }
  if (!session) return <Navigate to="/login" replace />
  return <Navigate to={session.role === 'senior' ? '/senior' : '/guardian'} replace />
}
