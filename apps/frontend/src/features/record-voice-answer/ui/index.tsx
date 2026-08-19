import styles from './RecordVoiceAnswerAction.module.css'

type RecordVoiceAnswerActionProps = {
  characterImageAlt: string
  characterImageSrc: string
  characterState: 'waiting' | 'listening' | 'question' | 'thinking'
  onFinishAnswer: () => void
  // TTS 자동재생이 막혀(iOS 등) 소리 없이 텍스트로만 전달됐을 때 true —
  // "말하고 있어요" 대신 "글로 전해요" 안내로 바꿔 사용자가 위 말풍선을
  // 확인하도록 유도한다.
  ttsAutoplayBlocked?: boolean
}

export function RecordVoiceAnswerAction({
  characterImageAlt,
  characterImageSrc,
  characterState,
  onFinishAnswer,
  ttsAutoplayBlocked = false,
}: RecordVoiceAnswerActionProps) {
  // 'waiting'(마이크는 열렸지만 아직 말소리 없음)과 'listening'(말소리 감지됨)
  // 둘 다 녹음 구간이 진행 중이므로 "지금 답변 마치기" 버튼을 눌러 답변을
  // 제출할 수 있다 — 'waiting'에서 눌러도 무음 답변은 서버로 보내지 않고
  // 안내만 뜬다(useRecordVoiceAnswer의 hasDetectedVoice 가드).
  const isRecording = characterState === 'waiting' || characterState === 'listening'
  const statusText =
    characterState === 'thinking'
      ? '답변을 정리하고 있어요'
      : characterState === 'listening'
        ? '어르신 말씀을 듣고 있어요'
        : characterState === 'waiting'
          ? '말씀을 기다리고 있어요'
          : ttsAutoplayBlocked
            ? '다슬이가 위 글로 이야기하고 있어요'
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
        disabled={!isRecording}
        data-state={isRecording ? 'responding' : 'waiting'}
        onClick={onFinishAnswer}
      >
        <span aria-hidden="true">{isRecording ? '' : '•••'}</span>
        <strong>{isRecording ? '지금 답변 마치기' : '응답 대기 중'}</strong>
      </button>
      <p className={styles.finishHint}>
        {isRecording
          ? '말씀을 멈추시면 잠시 후 답변이 자동으로 완료돼요'
          : '말씀을 시작하시면 다슬이가 멈추고 답변을 들어요'}
      </p>
    </section>
  )
}
