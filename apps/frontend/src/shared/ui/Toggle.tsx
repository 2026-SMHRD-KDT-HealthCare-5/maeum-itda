import styles from './Toggle.module.css'

interface ToggleProps {
  checked: boolean
  onChange: (checked: boolean) => void
  label: string
  controlPosition?: 'start' | 'end'
  // 눌러봐야 아무 효과가 없는 상태(예: 브라우저 알림 권한이 이미 차단됨)를
  // 표시한다 — 클릭은 막되, 왜 안 되는지는 호출부가 별도 안내 문구로 알려준다.
  disabled?: boolean
}

// 자동 로그인 스위치(로그인 화면 목업 D 컴포넌트) 기준 — ON/OFF 두 상태.
export function Toggle({
  checked,
  onChange,
  label,
  controlPosition = 'start',
  disabled = false,
}: ToggleProps) {
  return (
    <label
      className={styles.wrapper}
      data-control-position={controlPosition}
      data-disabled={disabled || undefined}
    >
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(event) => onChange(event.target.checked)}
        className={styles.input}
      />
      <span className={styles.track} />
      <span className={styles.label}>{label}</span>
    </label>
  )
}
