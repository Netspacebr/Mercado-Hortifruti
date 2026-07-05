const CACHE_NAME = 'supermercado-app-cache-v10'; // Versão do cache incrementada
// Usar caminhos relativos é crucial para a compatibilidade.
const urlsToCache = [
  'index.html',
  'manifest.json',
  'favicon.ico',
  'logo192.png',
  'logo512.png'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Cache aberto. Adicionando o App Shell ao cache com caminhos relativos.');
        return cache.addAll(urlsToCache);
      })
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  const cacheWhitelist = [CACHE_NAME];
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheWhitelist.indexOf(cacheName) === -1) {
            console.log('Removendo cache antigo:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET' || event.request.url.includes('script.google.com')) {
    return;
  }

  // Estratégia para requisições de navegação
  if (event.request.mode === 'navigate') {
    event.respondWith(
      // Sempre serve o 'index.html' do cache.
      // A chave aqui é usar 'index.html' (relativo) e não '/index.html' (absoluto).
      caches.match('index.html')
        .then(cachedResponse => {
          if (cachedResponse) {
            return cachedResponse;
          }
          return fetch(event.request).catch(() => caches.match('index.html'));
        })
    );
    return;
  }

  // Estratégia "Cache, caindo para a Rede" para outros recursos
  event.respondWith(
    caches.match(event.request)
      .then(cachedResponse => {
        if (cachedResponse) {
          return cachedResponse;
        }

        return fetch(event.request).then(networkResponse => {
          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME)
            .then(cache => {
              cache.put(event.request, responseToCache);
            });
          return networkResponse;
        });
      })
  );
});