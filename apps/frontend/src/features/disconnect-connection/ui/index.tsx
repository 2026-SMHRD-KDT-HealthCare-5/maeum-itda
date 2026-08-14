import { useState } from 'react'
import styles from './DisconnectConnectionAction.module.css'

interface DisconnectConnectionActionProps {
  onDisconnect: () => void
  variant?: 'default' | 'guardian'
}

// 결정사항 로그 §7 — 시니어/보호자 내 정보 화면 양쪽에서 쓰는 "연결 끊기" 액션.
// 실제 API 연결 전이라 onDisconnect는 호출부(entities/connection 상태)가
// 로컬로 처리한다.
export function DisconnectConnectionAction({
  onDisconnect,
  variant = 'default',
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
          <div className={styles.confirmActions}>
            <button
              type="button"
              className={styles.cancelButton}
              onClick={() => setIsConfirming(false)}
            >
              취소
            </button>
            <button
              type="button"
              className={styles.confirmButton}
              onClick={() => {
                onDisconnect()
                setIsConfirming(false)
              }}
            >
              연결 끊기
            </button>
          </div>
        </div>
      )}
    </>
  )
}
