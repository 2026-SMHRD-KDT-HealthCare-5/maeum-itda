import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button, ErrorState, LoadingSpinner } from '../../../shared/ui'
import styles from './DebugErrorsPage.module.css'

// 화면설계서에 없는 숨김 화면 — ErrorBoundary/404 화면을 실제로 무너뜨리지 않고
// 확인해보기 위한 개발용 이스터에그. LoginPage 브랜드 로고를 5번 연속 클릭하면 온다.
export function DebugErrorsPage() {
  const navigate = useNavigate()
  const [throwNow, setThrowNow] = useState(false)
  const [showSpinner, setShowSpinner] = useState(false)
  const [isRetrying, setIsRetrying] = useState(false)

  if (throwNow) {
    throw new Error('디버그 화면에서 발생시킨 테스트 에러 — ErrorBoundary 확인용')
  }

  return (
    <div className={styles.wrapper}>
      <h1 className={styles.title}>에러 화면 미리보기 🥚</h1>
      <Button type="button" onClick={() => setThrowNow(true)}>
        ErrorBoundary 화면 보기
      </Button>
      <Button type="button" variant="outline" onClick={() => navigate('/이런-경로는-없음')}>
        404 화면 보기
      </Button>
      <Button type="button" variant="outline" onClick={() => setShowSpinner((prev) => !prev)}>
        로딩 스피너 미리보기
      </Button>
      {showSpinner && <LoadingSpinner />}
      <div className={styles.preview}>
        <h2>네트워크 오류 상태</h2>
        <ErrorState
          message="서버에 연결하지 못했어요. 네트워크 상태를 확인한 뒤 다시 시도해 주세요."
          isRetrying={isRetrying}
          onRetry={() => {
            setIsRetrying(true)
            window.setTimeout(() => setIsRetrying(false), 1500)
          }}
        />
      </div>
    </div>
  )
}
