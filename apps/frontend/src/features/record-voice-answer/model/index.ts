import { useEffect, useRef, useState } from 'react'
import type { AiQuestionPayload, AudioEndType, WsErrorPayload } from '../../../shared/types'
import type { ChatSocket } from '../../../shared/api'
import { playTtsAudioStream, type TtsPlaybackHandle } from '../../../shared/lib'
import { sendVoiceAnswer } from '../api'
import {
  createSilenceWatcher,
  pickSupportedAudioMimeType,
  startPcmStream,
  type PcmStreamHandle,
  type SilenceWatcherHandle,
} from '../lib'

// SeniorConversationPage가 캐릭터 이미지를 고르는 데 쓰는 상태.
// 'question': 새 AI 질문의 TTS가 재생 중(또는 TTS가 없어 곧바로 다음 단계로 넘어가는 중)
// 'waiting': 마이크는 열려 있지만 이번 녹음 구간에서 아직 말소리가 감지되지 않음
// 'listening': 말소리가 감지되어 실제로 답변을 받는 중
// 'thinking': 답변 전송 후 분석 결과와 다음 질문을 기다리는 중 — 분석이 실패하면
//   같은 질문에 대한 녹음을 다시 열지만, 그 외에는 추가 발화를 받지 않는다
//   (2026-08-21 결정: 이미 3초 묵음으로 답변을 마쳤다고 판단했으므로 분석 중엔
//   더 듣지 않는다 — 아래 runTurn() 참고)
export type RecordingPhase = 'question' | 'waiting' | 'listening' | 'thinking'

export interface UseRecordVoiceAnswerOptions {
  socket: ChatSocket
  // 현재 답해야 할 AI 질문 — null이면 아직 대화가 시작되지 않은 상태다.
  currentQuestion: AiQuestionPayload | null
  // 이번 질문의 TTS를 스트리밍으로 받아올 URL(있으면). null이면(TTS 생성 실패 등)
  // 재생 없이 곧바로 마이크를 연다.
  ttsStreamUrl?: string | null
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
  // "지금 답변할게요" 버튼(질문 재생 중에만 노출)에 그대로 연결한다 — 다슬이의
  // TTS를 끝까지 듣지 않고 곧바로 마이크를 연다. VAD로 끼어들기를 감지하는
  // 방식은 스피커 소리가 마이크로 새어 들어와 오작동했던 문제로 이미 제거됐지만
  // (2026-08-19), 이건 음성 감지가 아니라 사용자가 직접 누르는 버튼이라 그
  // 에코 문제와 무관하다.
  skipQuestion: () => void
  // 이번 질문의 TTS 자동재생이 막혀(iOS 등) 소리 없이 텍스트로만 전달됐는지.
  ttsAutoplayBlocked: boolean
}

const AUTO_SILENCE_MS = 3_000
// AUDIO_ANALYSIS_FAILED 수신 시 발화 없이도 마이크를 강제로 재개방하는 재시도
// 횟수 상한(질문마다 초기화). 상한이 없으면 ai-server가 계속 실패할 때 발화
// 없는 세그먼트가 계속 제출되며 같은 질문의 답변 개수 상한(MAX_ANSWER_SEGMENTS_
// PER_QUESTION, 백엔드)까지 소모해버릴 수 있다 — 상한을 넘으면 더 이상 자동으로
// 재개방하지 않는다(분석 중엔 추가 발화도 듣지 않으므로, 그 뒤로는 다음 질문이
// 올 때까지 '생각 중'에 머문다).
const MAX_AUTO_ANALYSIS_RETRIES = 2
// 후속 질문은 텍스트(currentQuestion)가 먼저 도착하고 TTS 스트리밍 경로는 단기
// 토큰 발급이 끝나는 대로 별도로 뒤이어 온다(백엔드 QuestionDeliveryService.
// deliverTtsToken) — 그래서 이 훅이 실행되는 시점엔 ttsStreamUrl이 아직 null인
// 경우가 흔하다. 무한정 기다리지 않고 이 시간만큼만 기다렸다가, 그래도 안 오면
// 텍스트만으로 곧바로 마이크를 연다(TTS 생성 실패와 동일하게 취급).
const TTS_WAIT_TIMEOUT_MS = 5_000

