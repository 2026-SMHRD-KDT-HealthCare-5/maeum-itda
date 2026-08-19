import { useEffect, useRef, useState } from 'react'
import type { AiQuestionPayload, AudioEndType, WsErrorPayload } from '../../../shared/types'
import type { ChatSocket } from '../../../shared/api'
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
// 'waiting': 마이크는 열려 있지만 이번 녹음 구간에서 아직 말소리가 감지되지 않음
// 'listening': 말소리가 감지되어 실제로 답변을 받는 중 — 지금 질문에 대한 답변이거나
//   다음 질문을 기다리며 받은 추가 답변일 수 있다
// 'thinking': 답변 전송 후 분석 결과와 다음 질문을 기다리는 중(추가 발화 감시는 계속된다)
export type RecordingPhase = 'question' | 'waiting' | 'listening' | 'thinking'

export interface UseRecordVoiceAnswerOptions {
  socket: ChatSocket
  // 현재 답해야 할 AI 질문 — null이면 아직 대화가 시작되지 않은 상태다.
  currentQuestion: AiQuestionPayload | null
  // 이번 질문의 TTS 오디오(있으면). null이면(TTS 생성 실패 등) 재생 없이 곧바로 마이크를 연다.
  ttsAudio?: { base64: string; mimeType: string } | null
  // 이번 녹음 구간에서 한 번도 소리가 감지되지 않은 채로 "지금 답변 마치기"를
  // 눌렀을 때 호출된다 — 이 경우 서버로 보내지 않고 녹음을 계속 듣는다(무음도
  // STT로 보내면 Whisper 계열이 엉뚱한 문장을 환각하는 경우가 있어서다).
  onSilentFinishAttempt?: () => void
  // 녹음 구간에서 소리가 처음 감지된 순간 호출된다 — onSilentFinishAttempt로
  // 띄운 안내를 사용자가 말을 시작하자마자 지우는 데 쓴다(선택).
  onVoiceDetected?: () => void
}

export interface UseRecordVoiceAnswerResult {
  phase: RecordingPhase
  // "지금 답변 마치기" 버튼에 그대로 연결한다.
  finishAnswer: () => void
  // 이번 질문의 TTS 자동재생이 막혀(iOS 등) 소리 없이 텍스트로만 전달됐는지.
  ttsAutoplayBlocked: boolean
}

const AUTO_SILENCE_MS = 3_000

