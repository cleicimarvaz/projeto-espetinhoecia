/* ===========================================================
   SERVICE WORKER - ESPETINHO & CIA
   Versão: v4 (Assets corrigidos para estrutura real do projeto)
   =========================================================== */

const CACHE_NAME = 'espetinho-cia-v4';

const assets = [
    './',
    './index.html',
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
    // Componentes JS
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

// 1. INSTALAÇÃO: Salva os arquivos no cache
self.addEventListener('install', event => {
    self.skipWaiting();
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => {
                console.log('[SW v4] Cache iniciado');
                // addAll falha se qualquer arquivo der erro — usamos Promise.allSettled para tolerância
                return Promise.allSettled(
                    assets.map(url => cache.add(url).catch(err => console.warn(`[SW] Falha ao cachear: ${url}`, err)))
                );
            })
    );
});

// 2. ATIVAÇÃO: Remove versões antigas
self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys().then(keys =>
            Promise.all(keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key)))
        )
    );
    self.clients.claim();
});

// 3. FETCH: Network First com fallback para cache
// Garante que os scripts e dados estejam sempre atualizados quando há internet.
// Se cair offline, entrega a versão em cache.
self.addEventListener('fetch', event => {
    // Deixa o Supabase e CDNs externos passarem sem interceptar
    const url = event.request.url;
    if (url.includes('supabase.co') || url.includes('cdn.') || url.includes('unpkg.com')) {
        return;
    }

    // Só trata requisições GET
    if (event.request.method !== 'GET') return;

    event.respondWith(
        fetch(event.request)
            .then(response => {
                // Atualiza o cache com a versão mais nova
                const resClone = response.clone();
                caches.open(CACHE_NAME).then(cache => cache.put(event.request, resClone));
                return response;
            })
            .catch(() => {
                // Sem internet: entrega do cache
                return caches.match(event.request);
            })
    );
});