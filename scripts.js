/* =============================================================
   1. CONFIGURAÇÃO E CONEXÃO SUPABASE
   ============================================================= */
const SUPABASE_URL = 'https://vtexlttnjzmgknmbwbwl.supabase.co';
const SUPABASE_KEY = 'sb_publishable_C5SP_ulU5lhJjTdokxdegA_6ZIdeGPk'; 
const _supabase = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// Registro do Service Worker para PWA
if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js').catch(err => console.log("PWA:", err));
}

/* =============================================================
   2. OBJETO DB - OPERAÇÕES NA NUVEM (ASYNC)
   ============================================================= */
const DB = {
    // PRODUTOS
    getProdutos: async () => {
        const { data, error } = await _supabase.from('produtos').select('*').order('nome');
        return data || [];
    },
    addProduto: async (p) => { await _supabase.from('produtos').insert([p]); },
    deleteProduto: async (id) => { await _supabase.from('produtos').delete().eq('id', id); },

    // COMANDAS
    getComandas: async () => {
        const { data, error } = await _supabase.from('comandas').select('*').order('created_at', { ascending: false });
        return data || [];
    },
    getComandaPorId: async (id) => {
        const { data } = await _supabase.from('comandas').select('*').eq('id', id).single();
        return data;
    },
    addComanda: async (c) => { await _supabase.from('comandas').insert([c]); },
    updateComanda: async (id, dados) => { await _supabase.from('comandas').update(dados).eq('id', id); },

    // VENDAS
    addVenda: async (v) => { await _supabase.from('historico_vendas').insert([v]); },
    getVendas: async () => {
        const { data } = await _supabase.from('historico_vendas').select('*').order('created_at', { ascending: false });
        return data || [];
    }
};

/* =============================================================
   3. INICIALIZAÇÃO POR PÁGINA (ROUTER)
   ============================================================= */
document.addEventListener('DOMContentLoaded', async () => {
    initNavbar();

    // Executa a função correta baseada no ID do body da página
    if (document.getElementById('home-page')) initHome();
    if (document.getElementById('venda-page')) renderizarVenda();
    if (document.getElementById('comandas-page')) renderizarComandas();
    if (document.getElementById('produtos-page')) renderizarCatalogo();
    if (document.getElementById('fechamento-page')) gerarRelatorioFechamento();
    if (document.getElementById('estorno-page')) renderizarEstornos();
    if (document.getElementById('lancar-page')) initLancamento();
});

/* =============================================================
   4. MÓDULO: GESTÃO DE PRODUTOS (CORRIGE O ERRO DA IMAGEM 3)
   ============================================================= */
async function renderizarCatalogo() {
    const container = document.getElementById('lista-catalogo');
    if (!container) return;

    const produtos = await DB.getProdutos();
    
    if (produtos.length === 0) {
        container.innerHTML = `<p class="text-center py-10 text-slate-400 italic">Nenhum item no catálogo.</p>`;
        return;
    }

    container.innerHTML = produtos.map(p => `
        <div class="card-cia flex justify-between items-center mb-2">
            <div class="flex items-center space-x-4">
                <div class="text-2xl">${p.categoria === 'Bebidas' ? '🥤' : '🍢'}</div>
                <div>
                    <h4 class="font-bold text-slate-800 text-sm">${p.nome}</h4>
                    <p class="text-[10px] font-bold text-[#e63946]">R$ ${parseFloat(p.preco).toFixed(2)}</p>
                </div>
            </div>
            <button onclick="excluirProduto(${p.id})" class="text-red-400 p-2">🗑️</button>
        </div>
    `).join('');
}

async function salvarProduto() {
    const nome = document.getElementById('p-nome').value;
    const preco = parseFloat(document.getElementById('p-preco').value);
    const categoria = document.getElementById('p-categoria').value;

    if (!nome || isNaN(preco)) return alert("Preencha os campos!");

    await DB.addProduto({ nome, preco, categoria });
    document.getElementById('p-nome').value = "";
    document.getElementById('p-preco').value = "";
    renderizarCatalogo();
}

async function excluirProduto(id) {
    if (confirm("Deseja excluir este item?")) {
        await DB.deleteProduto(id);
        renderizarCatalogo();
    }
}

/* =============================================================
   5. MÓDULO: COMANDAS E LANÇAMENTOS
   ============================================================= */
async function abrirNovaComanda() {
    const nome = document.getElementById('nome-cliente').value;
    if (!nome) return alert("Digite o nome!");

    await DB.addComanda({ 
        nome, 
        codigo: Math.floor(1000 + Math.random() * 9000).toString(), 
        itens: [], 
        total: 0 
    });
    document.getElementById('nome-cliente').value = "";
    renderizarComandas();
}

async function renderizarComandas() {
    const container = document.getElementById('lista-comandas');
    if (!container) return;
    const comandas = await DB.getComandas();
    container.innerHTML = comandas.map(c => `
        <div class="card-cia flex items-center justify-between border-l-4 border-blue-500 mb-3">
            <div><h3 class="font-bold">${c.nome}</h3><p class="text-[9px] font-bold text-slate-400 uppercase">MESA ${c.mesa || 'S/M'}</p></div>
            <a href="lancar.html?id=${c.id}" class="bg-slate-100 p-3 rounded-xl text-slate-400">➕</a>
        </div>`).join('');
}

/* =============================================================
   6. UTILITÁRIOS FIXOS (NAVBAR, LOGIN, ETC)
   ============================================================= */
function initNavbar() {
    const page = window.location.pathname.split("/").pop() || "home.html";
    const rotas = { 'home.html': 'nav-home', 'venda.html': 'nav-venda', 'comandas.html': 'nav-comandas', 'produtos.html': 'nav-admin' };
    const activeId = rotas[page];
    if (activeId && document.getElementById(activeId)) document.getElementById(activeId).classList.add('active');
}

function fazerLogin() {
    const user = document.getElementById('user').value.toLowerCase().trim();
    if (user === 'admin' || user === 'vendedor') {
        localStorage.setItem('userRole', user);
        window.location.href = 'home.html';
    } else { alert("Usuário inválido!"); }
}
