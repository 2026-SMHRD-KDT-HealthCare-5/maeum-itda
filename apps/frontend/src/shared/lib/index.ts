import { useEffect, useRef, useState } from 'react'

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('ko-KR', { timeZone: 'Asia/Seoul' })
}

const seoulDateKeyFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Seoul',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
})

// 서비스 기준 날짜(서울)를 GET /chats/messages?date= 등의 YYYY-MM-DD 형식으로 반환한다.
export function getSeoulDateKey(date: Date = new Date()): string {
  return seoulDateKeyFormatter.format(date)
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

let sharedAudioContext: AudioContext | null = null

// iOS Safari는 사용자 제스처 콜스택 안에서 만들어지거나 resume()된 AudioContext만
// 안정적으로 'running' 상태가 되고, 그 뒤로는 같은 페이지에서 새로 만드는
// AudioContext도 제스처 없이 곧바로 'running'으로 생성된다 — 반대로 제스처 없이
// 만든 첫 AudioContext는 resume()을 호출해도 계속 'suspended'로 남는다. 그래서
// "안부 대화 시작하기" 버튼의 클릭 핸들러처럼 확실한 탭 이벤트 안에서 이 함수를
// 동기적으로 한 번 호출해 컨텍스트를 미리 깨워두고, 대화 내내 같은 인스턴스를
// 재사용한다(record-voice-answer의 createSilenceWatcher 참고).
export function getUnlockedAudioContext(): AudioContext {
  if (!sharedAudioContext || sharedAudioContext.state === 'closed') {
    sharedAudioContext = new AudioContext()
  }
  if (sharedAudioContext.state === 'suspended') {
    void sharedAudioContext.resume()
  }
  return sharedAudioContext
}

export interface TtsPlaybackHandle {
  // 재생이 끝나거나(ended) 아예 시작하지 못했으면(autoplay 차단, 디코딩 실패
  // 등) resolve된다 — 호출부는 이 promise를 기다렸다가 다음 동작(마이크 열기
  // 등)을 이어가면 된다. autoplayBlocked가 true면 소리 없이 넘어간 것이므로
  // 호출부가 텍스트 전용 폴백을 보여줄지 판단하는 데 쓴다.
  finished: Promise<{ autoplayBlocked: boolean }>
  stop: () => void
}

// TTS 오디오를 실제 HTTP chunked 스트림 URL로 재생한다(2026-08-21 — base64 전체를
// 받아서 디코드하던 방식에서 전환, TTFB를 200ms대로 줄이기 위함). 브라우저가 <audio>
// 엘리먼트에 URL만 넘겨주면 오는 대로 점진 재생한다(라디오 스트리밍과 동일한 방식) —
// MediaSource Extensions는 안 쓴다(iOS Safari의 MP3+MSE 지원이 불안정해서, 그냥
// <audio src> 스트리밍이 크로스브라우저로 더 안전하다). iOS/모바일 브라우저는 사용자
// 제스처 없는 자동재생을 막을 수 있어(NotAllowedError), play()가 거부되면
// autoplayBlocked=true로 즉시 종료 처리한다 — 소리만 못 듣고 넘어갈 뿐 대화 흐름
// (마이크 열기 등)이 막히면 안 되기 때문이다.
export function playTtsAudioStream(streamUrl: string): TtsPlaybackHandle {
  const audio = new Audio(streamUrl)
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
