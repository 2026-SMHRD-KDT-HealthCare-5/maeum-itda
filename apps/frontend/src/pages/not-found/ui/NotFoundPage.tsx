import { useNavigate } from 'react-router-dom'
import characterImage from '../../../shared/assets/character/character-daseul-404.png'
import { useSession } from '../../../entities/user'
import { Button } from '../../../shared/ui'
import styles from './NotFoundPage.module.css'

const HOME_PATH_BY_ROLE = {
  senior: '/senior',
  guardian: '/guardian',
} as const

// 화면설계서에 없는 화면 — 존재하지 않는 경로로 들어왔을 때 보여준다.
// 이전에는 조용히 /login으로 리다이렉트했으나(AppRouter의 catch-all), 실제로
// 무슨 일이 있었는지 알 수 없어 사용자를 혼란스럽게 했다.
export function NotFoundPage() {
  const navigate = useNavigate()
  const { session } = useSession()
  const homePath = session ? HOME_PATH_BY_ROLE[session.role] : '/login'

  return (
    <div className={styles.wrapper}>
      <img className={styles.character} src={characterImage} alt="" />
      <p className={styles.message}>페이지를 찾을 수 없어요.</p>
      <Button type="button" onClick={() => navigate(homePath, { replace: true })}>
        홈으로 가기
      </Button>
    </div>
  )
}
