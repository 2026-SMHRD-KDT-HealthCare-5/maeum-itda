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
}

export interface SilenceWatcherHandle {
  stop: () => void
}

// 발화 중 묵음이 일정 시간 이어지면 녹음 한 건을 자동 종료한다
// (docs/ws-protocol.md §6 "발화 중 10초 묵음" — 프론트 책임). 아직 한 번도
// 말하지 않은 구간(rms가 처음부터 낮은 경우)은 대상이 아니다 — 그건 AI 질문
// 후 첫 발화 30초/2분 무응답으로 서버가 별도 처리한다.
export function createSilenceWatcher(
  stream: MediaStream,
  { silenceMs, onSilence }: SilenceWatcherOptions,
): SilenceWatcherHandle {
  const audioContext = new AudioContext()
  const source = audioContext.createMediaStreamSource(stream)
  const analyser = audioContext.createAnalyser()
  analyser.fftSize = 2048
  source.connect(analyser)

  const buffer = new Uint8Array(analyser.fftSize)
  let lastLoudAt: number | null = null
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
  }
}
