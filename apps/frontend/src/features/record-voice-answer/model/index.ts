import { useEffect, useRef, useState } from 'react'
import type { AiQuestionPayload, AudioAckPayload, AudioEndType } from '../../../shared/types'
import type { ChatSocket } from '../../../shared/api'
import type { ChatMessage } from '../../../entities/conversation'
import { playTtsAudioOnce, type TtsPlaybackHandle } from '../../../shared/lib'
import { sendVoiceAnswer } from '../api'
import {
  createSilenceWatcher,
  createVoiceActivityWatcher,
  pickSupportedAudioMimeType,
  type SilenceWatcherHandle,
  type VoiceActivityWatcherHandle,
} from '../lib'

// SeniorConversationPage가 캐릭터 이미지를 고르는 데 쓰는 상태.
// 'question': 새 AI 질문의 TTS가 재생 중(또는 TTS가 없어 곧바로 다음 단계로 넘어가는 중)
// 'listening': 실제로 녹음 중 — 지금 질문에 대한 답변이거나, 끼어들기로 이전
//   질문에 추가된 답변이거나, 다음 질문을 기다리며 받은 추가 답변일 수 있다
// 'thinking': 답변 전송 후 다음 질문을 기다리는 중(끼어들기 감시는 계속된다)
export type RecordingPhase = 'question' | 'listening' | 'thinking'

// 지금 열려 있는 녹음이 어느 질문에 대한 답변으로 제출돼야 하는지.
// 'current': 지금 화면의 질문(정상 답변, 또는 같은 질문에 대한 추가 답변).
// 'previous': 다슬이가 다음 질문을 말하는 도중 시니어가 끼어든 경우 — 그 발화는
//   지금 질문이 아니라 "직전 질문"에 대한 추가 답변으로 저장한다.
type RecordingTarget = 'current' | 'previous'

export interface UseRecordVoiceAnswerOptions {
  socket: ChatSocket
  // 현재 답해야 할 AI 질문 — null이면 아직 대화가 시작되지 않은 상태다.
  currentQuestion: AiQuestionPayload | null
  // audio:ack로 messageId가 확정된 시니어 답변을 대화 목록에 추가한다.
  // content는 STT 완료 전이라 null이다(docs/ws-protocol.md §5.4).
  onAnswerQueued: (message: ChatMessage) => void
  // 이번 질문의 TTS 오디오(있으면). 백엔드가 아직 tts:audio로 실제 오디오를
  // 보내지 않는 동안(8/18 예정)은 항상 null이고, 이 경우 TTS 재생 없이 곧바로
  // 마이크를 연다(끼어들기도 발생할 수 없다 — 다슬이가 말하는 중이 아니므로).
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

// UC-02: 대화가 시작되면 마이크 권한을 한 번만 받아 대화가 끝날 때까지 유지한다
// (질문마다 다시 열지 않음 — 그래야 다슬이가 다음 질문을 말하는 도중이나 다음
// 질문을 준비하는 도중에도 시니어가 끼어들 수 있다). 시니어가 말을 시작하면:
// - 다슬이가 아직 말하지 않았거나(TTS 없음/이미 끝남) 다음 질문을 기다리는
//   '생각 중'이면 → 지금 질문에 대한 (추가) 답변으로 녹음한다.
// - 다슬이가 다음 질문을 TTS로 말하는 중이면 → 그 재생을 멈추고, 시니어의
//   발화가 끝날 때까지는 "직전 질문"에 대한 추가 답변으로 녹음한 뒤, 곧바로
//   이어서 지금(끼어든) 질문에 대한 실제 답변 녹음으로 넘어간다(질문을 다시
//   말하지 않는다 — 이미 끼어들어 응답 중이므로).
// 사용자가 직접 끝내거나(manual) 묵음이 10초 이어지면(auto) 한 녹음 구간을
// 마쳐 서버로 보낸다. 실제 WebSocket 연동(effect)까지 포함하므로 단위 테스트는
// 이 훅이 호출하는 lib 함수 단위로 한다.
export function useRecordVoiceAnswer({
  socket,
  currentQuestion,
  onAnswerQueued,
  ttsAudio = null,
}: UseRecordVoiceAnswerOptions): UseRecordVoiceAnswerResult {
  const [phase, setPhase] = useState<RecordingPhase>('question')
  const [ttsAutoplayBlocked, setTtsAutoplayBlocked] = useState(false)

  const streamRef = useRef<MediaStream | null>(null)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const mimeTypeRef = useRef('audio/webm')
  const silenceWatcherRef = useRef<SilenceWatcherHandle | null>(null)
  const vadWatcherRef = useRef<VoiceActivityWatcherHandle | null>(null)
  const ttsPlaybackRef = useRef<TtsPlaybackHandle | null>(null)

  // 지금 열려 있는 녹음이 어느 질문(target)을 향하는지, 그리고 그 target이
  // 'previous'일 때 실제로 어떤 질문 객체를 가리키는지. lastQuestionRef는 이
  // 훅의 메인 effect에서만 갱신한다(다른 effect의 currentQuestionRef 갱신과
  // 타이밍이 엮이지 않게).
  const recordingTargetRef = useRef<RecordingTarget>('current')
  const lastQuestionRef = useRef<AiQuestionPayload | null>(null)
  const turnPreviousQuestionRef = useRef<AiQuestionPayload | null>(null)
  const currentQuestionRef = useRef(currentQuestion)
  const resolveSegmentRef = useRef<(() => void) | null>(null)

  // 최신 finish를 effect 의존성 없이 부르기 위한 latest-ref. 렌더 중이 아니라
  // 커밋 이후(effect)에 갱신해야 한다(react-hooks/refs).
  const finishRef = useRef<(endType: AudioEndType) => void>(() => {})
  useEffect(() => {
    currentQuestionRef.current = currentQuestion
    finishRef.current = finish
  })

  // 마이크 스트림은 대화 전체에서 한 번만 열고, 컴포넌트가 사라질 때만 닫는다.
  useEffect(() => {
    return () => {
      streamRef.current?.getTracks().forEach((track) => track.stop())
      streamRef.current = null
    }
  }, [])

  useEffect(() => {
    if (!currentQuestion?.generationId) return
    let cancelled = false

    const previousQuestion = lastQuestionRef.current
    lastQuestionRef.current = currentQuestion
    turnPreviousQuestionRef.current = previousQuestion

    async function ensureStream(): Promise<MediaStream | null> {
      if (streamRef.current) return streamRef.current
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: { echoCancellation: true },
        })
        streamRef.current = stream
        return stream
      } catch {
        // 마이크 권한 거부 — 답변 없이 서버의 30초 안내/2분 자동 종료에 맡긴다.
        return null
      }
    }

