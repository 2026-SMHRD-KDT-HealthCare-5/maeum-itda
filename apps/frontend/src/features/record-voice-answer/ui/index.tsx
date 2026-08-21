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

  // 버튼을 누를 수 없는 두 상태('question'/'thinking')를 예전엔 "응답 대기 중"
  // 하나로 묶어 보여줬는데, 누구의 응답을 기다린다는 건지(어르신? 다슬이?)
  // 헷갈린다는 피드백이 있었다 — 그렇다고 각 상태를 풀어서 설명하는 문장을
  // 넣으면 위 상태 pill과 내용이 겹치고 버튼 답게 짧지도 않아서, 짧은
  // 상태어 하나씩으로만 구분한다(설명은 아래 finishHint가 맡는다).
  // 'waiting'은 버튼이 눌리긴 하지만(무음 안내만 뜨고 실제로 끝나진 않는다,
  // useRecordVoiceAnswer의 hasDetectedVoice 가드 참고) 아직 아무 말도 하기 전이라
  // "지금 답변 마치기"라고 하면 끝낼 답변이 있는 것처럼 보여 어색하다 — 그
  // 문구는 실제로 마칠 내용이 있는 'listening'에만 쓴다.
  const finishButtonLabel =
    characterState === 'question'
      ? '질문 듣는 중'
      : characterState === 'waiting'
        ? '말씀해 주세요'
        : characterState === 'thinking'
          ? '분석 중'
          : '지금 답변 마치기'

  // 'question' 구간은 끼어들기를 받지 않으므로(2026-08-19, 에코로 인한 TTS
  // 오작동 방지) "말씀을 시작하시면 다슬이가 멈추고"라는 안내가 틀린 말이
  // 된다 — 'thinking' 구간에만 그 설명이 실제로 맞다.
  const finishHint = isRecording
    ? '말씀을 멈추시면 잠시 후 답변이 자동으로 완료돼요'
    : characterState === 'thinking'
      ? '말씀을 시작하시면 다슬이가 멈추고 답변을 들어요'
      : '다슬이의 이야기가 끝나면 답변 버튼이 켜져요'

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
        data-state={characterState}
        onClick={onFinishAnswer}
      >
        <span aria-hidden="true">{isRecording ? '' : '•••'}</span>
        <strong>{finishButtonLabel}</strong>
      </button>
      <p className={styles.finishHint}>{finishHint}</p>
    </section>
  )
}
