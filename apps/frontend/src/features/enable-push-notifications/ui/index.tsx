import { useEffect, useState } from 'react'
import { fetchVapidPublicKey, registerPushSubscription, unregisterPushSubscription } from '../api'
import { urlBase64ToUint8Array } from '../lib'
import type { PushSubscriptionStatus } from '../model'
import { Toggle } from '../../../shared/ui'
import styles from './EnablePushNotificationsAction.module.css'

function isPushSupported(): boolean {
  return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window
}

// UC-10/11 위험 알림 실제 발송의 프론트 구독 등록 플로우 — 결정사항 로그 §1
// "웹 푸시 알림" 참고. 서버가 이미 구독을 저장/발송할 준비가 돼 있어도(REST
// 엔드포인트 존재) 브라우저가 구독을 등록해야 실제로 알림이 온다.
export function EnablePushNotificationsAction() {
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

  async function handleSubscribe() {
    setError(null)
    setIsBusy(true)
    try {
      const permission = await Notification.requestPermission()
      if (permission !== 'granted') {
        setStatus(permission === 'denied' ? 'permission-denied' : 'not-subscribed')
        return
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
    } catch {
      setError('알림 구독에 실패했어요. 잠시 후 다시 시도해주세요.')
    } finally {
      setIsBusy(false)
    }
  }

  async function handleUnsubscribe() {
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
  }

  if (status === 'unsupported') return null

  return (
    <div className={styles.row}>
      <div className={styles.copy}>
        <p>위험 알림 푸시로 받기</p>
        <span>
          {status === 'permission-denied'
            ? '브라우저 알림 권한이 꺼져 있어요. 브라우저 설정에서 허용해주세요.'
            : '정서 지수 하락 알림을 이 기기의 알림으로도 받아요'}
        </span>
      </div>
      <Toggle
        checked={status === 'subscribed'}
        onChange={(checked) => void (checked ? handleSubscribe() : handleUnsubscribe())}
        label={status === 'subscribed' ? '푸시 켜짐' : '푸시 꺼짐'}
      />
      {isBusy && <span className={styles.busy}>처리 중이에요…</span>}
      {error && <p className={styles.error}>{error}</p>}
    </div>
  )
}