    // 녹음 한 구간을 열고 finish()가 호출될 때까지 기다린다(제출까지 완료된 뒤 resolve).
    function recordSegment(target: RecordingTarget, stream: MediaStream): Promise<void> {
      return new Promise((resolve) => {
        recordingTargetRef.current = target
        resolveSegmentRef.current = resolve
        setPhase('listening')

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
      })
    }

    async function runTurn() {
      const stream = await ensureStream()
      if (cancelled || !stream) return

      setPhase('question')
      setTtsAutoplayBlocked(false)
      const ttsPlayback = ttsAudio ? playTtsAudioOnce(ttsAudio.base64, ttsAudio.mimeType) : null
      ttsPlaybackRef.current = ttsPlayback

      let bargedIn = false
      if (ttsPlayback) {
        await new Promise<void>((resolve) => {
          let settled = false
          function settle() {
            if (settled) return
            settled = true
            vadWatcherRef.current?.stop()
            vadWatcherRef.current = null
            resolve()
          }
          vadWatcherRef.current = createVoiceActivityWatcher(stream, {
            onVoiceDetected: () => {
              bargedIn = true
              settle()
            },
          })
          void ttsPlayback.finished.then(() => settle())
        })
        if (cancelled) return
        if (bargedIn) {
          ttsPlayback.stop()
        } else {
          const { autoplayBlocked } = await ttsPlayback.finished
          if (cancelled) return
          setTtsAutoplayBlocked(autoplayBlocked)
        }
      }
      ttsPlaybackRef.current = null
      if (cancelled) return

      // 끼어든 발화는 먼저 "직전 질문"에 대한 추가 답변으로 마무리한다 — 단,
      // 대화의 첫 질문이라 직전 질문 자체가 없으면 그 단계는 건너뛴다(붙일 곳이
      // 없는데 target='previous'로 녹음을 열면 finish()가 question을 못 찾아
      // 영원히 멈춘다).
      if (bargedIn && turnPreviousQuestionRef.current) {
        await recordSegment('previous', stream)
        if (cancelled) return
      }
      // 질문을 다시 말하지 않고 곧바로 지금(끼어든) 질문에 대한 답변을 받는다.
      await recordSegment('current', stream)
      if (cancelled) return

      // 다음 질문이 올 때까지 '생각 중' — 그 사이 끼어드는 발화는 지금 질문에
      // 대한 추가 답변으로 받는다. 다음 질문이 실제로 도착하면(currentQuestion
      // 변경) 이 effect의 cleanup이 cancelled를 세워 이 루프를 끝낸다.
      while (!cancelled) {
        setPhase('thinking')
        const gotVoice = await new Promise<boolean>((resolve) => {
          vadWatcherRef.current = createVoiceActivityWatcher(stream, {
            onVoiceDetected: () => resolve(true),
          })
        })
        vadWatcherRef.current = null
        if (cancelled || !gotVoice) break
        await recordSegment('current', stream)
        if (cancelled) break
      }
    }

    void runTurn()
    return () => {
      cancelled = true
      ttsPlaybackRef.current?.stop()
      ttsPlaybackRef.current = null
      vadWatcherRef.current?.stop()
      vadWatcherRef.current = null
      silenceWatcherRef.current?.stop()
      silenceWatcherRef.current = null
      if (mediaRecorderRef.current?.state === 'recording') mediaRecorderRef.current.stop()
      resolveSegmentRef.current = null
    }
    // currentQuestion 전체가 아니라 generationId로만 키를 잡는다 — chat:restored로
    // 같은 질문이 새 객체(참조만 다름)로 다시 오는 경우까지 이 effect를 다시
    // 돌리면 진행 중이던 턴을 불필요하게 재시작하게 된다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
    const target = recordingTargetRef.current
    const question =
      target === 'previous' ? turnPreviousQuestionRef.current : currentQuestionRef.current
    if (!recorder || recorder.state !== 'recording' || !question) return

    silenceWatcherRef.current?.stop()
    silenceWatcherRef.current = null
    const resolveSegment = resolveSegmentRef.current
    recorder.onstop = () => {
      const blob = new Blob(chunksRef.current, { type: mimeTypeRef.current })
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
      resolveSegment?.()
    }
    recorder.stop()
  }

  return { phase, finishAnswer: () => finish('manual'), ttsAutoplayBlocked }
}
