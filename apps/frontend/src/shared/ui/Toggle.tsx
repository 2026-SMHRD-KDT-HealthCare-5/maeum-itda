import styles from './Toggle.module.css'

interface ToggleProps {
  checked: boolean
  onChange: (checked: boolean) => void
  label: string
  controlPosition?: 'start' | 'end'
  // 눌러봐야 아무 효과가 없는 상태(예: 브라우저 알림 권한이 이미 차단됨)를
  // 표시한다 — 클릭은 막되, 왜 안 되는지는 호출부가 별도 안내 문구로 알려준다.
  disabled?: boolean
  // label을 화면에 보이는 문구가 아니라 접근성 이름으로만 쓴다 — 이미 옆에
  // 같은 내용을 설명하는 텍스트가 따로 있을 때 쓴다(중복 노출 방지). label이
  // on/off에 따라 바뀌는 문구라면 특히 필요하다 — 보이는 문구로 두면 텍스트
  // 길이가 바뀔 때마다 스위치 위치가 흔들린다.
  hideLabelVisually?: boolean
}

// 자동 로그인 스위치(로그인 화면 목업 D 컴포넌트) 기준 — ON/OFF 두 상태.
export function Toggle({
  checked,
  onChange,
  label,
  controlPosition = 'start',
  disabled = false,
  hideLabelVisually = false,
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
      <span className={hideLabelVisually ? styles.labelHidden : styles.label}>{label}</span>
    </label>
  )
}
