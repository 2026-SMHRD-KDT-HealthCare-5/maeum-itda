import styles from './Skeleton.module.css'

// 데이터 구조를 유지한 채 로딩 중인 영역만 표현하는 공통 시각 요소다.
// 상태 안내는 사용하는 화면이 role/status와 텍스트로 별도 제공한다.
export function Skeleton({ className = '' }: { className?: string }) {
  return (
    <span className={[styles.skeleton, className].filter(Boolean).join(' ')} aria-hidden="true" />
  )
}
