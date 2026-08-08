import { useState } from 'react'
import { Toggle } from '../../../shared/ui'
import styles from './SetCheckinReminderAction.module.css'

export interface CheckinReminderValue {
  enabled: boolean
  time: string // "HH:mm"
}

interface SetCheckinReminderActionProps {
  value: CheckinReminderValue
  onChange: (next: CheckinReminderValue) => void
}

// 결정사항 로그 §7 — 시니어 홈 화면에 있던 "안부 알림 시간을 설정해 보세요"
// 죽은 버튼이 원래 이어져야 했던 시니어 내 정보 화면의 "안부 알림" 카드.
export function SetCheckinReminderAction({ value, onChange }: SetCheckinReminderActionProps) {
  const [isEditingTime, setIsEditingTime] = useState(false)

  return (
    <div>
      <h2 className={styles.title}>안부 알림</h2>

      <div className={styles.row}>
        <Toggle
          checked={value.enabled}
          onChange={(enabled) => onChange({ ...value, enabled })}
          label="다슬이가 매일 먼저 안부를 물어봐요"
        />
      </div>

      <div className={styles.timeRow}>
        <span className={styles.timeLabel}>알림 시간</span>
        {isEditingTime ? (
          <input
            type="time"
            className={styles.timeInput}
            value={value.time}
            onChange={(event) => onChange({ ...value, time: event.target.value })}
            onBlur={() => setIsEditingTime(false)}
            aria-label="안부 알림 시간"
            autoFocus
          />
        ) : (
          <span className={styles.timeValue}>
            {value.time}
            <button
              type="button"
              className={styles.editButton}
              onClick={() => setIsEditingTime(true)}
              aria-label="안부 알림 시간 수정"
            >
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M4 20h4l10-10-4-4L4 16v4Z" />
                <path d="m13 7 4 4" />
              </svg>
            </button>
          </span>
        )}
      </div>
    </div>
  )
}
