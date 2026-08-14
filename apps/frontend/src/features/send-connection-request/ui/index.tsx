import { type FormEvent, useState } from 'react'
import { mockSendConnectionRequest, type SentConnectionRequest } from '../model'
import styles from './SendConnectionRequestAction.module.css'

// GUARDIAN_LINK_01 (UC-00-1) — 어르신 아이디로 연결 요청을 보내는 폼.
// 실제 연결 요청 API 연동 전이라 mockSendConnectionRequest로 성공/실패를
// 흉내낸다.
export function SendConnectionRequestAction() {
  const [seniorUsername, setSeniorUsername] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [sentRequest, setSentRequest] = useState<SentConnectionRequest | null>(null)

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const trimmed = seniorUsername.trim()
    if (!trimmed) return

    const result = mockSendConnectionRequest(trimmed)
    if (!result.ok) {
      setError('해당 아이디로 등록된 어르신을 찾을 수 없어요.')
      return
    }

    setError(null)
    setSentRequest({ seniorUsername: trimmed, requestedAt: new Date().toISOString() })
  }

  function handleCancel() {
    setSentRequest(null)
    setSeniorUsername('')
  }

  return (
    <div className={styles.container}>
      <form className={styles.card} onSubmit={handleSubmit} noValidate>
        <h2 className={styles.title}>어르신 아이디</h2>
        <div className={styles.row}>
          <input
            className={styles.input}
            value={seniorUsername}
            onChange={(event) => {
              setSeniorUsername(event.target.value)
              setError(null)
            }}
            placeholder="아이디를 입력하세요"
            aria-label="어르신 아이디"
            aria-describedby={error ? 'senior-id-error' : 'senior-id-hint'}
            aria-invalid={Boolean(error)}
            disabled={Boolean(sentRequest)}
          />
          <button
            type="submit"
            className={styles.submitButton}
            disabled={!seniorUsername.trim() || Boolean(sentRequest)}
          >
            요청
          </button>
        </div>
        <p id="senior-id-hint" className={styles.hint}>
          {sentRequest
            ? '보낸 요청을 취소하면 다른 어르신을 찾을 수 있어요.'
            : '어르신이 가입 시 등록한 아이디로 찾을 수 있어요.'}
        </p>
        {error && (
          <p id="senior-id-error" className={styles.error} role="alert">
            {error}
          </p>
        )}
      </form>

      {sentRequest && (
        <div className={styles.sentCard}>
          <h3 className={styles.sentTitle}>보낸 요청</h3>
          <div className={styles.sentRow} aria-live="polite">
            <div>
              <div className={styles.sentHeading}>
                <p className={styles.sentUsername}>{sentRequest.seniorUsername}</p>
                <span className={styles.pendingBadge}>수락 대기</span>
              </div>
              <p className={styles.sentDate}>
                {new Date(sentRequest.requestedAt).toLocaleDateString('ko-KR')} 요청
              </p>
            </div>
            <button type="button" className={styles.cancelButton} onClick={handleCancel}>
              요청 취소
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
