import { useState } from 'react'
import styles from './DisconnectConnectionAction.module.css'

interface DisconnectConnectionActionProps {
  onDisconnect: () => void
  variant?: 'default' | 'guardian'
  isDisconnecting?: boolean
  error?: string | null
}

// 결정사항 로그 §7 — 시니어/보호자 내 정보 화면 양쪽에서 쓰는 "연결 끊기" 액션.
// 실제 DELETE /connections/me 호출과 그 pending/error 상태는 호출부(페이지)가
// 소유하고, 이 컴포넌트는 확인 단계 UI만 담당한다.
export function DisconnectConnectionAction({
  onDisconnect,
  variant = 'default',
  isDisconnecting = false,
  error = null,
}: DisconnectConnectionActionProps) {
  const [isConfirming, setIsConfirming] = useState(false)

  return (
    <>
      <button
        type="button"
        className={[styles.trigger, variant === 'guardian' ? styles.guardianTrigger : '']
          .filter(Boolean)
          .join(' ')}
        onClick={() => setIsConfirming(true)}
        aria-expanded={isConfirming}
        aria-controls="disconnect-confirmation"
      >
        연결 끊기
      </button>

      {isConfirming && (
        <div
          id="disconnect-confirmation"
          className={[styles.confirm, variant === 'guardian' ? styles.guardianConfirm : '']
            .filter(Boolean)
            .join(' ')}
          role="alertdialog"
          aria-modal={variant === 'guardian' ? true : undefined}
          aria-label="연결 끊기 확인"
        >
          <p className={styles.confirmText}>정말 연결을 끊으시겠어요?</p>
          {error && (
            <p role="alert" className={styles.confirmError}>
              {error}
            </p>
          )}
          <div className={styles.confirmActions}>
            <button
              type="button"
              className={styles.cancelButton}
              onClick={() => setIsConfirming(false)}
              disabled={isDisconnecting}
            >
              취소
            </button>
            <button
              type="button"
              className={styles.confirmButton}
              onClick={onDisconnect}
              disabled={isDisconnecting}
            >
              {isDisconnecting ? '연결 끊는 중...' : '연결 끊기'}
            </button>
          </div>
        </div>
      )}
    </>
  )
}
