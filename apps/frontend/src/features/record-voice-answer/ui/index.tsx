import styles from './RecordVoiceAnswerAction.module.css'

type RecordVoiceAnswerActionProps = {
  characterImageAlt: string
  characterImageSrc: string
  characterState: 'listening' | 'question' | 'thinking'
}

export function RecordVoiceAnswerAction({
  characterImageAlt,
  characterImageSrc,
  characterState,
}: RecordVoiceAnswerActionProps) {
  const isResponding = characterState === 'listening'
  const statusText =
    characterState === 'thinking'
      ? '답변을 정리하고 있어요'
      : isResponding
        ? '어르신 말씀을 듣고 있어요'
        : '다슬이가 이야기하고 있어요'

  return (
    <section className={styles.controls} aria-labelledby="conversation-status">
      <div className={styles.characterFrame} data-state={characterState}>
        <img key={characterState} src={characterImageSrc} alt={characterImageAlt} />
      </div>

      <div className={styles.listening} aria-live="polite">
        <span aria-hidden="true" />
        <strong id="conversation-status">{statusText}</strong>
      </div>

      <button
        className={styles.finishAnswer}
        type="button"
        disabled={!isResponding}
        data-state={isResponding ? 'responding' : 'waiting'}
      >
        <span aria-hidden="true">{isResponding ? '' : '•••'}</span>
        <strong>{isResponding ? '지금 답변 마치기' : '응답 대기 중'}</strong>
      </button>
      <p className={styles.finishHint}>
        {isResponding
          ? '말씀을 멈추시면 잠시 후 답변이 자동으로 완료돼요'
          : '말씀을 시작하시면 다슬이가 멈추고 답변을 들어요'}
      </p>
    </section>
  )
}
