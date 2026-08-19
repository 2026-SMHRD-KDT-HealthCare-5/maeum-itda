import type { CSSProperties, ReactNode } from 'react'
import { Toggle } from '../../../shared/ui'
import { THRESHOLD_MAX, THRESHOLD_MIN, type NotificationThresholdValue } from '../model'
import styles from './SetNotificationThresholdAction.module.css'

interface SetNotificationThresholdActionProps {
  value: NotificationThresholdValue
  onChange: (next: NotificationThresholdValue) => void
  feedback?: string | null
  // 제목 아래·알림 토글 위에 끼워 넣을 내용 — 웹 푸시 허용 토글이 이 자리에 온다.
  beforeContent?: ReactNode
}

// UC-12 — 결정사항 로그 §7에 따라 '보호자 알림 설정' 화면에서 '보호자 내
// 정보' 화면의 카드로 흡수됨.
export function SetNotificationThresholdAction({
  value,
  onChange,
  feedback = null,
  beforeContent,
}: SetNotificationThresholdActionProps) {
  const thresholdPercent =
    ((value.threshold - THRESHOLD_MIN) / (THRESHOLD_MAX - THRESHOLD_MIN)) * 100
  const thresholdTicks = Array.from(
    { length: (THRESHOLD_MAX - THRESHOLD_MIN) / 10 + 1 },
    (_, index) => THRESHOLD_MIN + index * 10,
  )

  return (
    <div>
      <h2 className={styles.title}>정서 지수 알림</h2>
      {beforeContent}

      <div className={[styles.row, beforeContent ? styles.separatedRow : ''].join(' ')}>
        <div className={styles.notificationCopy}>
          <p>정서 지수 하락 알림</p>
          <span>임계치 아래로 내려가면 알려드려요</span>
        </div>
        <Toggle
          checked={value.enabled}
          onChange={(enabled) => onChange({ ...value, enabled })}
          label={value.enabled ? '알림 켜짐' : '알림 꺼짐'}
        />
      </div>

      {feedback && (
        <p className={styles.feedback} role="alert">
          {feedback}
        </p>
      )}

      {value.enabled && (
        <div className={styles.sliderRow}>
          <div className={styles.sliderHeader}>
            <span className={styles.sliderLabel}>알림 임계치</span>
            <span className={styles.sliderValue}>{value.threshold}점</span>
          </div>
          <div
            className={styles.sliderControl}
            style={{ '--threshold-percent': `${thresholdPercent}%` } as CSSProperties}
          >
            <input
              type="range"
              className={styles.slider}
              min={THRESHOLD_MIN}
              max={THRESHOLD_MAX}
              step={10}
              value={value.threshold}
              onChange={(event) => onChange({ ...value, threshold: Number(event.target.value) })}
              aria-label="정서 지수 알림 임계치"
            />
          </div>
          <div className={styles.rangeLabels} aria-hidden="true">
            {thresholdTicks.map((tick) => (
              <span className={tick === value.threshold ? styles.activeTick : undefined} key={tick}>
                {tick}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
