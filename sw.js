/* ===========================================================
   SERVICE WORKER - ESPETINHO & CIA
   Versão: v3.1-REVISADO (Força atualização e limpa cache antigo)
   =========================================================== */

const CACHE_NAME = 'espetinho-cia-v3.1-force'; // MUDADO PARA FORÇAR RESET

const assets = [
    './',
    './index.html',
    './manifest.json',
    './home.html',
    './venda.html',
    './comandas.html',
    './estorno.html',
    './configuracoes.html',
    './divisao.html',
    './historico-caixas.html',
    './cozinha.html',
    './style.css',
    './img/logo.jpg',
    './componentes/config.js',
    './componentes/database.js',
    './componentes/utils.js',
    './componentes/login.js',
    './componentes/audit.js',
    './componentes/produtos.js',
    './componentes/vendas.js',
    './componentes/comandas.js',
    './componentes/caixa.js',
    './componentes/caixa-reports.js',
    './componentes/user.js',
    './componentes/cozinha.js',
    './componentes/ui.js',
    './componentes/print.js',
    './componentes/dashboard.js',
    './componentes/main.js'
];

self.addEventListener('install', event => {
    self.skipWaiting();
    event.waitUntil(
        caches.open(CACHE_NAME).then(cache => {
            console.log('[SW 3.1] Forçando novo cache');
            return Promise.allSettled(
                assets.map(url => cache.add(url).catch(err => console.warn(`Falha: ${url}`, err)))
            );
        })
    );
});

self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys().then(keys =>
            Promise.all(keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key)))
        )
    );
    self.clients.claim();
});

self.addEventListener('fetch', event => {
    const url = event.request.url;
    if (url.includes('supabase.co') || url.includes('cdn.') || url.includes('unpkg.com')) return;
    if (event.request.method !== 'GET') return;

    event.respondWith(
        fetch(event.request)
            .then(response => {
                const resClone = response.clone();
                caches.open(CACHE_NAME).then(cache => cache.put(event.request, resClone));
                return response;
            })
            .catch(() => caches.match(event.request).then(res => res || caches.match('./index.html')))
    );
});
