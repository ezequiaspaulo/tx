// Atualize este nome sempre que quiser forçar uma nova versão (ex: v17, v18)
const CACHE_NAME = 'tx-tracker-v16';

// Arquivos locais essenciais para o funcionamento offline
const ASSETS_TO_CACHE = [
  './',
  './index.html',
  './css/style.css',
  './js/app.js',
  './manifest.json',
  './imgs/tx.jpg',
  './imgs/rangerprata-lateral.png'
];

self.addEventListener('install', (e) => {
  self.skipWaiting(); // Força o SW a instalar imediatamente
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return Promise.allSettled(
        ASSETS_TO_CACHE.map(url => cache.add(url).catch(err => console.warn(`Falha ao cachear ${url}:`, err)))
      );
    })
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          // Deleta todos os caches antigos que não sejam a versão atual
          if (cacheName !== CACHE_NAME) {
            console.log('Limpando cache antigo:', cacheName);
            return caches.delete(cacheName); 
          }
        })
      );
    })
  );
  self.clients.claim(); // Assume o controle da página na mesma hora
});

self.addEventListener('fetch', (e) => {
  // Ignora requisições não-GET, Supabase (Banco/Auth) e Extensões do Chrome
  if (
      e.request.method !== 'GET' || 
      e.request.url.includes('supabase.co') || 
      e.request.url.startsWith('chrome-extension://')
  ) {
      return; 
  }

  // NOVA ESTRATÉGIA: Network-First (Rede Primeiro), Fallback para Cache
  e.respondWith(
    fetch(e.request)
      .then((networkResponse) => {
        // Se a rede funcionou e retornou ok, clona a resposta e atualiza o cache silenciosamente
        if (networkResponse && networkResponse.status === 200 && networkResponse.type === 'basic') {
          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(e.request, responseToCache);
          });
        }
        return networkResponse; // Retorna o arquivo fresquinho da rede
      })
      .catch(() => {
        // Se a rede falhar (usuário sem internet), busca no cache
        console.warn('Buscando do cache (Offline):', e.request.url);
        return caches.match(e.request);
      })
  );
});