import { useRef, useState } from 'react'
import { useAnimatedPresence, useFocusTrap } from '../../../shared/lib'
import { InlineFeedback, Toggle, type InlineFeedbackTone } from '../../../shared/ui'
import type { CheckinReminderValue } from '../model'
import styles from './SetCheckinReminderAction.module.css'

interface SetCheckinReminderActionProps {
  value: CheckinReminderValue
  onChange: (next: CheckinReminderValue) => void
  feedback?: { tone: InlineFeedbackTone; message: string } | null
  // 이 기기의 웹 푸시 구독은 토글 하나로 통합해서 다룬다(내부적으로만 관리) —
  // 그래서 브라우저 권한/구독 상태는 features/enable-push-notifications의
  // usePushSubscription을 페이지가 직접 호출해 아래 형태로 풀어서 넘긴다.
  pushPermissionDenied: boolean
  pushBusy: boolean
  pushError?: string | null
  onRequestPushSubscribe: () => Promise<boolean>
  onRequestPushUnsubscribe: () => void
}

// 결정사항 로그 §7 — 시니어 홈 화면에 있던 "안부 알림 시간을 설정해 보세요"
// 죽은 버튼이 원래 이어져야 했던 시니어 내 정보 화면의 "안부 알림" 카드.
export function SetCheckinReminderAction({
  value,
  onChange,
  feedback = null,
  pushPermissionDenied,
  pushBusy,
  pushError = null,
  onRequestPushSubscribe,
  onRequestPushUnsubscribe,
}: SetCheckinReminderActionProps) {
  const [isTimeModalOpen, setIsTimeModalOpen] = useState(false)
  const timeModalPresence = useAnimatedPresence(isTimeModalOpen)
  const modalRef = useRef<HTMLDivElement>(null)
  useFocusTrap(modalRef, timeModalPresence.isRendered, () => setIsTimeModalOpen(false))
  const [hour, minute] = value.time.split(':').map(Number)
  const timePeriod = hour < 12 ? '오전' : '오후'
  const displayHour = hour % 12 || 12

  function formatHour(optionHour: number) {
    const period = optionHour < 12 ? '오전' : '오후'
    return `${period} ${optionHour % 12 || 12}시`
  }

  // 토글 값은 항상 사용자가 설정한 값(enabled) 그대로여야 한다 — 켤 때만
  // 내부적으로 구독을 시도하고, 실제로 구독까지 성공했을 때만 켜짐으로
  // 저장한다. 끌 때는 구독 해제는 최선을 다해 시도하되(실패해도 무방) enabled는
  // 곧바로 꺼짐으로 저장한다.
  async function handleToggle(nextEnabled: boolean) {
    if (!nextEnabled) {
      onChange({ ...value, enabled: false })
      onRequestPushUnsubscribe()
      return
    }
    if (pushPermissionDenied) return
    const subscribed = await onRequestPushSubscribe()
    if (subscribed) onChange({ ...value, enabled: true })
  }

  return (
    <div>
      <div className={styles.row}>
        <div className={styles.notificationCopy}>
          <p>안부 알림</p>
          <span>매일 다슬이가 먼저 안부를 물어보면 이 기기로 알려드려요</span>
        </div>
        <Toggle
          checked={value.enabled}
          onChange={(checked) => void handleToggle(checked)}
          label="안부 알림"
          hideLabelVisually
          disabled={pushPermissionDenied}
        />
      </div>

      {pushPermissionDenied && (
        <InlineFeedback
          message="브라우저 알림이 차단되어 있어요. 주소창의 사이트 설정에서 알림을 허용한 뒤 새로고침해주세요."
          tone="error"
        />
      )}
      {!pushPermissionDenied && pushBusy && (
        <InlineFeedback message="알림 설정을 처리하고 있어요." tone="info" />
      )}
      {!pushPermissionDenied && !pushBusy && (feedback ?? pushError) && (
        <InlineFeedback
          message={feedback?.message ?? pushError ?? ''}
          tone={feedback?.tone ?? 'error'}
        />
      )}

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

      {timeModalPresence.isRendered && (
        <div
          className={`${styles.modalOverlay} ${timeModalPresence.isClosing ? styles.modalOverlayClosing : ''}`}
          onClick={() => setIsTimeModalOpen(false)}
        >
          <div
            ref={modalRef}
            className={`${styles.modal} ${timeModalPresence.isClosing ? styles.modalClosing : ''}`}
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
