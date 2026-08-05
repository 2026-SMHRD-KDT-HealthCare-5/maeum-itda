import styles from './ConversationHistoryList.module.css'

export function ConversationHistoryList() {
  return (
    <section className={styles.transcript} aria-label="안부 대화 내용">
      <div className={styles.empty}>
        <span aria-hidden="true">•••</span>
        <p>대화가 시작되면 다슬이의 질문과 어르신의 말씀이 이곳에 표시돼요.</p>
      </div>
    </section>
  )
}
