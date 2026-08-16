import { useEffect, useRef, useState } from 'react'
import type { AiQuestionPayload, AudioAckPayload, AudioEndType } from '../../../shared/types'
import type { ChatSocket } from '../../../shared/api'
import type { ChatMessage } from '../../../entities/conversation'
import { playTtsAudioOnce } from '../../../shared/lib'
import { sendVoiceAnswer } from '../api'
import { createSilenceWatcher, pickSupportedAudioMimeType, type SilenceWatcherHandle } from '../lib'

// SeniorConversationPage가 캐릭터 이미지를 고르는 데 쓰는 상태.
// 'question': 새 AI 질문이 도착해 마이크를 준비하는 중
// 'listening': 실제로 녹음 중
// 'thinking': 답변 전송 후 다음 질문을 기다리는 중
export type RecordingPhase = 'question' | 'listening' | 'thinking'

export interface UseRecordVoiceAnswerOptions {
  socket: ChatSocket
  // 현재 답해야 할 AI 질문 — null이면 아직 대화가 시작되지 않은 상태다.
  currentQuestion: AiQuestionPayload | null
  // audio:ack로 messageId가 확정된 시니어 답변을 대화 목록에 추가한다.
  // content는 STT 완료 전이라 null이다(docs/ws-protocol.md §5.4).
  onAnswerQueued: (message: ChatMessage) => void
  // 이번 질문의 TTS 오디오(있으면) — 재생이 끝난 뒤에만 마이크를 열어 TTS
  // 소리가 마이크에 그대로 들어가 에코가 생기는 걸 막는다. 백엔드가 아직
  // tts:audio로 실제 오디오를 보내지 않는 동안(8/18 예정)은 항상 null이고,
  // 이 경우 기존처럼 질문 도착 즉시 마이크를 연다.
  ttsAudio?: { base64: string; mimeType: string } | null
}

export interface UseRecordVoiceAnswerResult {
  phase: RecordingPhase
  // "지금 답변 마치기" 버튼에 그대로 연결한다.
  finishAnswer: () => void
  // 이번 질문의 TTS 자동재생이 막혀(iOS 등) 소리 없이 텍스트로만 전달됐는지.
  ttsAutoplayBlocked: boolean
}

const AUTO_SILENCE_MS = 10_000

// UC-02: AI 질문이 도착하면 마이크 권한을 받아 녹음을 시작하고, 사용자가
// 직접 끝내거나(manual) 묵음이 10초 이어지면(auto) 녹음을 마쳐 서버로
// 보낸다. 실제 WebSocket 연동(effect)까지 포함하므로 단위 테스트는 이
// 훅이 호출하는 lib 함수 단위로 한다.
export function useRecordVoiceAnswer({
  socket,
  currentQuestion,
  onAnswerQueued,
  ttsAudio = null,
}: UseRecordVoiceAnswerOptions): UseRecordVoiceAnswerResult {
  const [phase, setPhase] = useState<RecordingPhase>('question')
  const [ttsAutoplayBlocked, setTtsAutoplayBlocked] = useState(false)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const silenceWatcherRef = useRef<SilenceWatcherHandle | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const mimeTypeRef = useRef('audio/webm')
  const currentQuestionRef = useRef(currentQuestion)
  // 최신 finish를 effect 의존성 없이 부르기 위한 latest-ref. 렌더 중이 아니라
  // 커밋 이후(effect)에 갱신해야 한다(react-hooks/refs).
  const finishRef = useRef<(endType: AudioEndType) => void>(() => {})
  useEffect(() => {
    currentQuestionRef.current = currentQuestion
    finishRef.current = finish
  })

  useEffect(() => {
    if (!currentQuestion?.generationId) return
    let cancelled = false
    const ttsPlayback = ttsAudio ? playTtsAudioOnce(ttsAudio.base64, ttsAudio.mimeType) : null

    async function startRecording() {
      // 동기적인 effect 본문이 아니라 이 비동기 콜백 안에서 상태를 바꿔야
      // 불필요한 cascading render 경고(react-hooks/set-state-in-effect)를 피한다.
      setPhase('question')
      setTtsAutoplayBlocked(false)
      if (ttsPlayback) {
        const { autoplayBlocked } = await ttsPlayback.finished
        if (cancelled) return
        setTtsAutoplayBlocked(autoplayBlocked)
      }
      let stream: MediaStream
      try {
        stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      } catch {
        // 마이크 권한 거부 — 답변 없이 서버의 30초 안내/2분 자동 종료에 맡긴다.
        return
      }
      if (cancelled) {
        stream.getTracks().forEach((track) => track.stop())
        return
      }

      streamRef.current = stream
      const mimeType = pickSupportedAudioMimeType()
      mimeTypeRef.current = mimeType
      chunksRef.current = []
      const recorder = new MediaRecorder(stream, { mimeType })
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunksRef.current.push(event.data)
      }
      mediaRecorderRef.current = recorder
      recorder.start()
      silenceWatcherRef.current = createSilenceWatcher(stream, {
        silenceMs: AUTO_SILENCE_MS,
        onSilence: () => finishRef.current('auto'),
      })
      setPhase('listening')
    }

    void startRecording()
    return () => {
      cancelled = true
      ttsPlayback?.stop()
      silenceWatcherRef.current?.stop()
      silenceWatcherRef.current = null
      if (mediaRecorderRef.current?.state === 'recording') mediaRecorderRef.current.stop()
      streamRef.current?.getTracks().forEach((track) => track.stop())
      streamRef.current = null
    }
  }, [currentQuestion?.generationId, ttsAudio])

  useEffect(() => {
    function handleAck(payload: AudioAckPayload) {
      onAnswerQueued({
        messageId: payload.messageId,
        speakerType: 'SENIOR',
        content: null,
        sttStatus: 'WAITING',
        createdAt: new Date().toISOString(),
      })
    }
    socket.on('audio:ack', handleAck)
    return () => socket.off('audio:ack', handleAck)
  }, [socket, onAnswerQueued])

  function finish(endType: AudioEndType): void {
    const recorder = mediaRecorderRef.current
    const question = currentQuestionRef.current
    if (!recorder || recorder.state !== 'recording' || !question) return

    silenceWatcherRef.current?.stop()
    setPhase('thinking')
    recorder.onstop = () => {
      const blob = new Blob(chunksRef.current, { type: mimeTypeRef.current })
      streamRef.current?.getTracks().forEach((track) => track.stop())
      streamRef.current = null
      void sendVoiceAnswer(
        socket,
        {
          audioTransferId: crypto.randomUUID(),
          questionMessageId: question.messageId,
          generationId: question.generationId,
          mimeType: mimeTypeRef.current,
          capturedAt: new Date().toISOString(),
          endType,
        },
        blob,
      )
    }
    recorder.stop()
  }

  return { phase, finishAnswer: () => finish('manual'), ttsAutoplayBlocked }
}
