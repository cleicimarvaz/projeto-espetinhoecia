/* =============================================================
   1. NÚCLEO E CONFIGURAÇÕES GLOBAIS (BANCO DE DADOS)
   ============================================================= */
const DB = {
    get: (key) => JSON.parse(localStorage.getItem(key)) || [],
    set: (key, data) => localStorage.setItem(key, JSON.stringify(data)),
    getConfig: () => localStorage.getItem('cfg_nome_evento') || "Espetinho & Cia"
};

// Registro do Service Worker para PWA
if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js').catch(err => console.log("Erro PWA", err));
}

/* =============================================================
   2. NAVEGAÇÃO E INTERFACE (UI)
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

// Router: Inicializa funções específicas de acordo com o ID do Body
document.addEventListener('DOMContentLoaded', () => {
    initNavbar();
    if (document.getElementById('login-page')) { /* Lógica no botão onclick */ }
    if (document.getElementById('home-page')) initHome();
    if (document.getElementById('venda-page')) renderizarVenda();
    if (document.getElementById('comandas-page')) renderizarComandas();
    if (document.getElementById('produtos-page')) renderizarCatalogo();
    if (document.getElementById('config-page')) { /* Já carregado via inputs */ }
    if (document.getElementById('fechamento-page')) gerarRelatorioFechamento();
    if (document.getElementById('estorno-page')) renderizarEstornos();
    if (document.getElementById('lancar-page')) initLancamento();
    if (document.getElementById('divisao-page')) initDivisao();
});

/* =============================================================
   3. MÓDULO: AUTENTICAÇÃO E HOME
   ============================================================= */
