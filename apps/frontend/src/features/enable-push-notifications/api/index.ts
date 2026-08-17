import type { UpsertPushSubscriptionDto } from '@maeum-itda/api-client'
import { apiClient } from '../../../shared/api'

export async function fetchVapidPublicKey(): Promise<string> {
  const { data } = await apiClient.notifications.notificationsControllerGetVapidPublicKey()
  return data.publicKey
}

// PushSubscription.toJSON()의 endpoint/keys는 타입상 optional이라(구독 직후에는
// 항상 채워져 있음) 호출부에서 이미 채워진 값만 넘기도록 시그니처를 좁힌다.
// expirationTime은 백엔드 DTO에 명시적 @ApiProperty 타입이 없어 swagger-typescript-api가
// `object | null`로 생성한다(entities/connection과 동일한 이슈) — 실제로는 number이므로 캐스팅한다.
export async function registerPushSubscription(subscription: {
  endpoint: string
  expirationTime: number | null
  keys: { p256dh: string; auth: string }
}): Promise<void> {
  await apiClient.notifications.notificationsControllerUpsertPushSubscription(
    subscription as unknown as UpsertPushSubscriptionDto,
  )
}

export async function unregisterPushSubscription(endpoint: string): Promise<void> {
  await apiClient.notifications.notificationsControllerDeletePushSubscription({ endpoint })
}
