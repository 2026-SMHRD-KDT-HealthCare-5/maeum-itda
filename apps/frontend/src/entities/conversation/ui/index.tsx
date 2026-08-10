import { Fragment, useEffect, useRef } from 'react'
import type { ConversationTurn } from '../model'
import styles from './ConversationHistoryList.module.css'

// UC-14 — 시니어 이전 대화 기록 조회 화면에서 특정 날짜의 turn 목록을 보여줄
// 때 쓴다. 실시간 대화 화면(ConversationHistoryList)과 말풍선 스타일은
// 공유하지만, turn 데이터를 매개변수로 받는다는 점이 다르다.
export function DailyConversationList({ turns }: { turns: ConversationTurn[] }) {
  return (
    <section className={styles.transcript} aria-label="선택한 날짜의 대화 내용">
      <div className={`${styles.messages} ${styles.dailyMessages}`}>
        {turns.map((turn) => (
          <Fragment key={turn.id}>
            <p className={styles.assistantMessage}>{turn.question}</p>
            {turn.answer && <p className={styles.seniorMessage}>{turn.answer}</p>}
          </Fragment>
        ))}
      </div>
    </section>
  )
}

export function ConversationHistoryList({
  onOverflowChange,
}: {
  onOverflowChange?: (hasOverflow: boolean) => void
}) {
  const transcriptRef = useRef<HTMLElement>(null)

  useEffect(() => {
    const transcript = transcriptRef.current
    if (!transcript) return

    const updateOverflow = () => {
      onOverflowChange?.(transcript.scrollHeight > transcript.clientHeight + 1)
    }

    const scrollToLatestMessage = () => {
      transcript.scrollTo({ top: transcript.scrollHeight, behavior: 'smooth' })
      updateOverflow()
    }

    transcript.scrollTo({ top: transcript.scrollHeight })
    updateOverflow()
    const observer = new MutationObserver(scrollToLatestMessage)
    observer.observe(transcript, { childList: true, characterData: true, subtree: true })
    const resizeObserver = new ResizeObserver(updateOverflow)
    resizeObserver.observe(transcript)

    return () => {
      observer.disconnect()
      resizeObserver.disconnect()
    }
  }, [onOverflowChange])

  return (
    <section ref={transcriptRef} className={styles.transcript} aria-label="안부 대화 내용">
      <div
        className={`${styles.messages} ${styles.liveMessages}`}
        role="feed"
        aria-label="대화 이력 미리보기"
      >
        <p className={styles.assistantMessage}>어르신, 오늘 아침은 잘 보내셨어요?</p>
        <p className={styles.seniorMessage}>응, 아침을 먹고 화분에 물도 줬어.</p>
        <p className={styles.assistantMessage}>화분을 돌보셨군요. 어떤 꽃을 키우고 계세요?</p>
        <p className={styles.seniorMessage}>분홍색 제라늄인데 요즘 꽃이 많이 피었어.</p>
        <p className={styles.seniorMessage}>그리고 동네를 한 바퀴 걷고 왔어.</p>
        <p className={styles.assistantMessage}>산책도 다녀오셨군요. 오늘 날씨는 어떠셨어요?</p>
      </div>
    </section>
  )
}
