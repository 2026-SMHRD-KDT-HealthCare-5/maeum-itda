import type { UsePushSubscriptionResult } from '../model'
import { Toggle } from '../../../shared/ui'
import styles from './EnablePushNotificationsAction.module.css'

interface EnablePushNotificationsActionProps {
  title?: string
  description?: string
  // 페이지가 usePushSubscription()을 직접 호출해서 넘긴다 — 이 컴포넌트가 내부에서
  // 다시 호출하면 별도 인스턴스가 생겨, 페이지의 다른 곳(예: 안부 알림 토글의
  // "푸시 먼저 켜라" 가드)이 보는 status와 서로 안 맞게 어긋난다.
  pushSubscription: UsePushSubscriptionResult
}

// UC-10/11 위험 알림 실제 발송의 프론트 구독 등록 플로우 — 결정사항 로그 §1
// "웹 푸시 알림" 참고. 서버가 이미 구독을 저장/발송할 준비가 돼 있어도(REST
// 엔드포인트 존재) 브라우저가 구독을 등록해야 실제로 알림이 온다. 보호자/
// 시니어 화면이 문구만 다르게 재사용한다.
export function EnablePushNotificationsAction({
  title = '알림 푸시 허용',
  description = '정서 지수 하락 알림을 이 기기의 알림으로도 받아요',
  pushSubscription,
}: EnablePushNotificationsActionProps) {
  const { status, isBusy, error, subscribe, unsubscribe } = pushSubscription

  if (status === 'unsupported') return null

  const isPermissionDenied = status === 'permission-denied'

  return (
    <div className={styles.row}>
      <div className={styles.copy}>
        <p>{title}</p>
        <span>{description}</span>
      </div>
      <Toggle
        checked={status === 'subscribed'}
        onChange={(checked) => void (checked ? subscribe() : unsubscribe())}
        label={status === 'subscribed' ? '푸시 켜짐' : '푸시 꺼짐'}
        // 한 번 차단하면 브라우저가 다시 물어보지 않아 토글을 눌러도 아무 일도
        // 안 일어난다 — 그걸 숨기지 않고 비활성 상태로 드러낸다.
        disabled={isPermissionDenied}
      />
      {isPermissionDenied && (
        <p className={styles.error}>
          브라우저 알림이 차단되어 있어요. 주소창의 사이트 설정에서 알림을 허용한 뒤
          새로고침해주세요.
        </p>
      )}
      {isBusy && <span className={styles.busy}>처리 중이에요…</span>}
      {error && <p className={styles.error}>{error}</p>}
    </div>
  )
}
