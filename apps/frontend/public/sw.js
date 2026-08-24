const SHELL_CACHE = 'maeum-itda-shell-v4'
const SHELL_ASSETS = [
  '/',
  '/manifest.webmanifest',
  '/pwa/favicon-32.png',
  '/pwa/apple-touch-icon.png',
  '/pwa/icon-192.png',
  '/pwa/icon-512.png',
  '/pwa/icon-maskable-512.png',
]

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(SHELL_CACHE).then((cache) => cache.addAll(SHELL_ASSETS)))
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== SHELL_CACHE).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  )
})

// 페이지 네비게이션(주소 이동/새로고침)만 오프라인 시 캐시된 앱 셸로 대체한다.
// API 요청(백엔드 등 다른 origin으로 가는 fetch)은 절대 가로채지 않는다 — 안 그러면
// CORS 등으로 실패한 API 응답 대신 캐시된 index.html이 조용히 반환되어 버린다.
self.addEventListener('fetch', (event) => {
  const { request } = event
  if (request.method !== 'GET' || request.mode !== 'navigate') return
  if (new URL(request.url).origin !== self.location.origin) return

  event.respondWith(fetch(request).catch(() => caches.match('/')))
})

// 위험 알림 웹 푸시 수신 — 백엔드(web-push-delivery.service.ts의 WebPushPayload)가
// 보내는 payload는 { title, body, url, tag } 형태의 JSON이다. payload가 없거나
// 파싱에 실패해도 알림 자체는 항상 띄운다(그래야 브라우저가 "조용한 푸시"로
// 판단해 구독을 해지하지 않는다).
self.addEventListener('push', (event) => {
  let payload = { title: '마음잇다', body: '새로운 알림이 도착했어요.', url: '/guardian', tag: undefined }
  try {
    if (event.data) payload = { ...payload, ...event.data.json() }
  } catch {
    // JSON이 아니면 기본 문구를 그대로 사용한다.
  }

  event.waitUntil(
    self.registration.showNotification(payload.title, {
      body: payload.body,
      icon: '/pwa/icon-192.png',
      tag: payload.tag,
      data: { url: payload.url },
    }),
  )
})

// 알림 클릭 시 이미 열려 있는 탭이 있으면 그 탭으로 포커스하고, 없으면 새 탭을 연다.
self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const targetUrl = event.notification.data?.url || '/guardian'

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      const existing = clients.find((client) => client.url.includes(self.location.origin))
      if (existing) return existing.focus()
      return self.clients.openWindow(targetUrl)
    }),
  )
})
