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
  return (
    <section className={styles.controls} aria-labelledby="conversation-status">
      <div className={styles.characterFrame} data-state={characterState}>
        <img key={characterState} src={characterImageSrc} alt={characterImageAlt} />
      </div>

      <div className={styles.listening} aria-live="polite">
        <span aria-hidden="true" />
        <strong id="conversation-status">대화를 준비하고 있어요</strong>
      </div>

      <button className={styles.finishAnswer} type="button" disabled aria-label="발화 완료 준비 중">
        <span aria-hidden="true" />
      </button>
      <p className={styles.finishHint}>말을 마치시면 가운데 버튼을 눌러주세요</p>

      <button className={styles.startConversation} type="button">
        대화 시작
      </button>
      <p className={styles.safety}>안전한 연결로 보호되고 있어요</p>
    </section>
  )
}
