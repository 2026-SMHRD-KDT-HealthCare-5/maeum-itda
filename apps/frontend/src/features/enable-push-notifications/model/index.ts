import { useCallback, useEffect, useMemo, useState } from 'react'
import { fetchVapidPublicKey, registerPushSubscription, unregisterPushSubscription } from '../api'
import { urlBase64ToUint8Array } from '../lib'

export type PushSubscriptionStatus =
  'checking' | 'unsupported' | 'subscribed' | 'not-subscribed' | 'permission-denied'

function isPushSupported(): boolean {
  return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window
}

export interface UsePushSubscriptionResult {
  status: PushSubscriptionStatus
  isBusy: boolean
  error: string | null
  // 브라우저 구독 성립까지 성공했을 때만 true를 반환한다 — 호출부가 이 결과를
  // 보고 나서야 "알림 켜짐" 값을 저장해야, 권한이 거절된 순간에도 실제로는
  // 꺼진 상태를 켜짐으로 잘못 저장하지 않는다.
  subscribe: () => Promise<boolean>
  unsubscribe: () => Promise<void>
}

// UC-10/11 위험 알림 실제 발송의 브라우저 구독 등록/해제 로직 — 결정사항 로그 §1
// "웹 푸시 알림" 참고. features/enable-push-notifications(보호자 화면 토글)와
// pages/senior-my-info(시니어 화면 — 기존 "안부 알림" 토글이 구독 토글을
// 겸함) 양쪽에서 재사용한다.
export function usePushSubscription(): UsePushSubscriptionResult {
  const [status, setStatus] = useState<PushSubscriptionStatus>('checking')
  const [isBusy, setIsBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    async function checkStatus() {
      if (!isPushSupported()) {
        if (!cancelled) setStatus('unsupported')
        return
      }
      if (Notification.permission === 'denied') {
        if (!cancelled) setStatus('permission-denied')
        return
      }
      const registration = await navigator.serviceWorker.ready
      const subscription = await registration.pushManager.getSubscription()
      if (!cancelled) setStatus(subscription ? 'subscribed' : 'not-subscribed')
    }

    void checkStatus()
    return () => {
      cancelled = true
    }
  }, [])

  // 호출부(pages)가 마운트 시 "서버 설정은 켜져 있는데 이 브라우저는 아직
  // 구독 전"인 경우를 감지해 자동으로 구독을 시도하는 effect의 의존성으로
  // 쓰인다 — 매 렌더마다 새 함수가 되면 그 effect가 무한 재실행된다.
  const subscribe = useCallback(async () => {
    setError(null)
    setIsBusy(true)
    try {
      const permission = await Notification.requestPermission()
      if (permission !== 'granted') {
        setStatus(permission === 'denied' ? 'permission-denied' : 'not-subscribed')
        return false
      }

      const registration = await navigator.serviceWorker.ready
      const vapidPublicKey = await fetchVapidPublicKey()
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        // TS의 Uint8Array<ArrayBufferLike> vs BufferSource(ArrayBuffer 한정) 제네릭
        // 불일치일 뿐, 실제로는 항상 진짜 ArrayBuffer로 채워지므로 안전한 캐스팅이다.
        applicationServerKey: urlBase64ToUint8Array(vapidPublicKey) as BufferSource,
      })
      const json = subscription.toJSON()
      if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth) {
        throw new Error('구독 정보를 생성하지 못했습니다.')
      }
      await registerPushSubscription({
        endpoint: json.endpoint,
        expirationTime: json.expirationTime ?? null,
        keys: { p256dh: json.keys.p256dh, auth: json.keys.auth },
      })
      setStatus('subscribed')
      return true
    } catch {
      setError('알림 구독에 실패했어요. 잠시 후 다시 시도해주세요.')
      return false
    } finally {
      setIsBusy(false)
    }
  }, [])

  const unsubscribe = useCallback(async () => {
    setError(null)
    setIsBusy(true)
    try {
      const registration = await navigator.serviceWorker.ready
      const subscription = await registration.pushManager.getSubscription()
      if (subscription) {
        await unregisterPushSubscription(subscription.endpoint)
        await subscription.unsubscribe()
      }
      setStatus('not-subscribed')
    } catch {
      setError('알림 해제에 실패했어요. 잠시 후 다시 시도해주세요.')
    } finally {
      setIsBusy(false)
    }
  }, [])

  // 호출부가 이 반환값 자체를 effect 의존성으로 쓸 수 있도록(위 subscribe 주석
  // 참고) 값이 실제로 바뀔 때만 새 객체가 되게 한다.
  return useMemo(
    () => ({ status, isBusy, error, subscribe, unsubscribe }),
    [status, isBusy, error, subscribe, unsubscribe],
  )
}
