/* ===========================================================
   SERVICE WORKER - ESPETINHO & CIA
   Versão: v3.0-final (Estratégia Network First)
   =========================================================== */

const CACHE_NAME = 'espetinho-cia-v3-final';

// Lista de arquivos para funcionamento Offline
const assets = [
    './',
    './index.html',
    './manifest.json', // Vital para o PWA
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

// 1. INSTALAÇÃO: Cacheia os arquivos
self.addEventListener('install', event => {
    self.skipWaiting();
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => {
                console.log('[SW] Iniciando cache da Release 3.0');
                // Usamos allSettled para evitar que um erro em um arquivo trave todo o sistema
                return Promise.allSettled(
                    assets.map(url => cache.add(url).catch(err => console.warn(`[SW] Falha ao cachear: ${url}`, err)))
                );
            })
    );
});

// 2. ATIVAÇÃO: Limpa versões antigas (v1, v2, v4 antigas)
self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys().then(keys =>
            Promise.all(
                keys.filter(key => key !== CACHE_NAME)
                    .map(key => {
                        console.log('[SW] Removendo cache antigo:', key);
                        return caches.delete(key);
                    })
            )
        )
    );
    self.clients.claim();
});

// 3. FETCH: ESTRATÉGIA NETWORK FIRST
// Tenta buscar no GitHub primeiro. Se não tiver internet, usa o Cache.
self.addEventListener('fetch', event => {
    const url = event.request.url;

    // Ignora chamadas ao Banco de Dados (Supabase) e CDNs externos para evitar conflitos
    if (url.includes('supabase.co') || url.includes('cdn.') || url.includes('unpkg.com')) {
        return;
    }

    // Apenas intercepta requisições GET
    if (event.request.method !== 'GET') return;

    event.respondWith(
        fetch(event.request)
            .then(response => {
                // Se a rede respondeu, atualizamos o cache com a cópia nova
                const resClone = response.clone();
                caches.open(CACHE_NAME).then(cache => cache.put(event.request, resClone));
                return response;
            })
            .catch(() => {
                // Se estiver sem internet (OFFLINE), entrega o que estiver no cache
                return caches.match(event.request).then(cachedResponse => {
                    return cachedResponse || caches.match('./index.html');
                });
            })
    );
});