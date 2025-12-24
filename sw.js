const CACHE_NAME = 'espetinho-cia-v1';

// Lista de arquivos para salvar no cache (Offline)
const assets = [
  '/',
  'login.html',
  'home.html',
  'venda.html',
  'comandas.html',
  'produtos.html',
  'fechamento.html',
  'estorno.html',
  'configuracoes.html',
  'lancar.html',
  'divisao.html',
  'style.css',
  'scripts.js',
  'img/logo.jpg'
];

// Instalação: Salva os arquivos no cache
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      console.log('Cache aberto com sucesso!');
      return cache.addAll(assets);
    })
  );
});

// Ativação: Limpa caches antigos se houver atualização
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => {
      return Promise.all(
        keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key))
      );
    })
  );
});

// Estratégia: Tenta carregar do cache primeiro (Rapidez)
self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request).then(response => {
      return response || fetch(event.request);
    })
  );
});