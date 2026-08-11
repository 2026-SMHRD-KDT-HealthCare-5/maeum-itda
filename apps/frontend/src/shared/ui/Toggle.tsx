import styles from './Toggle.module.css'

interface ToggleProps {
  checked: boolean
  onChange: (checked: boolean) => void
  label: string
  controlPosition?: 'start' | 'end'
}

// 자동 로그인 스위치(로그인 화면 목업 D 컴포넌트) 기준 — ON/OFF 두 상태.
export function Toggle({ checked, onChange, label, controlPosition = 'start' }: ToggleProps) {
  return (
    <label className={styles.wrapper} data-control-position={controlPosition}>
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className={styles.input}
      />
      <span className={styles.track} />
      <span className={styles.label}>{label}</span>
    </label>
  )
}
