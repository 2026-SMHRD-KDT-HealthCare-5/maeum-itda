import { Fragment, useEffect, useRef } from 'react'
import type { ChatMessage } from '../model'
import styles from './ConversationHistoryList.module.css'

const messageTimeFormatter = new Intl.DateTimeFormat('ko-KR', {
  hour: 'numeric',
  minute: '2-digit',
  hour12: true,
  timeZone: 'Asia/Seoul',
})

function MessageBubble({ message }: { message: ChatMessage }) {
  const variant = message.speakerType === 'AI' ? 'assistant' : 'senior'
  const date = new Date(message.createdAt)
  const formattedTime = Number.isNaN(date.getTime()) ? null : messageTimeFormatter.format(date)
  // 시니어 답변은 STT가 끝나기 전까지 content가 null이다(docs/ws-protocol.md §5.4) —
  // 그동안은 텍스트 대신 처리 중 안내를 보여준다.
  const isPending = message.content === null

  return (
    <div
      className={`${styles.message} ${
        variant === 'assistant' ? styles.assistantMessage : styles.seniorMessage
      } ${isPending ? styles.pendingMessage : ''}`}
    >
      <span>
        {isPending
          ? message.sttStatus === 'FAILED'
            ? '답변을 이해하지 못했어요'
            : '답변을 보내드렸어요'
          : message.content}
      </span>
      {formattedTime && <time dateTime={message.createdAt}>{formattedTime}</time>}
    </div>
  )
}

// UC-14 — 시니어 이전 대화 기록 조회 화면에서 특정 날짜의 메시지 목록을
// 보여줄 때 쓴다. 실시간 대화 화면(ConversationHistoryList)과 말풍선
// 스타일·데이터 모델(ChatMessage)을 그대로 공유한다.
export function DailyConversationList({ messages }: { messages: ChatMessage[] }) {
  return (
    <section className={styles.transcript} aria-label="선택한 날짜의 대화 내용">
      <div className={`${styles.messages} ${styles.dailyMessages}`}>
        {messages.map((message) => (
          <Fragment key={message.messageId}>
            <MessageBubble message={message} />
          </Fragment>
        ))}
      </div>
    </section>
  )
}

export function ConversationHistoryList({
  messages,
  onOverflowChange,
}: {
  messages: ChatMessage[]
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
        {messages.map((message) => (
          <MessageBubble key={message.messageId} message={message} />
        ))}
      </div>
    </section>
  )
}
