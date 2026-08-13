const SHELL_CACHE = 'maeum-itda-shell-v2'
const SHELL_ASSETS = ['/', '/manifest.webmanifest', '/favicon.svg']

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
