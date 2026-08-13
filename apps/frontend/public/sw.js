const SHELL_CACHE = 'maeum-itda-shell-v1'
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

// 네트워크 우선, 실패 시(오프라인) 캐시된 앱 셸로 대체. 해시 붙은 빌드 산출물은 캐시하지 않는다.
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return

  event.respondWith(
    fetch(event.request).catch(() => caches.match(event.request).then((cached) => cached ?? caches.match('/'))),
  )
})
