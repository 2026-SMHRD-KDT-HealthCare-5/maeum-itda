// 발화 중 pcm16 LE mono(24kHz) 청크를 만들어 live STT로 보낸다.
import { getUnlockedAudioContext } from '../../../shared/lib'

const TARGET_SAMPLE_RATE = 24_000
const TARGET_CHUNK_SAMPLES = 2_400 // 100ms

export interface PcmStreamHandle {
  stop: () => void
}

export function startPcmStream(
  mediaStream: MediaStream,
  onChunk: (pcmBase64: string) => void,
): PcmStreamHandle {
  const audioContext = getUnlockedAudioContext()
  const source = audioContext.createMediaStreamSource(mediaStream)
  // ScriptProcessor는 deprecated이지만 AudioWorklet 없이 폭넓게 동작한다.
  // Chrome은 destination에 연결해야 onaudioprocess가 돈다 — 무음 gain으로 스피커 누출을 막는다.
  const processor = audioContext.createScriptProcessor(4096, 1, 1)
  const mute = audioContext.createGain()
  mute.gain.value = 0

  let pending: number[] = []
  let stopped = false

  processor.onaudioprocess = (event) => {
    if (stopped) return
    const input = event.inputBuffer.getChannelData(0)
    const resampled = resampleLinear(input, audioContext.sampleRate, TARGET_SAMPLE_RATE)
    for (let i = 0; i < resampled.length; i += 1) {
      pending.push(resampled[i])
    }
    while (pending.length >= TARGET_CHUNK_SAMPLES) {
      const frame = pending.slice(0, TARGET_CHUNK_SAMPLES)
      pending = pending.slice(TARGET_CHUNK_SAMPLES)
      onChunk(floatSamplesToPcm16Base64(frame))
    }
  }

  source.connect(processor)
  processor.connect(mute)
  mute.connect(audioContext.destination)

  return {
    stop: () => {
      if (stopped) return
      stopped = true
      processor.onaudioprocess = null
      try {
        source.disconnect()
        processor.disconnect()
        mute.disconnect()
      } catch {
        // 이미 끊긴 노드
      }
    },
  }
}

function resampleLinear(
  input: Float32Array,
  inputRate: number,
  outputRate: number,
): Float32Array {
  if (inputRate === outputRate) return input
  const ratio = inputRate / outputRate
  const outputLength = Math.max(1, Math.floor(input.length / ratio))
  const output = new Float32Array(outputLength)
  for (let i = 0; i < outputLength; i += 1) {
    const position = i * ratio
    const index = Math.floor(position)
    const fraction = position - index
    const a = input[index] ?? 0
    const b = input[Math.min(index + 1, input.length - 1)] ?? 0
    output[i] = a + (b - a) * fraction
  }
  return output
}

function floatSamplesToPcm16Base64(samples: number[]): string {
  const bytes = new Uint8Array(samples.length * 2)
  const view = new DataView(bytes.buffer)
  for (let i = 0; i < samples.length; i += 1) {
    const clipped = Math.max(-1, Math.min(1, samples[i] ?? 0))
    view.setInt16(i * 2, clipped < 0 ? clipped * 0x8000 : clipped * 0x7fff, true)
  }
  let binary = ''
  for (let i = 0; i < bytes.length; i += 1) {
    binary += String.fromCharCode(bytes[i]!)
  }
  return btoa(binary)
}
