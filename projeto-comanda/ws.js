/* ===========================================================
   SERVICE WORKER - ESPETINHO & CIA
   Versão: v3 (Força atualização de scripts e correção de login)
   =========================================================== */

const CACHE_NAME = 'espetinho-cia-v3'; // Mudamos para v3 para limpar o cache antigo com erro

// Lista exata de arquivos que existem na sua pasta (Baseado na imagem enviada)
const assets = [
  './',                 // Raiz
  './index.html',       // Login
  './home.html',        // Menu Principal
  './venda.html',       // PDV
  './comandas.html',    // Gestão de Mesas
  './estorno.html',     // Auditoria
  './configuracoes.html', // Painel Admin
  './divisao.html',     // Pagamento Parcial
  './style.css',        // Estilos
  './scripts.js',       // Lógica do Sistema (Corrigido)
  './img/logo.jpg'      // Logomarca
];

// 1. INSTALAÇÃO: Tenta salvar os arquivos no cache
self.addEventListener('install', event => {
  self.skipWaiting(); // Força o SW a ativar imediatamente
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('[SW] Cache v3 iniciado');
        return cache.addAll(assets);
      })
      .catch(err => console.error('[SW] Erro ao salvar arquivos:', err))
  );
});

// 2. ATIVAÇÃO: Remove versões antigas (v1, v2...) para liberar espaço e evitar erros
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => {
      return Promise.all(
        keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key))
      );
    })
  );
  self.clients.claim(); // Assume o controle da página imediatamente
});

// 3. INTERCEPTAÇÃO (FETCH): Estratégia Network First (Rede Primeiro)
// Isso garante que você sempre pegue o 'scripts.js' mais novo se tiver internet.
// Se a internet cair, ele usa a versão salva no cache.
self.addEventListener('fetch', event => {
  // Ignora requisições para o Supabase ou outras APIs externas no cache de arquivos
  if (event.request.url.includes('supabase.co')) {
    return; // Deixa o navegador lidar com a API normalmente
  }

  event.respondWith(
    fetch(event.request)
      .then(response => {
        // Se a resposta for válida, clona ela pro cache (atualiza o cache em tempo real)
        const resClone = response.clone();
        caches.open(CACHE_NAME).then(cache => {
          cache.put(event.request, resClone);
        });
        return response;
      })
      .catch(() => {
        // Se a internet falhar, entrega o arquivo do cache
        return caches.match(event.request);
      })
  );
});