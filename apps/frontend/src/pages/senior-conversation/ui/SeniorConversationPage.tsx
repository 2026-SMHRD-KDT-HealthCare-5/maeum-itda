import { useEffect, useRef, useState } from 'react'
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

type CharacterState = 'waiting' | 'listening' | 'question' | 'thinking'
type TtsAudio = { base64: string; mimeType: string }

// 'waiting'은 전용 캐릭터 그림이 아직 없어 'listening'과 같은 그림을 쓰고
// alt 텍스트와 하단 배지 문구로만 구분한다(RecordVoiceAnswerAction 참고).
const characterByState: Record<CharacterState, { alt: string; src: string }> = {
  waiting: {
    alt: '어르신의 말씀을 기다리는 다슬',
    src: listeningCharacterImage,
  },
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
  const [answerRetryNotice, setAnswerRetryNotice] = useState<string | null>(null)
  const [isEndDialogOpen, setIsEndDialogOpen] = useState(false)
  const [hasScrollableHistory, setHasScrollableHistory] = useState(false)
  const [currentQuestionTts, setCurrentQuestionTts] = useState<TtsAudio | null>(null)
  // tts:audio는 같은 질문의 ai:question보다 먼저 도착한다(QuestionDeliveryService.deliver
  // 순서) — ai:question이 올 때 messageId로 짝지어 currentQuestionTts에 반영하기 전까지
  // messageId별로 임시 보관한다. 리렌더를 유발할 필요 없는 값이라 state가 아니라 ref다.
  const pendingTtsByMessageIdRef = useRef(new Map<number, TtsAudio>())

  useEffect(() => {
    // 로그인 정보가 없으면 연결을 시도하지 않는다 — 아래 렌더링이 이 경우를
    // session?.accessToken 값으로 직접 판단해 보여준다(별도 상태 없이).
    if (!session?.accessToken) return
    const accessToken = session.accessToken

    const handleAiQuestion: Parameters<typeof socket.on<'ai:question'>>[1] = (payload) => {
      const ttsAudio = pendingTtsByMessageIdRef.current.get(payload.messageId) ?? null
      pendingTtsByMessageIdRef.current.delete(payload.messageId)
      setCurrentQuestion(payload)
      setCurrentQuestionTts(ttsAudio)
      setIdleNotice(null)
      setConnectionError(null)
      setMessages((prev) => [...prev, questionToMessage(payload)])
    }
    // tts:audio는 ai:question 직전에 온다(§4.2) — 아직 currentQuestion이 갱신되기
    // 전이므로 일단 messageId로만 보관해뒀다가 handleAiQuestion에서 짝짓는다.
    const handleTtsAudio: Parameters<typeof socket.on<'tts:audio'>>[1] = (payload) => {
      pendingTtsByMessageIdRef.current.set(payload.messageId, {
        base64: payload.base64,
        mimeType: payload.mimeType,
      })
    }
    // 답변 메시지는 분석이 성공해 실제로 저장된 시점에야 처음 이 이벤트로
    // 도착한다(결정사항: 분석 실패 시 아무 메시지도 만들지 않는다) — 그래서
    // 기존 말풍선을 갱신하는 게 아니라 여기서 새로 추가한다. 분석 실패는
    // error 이벤트(AUDIO_ANALYSIS_FAILED)의 배너로만 안내한다.
    const handleAudioTranscript: Parameters<typeof socket.on<'audio:transcript'>>[1] = (
      payload,
    ) => {
      setAnswerRetryNotice(null)
      setMessages((prev) => [
        ...prev,
        ...payload.transcripts.map(({ messageId, content }): ChatMessage => ({
          messageId,
          speakerType: 'SENIOR',
          content,
          sttStatus: 'COMPLETED',
          createdAt: new Date().toISOString(),
        })),
      ])
    }
    const handleIdleWarning: Parameters<typeof socket.on<'chat:idle-warning'>>[1] = (payload) =>
      setIdleNotice(payload.message)
    const handleChatEnded: Parameters<typeof socket.on<'chat:ended'>>[1] = () => {
      setCurrentQuestion(null)
      navigate('/senior')
    }
    const handleError: Parameters<typeof socket.on<'error'>>[1] = (payload) => {
      if (payload.code === 'AUDIO_ANALYSIS_FAILED') {
        // 연결 장애가 아니라 방금 답변 분석 실패다 — 답변 조작부 바로 위에서
        // 재답변을 안내한다(녹음 자체는 record-voice-answer 훅이 이 이벤트를
        // 받아 곧바로 다시 연다).
        setAnswerRetryNotice('음성을 분석하지 못했어요. 다시 말씀해주세요.')
        return
      }
      setConnectionError(payload.message)
    }

    socket.on('ai:question', handleAiQuestion)
    socket.on('tts:audio', handleTtsAudio)
    socket.on('audio:transcript', handleAudioTranscript)
    socket.on('chat:idle-warning', handleIdleWarning)
    socket.on('chat:ended', handleChatEnded)
    socket.on('error', handleError)

    // StrictMode 개발 모드에서는 이 effect가 마운트→클린업→재마운트로 두 번
    // 실행된다. 첫 실행의 connect()가 아직 CONNECTING인 상태에서 클린업이
    // socket.disconnect()를 호출하면 브라우저가 그 소켓의 error 이벤트를
    // 발생시켜 connect()가 실패로 reject된다 — 이 reject는 이미 정리된
    // 첫 실행에 속한 것이므로, 두 번째(살아남은) 실행이 성공해도 화면에
    // 에러가 잠깐 표시됐다 사라지는 원인이 된다. cancelled 플래그로 클린업된
    // 실행의 결과는 상태에 반영하지 않는다.
    let cancelled = false

    // 인증 후 소켓이 예기치 않게 끊기면(네트워크 단절, 서버 재시작 등) 아무
    // 이벤트도 더 오지 않아 화면이 "대화 중" 상태로 멈춰버린다 — 최소한 끊김을
    // 감지해 안내라도 보여준다(자동 재연결까지는 하지 않음).
    const handleUnexpectedClose = () => {
      if (cancelled) return
      setConnectionState('error')
      setConnectionError('다슬이와의 연결이 끊어졌어요. 화면을 새로고침해 다시 시도해 주세요.')
    }

    socket
      .connect(accessToken)
      .then(() => {
        if (cancelled) return
        setConnectionState('ready')
        socket.onClose(handleUnexpectedClose)
        socket.startChat()
      })
      .catch((error: unknown) => {
        if (cancelled) return
        setConnectionState('error')
        setConnectionError(
          error instanceof Error ? error.message : '대화 서버에 연결하지 못했습니다.',
        )
      })

    return () => {
      cancelled = true
      socket.off('ai:question', handleAiQuestion)
      socket.off('tts:audio', handleTtsAudio)
      socket.off('audio:transcript', handleAudioTranscript)
      socket.off('chat:idle-warning', handleIdleWarning)
      socket.off('chat:ended', handleChatEnded)
      socket.off('error', handleError)
      socket.disconnect()
    }
  }, [session?.accessToken, socket, navigate])

  const { phase, finishAnswer, ttsAutoplayBlocked } = useRecordVoiceAnswer({
    socket,
    currentQuestion,
    ttsAudio: currentQuestionTts,
    // 무음인 채로 "지금 답변 마치기"를 누르면 서버로 보내지 않고 안내만 띄운다
    // (Whisper 계열이 무음에도 엉뚱한 문장을 환각하는 걸 막기 위한 클라이언트
    // 사전 필터 — app/services/stt.py 자체에는 무음 판별이 없다).
    onSilentFinishAttempt: () =>
      setAnswerRetryNotice('아직 말씀하신 내용이 없어요. 말씀해 주세요.'),
    onVoiceDetected: () => setAnswerRetryNotice(null),
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
            {answerRetryNotice && (
              <p className={styles.answerRetryNotice} role="alert">
                {answerRetryNotice}
              </p>
            )}
            <RecordVoiceAnswerAction
              characterImageAlt={character.alt}
              characterImageSrc={character.src}
              characterState={phase}
              onFinishAnswer={finishAnswer}
              ttsAutoplayBlocked={ttsAutoplayBlocked}
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