function fazerLogin() {
    const user = document.getElementById('user').value.toLowerCase().trim();
    if (user === 'admin' || user === 'vendedor') {
        localStorage.setItem('userRole', user);
        window.location.href = 'home.html';
    } else { alert("Usuário não reconhecido!"); }
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

/* =============================================================
   4. MÓDULO: VENDAS DIRETAS (CARRINHO)
   ============================================================= */
let carrinho = [];

function renderizarVenda(lista) {
    const container = document.getElementById('lista-venda');
    const produtos = lista || DB.get('produtos_delta');
    if (!container) return;
    container.innerHTML = produtos.length === 0 
        ? `<div class="card-cia text-center py-10 text-slate-400">Nenhum produto cadastrado.</div>`
        : produtos.map(p => `
            <div class="card-cia flex items-center justify-between" onclick="adicionarAoCarrinho(${p.id})">
                <div class="flex items-center space-x-4">
                    <div class="text-2xl">${p.categoria === 'Bebidas' ? '🥤' : '🍢'}</div>
                    <div><h4 class="font-bold">${p.nome}</h4><p class="text-red-500 font-bold">R$ ${parseFloat(p.preco).toFixed(2)}</p></div>
                </div>
                <div class="bg-slate-100 w-10 h-10 rounded-full flex items-center justify-center text-red-500 font-bold">+</div>
            </div>`).join('');
}

function filtrarProdutos() {
    const termo = document.getElementById('busca-produto').value.toLowerCase();
    const filtrados = DB.get('produtos_delta').filter(p => p.nome.toLowerCase().includes(termo));
    renderizarVenda(filtrados);
}

function adicionarAoCarrinho(id) {
    const p = DB.get('produtos_delta').find(i => i.id === id);
    carrinho.push(p);
    atualizarCarrinhoUI();
}

function atualizarCarrinhoUI() {
    const cartPanel = document.getElementById('cart');
    if (carrinho.length > 0) {
        cartPanel.classList.remove('hidden');
        document.getElementById('total-val').innerText = `R$ ${carrinho.reduce((s, i) => s + parseFloat(i.preco), 0).toFixed(2)}`;
        document.getElementById('cart-count').innerText = `${carrinho.length} itens`;
    } else { cartPanel.classList.add('hidden'); }
}

function limparCarrinho() { carrinho = []; atualizarCarrinhoUI(); }

function finalizarVenda() {
    const total = carrinho.reduce((s, i) => s + parseFloat(i.preco), 0);
    const historico = DB.get('historico_vendas');
    const novaVenda = {
        id: Date.now(),
        hora: new Date().toLocaleTimeString('pt-BR', {hour:'2-digit', minute:'2-digit'}),
        total: total,
        metodo: "Dinheiro",
        itens_resumo: carrinho.map(i => i.nome).join(', '),
        produtos: [...carrinho]
    };
    historico.unshift(novaVenda);
    DB.set('historico_vendas', historico);
    alert(`Venda finalizada no evento: ${DB.getConfig()}`);
    limparCarrinho();
}

/* =============================================================
   5. MÓDULO: COMANDAS E QR CODE
   ============================================================= */
function renderizarComandas() {
    const container = document.getElementById('lista-comandas');
    const comandas = DB.get('comandas_cia');
    if (!container) return;
    container.innerHTML = comandas.length === 0 
        ? `<div class="card-cia text-center py-12 italic text-slate-400">Nenhum cliente em atendimento.</div>`
        : comandas.map(c => `
            <div class="card-cia flex items-center justify-between border-l-4 border-blue-500 mb-3">
                <div><h3 class="font-bold">${c.nome}</h3><p class="text-[9px] font-bold text-slate-400">MESA ${c.mesa || 'S/M'}</p></div>
                <div class="flex items-center space-x-2">
                    <button onclick="abrirModalQR(${c.id}, '${c.nome}')" class="text-[9px] font-black">🖨️ QR</button>
                    <a href="lancar.html?id=${c.id}" class="bg-slate-100 p-3 rounded-xl">➕</a>
                </div>
            </div>`).join('');
}

function abrirNovaComanda() {
    const input = document.getElementById('nome-cliente');
    if (!input || !input.value.trim()) return alert("Nome obrigatório!");
    let comandas = DB.get('comandas_cia');
    comandas.unshift({ id: Date.now(), nome: input.value, mesa: null, codigo: Math.floor(1000 + Math.random() * 9000), total: 0, itens: [] });
    DB.set('comandas_cia', comandas);
    input.value = ""; renderizarComandas();
}

function vincularMesa(id) {
    const mesa = prompt("Número da mesa:");
    if (mesa) {
        let comandas = DB.get('comandas_cia');
        const idx = comandas.findIndex(c => c.id === id);
        comandas[idx].mesa = mesa;
        DB.set('comandas_cia', comandas);
        renderizarComandas();
    }
}

function gerarQRCodeComanda(idComanda, containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;
    container.innerHTML = "";
    const urlBase = window.location.origin + window.location.pathname.replace(/\/[^\/]*$/, '');
    new QRCode(container, { text: `${urlBase}/lancar.html?id=${idComanda}`, width: 128, height: 128 });
}

function abrirModalQR(id, nome) {
    document.getElementById('qr-nome-cliente').innerText = `Comanda: ${nome}`;
    document.getElementById('modal-qr').classList.remove('hidden');
    gerarQRCodeComanda(id, 'qrcode');
}

function fecharModalQR() { document.getElementById('modal-qr').classList.add('hidden'); }

/* =============================================================
   6. MÓDULO: LANÇAMENTO E DIVISÃO
   ============================================================= */
let itensTemporarios = [];
let comandaAtual = null;

function initLancamento() {
    const id = new URLSearchParams(window.location.search).get('id');
    const comandas = DB.get('comandas_cia');
    comandaAtual = comandas.find(c => c.id == id);
    if (!comandaAtual) return window.location.href = 'comandas.html';
    document.getElementById('nome-cliente-view').innerText = comandaAtual.nome;
    document.getElementById('mesa-view').innerText = `Mesa: ${comandaAtual.mesa || 'S/M'}`;
    const produtos = DB.get('produtos_delta');
    document.getElementById('lista-para-lancar').innerHTML = produtos.map(p => `
        <div class="card-cia flex justify-between" onclick="adicionarTemporario(${p.id})">
            <div><h4 class="font-bold">${p.nome}</h4><p class="text-blue-600 font-bold">R$ ${parseFloat(p.preco).toFixed(2)}</p></div>
            <div class="bg-blue-50 w-8 h-8 rounded-full flex items-center justify-center text-blue-600 font-bold">+</div>
        </div>`).join('');
}

function adicionarTemporario(id) {
    const p = DB.get('produtos_delta').find(i => i.id === id);
    itensTemporarios.push(p);
    document.getElementById('resumo-lancamento').classList.remove('hidden');
    document.getElementById('total-sessao').innerText = `R$ ${itensTemporarios.reduce((s, i) => s + parseFloat(i.preco), 0).toFixed(2)}`;
}

function confirmarLancamento() {
    let comandas = DB.get('comandas_cia');
    const idx = comandas.findIndex(c => c.id == comandaAtual.id);
    comandas[idx].itens = [...(comandas[idx].itens || []), ...itensTemporarios];
    comandas[idx].total = comandas[idx].itens.reduce((s, i) => s + parseFloat(i.preco), 0);
    DB.set('comandas_cia', comandas);
    window.location.href = 'comandas.html';
}

/* =============================================================
   7. MÓDULO: GESTÃO (PRODUTOS / FECHAMENTO / ESTORNO)
   ============================================================= */
function renderizarCatalogo() {
    const container = document.getElementById('lista-catalogo');
    const produtos = DB.get('produtos_delta');
    if (!container) return;
    container.innerHTML = produtos.map(p => `
        <div class="card-cia flex justify-between items-center mb-2">
            <div><h4 class="font-bold text-sm">${p.nome}</h4><p class="text-[10px] text-slate-400">R$ ${parseFloat(p.preco).toFixed(2)}</p></div>
            <button onclick="excluirProduto(${p.id})" class="text-red-400">🗑️</button>
        </div>`).join('');
}

function salvarProduto() {
    const nome = document.getElementById('p-nome').value;
    const preco = parseFloat(document.getElementById('p-preco').value);
    if (!nome || isNaN(preco)) return alert("Dados inválidos!");
    let produtos = DB.get('produtos_delta');
    produtos.unshift({ id: Date.now(), nome, preco, categoria: document.getElementById('p-categoria').value, estoque: document.getElementById('p-estoque').value });
    DB.set('produtos_delta', produtos);
    location.reload();
}

function excluirProduto(id) {
    if (confirm("Excluir item?")) {
        let produtos = DB.get('produtos_delta').filter(p => p.id !== id);
        DB.set('produtos_delta', produtos); renderizarCatalogo();
    }
}

function gerarRelatorioFechamento() {
    const historico = DB.get('historico_vendas');
    const total = historico.reduce((s, v) => s + v.total, 0);
    document.getElementById('total-geral').innerText = `R$ ${total.toFixed(2)}`;
    // (Pode adicionar lógica de ranking aqui se desejar)
}

function renderizarEstornos() {
    const container = document.getElementById('lista-estornos');
    const historico = DB.get('historico_vendas');
    if (!container) return;
    container.innerHTML = historico.map(v => `
        <div class="card-cia border-l-4 border-red-500 mb-4">
            <h4 class="font-bold text-xs uppercase">ID #${v.id} - ${v.hora}</h4>
            <p class="text-sm font-black text-red-600">R$ ${v.total.toFixed(2)}</p>
            <button onclick="confirmarEstorno(${v.id})" class="w-full bg-red-50 text-red-600 py-2 mt-3 rounded-xl font-bold text-[10px] uppercase">Estornar</button>
        </div>`).join('');
}

function confirmarEstorno(id) {
    if (confirm("Confirmar cancelamento?")) {
        let historico = DB.get('historico_vendas').filter(v => v.id !== id);
        DB.set('historico_vendas', historico); renderizarEstornos();
    }
}

/* =============================================================
   8. MÓDULO: CONFIGURAÇÕES
   ============================================================= */
function salvarConfig() {
    const nome = document.getElementById('cfg-evento').value;
    localStorage.setItem('cfg_nome_evento', nome); alert("Evento Atualizado!");
}

function limparVendas() { if(confirm("Zerar relatório?")) localStorage.removeItem('historico_vendas'); }
function limparComandas() { if(confirm("Fechar comandas?")) localStorage.removeItem('comandas_cia'); location.reload(); }