// UC-02: 대화가 시작되면 마이크 권한을 한 번만 받아 대화가 끝날 때까지 유지한다
// (질문마다 다시 열지 않는다). 다슬이가 다음 질문을 TTS로 말하는 동안에는 끼어들기를
// 받지 않는다 — 스피커 소리가 마이크로 새어 들어와(echoCancellation이 재생 시작
// 직후엔 완전히 걸러주지 못함) 사람 목소리로 오인되면서 TTS가 즉시 끊기고 그 잡음이
// 답변으로 전송돼 분석에 실패하는 문제가 있었다(2026-08-19, 끼어들기 제거로 해결).
// TTS가 끝난 뒤에만 마이크를 열어 답변을 받는다. 답변을 보내고 나면 '생각 중'으로
// 넘어가 다음 질문을 기다리며, 이 구간에는 추가 발화를 듣지 않는다(2026-08-21
// 결정 — 이미 3초 묵음으로 이번 답변을 마쳤다고 판단했으므로, 시니어가 다시 말해도
// 다음 질문이 올 때까지는 새 녹음을 열지 않는다). 분석이 실패하면(AUDIO_ANALYSIS_
// FAILED) 예외적으로 같은 질문에 대한 녹음을 다시 연다.
// 사용자가 직접 끝내거나(manual) 묵음이 3초 이어지면(auto) 한 녹음 구간을
// 마쳐 서버로 보낸다. 실제 WebSocket 연동(effect)까지 포함하므로 단위 테스트는
// 이 훅이 호출하는 lib 함수 단위로 한다.
export function useRecordVoiceAnswer({
  socket,
  currentQuestion,
  ttsStreamUrl = null,
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
  const pcmStreamRef = useRef<PcmStreamHandle | null>(null)
  const ttsPlaybackRef = useRef<TtsPlaybackHandle | null>(null)
  // '생각 중'에 분석 실패 시 같은 질문에 대한 녹음을 다시 열 신호를 기다리는
  // resolver(무한 대기 방지) — 그 외에는 이 대기를 풀 방법이 없다(2026-08-21
  // 결정: 분석 중엔 추가 발화를 듣지 않음, 아래 runTurn() 참고).
  const forceRecordResolverRef = useRef<(() => void) | null>(null)
  // 이번 질문에서 AUDIO_ANALYSIS_FAILED로 강제 재개방한 횟수 — runTurn() 시작 시
  // (새 질문마다) 0으로 되돌린다.
  const autoAnalysisRetriesRef = useRef(0)

  const currentQuestionRef = useRef(currentQuestion)
  // finish()가 recorder.stop()을 부를 때 함께 넘길 endType — recorder.onstop
  // 핸들러가 recordSegment() 시점에 미리 걸리기 때문에(아래 참고) finish()가
  // 직접 endType을 알려줄 방법이 필요하다.
  const pendingEndTypeRef = useRef<AudioEndType>('auto')

  // 최신 finish를 effect 의존성 없이 부르기 위한 latest-ref. 렌더 중이 아니라
  // 커밋 이후(effect)에 갱신해야 한다(react-hooks/refs).
  const finishRef = useRef<(endType: AudioEndType) => void>(() => {})
  useEffect(() => {
    currentQuestionRef.current = currentQuestion
    finishRef.current = finish
  })

  // ttsStreamUrl을 아래 큰 effect의 의존성에 넣지 않는다 — currentQuestion과 별도로
  // 나중에 도착하는데, 의존성에 넣으면 그때마다 effect가 재시작되면서 이미 진행
  // 중이던 녹음까지 멈추고 처음부터 다시 시작하게 된다. 대신 ref로만 최신값을
  // 들고, runTurn()이 TTS를 기다리는 중이면 resolver를 불러 깨운다.
  const ttsStreamUrlRef = useRef(ttsStreamUrl)
  const ttsArrivedResolverRef = useRef<(() => void) | null>(null)
  const ttsWaitTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => {
    ttsStreamUrlRef.current = ttsStreamUrl
    if (ttsStreamUrl) ttsArrivedResolverRef.current?.()
  }, [ttsStreamUrl])

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
        setPhase('waiting')
        setHasDetectedVoice(false)

        const mimeType = pickSupportedAudioMimeType()
        mimeTypeRef.current = mimeType
        chunksRef.current = []
        const recorder = new MediaRecorder(stream, { mimeType })
        recorder.ondataavailable = (event) => {
          if (event.data.size > 0) chunksRef.current.push(event.data)
        }

        // finish()가 recorder.stop()을 불러 정상 종료되는 경우가 보통이지만,
        // 마이크 권한 회수·장치 분리 등으로 트랙이 죽으면 브라우저가 recorder를
        // 스스로 멈춘다(onerror, 뒤이어 onstop) — finish() 호출 전에 이미
        // state가 'inactive'가 되어버려서, onstop을 finish() 안에서 그때서야
        // 걸면 이미 놓친 이벤트라 아무 반응도 못 하고 대화가 영원히 멈춘다.
        // 그래서 여기서 미리 걸어두고, 멈추는 경로가 뭐든 한 번만 처리한다.
        let settled = false
        const settle = (submit: boolean) => {
          if (settled) return
          settled = true
          pcmStreamRef.current?.stop()
          pcmStreamRef.current = null
          const question = currentQuestionRef.current
          // effect가 이미 정리된(새 질문 도착·언마운트) 뒤라면 제출하지 않는다 —
          // onstop/onerror는 비동기로 나중에 도착하므로, 그 사이 currentQuestionRef가
          // 다음 질문으로 바뀌어 있을 수 있어 지금 청산되는 답변을 잘못된 질문에
          // 붙여 제출하면 안 된다(effect cleanup의 mediaRecorderRef.stop() 호출 참고).
          if (submit && !cancelled && question && chunksRef.current.length > 0) {
            void sendVoiceAnswer(
              socket,
              {
                audioTransferId: crypto.randomUUID(),
                questionMessageId: question.messageId,
                generationId: question.generationId,
                mimeType: mimeTypeRef.current,
                capturedAt: new Date().toISOString(),
                endType: pendingEndTypeRef.current,
              },
              new Blob(chunksRef.current, { type: mimeTypeRef.current }),
            )
          }
          resolve()
        }
        recorder.onstop = () => settle(true)
        // 트랙이 죽어 recorder가 스스로 끝난 경우: 그때까지 모인 조각이 있으면
        // 그대로 제출을 시도해 백엔드의 기존 분석-실패 복구 경로(재녹음 재개)를
        // 타게 하고, 아무것도 못 모았으면 제출 없이 다음 시도로 넘어간다 —
        // 어느 쪽이든 대기 중인 Promise는 반드시 resolve해서 runTurn()이
        // 영원히 멈추지 않게 한다.
        recorder.onerror = () => settle(chunksRef.current.length > 0)

        mediaRecorderRef.current = recorder
        recorder.start()
        silenceWatcherRef.current = createSilenceWatcher(stream, {
          silenceMs: AUTO_SILENCE_MS,
          onSilence: () => finishRef.current('auto'),
          onVoiceDetected: () => {
            setHasDetectedVoice(true)
            setPhase('listening')
            onVoiceDetected?.()
            // 말소리가 확인된 뒤에만 live STT로 PCM을 보낸다 — 대기 중 무음이
            // gpt-live-transcribe 환각을 일으키는 걸 줄인다.
            if (!pcmStreamRef.current) {
              const question = currentQuestionRef.current
              if (question) {
                pcmStreamRef.current = startPcmStream(stream, (pcmBase64) => {
                  socket.sendAudioPcm({
                    questionMessageId: question.messageId,
                    generationId: question.generationId,
                    pcmBase64,
                  })
                })
              }
            }
          },
        })
      })
    }

    async function runTurn() {
      const stream = await ensureStream()
      if (cancelled || !stream) return

      autoAnalysisRetriesRef.current = 0
      setPhase('question')
      setTtsAutoplayBlocked(false)
      if (!ttsStreamUrlRef.current) {
        // TTS가 아직 합성 중일 수 있다 — 잠깐만 기다렸다가, 그래도 안 오면
        // 텍스트만으로 넘어간다(TTS 생성 실패와 동일하게 취급).
        await new Promise<void>((resolve) => {
          const timeout = setTimeout(resolve, TTS_WAIT_TIMEOUT_MS)
          ttsWaitTimeoutRef.current = timeout
          ttsArrivedResolverRef.current = () => {
            clearTimeout(timeout)
            resolve()
          }
        })
        ttsWaitTimeoutRef.current = null
        ttsArrivedResolverRef.current = null
        if (cancelled) return
      }
      const ttsUrl = ttsStreamUrlRef.current
      const ttsPlayback = ttsUrl ? playTtsAudioStream(ttsUrl) : null
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

      // 다음 질문이 올 때까지 '생각 중'으로 대기한다 — 다음 질문이 실제로 도착하면
      // (currentQuestion 변경) 이 effect의 cleanup이 cancelled를 세워 이 루프를
      // 끝낸다. 분석이 실패하면(AUDIO_ANALYSIS_FAILED, 아래 handleError) 예외적으로
      // forceRecordResolverRef가 이 대기를 풀어 같은 질문에 대한 녹음을 다시 연다 —
      // 그 외에는(분석이 정상 진행 중이면) 시니어가 다시 말해도 새 녹음을 열지 않는다.
      while (!cancelled) {
        setPhase('thinking')
        await new Promise<void>((resolve) => {
          forceRecordResolverRef.current = resolve
        })
        forceRecordResolverRef.current = null
        if (cancelled) break
        await recordSegment(stream)
        if (cancelled) break
      }
    }

    void runTurn()
    return () => {
      cancelled = true
      if (ttsWaitTimeoutRef.current) clearTimeout(ttsWaitTimeoutRef.current)
      ttsWaitTimeoutRef.current = null
      ttsArrivedResolverRef.current = null
      ttsPlaybackRef.current?.stop()
      ttsPlaybackRef.current = null
      silenceWatcherRef.current?.stop()
      silenceWatcherRef.current = null
      pcmStreamRef.current?.stop()
      pcmStreamRef.current = null
      if (mediaRecorderRef.current?.state === 'recording') mediaRecorderRef.current.stop()
    }
    // currentQuestion 전체가 아니라 generationId로만 키를 잡는다 — chat:restored로
    // 같은 질문이 새 객체(참조만 다름)로 다시 오는 경우까지 이 effect를 다시
    // 돌리면 진행 중이던 턴을 불필요하게 재시작하게 된다. ttsStreamUrl도 일부러
    // 빼둔다 — 위 ttsStreamUrlRef 동기화 effect 설명 참고.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentQuestion?.generationId])

  // 방금 보낸 답변의 분석이 실패하면(AUDIO_ANALYSIS_FAILED) '생각 중' 상태로
  // 무한 대기하지 않고 곧바로 같은 질문에 대한 녹음을 다시 연다 — 화면 진입
  // 때와 같은 답변 대기 상태로 되돌아간다(실패 안내 자체는 SeniorConversationPage의
  // error 배너가 담당한다).
  useEffect(() => {
    function handleError(payload: WsErrorPayload) {
      if (payload.code !== 'AUDIO_ANALYSIS_FAILED') return
      // 상한에 닿으면 더 이상 강제 재개방하지 않는다 — '생각 중'엔 추가 발화도
      // 듣지 않으므로(위 runTurn() 참고), ai-server가 계속 실패하는 극단적인
      // 경우엔 다음 질문이 올 때까지 '생각 중'에 머문다(실패 안내 배너는 계속
      // 뜬다). 상한을 두는 목적은 그 반복 실패가 답변 개수 상한을 조용히
      // 소모하는 걸 막는 것이지, 이 경우까지 스스로 복구시키는 게 아니다.
      if (autoAnalysisRetriesRef.current >= MAX_AUTO_ANALYSIS_RETRIES) return
      autoAnalysisRetriesRef.current += 1
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
    pcmStreamRef.current?.stop()
    pcmStreamRef.current = null
    pendingEndTypeRef.current = endType
    recorder.stop()
  }

  // 질문 재생 중(TTS 도착 대기 포함)에만 의미가 있다 — 그 외 상태에서 호출되면
  // 아무 것도 하지 않는다.
  function skipQuestion(): void {
    if (phase !== 'question') return
    if (ttsWaitTimeoutRef.current) clearTimeout(ttsWaitTimeoutRef.current)
    ttsWaitTimeoutRef.current = null
    // TTS URL을 아직 기다리는 중이면(도착 전) 그 대기부터 곧바로 끝낸다.
    ttsArrivedResolverRef.current?.()
    ttsArrivedResolverRef.current = null
    // 이미 재생 중이면 멈추고 재생 완료 Promise를 즉시 resolve한다 — runTurn()이
    // await 중인 ttsPlayback.finished가 곧바로 풀려 recordSegment()로 넘어간다.
    ttsPlaybackRef.current?.stop()
  }

  return { phase, finishAnswer: () => finish('manual'), skipQuestion, ttsAutoplayBlocked }
}
