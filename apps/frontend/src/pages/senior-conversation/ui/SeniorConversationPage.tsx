import { Link } from 'react-router-dom'
import { ConversationHistoryList } from '../../../entities/conversation'
import { RecordVoiceAnswerAction } from '../../../features/record-voice-answer'
import listeningCharacterImage from './character-daseul-listening.png'
import questionCharacterImage from './character-daseul-question.png'
import thinkingCharacterImage from './character-daseul-thinking.png'
import styles from './SeniorConversationPage.module.css'

type CharacterState = 'listening' | 'question' | 'thinking'

const characterByState: Record<CharacterState, { alt: string; src: string }> = {
  listening: {
    alt: '어르신의 말씀을 듣고 있는 다슬',
    src: listeningCharacterImage,
  },
  question: {
    alt: '어르신께 질문하는 다슬',
    src: questionCharacterImage,
  },
  thinking: {
    alt: '대화를 준비하며 생각하는 다슬',
    src: thinkingCharacterImage,
  },
}

// SENIOR_CONVERSATION_01 (UC-01, UC-02, UC-03)
// 이전 대화 이력 무한 스크롤은 결정사항 로그 §5 참고.
export function SeniorConversationPage() {
  const characterState: CharacterState = 'thinking'
  const character = characterByState[characterState]

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <Link className={styles.back} to="/senior" aria-label="시니어 홈으로 돌아가기">
          ‹
        </Link>
        <div className={styles.status} aria-live="polite">
          <span>
            <i aria-hidden="true" /> 대화 준비 중
          </span>
          <small>연결을 기다리고 있어요</small>
        </div>
      </header>

      <div className={styles.content}>
        <ConversationHistoryList />
        <RecordVoiceAnswerAction
          characterImageAlt={character.alt}
          characterImageSrc={character.src}
          characterState={characterState}
        />
      </div>
    </main>
  )
}
