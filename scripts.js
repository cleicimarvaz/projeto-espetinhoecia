/* =============================================================
   1. CONEXÃO E CONFIGURAÇÃO SUPABASE
   ============================================================= */
const SUPABASE_URL = 'https://vtexlttnjzmgknmbwbwl.supabase.co';
const SUPABASE_KEY = 'sb_publishable_C5SP_ulU5lhJjTdokxdegA_6ZIdeGPk'; 
const _supabase = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// Registro do Service Worker (PWA)
if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js').catch(err => console.log("Erro PWA", err));
}

/* =============================================================
   2. OBJETO DB - OPERAÇÕES EM NUVEM (ASYNC)
   ============================================================= */
const DB = {
    // CONFIGURAÇÕES (Mantidas localmente para rapidez)
    getConfig: () => localStorage.getItem('cfg_nome_evento') || "Espetinho & Cia",

    // MÓDULO: PRODUTOS
    getProdutos: async () => {
        const { data, error } = await _supabase.from('produtos').select('*').order('nome');
        if (error) console.error("Erro ao buscar produtos:", error);
        return data || [];
    },
    addProduto: async (produto) => {
        const { error } = await _supabase.from('produtos').insert([produto]);
        if (error) throw error;
    },
    deleteProduto: async (id) => {
        const { error } = await _supabase.from('produtos').delete().eq('id', id);
        if (error) throw error;
    },

    // MÓDULO: COMANDAS
    getComandas: async () => {
        const { data, error } = await _supabase.from('comandas').select('*').order('created_at', { ascending: false });
        if (error) console.error("Erro ao buscar comandas:", error);
        return data || [];
    },
    getComandaPorId: async (id) => {
        const { data, error } = await _supabase.from('comandas').select('*').eq('id', id).single();
        if (error) throw error;
        return data;
    },
    addComanda: async (comanda) => {
        const { error } = await _supabase.from('comandas').insert([comanda]);
        if (error) throw error;
    },
    updateComanda: async (id, dados) => {
        const { error } = await _supabase.from('comandas').update(dados).eq('id', id);
        if (error) throw error;
    },

    // MÓDULO: VENDAS (HISTÓRICO)
    getVendas: async () => {
        const { data, error } = await _supabase.from('historico_vendas').select('*').order('created_at', { ascending: false });
        return data || [];
    },
    addVenda: async (venda) => {
        const { error } = await _supabase.from('historico_vendas').insert([venda]);
        if (error) throw error;
    }
};

/* =============================================================
   3. INICIALIZAÇÃO E ROUTER DE INTERFACE
   ============================================================= */
document.addEventListener('DOMContentLoaded', async () => {
    initNavbar();
    
    // Identifica a página e carrega o módulo correspondente
    if (document.getElementById('home-page')) initHome();
    if (document.getElementById('venda-page')) renderizarVenda();
    if (document.getElementById('comandas-page')) renderizarComandas();
    if (document.getElementById('produtos-page')) renderizarCatalogo();
    if (document.getElementById('fechamento-page')) gerarRelatorioFechamento();
    if (document.getElementById('estorno-page')) renderizarEstornos();
    if (document.getElementById('lancar-page')) initLancamento();
    if (document.getElementById('divisao-page')) initDivisao();
});

/* =============================================================
   4. FUNÇÕES DE NEGÓCIO (LÓGICA DO APP)
   ============================================================= */

// --- AUTENTICAÇÃO ---
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

// --- VENDAS DIRETAS ---
let carrinho = [];
async function renderizarVenda() {
    const container = document.getElementById('lista-venda');
    if (!container) return;
    const produtos = await DB.getProdutos();
    container.innerHTML = produtos.map(p => `
        <div class="card-cia flex items-center justify-between" onclick="adicionarAoCarrinho('${p.nome}', ${p.preco})">
            <div class="flex items-center space-x-4">
                <div class="text-2xl">${p.categoria === 'Bebidas' ? '🥤' : '🍢'}</div>
                <div><h4 class="font-bold">${p.nome}</h4><p class="text-red-500 font-bold">R$ ${p.preco.toFixed(2)}</p></div>
            </div>
            <div class="bg-slate-100 w-10 h-10 rounded-full flex items-center justify-center text-red-500 font-bold">+</div>
        </div>`).join('');
}

function adicionarAoCarrinho(nome, preco) {
    carrinho.push({ nome, preco });
    const total = carrinho.reduce((s, i) => s + i.preco, 0);
    document.getElementById('cart').classList.remove('hidden');
    document.getElementById('total-val').innerText = `R$ ${total.toFixed(2)}`;
    document.getElementById('cart-count').innerText = `${carrinho.length} itens`;
}

async function finalizarVenda() {
    const total = carrinho.reduce((s, i) => s + i.preco, 0);
    const venda = { total, metodo: "Dinheiro", produtos: [...carrinho] };
    await DB.addVenda(venda);
    alert("Venda registrada na nuvem!");
    carrinho = [];
    document.getElementById('cart').classList.add('hidden');
}

