// UC-02 feature-local helpers: 브라우저 녹음 포맷 선택과 발화·묵음 감지.
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

// RMS(음량)만으로는 "소리가 났다"는 것만 알 뿐, 그게 말인지 바람 소리·기침
// 같은 비언어 소음인지 구분하지 못한다 — 실제로 바람 소리를 "Hello, world!"로,
// 무음을 "Tienes que estudiar."로 환각(hallucination)하는 사례가 있었다. 사람
// 목소리(특히 모음의 포먼트)는 전화 대역(300~3400Hz)에 에너지가 몰리는 반면,
// 바람 소리 같은 저음 럼블·광대역 잡음은 이 대역에 에너지가 고르게 퍼진다는
// 성질을 이용해 걸러낸다. 완전한 ML 기반 VAD(예: Silero VAD)만큼 정확하지는
// 않지만, 별도 모델 로딩 없이 이미 쓰던 Web Audio AnalyserNode만으로 구현
// 가능한 실용적 근사치다. 아래 두 상수는 실측 튜닝값이 아니라 전화 대역 표준을
// 참고한 시작값이므로, 오탐(false positive/negative)이 계속 보이면 조정한다.
const SPEECH_BAND_MIN_HZ = 300
const SPEECH_BAND_MAX_HZ = 3400
const SPEECH_BAND_ENERGY_RATIO_THRESHOLD = 0.35
// 프레임 하나가 우연히 조건을 만족해도 바로 "발화"로 확정하지 않고 이 시간(ms)만큼
// 연속돼야 확정한다 — 순간적인 잡음 튐(클릭·기침·의자 소리 등)으로 오탐지하는 걸
// 줄인다. 프레임 "개수"가 아니라 시간으로 재는 이유: requestAnimationFrame 간격은
// 화면 주사율에 따라 달라져서(60Hz면 프레임 3개가 ~50ms지만 144Hz면 ~21ms), 프레임
// 개수 기준은 기기마다 실제 확정 시간이 달라진다. 150ms면 흔한 순간 잡음은 걸러내면서
// 실제 발화(음절 하나도 대개 150ms를 넘는다)는 놓치지 않는다.
const VOICE_CONFIRM_MS = 150

// 한 프레임이 "사람 말소리에 가까운지" 판단한다: 먼저 RMS로 최소 음량을
// 넘는지 보고(완전한 무음 배제), 넘으면 주파수 분포가 사람 목소리 대역에
// 집중돼 있는지를 추가로 확인한다.
function isSpeechLikeFrame(
  analyser: AnalyserNode,
  sampleRate: number,
  timeDomainBuffer: Uint8Array<ArrayBuffer>,
  frequencyBuffer: Uint8Array<ArrayBuffer>,
): boolean {
  analyser.getByteTimeDomainData(timeDomainBuffer)
  let sumSquares = 0
  for (const sample of timeDomainBuffer) {
    const normalized = (sample - 128) / 128
    sumSquares += normalized * normalized
  }
  const rms = Math.sqrt(sumSquares / timeDomainBuffer.length)
  if (rms < SILENCE_RMS_THRESHOLD) return false

  analyser.getByteFrequencyData(frequencyBuffer)
  const hzPerBin = sampleRate / analyser.fftSize
  const minBin = Math.max(0, Math.floor(SPEECH_BAND_MIN_HZ / hzPerBin))
  const maxBin = Math.min(frequencyBuffer.length - 1, Math.ceil(SPEECH_BAND_MAX_HZ / hzPerBin))

  let speechBandEnergy = 0
  let totalEnergy = 0
  for (let i = 0; i < frequencyBuffer.length; i += 1) {
    totalEnergy += frequencyBuffer[i]
    if (i >= minBin && i <= maxBin) speechBandEnergy += frequencyBuffer[i]
  }
  if (totalEnergy === 0) return false
  return speechBandEnergy / totalEnergy >= SPEECH_BAND_ENERGY_RATIO_THRESHOLD
}

export interface SilenceWatcherOptions {
  // 첫 발화가 시작된 뒤 이만큼(ms) 계속 묵음이면 onSilence를 호출한다.
  silenceMs: number
  onSilence: () => void
  // 이 녹음 구간에서 처음 말소리가 감지된 순간 한 번만 호출된다(선택).
  onVoiceDetected?: () => void
}

export interface SilenceWatcherHandle {
  stop: () => void
  // 이 녹음 구간에서 지금까지 한 번이라도 말소리가 감지됐는지. 무음(또는
  // 바람 소리 같은 비언어 소음)인 채로 "지금 답변 마치기"를 눌렀을 때 STT로
  // 보내지 않고 거르는 데 쓴다 — Whisper 계열은 그런 입력에도 엉뚱한 문장을
  // 환각하는 경우가 있어 서버가 아니라 클라이언트에서 먼저 걸러야 한다.
  hasDetectedVoice: () => boolean
}

// 발화 중 묵음이 일정 시간 이어지면 녹음 한 건을 자동 종료한다
// (docs/ws-protocol.md §6 "발화 중 10초 묵음" — 프론트 책임). 아직 한 번도
// 말하지 않은 구간은 대상이 아니다 — 그건 AI 질문 후 첫 발화 30초/2분
// 무응답으로 서버가 별도 처리한다.
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

  const timeDomainBuffer = new Uint8Array(analyser.fftSize)
  const frequencyBuffer = new Uint8Array(analyser.frequencyBinCount)
  let lastLoudAt: number | null = null
  let detectedVoice = false
  let speechLikeSince: number | null = null
  let stopped = false

  function tick() {
    if (stopped) return
    const now = performance.now()

    if (isSpeechLikeFrame(analyser, audioContext.sampleRate, timeDomainBuffer, frequencyBuffer)) {
      if (speechLikeSince === null) speechLikeSince = now
      if (now - speechLikeSince >= VOICE_CONFIRM_MS) {
        lastLoudAt = now
        if (!detectedVoice) {
          detectedVoice = true
          onVoiceDetected?.()
        }
      }
    } else {
      speechLikeSince = null
      if (lastLoudAt !== null && now - lastLoudAt >= silenceMs) {
        stopped = true
        onSilence()
        return
      }
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
