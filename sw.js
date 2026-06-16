/* =========================================================================
   SERVICE WORKER - ESPETINHO & CIA
   Versão: v3.1.0 (Release Final - Network First)
   ========================================================================= */

// Nome do cache - Altere este número (ex: v3.1.0) sempre que subir novo JS/HTML
const CACHE_NAME = 'espetinho-cia-v3.3.0';

// Lista integral de arquivos para funcionamento Offline
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

self.addEventListener('install', event => {
    // Pula o estado "esperando" e ativa imediatamente
    self.skipWaiting();

    event.waitUntil(
        caches.open(CACHE_NAME).then(cache => {
            console.log('[SW] Cacheando versão v4.0.0');
            // Adiciona todos os arquivos
            return cache.addAll(assets);
        })
    );
});

// 2. ATIVAÇÃO: Remove caches de versões anteriores
self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys().then(keys => {
            return Promise.all(
                keys.filter(key => key !== CACHE_NAME).map(key => {
                    console.log('[SW] Removendo cache antigo:', key);
                    return caches.delete(key);
                })
            );
        })
    );
    // Garante que o SW controle as abas abertas imediatamente
    self.clients.claim();
});

// 3. FETCH: ESTRATÉGIA NETWORK FIRST (Rede primeiro, depois Cache)
self.addEventListener('fetch', event => {
    const url = event.request.url;

    // Ignora chamadas de API externas e Banco de Dados para não causar conflitos de dados
    if (
        url.includes('supabase.co') || 
        url.includes('cdn.') || 
        url.includes('unpkg.com') || 
        event.request.method !== 'GET'
    ) {
        return;
    }

    event.respondWith(
        fetch(event.request)
            .then(networkResponse => {
                // Se houver internet, clona a resposta e atualiza o cache
                const responseToCache = networkResponse.clone();
                caches.open(CACHE_NAME).then(cache => {
                    cache.put(event.request, responseToCache);
                });
                return networkResponse;
            })
            .catch(() => {
                // Se estiver OFFLINE, busca no cache
                return caches.match(event.request).then(cachedResponse => {
                    if (cachedResponse) {
                        return cachedResponse;
                    }
                    // Se não houver cache e for uma navegação de página, retorna a home
                    if (event.request.mode === 'navigate') {
                        return caches.match('./index.html');
                    }
                });
            })
    );
});