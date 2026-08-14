import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ConversationHistoryList, type ChatMessage } from '../../../entities/conversation'
import {
  RecordVoiceAnswerAction,
  useRecordVoiceAnswer,
} from '../../../features/record-voice-answer'
import { useSession } from '../../../entities/user'
import { ChatSocket } from '../../../shared/api'
import { useDelayedPending } from '../../../shared/lib'
import type { AiQuestionPayload } from '../../../shared/types'
import { Button, LoadingSpinner } from '../../../shared/ui'
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

function questionToMessage(question: AiQuestionPayload): ChatMessage {
  return {
    messageId: question.messageId,
    speakerType: 'AI',
    content: question.content,
    sttStatus: 'NOT_REQUIRED',
    createdAt: new Date().toISOString(),
  }
}

// SENIOR_CONVERSATION_01 (UC-01, UC-02, UC-03) — /ws/chats 실연동.
// 이전 대화 이력 무한 스크롤은 결정사항 로그 §5 참고(아직 REST 조회는
// 화면 진입 시 연결하지 않고, 이번 대화에서 오간 메시지만 보여준다).
export function SeniorConversationPage() {
  const { session } = useSession()
  const navigate = useNavigate()
  const [socket] = useState(() => new ChatSocket())

  const [connectionState, setConnectionState] = useState<'connecting' | 'ready' | 'error'>(
    'connecting',
  )
  const [connectionError, setConnectionError] = useState<string | null>(null)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [currentQuestion, setCurrentQuestion] = useState<AiQuestionPayload | null>(null)
  const [idleNotice, setIdleNotice] = useState<string | null>(null)
  const [isEndDialogOpen, setIsEndDialogOpen] = useState(false)
  const [hasScrollableHistory, setHasScrollableHistory] = useState(false)

  useEffect(() => {
    // 로그인 정보가 없으면 연결을 시도하지 않는다 — 아래 렌더링이 이 경우를
    // session?.accessToken 값으로 직접 판단해 보여준다(별도 상태 없이).
    if (!session?.accessToken) return
    const accessToken = session.accessToken

    socket.on('ai:question', (payload) => {
      setCurrentQuestion(payload)
      setIdleNotice(null)
      setConnectionError(null)
      setMessages((prev) => [...prev, questionToMessage(payload)])
    })
    socket.on('chat:idle-warning', (payload) => setIdleNotice(payload.message))
    socket.on('chat:ended', () => {
      setCurrentQuestion(null)
      navigate('/senior')
    })
    socket.on('error', (payload) => setConnectionError(payload.message))

    socket
      .connect(accessToken)
      .then(() => {
        setConnectionState('ready')
        socket.startChat()
      })
      .catch((error: unknown) => {
        setConnectionState('error')
        setConnectionError(
          error instanceof Error ? error.message : '대화 서버에 연결하지 못했습니다.',
        )
      })

    return () => socket.disconnect()
  }, [session?.accessToken, socket, navigate])

  const { phase, finishAnswer } = useRecordVoiceAnswer({
    socket,
    currentQuestion,
    onAnswerQueued: (message) => setMessages((prev) => [...prev, message]),
  })

  const character = characterByState[phase]
  const showConnectingSpinner = useDelayedPending(connectionState === 'connecting')

  function confirmEndChat() {
    socket.endChat()
    setIsEndDialogOpen(false)
    navigate('/senior')
  }

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <div>
          <p className={styles.eyebrow}>오늘의 안부 대화</p>
          <h1>
            <span aria-hidden="true" /> 다슬이와 대화하고 있어요
          </h1>
        </div>
        <button className={styles.endCall} type="button" onClick={() => setIsEndDialogOpen(true)}>
          대화 종료
        </button>
      </header>

      <div className={styles.content}>
        {!session?.accessToken && (
          <p role="alert">로그인 정보가 없어 대화를 시작할 수 없어요. 다시 로그인해 주세요.</p>
        )}
        {session?.accessToken && connectionState === 'error' && !showConnectingSpinner && (
          <p role="alert">{connectionError}</p>
        )}
        {session?.accessToken && showConnectingSpinner && (
          <LoadingSpinner overlay label="다슬이와 연결하고 있어요…" />
        )}
        {session?.accessToken && connectionState === 'ready' && !showConnectingSpinner && (
          <>
            {/* chat:start 이후에도 서버가 error 이벤트(예: AUDIO_ANALYSIS_FAILED)를
                보낼 수 있다 — connectionState는 이미 'ready'라 위 분기로는 안
                보이므로 여기서 배너로 띄운다. */}
            {connectionError && <p role="alert">{connectionError}</p>}
            {idleNotice && <p className={styles.historyHint}>{idleNotice}</p>}
            {hasScrollableHistory && (
              <p className={styles.historyHint}>위로 올려 지난 대화를 볼 수 있어요</p>
            )}
            <ConversationHistoryList
              messages={messages}
              onOverflowChange={setHasScrollableHistory}
            />
            <RecordVoiceAnswerAction
              characterImageAlt={character.alt}
              characterImageSrc={character.src}
              characterState={phase}
              onFinishAnswer={finishAnswer}
            />
          </>
        )}
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
              <button type="button" className={styles.dialogConfirm} onClick={confirmEndChat}>
                종료
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  )
}
