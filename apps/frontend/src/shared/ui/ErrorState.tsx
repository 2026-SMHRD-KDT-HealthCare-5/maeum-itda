import { Button } from './Button'
import styles from './ErrorState.module.css'

interface ErrorStateProps {
  message: string
  onRetry: () => void
  isRetrying?: boolean
  title?: string
}

// 조회 실패 화면의 의미·재시도 동작을 통일한다. 404와 정상적인 빈 데이터는
// 각 도메인의 empty state가 맡고, 이 컴포넌트는 복구 가능한 API 오류에만 쓴다.
export function ErrorState({
  message,
  onRetry,
  isRetrying = false,
  title = '연결이 원활하지 않아요',
}: ErrorStateProps) {
  return (
    <section className={styles.state} role="alert" aria-live="assertive">
      <span className={styles.icon} aria-hidden="true">
        <svg viewBox="0 0 24 24">
          <path d="M5 8.5a10.4 10.4 0 0 1 14 0M8 12a6 6 0 0 1 8 0M11 15.5a1.6 1.6 0 0 1 2 0" />
          <path d="m5 19 14-14" />
        </svg>
      </span>
      <div>
        <h2>{title}</h2>
        <p>{message}</p>
      </div>
      <Button type="button" onClick={onRetry} disabled={isRetrying}>
        {isRetrying ? '다시 불러오는 중...' : '다시 시도'}
      </Button>
    </section>
  )
}
