import { useEffect, useRef, useState } from 'react'

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('ko-KR')
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
