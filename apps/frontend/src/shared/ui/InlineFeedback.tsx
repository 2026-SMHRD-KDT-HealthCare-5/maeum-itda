import styles from './InlineFeedback.module.css'

export type InlineFeedbackTone = 'success' | 'error' | 'info'

// 폼과 설정 카드 안에서 비동기 작업 결과를 같은 위치와 의미로 전달한다.
export function InlineFeedback({
  message,
  tone,
  className = '',
}: {
  message: string
  tone: InlineFeedbackTone
  className?: string
}) {
  const icon = tone === 'success' ? '✓' : tone === 'error' ? '!' : '…'

  return (
    <p
      className={[styles.feedback, styles[tone], className].filter(Boolean).join(' ')}
      role={tone === 'error' ? 'alert' : 'status'}
    >
      <span aria-hidden="true">{icon}</span>
      {message}
    </p>
  )
}