// --- COMANDAS ---
async function abrirNovaComanda() {
    const input = document.getElementById('nome-cliente');
    if (!input || !input.value.trim()) return alert("Nome obrigatório!");
    const nova = { nome: input.value, mesa: null, codigo: Math.floor(1000 + Math.random() * 9000).toString(), total: 0, itens: [] };
    await DB.addComanda(nova);
    input.value = ""; renderizarComandas();
}

async function renderizarComandas() {
    const container = document.getElementById('lista-comandas');
    if (!container) return;
    const comandas = await DB.getComandas();
    container.innerHTML = comandas.map(c => `
        <div class="card-cia flex items-center justify-between border-l-4 border-blue-500 mb-3 shadow-sm">
            <div><h3 class="font-bold">${c.nome}</h3><p class="text-[9px] font-bold text-slate-400 uppercase">MESA ${c.mesa || 'S/M'}</p></div>
            <div class="flex items-center space-x-2">
                <button onclick="abrirModalQR(${c.id}, '${c.nome}')" class="text-[9px] font-black uppercase">🖨️ QR</button>
                <a href="lancar.html?id=${c.id}" class="bg-slate-100 p-3 rounded-xl text-slate-400">➕</a>
            </div>
        </div>`).join('');
}

// --- LANÇAMENTOS ---
let itensTemporarios = [];
let comandaAtualId = null;

async function initLancamento() {
    comandaAtualId = new URLSearchParams(window.location.search).get('id');
    const comanda = await DB.getComandaPorId(comandaAtualId);
    document.getElementById('nome-cliente-view').innerText = comanda.nome;
    document.getElementById('mesa-view').innerText = `Mesa: ${comanda.mesa || 'S/M'}`;
    const produtos = await DB.getProdutos();
    document.getElementById('lista-para-lancar').innerHTML = produtos.map(p => `
        <div class="card-cia flex justify-between" onclick="addTempLancamento('${p.nome}', ${p.preco})">
            <div><h4 class="font-bold">${p.nome}</h4><p class="text-blue-600 font-bold">R$ ${p.preco.toFixed(2)}</p></div>
            <div class="bg-blue-50 w-8 h-8 rounded-full flex items-center justify-center text-blue-600 font-bold">+</div>
        </div>`).join('');
}

function addTempLancamento(nome, preco) {
    itensTemporarios.push({ nome, preco });
    document.getElementById('resumo-lancamento').classList.remove('hidden');
    document.getElementById('total-sessao').innerText = `R$ ${itensTemporarios.reduce((s, i) => s + i.preco, 0).toFixed(2)}`;
}

async function confirmarLancamento() {
    const comanda = await DB.getComandaPorId(comandaAtualId);
    const novosItens = [...(comanda.itens || []), ...itensTemporarios];
    const novoTotal = novosItens.reduce((s, i) => s + i.preco, 0);
    await DB.updateComanda(comandaAtualId, { itens: novosItens, total: novoTotal });
    window.location.href = 'comandas.html';
}

/* =============================================================
   5. UTILITÁRIOS (NAVBAR E QR CODE)
   ============================================================= */
function initNavbar() {
    const page = window.location.pathname.split("/").pop() || "home.html";
    const rotas = { 'home.html': 'nav-home', 'venda.html': 'nav-venda', 'comandas.html': 'nav-comandas', 'lancar.html': 'nav-comandas', 'produtos.html': 'nav-admin', 'fechamento.html': 'nav-admin', 'configuracoes.html': 'nav-admin', 'estorno.html': 'nav-admin' };
    const activeId = rotas[page];
    if (activeId && document.getElementById(activeId)) document.getElementById(activeId).classList.add('active');
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

// Função para buscar e mostrar os produtos do Supabase
async function renderizarCatalogo() {
    const container = document.getElementById('lista-catalogo');
    if (!container) return; // Só executa se estiver na página de produtos

    // Busca os dados na nuvem
    const produtos = await DB.getProdutos();
    
    if (produtos.length === 0) {
        container.innerHTML = `
            <div class="card-cia text-center py-10 border-dashed border-2 border-slate-200 bg-transparent shadow-none">
                <p class="text-slate-400 text-[10px] font-bold uppercase italic">Nenhum produto cadastrado.</p>
            </div>`;
        return;
    }

    // Monta a lista HTML
    container.innerHTML = produtos.map(p => `
        <div class="card-cia flex justify-between items-center mb-2">
            <div class="flex items-center space-x-4">
                <div class="w-10 h-10 bg-slate-50 rounded-xl flex items-center justify-center text-xl">
                    ${p.categoria === 'Bebidas' ? '🥤' : '🍢'}
                </div>
                <div>
                    <h4 class="font-bold text-slate-800 text-sm">${p.nome}</h4>
                    <p class="text-[10px] font-bold text-[#e63946] uppercase">R$ ${parseFloat(p.preco).toFixed(2)}</p>
                </div>
            </div>
            <button onclick="excluirProduto(${p.id})" class="text-red-400 p-2">🗑️</button>
        </div>
    `).join('');
}
