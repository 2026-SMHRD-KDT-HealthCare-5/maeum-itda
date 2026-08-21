import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ConversationHistoryList,
  fetchConversationHistoryByDate,
  type ChatMessage,
} from '../../../entities/conversation'
import {
  RecordVoiceAnswerAction,
  useRecordVoiceAnswer,
  type RecordingPhase,
} from '../../../features/record-voice-answer'
import { useSession } from '../../../entities/user'
import { ChatSocket } from '../../../shared/api'
import { API_BASE_URL } from '../../../shared/config'
import { getSeoulDateKey, useDelayedPending } from '../../../shared/lib'
import type { AiQuestionPayload } from '../../../shared/types'
import { Button, LoadingSpinner } from '../../../shared/ui'
import listeningCharacterImage from './character-daseul-listening.png'
import questionCharacterImage from './character-daseul-question.png'
import thinkingCharacterImage from './character-daseul-thinking.png'
import waitingCharacterImage from './character-daseul-waiting.png'
import styles from './SeniorConversationPage.module.css'

const characterByPhase: Record<RecordingPhase, { alt: string; src: string }> = {
  waiting: {
    alt: '어르신의 말씀을 기다리는 다슬',
    src: waitingCharacterImage,
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
// 오늘 이전 대화 이력은 화면 진입 시 GET /chats/messages?date=오늘로 불러와
// 채운다(2026-08-21, 서버 재시작으로 재진입이 새 대화처럼 보이던 문제 수정).
// 오늘보다 이전 날짜의 무한 스크롤 조회 자체는 아직 결정사항 로그 §5 미확정
// 상태다.
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
  const [currentQuestionTtsUrl, setCurrentQuestionTtsUrl] = useState<string | null>(null)
  // 2026-08-21부터 최초 질문·후속 질문 모두 ai:question(텍스트)이 먼저 오고
  // tts:audio(스트리밍 경로)는 단기 토큰 발급이 끝나는 대로 항상 뒤이어 온다 —
  // 그래서 tts:audio는 항상 "이미 화면에 뜬 질문과 같은 messageId"로만 도착한다.
  // 리렌더를 유발할 필요 없는 값이라 state가 아니라 ref다.
  const currentQuestionMessageIdRef = useRef<number | null>(null)

  // 서버가 재시작돼 ChatConnectionStateService의 메모리 상태가 사라진 뒤 같은 날
  // 재진입해도(2026-08-21 이전엔 대화가 처음부터 다시 시작돼 보였다), 오늘 오간
  // 메시지를 REST로 미리 채워둔다 — 실시간 소켓 이벤트와는 별개 경로라 messageId로
  // 중복만 걸러내고 병합한다(마지막이 아직 답변되지 않은 AI 질문이면 소켓이 곧
  // ai:question으로 그 질문을 다시 보내오는데, 그건 아래 handleAiQuestion에서
  // 걸러진다 — 여기서 currentQuestion/TTS까지 미리 설정하지 않는 이유는
  // generationId가 DB에 없어 REST 응답만으론 알 수 없기 때문이다).
  useEffect(() => {
    if (!session?.accessToken) return
    let cancelled = false

    fetchConversationHistoryByDate(getSeoulDateKey())
      .then((history) => {
        if (cancelled || history.length === 0) return
        setMessages((prev) => {
          const existingIds = new Set(prev.map((message) => message.messageId))
          const missing = history.filter((message) => !existingIds.has(message.messageId))
          if (missing.length === 0) return prev
          return [...missing, ...prev].sort((a, b) => a.messageId - b.messageId)
        })
      })
      .catch((error: unknown) => {
        console.error('오늘의 이전 대화 이력을 불러오지 못했습니다.', error)
      })

    return () => {
      cancelled = true
    }
  }, [session?.accessToken])

  useEffect(() => {
    // 로그인 정보가 없으면 연결을 시도하지 않는다 — 아래 렌더링이 이 경우를
    // session?.accessToken 값으로 직접 판단해 보여준다(별도 상태 없이).
    if (!session?.accessToken) return
    const accessToken = session.accessToken

    const handleAiQuestion: Parameters<typeof socket.on<'ai:question'>>[1] = (payload) => {
      currentQuestionMessageIdRef.current = payload.messageId
      setCurrentQuestion(payload)
      setCurrentQuestionTtsUrl(null)
      setIdleNotice(null)
      setConnectionError(null)
      // 서버 재시작 후 재진입 시 위 이력 조회 effect가 같은 질문을 이미 넣어뒀을
      // 수 있어(오늘 마지막 메시지가 아직 답변되지 않은 AI 질문인 경우), 같은
      // messageId면 중복으로 추가하지 않는다.
      setMessages((prev) =>
        prev.some((message) => message.messageId === payload.messageId)
          ? prev
          : [...prev, questionToMessage(payload)],
      )
    }
    // tts:audio는 항상 이미 화면에 뜬 질문과 같은 messageId로 뒤이어 온다 — 다른
    // 질문으로 넘어간 뒤 늦게 도착한 것이면(messageId 불일치) 조용히 버린다.
    const handleTtsAudio: Parameters<typeof socket.on<'tts:audio'>>[1] = (payload) => {
      if (payload.messageId !== currentQuestionMessageIdRef.current) return
      setCurrentQuestionTtsUrl(`${API_BASE_URL}${payload.streamPath}`)
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
      currentQuestionMessageIdRef.current = null
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
      if (payload.code === 'CHAT_ALREADY_STARTED') {
        // 같은 서버 프로세스에 짧게 재접속하면 서버가 chat:restored+ai:question으로
        // 기존 질문을 이미 복원해 보낸 뒤라, 뒤이어 우리가 보낸 chat:start는
        // 정상적으로 거부된 것이다 — 실패가 아니라 예상된 응답이므로 무시한다.
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

  const { phase, finishAnswer, skipQuestion, ttsAutoplayBlocked } = useRecordVoiceAnswer({
    socket,
    currentQuestion,
    ttsStreamUrl: currentQuestionTtsUrl,
    // 무음인 채로 "지금 답변 마치기"를 누르면 서버로 보내지 않고 안내만 띄운다
    // (Whisper 계열이 무음에도 엉뚱한 문장을 환각하는 걸 막기 위한 클라이언트
    // 사전 필터 — app/services/stt.py 자체에는 무음 판별이 없다).
    onSilentFinishAttempt: () =>
      setAnswerRetryNotice('아직 말씀하신 내용이 없어요. 말씀해 주세요.'),
    onVoiceDetected: () => setAnswerRetryNotice(null),
  })

  const character = characterByPhase[phase]
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
              phase={phase}
              onFinishAnswer={finishAnswer}
              onSkipQuestion={skipQuestion}
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
