import { Toggle } from '../../../shared/ui'
import { THRESHOLD_MAX, THRESHOLD_MIN, type NotificationThresholdValue } from '../model'
import styles from './SetNotificationThresholdAction.module.css'

interface SetNotificationThresholdActionProps {
  value: NotificationThresholdValue
  onChange: (next: NotificationThresholdValue) => void
}

// UC-12 — 결정사항 로그 §7에 따라 '보호자 알림 설정' 화면에서 '보호자 내
// 정보' 화면의 카드로 흡수됨.
export function SetNotificationThresholdAction({
  value,
  onChange,
}: SetNotificationThresholdActionProps) {
  return (
    <div>
      <h2 className={styles.title}>정서 지수 알림</h2>

      <div className={styles.row}>
        <Toggle
          checked={value.enabled}
          onChange={(enabled) => onChange({ ...value, enabled })}
          label="정서 지수가 떨어지면 알려드려요"
        />
      </div>

      <div className={styles.sliderRow}>
        <div className={styles.sliderHeader}>
          <span className={styles.sliderLabel}>알림 임계치</span>
          <span className={styles.sliderValue}>{value.threshold}점</span>
        </div>
        <input
          type="range"
          className={styles.slider}
          min={THRESHOLD_MIN}
          max={THRESHOLD_MAX}
          value={value.threshold}
          disabled={!value.enabled}
          onChange={(event) => onChange({ ...value, threshold: Number(event.target.value) })}
          aria-label="정서 지수 알림 임계치"
        />
      </div>
    </div>
  )
}
