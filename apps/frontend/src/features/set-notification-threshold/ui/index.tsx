import type { CSSProperties } from 'react'
import { InlineFeedback, Toggle, type InlineFeedbackTone } from '../../../shared/ui'
import { THRESHOLD_MAX, THRESHOLD_MIN, type NotificationThresholdValue } from '../model'
import styles from './SetNotificationThresholdAction.module.css'

interface SetNotificationThresholdActionProps {
  value: NotificationThresholdValue
  onChange: (next: NotificationThresholdValue) => void
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

// UC-12 — 결정사항 로그 §7에 따라 '보호자 알림 설정' 화면에서 '보호자 내
// 정보' 화면의 카드로 흡수됨.
export function SetNotificationThresholdAction({
  value,
  onChange,
  feedback = null,
  pushPermissionDenied,
  pushBusy,
  pushError = null,
  onRequestPushSubscribe,
  onRequestPushUnsubscribe,
}: SetNotificationThresholdActionProps) {
  const thresholdPercent =
    ((value.threshold - THRESHOLD_MIN) / (THRESHOLD_MAX - THRESHOLD_MIN)) * 100
  const thresholdTicks = Array.from(
    { length: (THRESHOLD_MAX - THRESHOLD_MIN) / 10 + 1 },
    (_, index) => THRESHOLD_MIN + index * 10,
  )

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
      <h2 className={styles.title}>정서 지수 알림</h2>

      <div className={styles.row}>
        <div className={styles.notificationCopy}>
          <p>정서 지수 하락 알림</p>
          <span>임계치 아래로 내려가면 이 기기로 알려드려요</span>
        </div>
        <Toggle
          checked={value.enabled}
          onChange={(checked) => void handleToggle(checked)}
          label="정서 지수 하락 알림"
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
    </div>
  )
}
