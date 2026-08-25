const SHELL_CACHE = 'maeum-itda-shell-v6'
const RUNTIME_CACHE = 'maeum-itda-runtime-v1'
const CURRENT_CACHES = [SHELL_CACHE, RUNTIME_CACHE]
const SHELL_ASSETS = [
  '/',
  '/manifest.webmanifest',
  '/pwa/favicon-32.png',
  '/pwa/apple-touch-icon-face.png',
  '/pwa/icon-face-192.png',
  '/pwa/icon-face-512.png',
  '/pwa/icon-face-maskable-512.png',
]

// Vite가 빌드 시 파일명에 콘텐츠 해시를 붙이는 정적 에셋(이미지/폰트/JS/CSS)만
// 대상으로 한다 — 해시가 파일명에 있으니 캐시-우선으로 무기한 재사용해도
// 내용이 바뀌면 자동으로 다른 URL이 되어 안전하다. 지금까지 이 asset들은
// 아예 캐싱 대상이 아니어서, PWA로 설치해도 매번 네트워크로 다시 받아오느라
// 이미지 로딩이 느렸다.
const CACHEABLE_ASSET_PATTERN = /\.(?:webp|png|jpe?g|gif|svg|js|css|woff2?)$/

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(SHELL_CACHE).then((cache) => cache.addAll(SHELL_ASSETS)))
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => !CURRENT_CACHES.includes(key)).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  )
})

// 페이지 네비게이션(주소 이동/새로고침)만 오프라인 시 캐시된 앱 셸로 대체한다.
// API 요청(백엔드 등 다른 origin으로 가는 fetch)은 절대 가로채지 않는다 — 안 그러면
// CORS 등으로 실패한 API 응답 대신 캐시된 index.html이 조용히 반환되어 버린다.
self.addEventListener('fetch', (event) => {
  const { request } = event
  if (request.method !== 'GET') return
  const url = new URL(request.url)
  if (url.origin !== self.location.origin) return

  if (request.mode === 'navigate') {
    event.respondWith(fetch(request).catch(() => caches.match('/')))
    return
  }

  if (CACHEABLE_ASSET_PATTERN.test(url.pathname)) {
    event.respondWith(
      caches.open(RUNTIME_CACHE).then(async (cache) => {
        const cached = await cache.match(request)
        if (cached) return cached
        const response = await fetch(request)
        if (response.ok) cache.put(request, response.clone())
        return response
      }),
    )
  }
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
      icon: '/pwa/icon-face-192.png',
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
