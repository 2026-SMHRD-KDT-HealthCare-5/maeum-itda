import { Link } from 'react-router-dom'
import { getUnlockedAudioContext } from '../../../shared/lib'
import characterImage from './character-daseul-greeting.webp'
import styles from './StartConversationAction.module.css'

export function StartConversationAction() {
  // 이 클릭이 실제 사용자 제스처이므로, 대화 화면의 묵음 감지(record-voice-answer의
  // createSilenceWatcher)가 쓸 AudioContext를 여기서 미리 깨워둔다 — iOS Safari는
  // 제스처 없이 만든 AudioContext의 resume()을 무시한다.
  function handleStartClick() {
    getUnlockedAudioContext()
  }

  return (
    <section className={styles.hero} aria-labelledby="conversation-invitation">
      <div className={styles.scene}>
        <div className={styles.speechBubble}>
          <p id="conversation-invitation">안녕하세요!</p>
          <p>오늘은 어떤 이야기를 나눠볼까요?</p>
          <span aria-hidden="true">♥</span>
        </div>
        <img
          className={styles.character}
          src={characterImage}
          alt="하트 쿠션을 안고 인사하는 마음잇다 캐릭터 다슬"
        />
      </div>

      <Link className={styles.button} to="/senior/conversation" onClick={handleStartClick}>
        <span className={styles.microphone} aria-hidden="true">
          <svg viewBox="0 0 24 24">
            <rect x="8" y="3" width="8" height="12" rx="4" />
            <path d="M5.5 11.5a6.5 6.5 0 0 0 13 0M12 18v3M9 21h6" />
          </svg>
        </span>
        <span className={styles.buttonCopy}>
          <small>다슬이와 함께</small>
          <strong>안부 대화 시작하기</strong>
        </span>
        <span className={styles.arrow} aria-hidden="true">
          ›
        </span>
      </Link>
    </section>
  )
}
