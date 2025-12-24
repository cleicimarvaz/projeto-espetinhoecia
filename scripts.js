/* =============================================================
   1. NÚCLEO E CONFIGURAÇÕES GLOBAIS
   ============================================================= */
const DB = {
    get: (key) => JSON.parse(localStorage.getItem(key)) || [],
    set: (key, data) => localStorage.setItem(key, JSON.stringify(data)),
    getConfig: () => localStorage.getItem('cfg_nome_evento') || "Espetinho & Cia"
};

// Registro do Service Worker (PWA)
if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js').catch(err => console.log("Erro PWA", err));
}

/* =============================================================
   2. UTILITÁRIOS (NAVBAR E QR CODE)
   ============================================================= */
function initNavbar() {
    const page = window.location.pathname.split("/").pop() || "home.html";
    const rotas = {
        'home.html': 'nav-home', 'venda.html': 'nav-venda',
        'comandas.html': 'nav-comandas', 'lancar.html': 'nav-comandas',
        'divisao.html': 'nav-comandas', 'produtos.html': 'nav-admin',
        'fechamento.html': 'nav-admin', 'configuracoes.html': 'nav-admin',
        'estorno.html': 'nav-admin'
    };
    const activeId = rotas[page];
    if (activeId && document.getElementById(activeId)) {
        document.getElementById(activeId).classList.add('active');
    }
}

function gerarQRCodeComanda(idComanda, containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;
    container.innerHTML = "";
    const urlBase = window.location.origin + window.location.pathname.replace(/\/[^\/]*$/, '');
    const linkAcesso = `${urlBase}/lancar.html?id=${idComanda}`;

    new QRCode(container, {
        text: linkAcesso, width: 150, height: 150,
        colorDark : "#1e293b", colorLight : "#ffffff",
        correctLevel : QRCode.CorrectLevel.H
    });
}

/* =============================================================
   3. INICIALIZAÇÃO POR PÁGINA
   ============================================================= */
document.addEventListener('DOMContentLoaded', () => {
    initNavbar();

    if (document.getElementById('home-page')) initHome();
    if (document.getElementById('venda-page')) renderizarVenda();
    if (document.getElementById('comandas-page')) renderizarComandas();
    if (document.getElementById('produtos-page')) renderizarCatalogo();
    if (document.getElementById('config-page')) initConfig();
    if (document.getElementById('fechamento-page')) gerarRelatorioFechamento();
    if (document.getElementById('estorno-page')) renderizarEstornos();
    if (document.getElementById('lancar-page')) initLancamento();
    if (document.getElementById('divisao-page')) initDivisao();
});

/* =============================================================
   4. MÓDULOS DE NEGÓCIO
   ============================================================= */

// --- LOGIN & SEGURANÇA ---
function fazerLogin() {
    const user = document.getElementById('user').value.toLowerCase().trim();
    if (user === 'admin' || user === 'vendedor') {
        localStorage.setItem('userRole', user);
        window.location.href = 'home.html';
    } else { alert("Usuário inválido!"); }
}

function logout() {
    localStorage.removeItem('userRole');
    window.location.href = 'login.html';
}

function initHome() {
    const role = localStorage.getItem('userRole');
    if (!role) window.location.href = 'login.html';
    if (document.getElementById('role-badge')) document.getElementById('role-badge').innerText = role;
    if (role === 'admin' && document.getElementById('admin-area')) {
        document.getElementById('admin-area').classList.remove('hidden');
    }
}

// --- VENDAS DIRETAS ---
let carrinho = [];
function renderizarVenda(lista) {
    const container = document.getElementById('lista-venda');
    const produtos = lista || DB.get('produtos_delta');
    if (!container) return;
    container.innerHTML = produtos.map(p => `
        <div class="card-cia flex items-center justify-between" onclick="adicionarAoCarrinho(${p.id})">
            <div class="flex items-center space-x-4">
                <div class="text-2xl">${p.categoria === 'Bebidas' ? '🥤' : '🍢'}</div>
                <div><h4 class="font-bold">${p.nome}</h4><p class="text-red-500 font-bold">R$ ${p.preco.toFixed(2)}</p></div>
            </div>
            <div class="bg-slate-100 w-8 h-8 rounded-full flex items-center justify-center text-red-500 font-bold">+</div>
        </div>`).join('');
}

