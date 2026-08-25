import { useEffect, useRef, useState } from 'react'
import { FiMic, FiMoreHorizontal, FiSquare } from 'react-icons/fi'

import type { RecordingPhase } from '../model'
import styles from './RecordVoiceAnswerAction.module.css'

// 캐릭터 이미지 전환 시 이전 이미지가 갑자기 사라지지 않도록, 이전 src를
// 잠깐 더 겹쳐 보여주며 CSS transition으로 페이드아웃한다. 진입 애니메이션은
// CSS의 characterEnter 키프레임이 그대로 맡는다.
const CHARACTER_FADE_MS = 320

function useExitingCharacterImage(src: string) {
  const [exiting, setExiting] = useState<string | null>(null)
  const [fading, setFading] = useState(false)
  const prevSrcRef = useRef(src)

  useEffect(() => {
    if (prevSrcRef.current === src) return
    setExiting(prevSrcRef.current)
    setFading(false)
    prevSrcRef.current = src
  }, [src])

  useEffect(() => {
    if (exiting === null) return undefined
    const raf = requestAnimationFrame(() => setFading(true))
    const timer = window.setTimeout(() => setExiting(null), CHARACTER_FADE_MS)
    return () => {
      cancelAnimationFrame(raf)
      window.clearTimeout(timer)
    }
  }, [exiting])

  return { exiting, fading }
}

type RecordVoiceAnswerActionProps = {
  characterImageAlt: string
  characterImageSrc: string
  phase: RecordingPhase
  onFinishAnswer: () => void
  // "지금 답변할게요" 버튼('question' 구간에서만 노출)에 연결한다 — 다슬이의
  // 질문을 끝까지 듣지 않고 곧바로 마이크를 연다.
  onSkipQuestion: () => void
  // TTS 자동재생이 막혀(iOS 등) 소리 없이 텍스트로만 전달됐을 때 true —
  // "말하고 있어요" 대신 "글로 전해요" 안내로 바꿔 사용자가 위 말풍선을
  // 확인하도록 유도한다.
  ttsAutoplayBlocked?: boolean
}

type AnswerActionIconProps = {
  phase: RecordingPhase
}

// react-icons의 Feather 아이콘으로 상태의 의미를 구분한다. question/waiting은
// 말하기, listening은 답변 종료, thinking은 처리 중인 상태를 나타내며 장식
// 요소라 버튼의 접근 가능한 이름은 텍스트가 맡는다.
function AnswerActionIcon({ phase }: AnswerActionIconProps) {
  if (phase === 'listening') {
    return <FiSquare aria-hidden="true" />
  }

  if (phase === 'thinking') {
    return <FiMoreHorizontal aria-hidden="true" />
  }

  return <FiMic aria-hidden="true" />
}

export function RecordVoiceAnswerAction({
  characterImageAlt,
  characterImageSrc,
  phase,
  onFinishAnswer,
  onSkipQuestion,
  ttsAutoplayBlocked = false,
}: RecordVoiceAnswerActionProps) {
  const { exiting, fading } = useExitingCharacterImage(characterImageSrc)

  // 'waiting'(마이크는 열렸지만 아직 말소리 없음)과 'listening'(말소리 감지됨)
  // 둘 다 녹음 구간이 진행 중이므로 "지금 답변 마치기" 버튼을 눌러 답변을
  // 제출할 수 있다 — 'waiting'에서 눌러도 무음 답변은 서버로 보내지 않고
  // 안내만 뜬다(useRecordVoiceAnswer의 hasDetectedVoice 가드).
  const isRecording = phase === 'waiting' || phase === 'listening'
  // 'question'도 버튼이 눌린다 — 다슬이의 질문을 끝까지 듣지 않고 곧바로
  // 답변으로 넘어가는 용도(skipQuestion, 아래 참고)라 'thinking'과 달리
  // disabled로 묶지 않는다.
  const canAct = isRecording || phase === 'question'
  const statusText =
    phase === 'thinking'
      ? '답변을 정리하고 있어요'
      : phase === 'listening'
        ? '어르신 말씀을 듣고 있어요'
        : phase === 'waiting'
          ? '말씀을 기다리고 있어요'
          : ttsAutoplayBlocked
            ? '다슬이가 위 글로 이야기하고 있어요'
            : '다슬이가 이야기하고 있어요'

  // 버튼을 누를 수 없는 'thinking'을 예전엔 'question'과 묶어 "응답 대기 중"
  // 하나로 보여줬는데, 누구의 응답을 기다린다는 건지(어르신? 다슬이?) 헷갈린다는
  // 피드백이 있었다 — 짧은 상태어로만 구분한다(설명은 아래 finishHint가 맡는다).
  // 'waiting'은 버튼이 눌리긴 하지만(무음 안내만 뜨고 실제로 끝나진 않는다,
  // useRecordVoiceAnswer의 hasDetectedVoice 가드 참고) 아직 아무 말도 하기 전이라
  // "지금 답변 마치기"라고 하면 끝낼 답변이 있는 것처럼 보여 어색하다 — 그
  // 문구는 실제로 마칠 내용이 있는 'listening'에만 쓴다. 'question'은 이제 실제
  // 클릭 가능한 동작(질문 건너뛰기)이 있어 그걸 그대로 부른다.
  const finishButtonLabel =
    phase === 'question'
      ? '지금 답변할게요'
      : phase === 'waiting'
        ? '말씀해 주세요'
        : phase === 'thinking'
          ? '분석 중'
          : '지금 답변 마치기'

  const finishHint =
    phase === 'question'
      ? '다슬이의 이야기를 다 듣지 않아도 답변할 수 있어요'
      : isRecording
        ? '말씀을 멈추시면 잠시 후 답변이 자동으로 완료돼요'
        : '잠시만 기다리시면 다슬이가 다음 질문을 이어서 드려요'

  return (
    <section className={styles.controls} aria-labelledby="conversation-status">
      <div className={styles.characterFrame} data-state={phase}>
        {exiting && (
          <img
            className={styles.characterExit}
            data-fading={fading}
            src={exiting}
            alt=""
            aria-hidden="true"
          />
        )}
        <img
          key={phase}
          className={styles.characterImg}
          src={characterImageSrc}
          alt={characterImageAlt}
        />
      </div>

      <div className={styles.listening} aria-live="polite">
        <span aria-hidden="true" />
        <strong id="conversation-status">{statusText}</strong>
      </div>

      <button
        className={styles.finishAnswer}
        type="button"
        disabled={!canAct}
        data-state={phase}
        onClick={phase === 'question' ? onSkipQuestion : onFinishAnswer}
      >
        <span className={styles.actionIcon}>
          <AnswerActionIcon phase={phase} />
        </span>
        <strong>{finishButtonLabel}</strong>
      </button>
      <p className={styles.finishHint}>{finishHint}</p>
    </section>
  )
}
