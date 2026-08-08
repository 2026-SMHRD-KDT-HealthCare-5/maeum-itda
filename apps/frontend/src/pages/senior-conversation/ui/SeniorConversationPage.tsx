import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ConversationHistoryList } from '../../../entities/conversation'
import { RecordVoiceAnswerAction } from '../../../features/record-voice-answer'
import { Button } from '../../../shared/ui'
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
  const characterState: CharacterState = 'listening'
  const character = characterByState[characterState]
  const [isEndDialogOpen, setIsEndDialogOpen] = useState(false)
  const navigate = useNavigate()

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <button
          className={styles.endCall}
          type="button"
          aria-label="통화 종료"
          onClick={() => setIsEndDialogOpen(true)}
        >
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M5 5l14 14M19 5 5 19" />
          </svg>
        </button>
      </header>

      <div className={styles.content}>
        <ConversationHistoryList />
        <RecordVoiceAnswerAction
          characterImageAlt={character.alt}
          characterImageSrc={character.src}
          characterState={characterState}
        />
      </div>

      {isEndDialogOpen && (
        <div className={styles.dialogOverlay} onClick={() => setIsEndDialogOpen(false)}>
          <div
            className={styles.dialog}
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="end-dialog-title"
            onClick={(event) => event.stopPropagation()}
          >
            <p id="end-dialog-title" className={styles.dialogTitle}>
              대화를 종료하시겠어요?
            </p>
            <p className={styles.dialogHint}>
              지금 종료하면 지금까지의 답변으로 오늘의 대화를 마쳐요.
            </p>
            <div className={styles.dialogActions}>
              <Button type="button" variant="outline" onClick={() => setIsEndDialogOpen(false)}>
                취소
              </Button>
              <button
                type="button"
                className={styles.dialogConfirm}
                onClick={() => navigate('/senior')}
              >
                종료
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  )
}
