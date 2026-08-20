import { useEffect, useRef, useState } from 'react'

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('ko-KR', { timeZone: 'Asia/Seoul' })
}

// 로딩 스피너 깜빡임 방지: isPending이 delay(ms) 안에 끝나면 스피너를 아예 띄우지
// 않고(빠른 화면은 스피너 없이 넘어감), 한 번 뜬 뒤엔 minDuration(ms)만큼은
// 유지해서 순간적으로 나타났다 사라지는 걸 막는다.
export function useDelayedPending(
  isPending: boolean,
  { delay = 200, minDuration = 500 }: { delay?: number; minDuration?: number } = {},
): boolean {
  const [show, setShow] = useState(false)
  const shownAtRef = useRef<number | null>(null)

  useEffect(() => {
    if (isPending) {
      const timer = setTimeout(() => {
        shownAtRef.current = Date.now()
        setShow(true)
      }, delay)
      return () => clearTimeout(timer)
    }

    if (shownAtRef.current === null) {
      setShow(false)
      return
    }

    const remaining = Math.max(0, minDuration - (Date.now() - shownAtRef.current))
    const timer = setTimeout(() => {
      shownAtRef.current = null
      setShow(false)
    }, remaining)
    return () => clearTimeout(timer)
  }, [isPending, delay, minDuration])

  return show
}

export interface TtsPlaybackHandle {
  // 재생이 끝나거나(ended) 아예 시작하지 못했으면(autoplay 차단, 디코딩 실패
  // 등) resolve된다 — 호출부는 이 promise를 기다렸다가 다음 동작(마이크 열기
  // 등)을 이어가면 된다. autoplayBlocked가 true면 소리 없이 넘어간 것이므로
  // 호출부가 텍스트 전용 폴백을 보여줄지 판단하는 데 쓴다.
  finished: Promise<{ autoplayBlocked: boolean }>
  stop: () => void
}

// base64로 인코딩된 TTS 오디오를 디코드해서 한 번 재생한다. iOS/모바일
// 브라우저는 사용자 제스처 없는 자동재생을 막을 수 있어(NotAllowedError),
// play()가 거부되면 autoplayBlocked=true로 즉시 종료 처리한다 — 소리만 못
// 듣고 넘어갈 뿐 대화 흐름(마이크 열기 등)이 막히면 안 되기 때문이다.
export function playTtsAudioOnce(ttsAudioBase64: string, ttsMimeType: string): TtsPlaybackHandle {
  const objectUrl = base64ToObjectUrl(ttsAudioBase64, ttsMimeType)
  const audio = new Audio(objectUrl)
  let settled = false
  let resolveFinished!: (result: { autoplayBlocked: boolean }) => void

  const finished = new Promise<{ autoplayBlocked: boolean }>((resolve) => {
    resolveFinished = resolve
  })

  function finish(autoplayBlocked: boolean) {
    if (settled) return
    settled = true
    audio.removeEventListener('ended', onEnded)
    audio.removeEventListener('error', onError)
    audio.pause()
    URL.revokeObjectURL(objectUrl)
    resolveFinished({ autoplayBlocked })
  }
  function onEnded() {
    finish(false)
  }
  function onError() {
    finish(true)
  }
  audio.addEventListener('ended', onEnded)
  audio.addEventListener('error', onError)
  audio.play().catch(() => finish(true))

  return { finished, stop: () => finish(true) }
}

function base64ToObjectUrl(base64: string, mimeType: string): string {
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i)
  }
  return URL.createObjectURL(new Blob([bytes], { type: mimeType }))
}
