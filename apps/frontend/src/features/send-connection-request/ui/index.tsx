import { type FormEvent, useState } from 'react'
import type { PendingSentRequest } from '../model'
import styles from './SendConnectionRequestAction.module.css'

interface SendConnectionRequestActionProps {
  pendingRequest: PendingSentRequest | null
  onSubmit: (seniorLoginId: string) => void
  onCancel: () => void
  isSubmitting?: boolean
  isCancelling?: boolean
  error?: string | null
}

// GUARDIAN_LINK_01 (UC-00-1) — 어르신 아이디로 연결 요청을 보내는 폼.
// 실제 요청/취소 API 호출과 서버 상태(pendingRequest)는 페이지가 소유하고,
// 이 컴포넌트는 입력값과 표시만 담당한다.
export function SendConnectionRequestAction({
  pendingRequest,
  onSubmit,
  onCancel,
  isSubmitting = false,
  isCancelling = false,
  error = null,
}: SendConnectionRequestActionProps) {
  const [seniorLoginId, setSeniorLoginId] = useState('')

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const trimmed = seniorLoginId.trim()
    if (!trimmed) return
    onSubmit(trimmed)
  }

  return (
    <div className={styles.container}>
      <form className={styles.card} onSubmit={handleSubmit} noValidate>
        <h2 className={styles.title}>어르신 아이디</h2>
        <div className={styles.row}>
          <input
            className={styles.input}
            value={seniorLoginId}
            onChange={(event) => setSeniorLoginId(event.target.value)}
            placeholder="아이디를 입력하세요"
            aria-label="어르신 아이디"
            aria-describedby={error ? 'senior-id-error' : 'senior-id-hint'}
            aria-invalid={Boolean(error)}
            disabled={Boolean(pendingRequest) || isSubmitting}
          />
          <button
            type="submit"
            className={styles.submitButton}
            disabled={!seniorLoginId.trim() || Boolean(pendingRequest) || isSubmitting}
          >
            {isSubmitting ? '요청 중...' : '요청'}
          </button>
        </div>
        <p id="senior-id-hint" className={styles.hint}>
          {pendingRequest
            ? '보낸 요청을 취소하면 다른 어르신을 찾을 수 있어요.'
            : '어르신이 가입 시 등록한 아이디로 찾을 수 있어요.'}
        </p>
        {error && (
          <p id="senior-id-error" className={styles.error} role="alert">
            {error}
          </p>
        )}
      </form>

      {pendingRequest && (
        <div className={styles.sentCard}>
          <h3 className={styles.sentTitle}>보낸 요청</h3>
          <div className={styles.sentRow} aria-live="polite">
            <div>
              <div className={styles.sentHeading}>
                <p className={styles.sentUsername}>{pendingRequest.seniorName}</p>
                <span className={styles.pendingBadge}>수락 대기</span>
              </div>
              <p className={styles.sentDate}>
                {new Date(pendingRequest.requestedAt).toLocaleDateString('ko-KR')} 요청
              </p>
            </div>
            <button
              type="button"
              className={styles.cancelButton}
              onClick={onCancel}
              disabled={isCancelling}
            >
              {isCancelling ? '취소 중...' : '요청 취소'}
            </button>
          </div>
          <p className={styles.cancelHint}>
            <span aria-hidden="true">i</span>
            요청을 취소하면 다른 어르신께 보낼 수 있어요.
          </p>
        </div>
      )}
    </div>
  )
}
