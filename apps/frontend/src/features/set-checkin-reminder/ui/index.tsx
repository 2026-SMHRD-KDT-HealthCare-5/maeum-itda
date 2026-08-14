import { useEffect, useState } from 'react'
import { Toggle } from '../../../shared/ui'
import type { CheckinReminderValue } from '../model'
import styles from './SetCheckinReminderAction.module.css'

interface SetCheckinReminderActionProps {
  value: CheckinReminderValue
  onChange: (next: CheckinReminderValue) => void
}

// 결정사항 로그 §7 — 시니어 홈 화면에 있던 "안부 알림 시간을 설정해 보세요"
// 죽은 버튼이 원래 이어져야 했던 시니어 내 정보 화면의 "안부 알림" 카드.
export function SetCheckinReminderAction({ value, onChange }: SetCheckinReminderActionProps) {
  const [isTimeModalOpen, setIsTimeModalOpen] = useState(false)
  const [hour, minute] = value.time.split(':').map(Number)
  const timePeriod = hour < 12 ? '오전' : '오후'
  const displayHour = hour % 12 || 12

  useEffect(() => {
    if (!isTimeModalOpen) return

    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setIsTimeModalOpen(false)
    }
    document.addEventListener('keydown', closeOnEscape)
    return () => document.removeEventListener('keydown', closeOnEscape)
  }, [isTimeModalOpen])

  function formatHour(optionHour: number) {
    const period = optionHour < 12 ? '오전' : '오후'
    return `${period} ${optionHour % 12 || 12}시`
  }

  return (
    <div>
      <h2 className={styles.title}>안부 알림</h2>

      <div className={styles.row}>
        <Toggle
          checked={value.enabled}
          onChange={(enabled) => onChange({ ...value, enabled })}
          label="안부 알림"
          controlPosition="end"
        />
        <p>매일 다슬이가 먼저 안부를 물어봐요</p>
      </div>

      {value.enabled && (
        <div className={styles.timeRow}>
          <span className={styles.timeLabel}>
            <strong>알림 시간</strong>
            <small>
              매일 {timePeriod} {displayHour}시에 알림이 와요
            </small>
          </span>
          <button
            type="button"
            className={styles.timeValue}
            onClick={() => setIsTimeModalOpen(true)}
            aria-haspopup="dialog"
          >
            {timePeriod} {displayHour}:{String(minute).padStart(2, '0')}
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M4 20h4l10-10-4-4L4 16v4Z" />
              <path d="m13 7 4 4" />
            </svg>
          </button>
        </div>
      )}

      {isTimeModalOpen && (
        <div className={styles.modalOverlay} onClick={() => setIsTimeModalOpen(false)}>
          <div
            className={styles.modal}
            role="dialog"
            aria-modal="true"
            aria-labelledby="reminder-time-title"
            onClick={(event) => event.stopPropagation()}
          >
            <div className={styles.modalHeader}>
              <div>
                <p>안부 알림</p>
                <h3 id="reminder-time-title">몇 시에 알려드릴까요?</h3>
              </div>
              <button
                type="button"
                className={styles.closeButton}
                onClick={() => setIsTimeModalOpen(false)}
                aria-label="시간 선택 닫기"
              >
                ×
              </button>
            </div>

            <div className={styles.hourGrid}>
              {Array.from({ length: 24 }, (_, optionHour) => {
                const optionValue = `${String(optionHour).padStart(2, '0')}:00`
                const isSelected = value.time === optionValue

                return (
                  <button
                    type="button"
                    key={optionValue}
                    className={isSelected ? styles.selectedHour : undefined}
                    aria-pressed={isSelected}
                    onClick={() => {
                      onChange({ ...value, time: optionValue })
                      setIsTimeModalOpen(false)
                    }}
                  >
                    {formatHour(optionHour)}
                  </button>
                )
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
