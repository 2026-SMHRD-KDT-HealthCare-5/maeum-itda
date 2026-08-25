import { useEffect, useRef, useState, type RefObject } from 'react'

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

// select-daily-record-date/select-report-date 캘린더 모달이 공유하는 날짜
// 유틸 — 둘 다 로컬 시간 기준으로 "하루"를 고르는 화면이라 동일한 계산이
// 필요했다(원래 각 feature에 복제돼 있던 것을 이쪽으로 옮김). select-report-week는
// weekStart를 라우트/쿼리 키로 써야 해서 UTC 자정 기준으로 별도 계산하므로
// 여기 포함하지 않는다.
export function isSameDate(left: Date, right: Date): boolean {
  return (
    left.getFullYear() === right.getFullYear() &&
    left.getMonth() === right.getMonth() &&
    left.getDate() === right.getDate()
  )
}

export function toDateKey(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

// 월요일 시작이 아니라 일요일 시작 6~7행 그리드를 만든다(달력 UI 관례).
export function getCalendarDates(year: number, month: number): Date[] {
  const firstDate = new Date(year, month, 1)
  const lastDate = new Date(year, month + 1, 0)
  const startDate = new Date(year, month, 1 - firstDate.getDay())
  const endOffset = 6 - lastDate.getDay()
  const endDate = new Date(year, month, lastDate.getDate() + endOffset)
  const dates: Date[] = []

  for (const date = new Date(startDate); date <= endDate; date.setDate(date.getDate() + 1)) {
    dates.push(new Date(date))
  }

  return dates
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

// 조건부 렌더링 모달이 닫힘 애니메이션을 마친 뒤 DOM에서 제거되도록 수명을 관리한다.
export function useAnimatedPresence(isOpen: boolean, exitDuration = 180) {
  const [isRendered, setIsRendered] = useState(isOpen)
  const [isClosing, setIsClosing] = useState(false)

  useEffect(() => {
    if (isOpen) {
      const timer = window.setTimeout(() => {
        setIsRendered(true)
        setIsClosing(false)
      }, 0)
      return () => window.clearTimeout(timer)
    }

    if (!isRendered) return

    const closingTimer = window.setTimeout(() => setIsClosing(true), 0)
    const removalTimer = window.setTimeout(() => {
      setIsRendered(false)
      setIsClosing(false)
    }, exitDuration)

    return () => {
      window.clearTimeout(closingTimer)
      window.clearTimeout(removalTimer)
    }
  }, [exitDuration, isOpen, isRendered])

  return { isRendered, isClosing }
}

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'

// 모달/다이얼로그 공통 키보드 접근성 — isActive가 true가 되면(보통
// useAnimatedPresence의 isRendered) 다이얼로그 안 첫 포커스 가능 요소로
// 포커스를 옮기고, Tab/Shift+Tab이 다이얼로그 밖으로 새지 않게 순환시키며,
// Escape 입력 시 onRequestClose를 호출한다. isActive가 다시 false가 되면
// (닫힘) 열기 전 포커스였던 요소로 되돌린다.
export function useFocusTrap(
  containerRef: RefObject<HTMLElement | null>,
  isActive: boolean,
  onRequestClose: () => void,
): void {
  const onRequestCloseRef = useRef(onRequestClose)
  useEffect(() => {
    onRequestCloseRef.current = onRequestClose
  })

  useEffect(() => {
    if (!isActive) return
    const container = containerRef.current
    if (!container) return

    const previouslyFocused = document.activeElement as HTMLElement | null

    function getFocusableElements(): HTMLElement[] {
      return Array.from(container!.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR))
    }

    const [firstOnOpen] = getFocusableElements()
    ;(firstOnOpen ?? container).focus()

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        onRequestCloseRef.current()
        return
      }
      if (event.key !== 'Tab') return

      const elements = getFocusableElements()
      if (elements.length === 0) {
        event.preventDefault()
        return
      }
      const firstElement = elements[0]
      const lastElement = elements[elements.length - 1]
      if (event.shiftKey && document.activeElement === firstElement) {
        event.preventDefault()
        lastElement.focus()
      } else if (!event.shiftKey && document.activeElement === lastElement) {
        event.preventDefault()
        firstElement.focus()
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      previouslyFocused?.focus()
    }
  }, [isActive, containerRef])
}

const PERMISSION_ONBOARDING_KEY_PREFIX = 'maeum-itda:permissionsOnboarded:'

// 로그인/회원가입 성공 직후 마이크·알림 권한을 미리 안내하는 온보딩 화면
// (pages/permission-onboarding)을 계정당 딱 한 번만 거치도록 하는 플래그.
// 기기 단위가 아니라 계정(userId) 단위로 저장한다 — 같은 브라우저에서
// 시니어/보호자 계정을 번갈아 테스트하는 경우가 있어, 기기 단위로 두면
// 먼저 로그인한 계정이 플래그를 소비해버려 다른 계정은 온보딩을 아예 못 본다.
export function hasCompletedPermissionOnboarding(userId: number): boolean {
  return localStorage.getItem(PERMISSION_ONBOARDING_KEY_PREFIX + userId) === '1'
}

export function markPermissionOnboardingComplete(userId: number): void {
  localStorage.setItem(PERMISSION_ONBOARDING_KEY_PREFIX + userId, '1')
}

export function homePathForRole(role: 'senior' | 'guardian'): string {
  return role === 'senior' ? '/senior' : '/guardian'
}

// 로그인/회원가입 성공 직후 이동할 경로 — 이 계정이 아직 권한 온보딩을 거치지
// 않았으면 역할별 홈 대신 온보딩 화면으로 먼저 보낸다.
export function resolvePostAuthPath(userId: number, role: 'senior' | 'guardian'): string {
  return hasCompletedPermissionOnboarding(userId)
    ? homePathForRole(role)
    : '/onboarding/permissions'
}

// 로그인 폼 입력 중 브라우저가 확대(핀치 줌 또는 iOS 자동 줌)된 상태가 SPA
// 네비게이션(새로고침 없는 client-side routing)에서는 저절로 리셋되지 않고
// 그대로 유지되는 문제 대응. viewport meta의 maximum-scale을 한 프레임만
// 강제해 현재 확대 배율을 1배로 되돌린 뒤 원래 content로 되돌려서, 사용자가
// 이후 다시 확대하는 것 자체는 계속 가능하게 둔다(접근성상 확대 자체를
// 막지 않음).
export function resetViewportZoom(): void {
  const viewport = document.querySelector('meta[name="viewport"]')
  if (!(viewport instanceof HTMLMetaElement)) return
  const original = viewport.content
  viewport.content = `${original}, maximum-scale=1`
  requestAnimationFrame(() => {
    viewport.content = original
  })
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
