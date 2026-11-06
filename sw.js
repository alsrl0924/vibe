// 생성형AI용어집 서비스 워커: 한 번 접속하면 이후에는 인터넷 없이도 실행되도록 파일을 저장해 둡니다.
const CACHE = 'vibelearn-v10'; // 사용자별 기록 저장 지원
const CORE = [
  './', './index.html', './manifest.json',
  './css/app.css', './css/cloud.css', './js/lucide.min.js', './js/progress-core.js',
  './js/cloud-progress.js', './js/supabase-2.118.0.js', './fonts/PretendardVariable.woff2',
  './icons/icon-192.png', './icons/icon-512.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    await cache.addAll(CORE);
    self.skipWaiting();
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter((k) => k.startsWith('vibelearn-') && k !== CACHE).map((k) => caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  // Never cache authenticated API responses or interfere with another study app.
  const url = new URL(req.url);
  const scope = new URL(self.registration.scope);
  if (url.origin !== scope.origin || !url.pathname.startsWith(scope.pathname) || req.headers.has('authorization')) return;

  // 페이지(HTML): 인터넷이 되면 최신 버전, 안 되면 저장본
  if (req.mode === 'navigate') {
    event.respondWith((async () => {
      try {
        const res = await fetch(req);
        const cache = await caches.open(CACHE);
        if (res.ok) cache.put('./index.html', res.clone());
        return res;
      } catch (e) {
        return (await caches.match('./index.html')) || (await caches.match('./'));
      }
    })());
    return;
  }

  // 그 밖의 파일(CSS, JS, 폰트, 아이콘): 저장본을 바로 보여 주고, 뒤에서 최신 파일로 갱신
  event.respondWith((async () => {
    const cache = await caches.open(CACHE);
    const cached = await cache.match(req);
    const network = fetch(req).then((res) => {
      if (res && res.ok) cache.put(req, res.clone());
      return res;
    }).catch(() => null);
    if (cached) {
      event.waitUntil(network);
      return cached;
    }
    return (await network) || Response.error();
  })());
});
