import { createPortal } from 'react-dom'
import loadingGif from '../assets/character/character-daseul-loading.gif'
import styles from './LoadingSpinner.module.css'

interface LoadingSpinnerProps {
  label?: string
  size?: number
  overlay?: boolean
}

export function LoadingSpinner({
  label = '불러오는 중이에요',
  size = 96,
  overlay = false,
}: LoadingSpinnerProps) {
  const content = (
    <div
      className={[styles.wrapper, overlay ? styles.overlay : ''].filter(Boolean).join(' ')}
      role="status"
      aria-live="polite"
    >
      <img src={loadingGif} alt="" width={size} height={size} className={styles.gif} />
      {label && <p className={styles.label}>{label}</p>}
    </div>
  )

  // overlay는 position: fixed로 화면 전체를 덮어야 하는데, filter/backdrop-filter/
  // transform이 있는 조상(예: LoginPage의 Card에 backdrop-filter blur)이 있으면
  // 그게 fixed의 containing block이 돼버려 그 조상 안에 갇힌다 — DOM 위치와
  // 무관하게 body에 붙여서 우회한다.
  return overlay ? createPortal(content, document.body) : content
}
