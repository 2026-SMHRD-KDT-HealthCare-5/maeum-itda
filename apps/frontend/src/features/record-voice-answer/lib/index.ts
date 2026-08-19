// UC-02 feature-local helpers: 브라우저 녹음 포맷 선택과 묵음 감지.
const CANDIDATE_MIME_TYPES = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4']

export function pickSupportedAudioMimeType(): string {
  for (const mimeType of CANDIDATE_MIME_TYPES) {
    if (typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(mimeType)) {
      return mimeType
    }
  }
  return 'audio/webm'
}

const SILENCE_RMS_THRESHOLD = 0.02

export interface SilenceWatcherOptions {
  // 첫 발화가 시작된 뒤 이만큼(ms) 계속 묵음이면 onSilence를 호출한다.
  silenceMs: number
  onSilence: () => void
  // 이 녹음 구간에서 처음 소리가 감지된 순간 한 번만 호출된다(선택).
  onVoiceDetected?: () => void
}

export interface SilenceWatcherHandle {
  stop: () => void
  // 이 녹음 구간에서 지금까지 한 번이라도 소리가 감지됐는지. 무음인 채로
  // "지금 답변 마치기"를 눌렀을 때 STT로 보내지 않고 거르는 데 쓴다 —
  // Whisper 계열은 무음 입력에도 엉뚱한 문장을 환각(hallucination)하는
  // 경우가 있어 무음 여부를 서버가 아니라 클라이언트에서 먼저 걸러야 한다.
  hasDetectedVoice: () => boolean
}

// 발화 중 묵음이 일정 시간 이어지면 녹음 한 건을 자동 종료한다
// (docs/ws-protocol.md §6 "발화 중 10초 묵음" — 프론트 책임). 아직 한 번도
// 말하지 않은 구간(rms가 처음부터 낮은 경우)은 대상이 아니다 — 그건 AI 질문
// 후 첫 발화 30초/2분 무응답으로 서버가 별도 처리한다.
export function createSilenceWatcher(
  stream: MediaStream,
  { silenceMs, onSilence, onVoiceDetected }: SilenceWatcherOptions,
): SilenceWatcherHandle {
  const audioContext = new AudioContext()
  // iOS Safari 등은 사용자 제스처 없이 만든 AudioContext를 'suspended'로 시작할
  // 수 있다 — resume() 없이 두면 analyser가 데이터를 못 받아 묵음 감지 자체가
  // 조용히 죽는다.
  if (audioContext.state === 'suspended') {
    void audioContext.resume()
  }
  const source = audioContext.createMediaStreamSource(stream)
  const analyser = audioContext.createAnalyser()
  analyser.fftSize = 2048
  source.connect(analyser)

  const buffer = new Uint8Array(analyser.fftSize)
  let lastLoudAt: number | null = null
  let detectedVoice = false
  let stopped = false

  function tick() {
    if (stopped) return
    analyser.getByteTimeDomainData(buffer)
    let sumSquares = 0
    for (const sample of buffer) {
      const normalized = (sample - 128) / 128
      sumSquares += normalized * normalized
    }
    const rms = Math.sqrt(sumSquares / buffer.length)
    const now = performance.now()

    if (rms >= SILENCE_RMS_THRESHOLD) {
      if (!detectedVoice) {
        detectedVoice = true
        onVoiceDetected?.()
      }
      lastLoudAt = now
    } else if (lastLoudAt !== null && now - lastLoudAt >= silenceMs) {
      stopped = true
      onSilence()
      return
    }
    requestAnimationFrame(tick)
  }
  requestAnimationFrame(tick)

  return {
    stop: () => {
      stopped = true
      source.disconnect()
      void audioContext.close()
    },
    hasDetectedVoice: () => detectedVoice,
  }
}

export interface VoiceActivityWatcherHandle {
  stop: () => void
}

// 아직 녹음 중이 아닌 구간(다음 질문을 기다리는 '생각 중', 또는 TTS가 재생 중인
// '질문' 구간)에 시니어가 말을 시작하는 첫 순간을 감지한다 — 감지되면
// onVoiceDetected를 한 번만 부르고 스스로 멈춘다(끼어들기/barge-in 트리거).
// createSilenceWatcher와 반대 방향 조건(첫 큰 소리를 기다림)이라 별도 함수로 둔다.
export function createVoiceActivityWatcher(
  stream: MediaStream,
  { onVoiceDetected }: { onVoiceDetected: () => void },
): VoiceActivityWatcherHandle {
  const audioContext = new AudioContext()
  if (audioContext.state === 'suspended') {
    void audioContext.resume()
  }
  const source = audioContext.createMediaStreamSource(stream)
  const analyser = audioContext.createAnalyser()
  analyser.fftSize = 2048
  source.connect(analyser)

  const buffer = new Uint8Array(analyser.fftSize)
  let stopped = false

  function finish() {
    stopped = true
    source.disconnect()
    void audioContext.close()
  }

  function tick() {
    if (stopped) return
    analyser.getByteTimeDomainData(buffer)
    let sumSquares = 0
    for (const sample of buffer) {
      const normalized = (sample - 128) / 128
      sumSquares += normalized * normalized
    }
    const rms = Math.sqrt(sumSquares / buffer.length)

    if (rms >= SILENCE_RMS_THRESHOLD) {
      finish()
      onVoiceDetected()
      return
    }
    requestAnimationFrame(tick)
  }
  requestAnimationFrame(tick)

  return {
    stop: () => {
      if (!stopped) finish()
    },
  }
}