// UC-02: 대화가 시작되면 마이크 권한을 한 번만 받아 대화가 끝날 때까지 유지한다
// (질문마다 다시 열지 않는다). 다슬이가 다음 질문을 TTS로 말하는 동안에는 끼어들기를
// 받지 않는다 — 스피커 소리가 마이크로 새어 들어와(echoCancellation이 재생 시작
// 직후엔 완전히 걸러주지 못함) 사람 목소리로 오인되면서 TTS가 즉시 끊기고 그 잡음이
// 답변으로 전송돼 분석에 실패하는 문제가 있었다(2026-08-19, 끼어들기 제거로 해결).
// TTS가 끝난 뒤에만 마이크를 열어 답변을 받는다. 다음 질문을 기다리는 '생각 중'
// 구간에는 시니어가 먼저 말을 시작하면 그 발화를 지금 질문에 대한 추가 답변으로
// 받는다(이 구간엔 TTS가 재생 중이 아니므로 에코 문제가 없다).
// 사용자가 직접 끝내거나(manual) 묵음이 3초 이어지면(auto) 한 녹음 구간을
// 마쳐 서버로 보낸다. 실제 WebSocket 연동(effect)까지 포함하므로 단위 테스트는
// 이 훅이 호출하는 lib 함수 단위로 한다.
export function useRecordVoiceAnswer({
  socket,
  currentQuestion,
  ttsAudio = null,
  onSilentFinishAttempt,
  onVoiceDetected,
}: UseRecordVoiceAnswerOptions): UseRecordVoiceAnswerResult {
  const [phase, setPhase] = useState<RecordingPhase>('question')
  const [ttsAutoplayBlocked, setTtsAutoplayBlocked] = useState(false)
  const [hasDetectedVoice, setHasDetectedVoice] = useState(false)

  const streamRef = useRef<MediaStream | null>(null)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const mimeTypeRef = useRef('audio/webm')
  const silenceWatcherRef = useRef<SilenceWatcherHandle | null>(null)
  const vadWatcherRef = useRef<VoiceActivityWatcherHandle | null>(null)
  const ttsPlaybackRef = useRef<TtsPlaybackHandle | null>(null)
  // '생각 중'에 다음 답변 녹음을 열 신호(실제 발화 감지 또는 직전 답변 분석
  // 실패)를 기다리는 resolver. 분석 실패 시 이걸 대신 호출해 VAD 감지를
  // 기다리지 않고 곧바로 같은 질문에 대한 녹음을 다시 연다(무한 대기 방지).
  const forceRecordResolverRef = useRef<(() => void) | null>(null)

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

    async function ensureStream(): Promise<MediaStream | null> {
      if (streamRef.current) return streamRef.current
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: { echoCancellation: true },
        })
        streamRef.current = stream
        return stream
      } catch {
        // 마이크 권한 거부 — 답변 없이 서버의 30초 안내/10분 자동 종료에 맡긴다.
        return null
      }
    }

    // 녹음 한 구간을 열고 finish()가 호출될 때까지 기다린다(제출까지 완료된 뒤 resolve).
    function recordSegment(stream: MediaStream): Promise<void> {
      return new Promise((resolve) => {
        resolveSegmentRef.current = resolve
        setPhase('waiting')
        setHasDetectedVoice(false)

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
          onVoiceDetected: () => {
            setHasDetectedVoice(true)
            setPhase('listening')
            onVoiceDetected?.()
          },
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

      if (ttsPlayback) {
        const { autoplayBlocked } = await ttsPlayback.finished
        if (cancelled) return
        setTtsAutoplayBlocked(autoplayBlocked)
      }
      ttsPlaybackRef.current = null
      if (cancelled) return

      await recordSegment(stream)
      if (cancelled) return

      // 다음 질문이 올 때까지 '생각 중' — 그 사이 시니어가 먼저 말을 시작하면
      // 그 발화를 지금 질문에 대한 추가 답변으로 받는다(TTS가 재생 중이 아닌
      // 구간이라 에코로 오탐지될 위험이 없다). 다음 질문이 실제로 도착하면
      // (currentQuestion 변경) 이 effect의 cleanup이 cancelled를 세워 이 루프를 끝낸다.
      while (!cancelled) {
        setPhase('thinking')
        const gotVoice = await new Promise<boolean>((resolve) => {
          forceRecordResolverRef.current = () => resolve(true)
          vadWatcherRef.current = createVoiceActivityWatcher(stream, {
            onVoiceDetected: () => resolve(true),
          })
        })
        forceRecordResolverRef.current = null
        vadWatcherRef.current = null
        if (cancelled || !gotVoice) break
        await recordSegment(stream)
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

  // 방금 보낸 답변의 분석이 실패하면(AUDIO_ANALYSIS_FAILED) '생각 중' 상태로
  // 무한 대기하지 않고 곧바로 같은 질문에 대한 녹음을 다시 연다 — 화면 진입
  // 때와 같은 답변 대기 상태로 되돌아간다(실패 안내 자체는 SeniorConversationPage의
  // error 배너가 담당한다).
  useEffect(() => {
    function handleError(payload: WsErrorPayload) {
      if (payload.code !== 'AUDIO_ANALYSIS_FAILED') return
      forceRecordResolverRef.current?.()
    }
    socket.on('error', handleError)
    return () => socket.off('error', handleError)
  }, [socket])

  function finish(endType: AudioEndType): void {
    const recorder = mediaRecorderRef.current
    const question = currentQuestionRef.current
    if (!recorder || recorder.state !== 'recording' || !question) return
    // 발화가 한 번도 감지되지 않은 채 수동 종료를 시도하면 서버로 보내지 않고
    // 계속 듣는다. auto 종료는 애초에 발화가 있어야만 트리거되므로(묵음 감지
    // 자체가 lastLoudAt 갱신을 전제) 여기서 걸러질 일이 없다.
    if (endType === 'manual' && !hasDetectedVoice) {
      onSilentFinishAttempt?.()
      return
    }

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
