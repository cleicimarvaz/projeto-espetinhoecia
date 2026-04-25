/* =========================================================================
   SERVICE WORKER - ESPETINHO & CIA
<<<<<<< HEAD
   Versão: v3.1.0 (Release Final - Network First)
   ========================================================================= */

// Nome do cache - Altere este número (ex: v3.1.0) sempre que subir novo JS/HTML
const CACHE_NAME = 'espetinho-cia-v3.1.0';

// Lista integral de arquivos para funcionamento Offline
=======
   Versão: v3.1-REVISADO (Força atualização e limpa cache antigo)
   =========================================================== */

const CACHE_NAME = 'espetinho-cia-v3.1-force'; // MUDADO PARA FORÇAR RESET

>>>>>>> abc4587392cf4f48e0803fa4d7bd7566021010db
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

<<<<<<< HEAD
// 1. INSTALAÇÃO: Armazena os arquivos no Cache
=======
>>>>>>> abc4587392cf4f48e0803fa4d7bd7566021010db
self.addEventListener('install', event => {
    // Força o novo Service Worker a assumir o controle imediatamente
    self.skipWaiting();
    
    event.waitUntil(
        caches.open(CACHE_NAME).then(cache => {
<<<<<<< HEAD
            console.log('[SW] Cacheando todos os ativos da nova versão');
            return Promise.allSettled(
                assets.map(url => {
                    return cache.add(url).catch(err => {
                        console.warn(`[SW] Erro ao cachear arquivo: ${url}`, err);
                    });
                })
=======
            console.log('[SW 3.1] Forçando novo cache');
            return Promise.allSettled(
                assets.map(url => cache.add(url).catch(err => console.warn(`Falha: ${url}`, err)))
>>>>>>> abc4587392cf4f48e0803fa4d7bd7566021010db
            );
        })
    );
});

<<<<<<< HEAD
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
=======
self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys().then(keys =>
            Promise.all(keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key)))
        )
>>>>>>> abc4587392cf4f48e0803fa4d7bd7566021010db
    );
    // Garante que o SW controle as abas abertas imediatamente
    self.clients.claim();
});

<<<<<<< HEAD
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
=======
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
>>>>>>> abc4587392cf4f48e0803fa4d7bd7566021010db
    );
});
