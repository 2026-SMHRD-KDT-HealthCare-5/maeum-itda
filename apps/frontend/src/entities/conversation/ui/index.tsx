import styles from './ConversationHistoryList.module.css'

export function ConversationHistoryList() {
  return (
    <section className={styles.transcript} aria-label="안부 대화 내용">
      <div className={styles.messages} role="feed" aria-label="대화 이력 미리보기">
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
