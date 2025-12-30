const CACHE_NAME = 'espetinho-app-v1';
const ASSETS = [
  './',
  './index.html',
  './home.html',
  './venda.html',
  './comandas.html',
  './configuracoes.html',
  './divisao.html',
  './estorno.html',
  './style.css',
  './scripts.js',
  './img/logo.jpg',
  'https://cdn.tailwindcss.com',
  'https://cdn.jsdelivr.net/npm/chart.js',
  'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2'
];

// 1. Instalação: Cacheia os arquivos estáticos
self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS);
    })
  );
});

// 2. Ativação: Limpa caches antigos se mudar a versão
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) return caches.delete(key);
        })
      );
    })
  );
});

// 3. Interceptação: Serve arquivos do cache se offline, ou busca na rede
self.addEventListener('fetch', (e) => {
  // Ignora requisições para o Supabase (sempre online)
  if (e.request.url.includes('supabase.co')) return;

  e.respondWith(
    caches.match(e.request).then((response) => {
      return response || fetch(e.request);
    })
  );
});