import guardianCoupleImage from '../../../shared/assets/illustrations/guardian-couple.webp'
import styles from './RespondConnectionRequestAction.module.css'

interface RespondConnectionRequestActionProps {
  guardianName: string
  onAccept: () => void
  onReject: () => void
  isAccepting?: boolean
  isRejecting?: boolean
  error?: string | null
}

export function RespondConnectionRequestAction({
  guardianName,
  onAccept,
  onReject,
  isAccepting = false,
  isRejecting = false,
  error = null,
}: RespondConnectionRequestActionProps) {
  const isBusy = isAccepting || isRejecting
  return (
    <section className={styles.request} aria-labelledby="connection-request-title">
      <div className={styles.guardianVisual} aria-hidden="true">
        <img src={guardianCoupleImage} alt="" />
      </div>

      <div className={styles.heading}>
        <p>새로운 보호자 연결 요청</p>
        <h1 id="connection-request-title">
          <strong>{guardianName}</strong> 님이
          <span>보호자가 되고 싶어 해요</span>
        </h1>
        <p className={styles.description}>
          수락하면 보호자에게 어르신의 안부와 마음 상태를 알려드릴 수 있어요.
        </p>
      </div>

      <div className={styles.permissions} aria-label="보호자에게 공유되는 정보">
        <p>
          <span aria-hidden="true">✓</span> 대화 요약과 마음 상태를 볼 수 있어요
        </p>
        <p>
          <span aria-hidden="true">✓</span> 대화 녹음 원본은 공유되지 않아요
        </p>
        <p>
          <span aria-hidden="true">✓</span> 내 정보에서 언제든 연결을 끊을 수 있어요
        </p>
      </div>

      <div className={styles.actions}>
        <button type="button" className={styles.accept} onClick={onAccept} disabled={isBusy}>
          {isAccepting ? '수락 중...' : '수락하기'}
        </button>
        <button type="button" className={styles.reject} onClick={onReject} disabled={isBusy}>
          {isRejecting ? '거절 중...' : '거절하기'}
        </button>
        {error && (
          <p role="alert" className={styles.errorText}>
            {error}
          </p>
        )}
        <p>지금 정하지 않아도 괜찮아요. 나중에 다시 확인할 수 있어요.</p>
      </div>
    </section>
  )
}
