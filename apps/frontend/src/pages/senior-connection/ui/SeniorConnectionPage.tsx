import { useNavigate } from 'react-router-dom'
import { RespondConnectionRequestAction } from '../../../features/respond-connection-request'
import styles from './SeniorConnectionPage.module.css'

// SENIOR_LINK_01 (UC-00-1)
export function SeniorConnectionPage() {
  const navigate = useNavigate()

  return (
    <main className={styles.overlay} aria-label="보호자 연결 요청">
      <button
        type="button"
        className={styles.backButton}
        onClick={() => navigate('/senior')}
        aria-label="홈으로 돌아가기"
      >
        ‹
      </button>
      <RespondConnectionRequestAction
        guardianName="홍길동"
        onAccept={() => navigate('/senior')}
        onReject={() => navigate('/senior')}
      />
    </main>
  )
}