function adicionarAoCarrinho(id) {
    const p = DB.get('produtos_delta').find(i => i.id === id);
    carrinho.push(p);
    const cart = document.getElementById('cart');
    cart.classList.remove('hidden');
    document.getElementById('total-val').innerText = `R$ ${carrinho.reduce((s, i) => s + i.preco, 0).toFixed(2)}`;
    document.getElementById('cart-count').innerText = `${carrinho.length} itens`;
}

function limparCarrinho() { carrinho = []; document.getElementById('cart').classList.add('hidden'); }

function finalizarVenda() {
    const total = carrinho.reduce((s, i) => s + i.preco, 0);
    const historico = DB.get('historico_vendas');
    historico.unshift({ id: Date.now(), total, metodo: "Dinheiro", produtos: [...carrinho], hora: new Date().toLocaleTimeString() });
    DB.set('historico_vendas', historico);
    alert("Venda Finalizada!");
    limparCarrinho();
}

// --- COMANDAS ---
function renderizarComandas() {
    const container = document.getElementById('lista-comandas');
    const comandas = DB.get('comandas_cia');
    if (!container) return;
    container.innerHTML = comandas.map(c => `
        <div class="card-cia flex items-center justify-between border-l-4 border-blue-500">
            <div><h3 class="font-bold">${c.nome}</h3><p class="text-[10px] font-bold text-slate-400">MESA ${c.mesa || 'S/M'}</p></div>
            <div class="flex items-center space-x-2">
                <button onclick="abrirModalQR(${c.id}, '${c.nome}')" class="text-xs">🖨️ QR</button>
                <a href="lancar.html?id=${c.id}" class="bg-slate-100 p-2 rounded-lg">➕</a>
            </div>
        </div>`).join('');
}

function abrirModalQR(id, nome) {
    document.getElementById('qr-nome-cliente').innerText = nome;
    document.getElementById('modal-qr').classList.remove('hidden');
    gerarQRCodeComanda(id, 'qrcode');
}

function fecharModalQR() { document.getElementById('modal-qr').classList.add('hidden'); }

// --- LANÇAMENTO E DIVISÃO ---
let itensLancamento = [];
function adicionarTemporario(id) {
    const p = DB.get('produtos_delta').find(i => i.id === id);
    itensLancamento.push(p);
    document.getElementById('resumo-lancamento').classList.remove('hidden');
    document.getElementById('total-sessao').innerText = `R$ ${itensLancamento.reduce((s, i) => s + i.preco, 0).toFixed(2)}`;
}

function confirmarLancamento() {
    const id = new URLSearchParams(window.location.search).get('id');
    let comandas = DB.get('comandas_cia');
    const idx = comandas.findIndex(c => c.id == id);
    comandas[idx].itens = [...(comandas[idx].itens || []), ...itensLancamento];
    comandas[idx].total = comandas[idx].itens.reduce((s, i) => s + i.preco, 0);
    DB.set('comandas_cia', comandas);
    window.location.href = 'comandas.html';
}

// --- GESTÃO (PRODUTOS / FECHAMENTO / ESTORNO) ---
function renderizarCatalogo() {
    const container = document.getElementById('lista-catalogo');
    const produtos = DB.get('produtos_delta');
    if (!container) return;
    container.innerHTML = produtos.map(p => `
        <div class="card-cia flex justify-between items-center">
            <div><h4 class="font-bold">${p.nome}</h4><p class="text-xs text-slate-400">R$ ${p.preco.toFixed(2)}</p></div>
            <button onclick="excluirProduto(${p.id})" class="text-red-500">🗑️</button>
        </div>`).join('');
}

function salvarProduto() {
    const nome = document.getElementById('p-nome').value;
    const preco = parseFloat(document.getElementById('p-preco').value);
    const produtos = DB.get('produtos_delta');
    produtos.unshift({ id: Date.now(), nome, preco, categoria: document.getElementById('p-categoria').value });
    DB.set('produtos_delta', produtos);
    renderizarCatalogo();
}

function gerarRelatorioFechamento() {
    const historico = DB.get('historico_vendas');
    const total = historico.reduce((s, v) => s + v.total, 0);
    document.getElementById('total-geral').innerText = `R$ ${total.toFixed(2)}`;
}