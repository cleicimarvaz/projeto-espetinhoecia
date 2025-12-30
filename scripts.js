/* =================================================================================
   MÓDULO 1: CONFIGURAÇÃO E VARIÁVEIS
   ================================================================================= */
console.log(">>> SISTEMA INICIANDO (V2.4 - DASHBOARD ADMIN)...");

const SUPABASE_URL = 'https://vtexlttnjzmgknmbwbwl.supabase.co';
const SUPABASE_KEY = 'sb_publishable_C5SP_ulU5lhJjTdokxdegA_6ZIdeGPk';
let _supabase = null;
const TEMPO_LIMITE_INATIVIDADE = 20 * 60 * 1000;

// ESTILOS DE ABAS
const STYLE_ACTIVE = "flex-1 py-3 rounded-full bg-[#e63946] text-white text-[9px] font-black uppercase transition-all font-sans italic tracking-widest shadow-sm";
const STYLE_INACTIVE = "flex-1 py-3 rounded-full bg-transparent text-slate-400 text-[9px] font-black uppercase transition-all font-sans italic tracking-widest hover:bg-slate-50";

try {
    if (typeof supabase !== 'undefined') {
        _supabase = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
    } else {
        console.error("ERRO: Supabase não carregou.");
    }
} catch (err) { console.error("ERRO INICIALIZAÇÃO:", err); }

// Estado Global
let carrinho = [];
let produtoEdicaoId = null;
let comandaAtualDivisao = null;
let itensParaAbater = [];
let itensExpandidosDivisao = [];
let comandaEmFechamentoId = null;
let totalFechamentoCache = 0;
let callbackConfirmacao = null;
let dadosUltimaVenda = null; 
let callbackAuth = null;

/* =================================================================================
   MÓDULO 2: SEGURANÇA E NAVEGAÇÃO
   ================================================================================= */
async function registrarLog(tipo, descricao) {
    if (!_supabase) return;
    const usuario = localStorage.getItem('userName') || 'Sistema';
    const textoLog = `${tipo.toUpperCase()}: ${descricao}`;
    await _supabase.from('auditoria_sistema').insert([{ usuario: usuario, acao: textoLog, created_at: new Date().toISOString() }]);
}

function setLoading(btnId, isLoading, text = "CONFIRMAR") {
    const btn = document.getElementById(btnId);
    if (!btn) return;
    if (isLoading) {
        btn.dataset.originalText = btn.innerText;
        btn.innerText = "⏳ PROCESSANDO...";
        btn.disabled = true;
        btn.classList.add("opacity-50", "cursor-not-allowed");
    } else {
        btn.innerText = text || btn.dataset.originalText || "CONFIRMAR";
        btn.disabled = false;
        btn.classList.remove("opacity-50", "cursor-not-allowed");
    }
}

function solicitarAutenticacao(acao) {
    callbackAuth = acao;
    document.getElementById('input-auth-senha').value = '';
    document.getElementById('modal-auth-admin').classList.remove('hidden');
    document.getElementById('modal-auth-admin').classList.add('flex');
    
    const btn = document.getElementById('btn-confirma-auth');
    if(btn) {
        btn.innerText = "CONFIRMAR";
        btn.disabled = false;
        btn.classList.remove("opacity-50", "cursor-not-allowed");
    }
    
    setTimeout(() => document.getElementById('input-auth-senha').focus(), 100);
}

function fecharModalAuth() {
    document.getElementById('modal-auth-admin').classList.add('hidden');
}

async function confirmarAuth() {
    const senhaDigitada = document.getElementById('input-auth-senha').value;
    if (!senhaDigitada) return showToast("DIGITE A SENHA", "erro");

    setLoading('btn-confirma-auth', true);

    try {
        const usuarioAtual = localStorage.getItem('userName');
        const { data: users, error } = await _supabase.from('usuarios').select('*').eq('usuario', usuarioAtual.toLowerCase()); 
        const user = users ? users.find(u => u.senha === senhaDigitada) : null;

        if (error || !user) {
            showToast("SENHA INCORRETA", "erro");
            setLoading('btn-confirma-auth', false, "CONFIRMAR");
            document.getElementById('input-auth-senha').value = '';
            document.getElementById('input-auth-senha').focus();
        } else {
            fecharModalAuth();
            if (callbackAuth) { await callbackAuth(); callbackAuth = null; }
        }
    } catch (e) {
        console.error(e);
        showToast("ERRO DE CONEXÃO", "erro");
        setLoading('btn-confirma-auth', false, "CONFIRMAR");
    }
}

window.fazerLogin = async function() {
    if (!_supabase) return showToast("SISTEMA OFFLINE", "erro");
    const u = document.getElementById('user').value.trim().toLowerCase();
    const s = document.getElementById('pass').value.trim();
    if (!u || !s) return showToast("PREENCHA TUDO", "erro");

    const btn = document.querySelector('button');
    const txtOriginal = btn.innerText;
    btn.innerText = "VERIFICANDO..."; 
    btn.disabled = true;
    btn.classList.add("opacity-70");

    try {
        const { data: user, error } = await _supabase.from('usuarios').select('*').eq('usuario', u).eq('senha', s).single();
        if (error || !user) { 
            showToast("DADOS INVÁLIDOS", "erro"); 
            btn.innerText = txtOriginal; 
            btn.disabled = false;
            btn.classList.remove("opacity-70");
        } else {
            localStorage.setItem('userRole', user.role || 'admin');
            localStorage.setItem('userName', user.usuario); 
            localStorage.setItem('userRealName', user.nome || user.usuario);
            registrarLog('LOGIN', 'Acesso realizado ao sistema');
            atualizarUltimoAcesso(); window.location.href = 'home.html';
        }
    } catch (e) { 
        showToast("ERRO REDE", "erro"); 
        btn.innerText = txtOriginal; 
        btn.disabled = false;
        btn.classList.remove("opacity-70");
    }
};

function verificarAuth() {
    const user = localStorage.getItem('userRole');
    const p = window.location.pathname;
    const loginPage = p.includes('index.html') || p === '/' || p.endsWith('/');

    if (!user && !loginPage) { window.location.href = 'index.html'; return; }
    if (user) {
        const ultimo = parseInt(localStorage.getItem('ultimoAcesso')||0);
        if (Date.now() - ultimo > TEMPO_LIMITE_INATIVIDADE) { alert("Sessão expirada."); logout(); }
    }
    
    const h = document.getElementById('header-usuario');
    if (h && user) {
        const nomeExibicao = localStorage.getItem('userRealName') || localStorage.getItem('userName') || 'ADMIN';
        h.innerText = `OLÁ, ${nomeExibicao.toUpperCase()}`;
    }
}

function iniciarMonitoramento() {
    ['click','mousemove','keypress','touchstart','scroll'].forEach(e => document.addEventListener(e, atualizarUltimoAcesso, {passive:true}));
}
function atualizarUltimoAcesso() { if(localStorage.getItem('userRole')) localStorage.setItem('ultimoAcesso', Date.now().toString()); }
function logout() { 
    registrarLog('LOGOUT', 'Saiu do sistema');
    localStorage.clear(); 
    window.location.href = 'index.html'; 
}
window.logout = logout;

function goBack() {
    if (document.referrer && document.referrer.includes(window.location.host)) { window.history.back(); } else { window.location.href = 'home.html'; }
}

function configurarBotaoVoltar() {
    const headers = document.querySelectorAll('header');
    headers.forEach(header => {
        const btn = header.querySelector('button');
        if (btn && (btn.innerText.includes('←') || btn.innerHTML.includes('←'))) {
            btn.onclick = function(e) { e.preventDefault(); e.stopPropagation(); goBack(); };
        }
    });
}

document.addEventListener('DOMContentLoaded', () => {
    verificarAuth();
    configurarBotaoVoltar(); 
    
    if (document.getElementById('user')) {
        const h = (e) => { if (e.key === 'Enter') window.fazerLogin(); };
        document.getElementById('user').addEventListener('keypress', h);
        document.getElementById('pass')?.addEventListener('keypress', h);
    } else {
        initSistema(); 
        iniciarMonitoramento(); 
        setInterval(verificarAuth, 60000);
    }
});

function initSistema() {
    const p = window.location.pathname;
    if (p.includes('venda.html')) { renderizarVenda(); verificarContextoVenda(); }
    else if (p.includes('configuracoes.html')) { 
        renderizarCatalogo(); carregarAuditoria(); carregarFiltroUsuarios(); 
        const nomeSalvo = localStorage.getItem('nomeLoja'); if(nomeSalvo) document.getElementById('cfg-nome-loja').value = nomeSalvo;
    }
    else if (p.includes('comandas.html')) { carregarComandas(); }
    else if (p.includes('divisao.html')) { initPaginaDivisao(); }
    else if (p.includes('estorno.html')) { carregarHistoricoEstorno(); }
    else if (p.includes('home.html')) { carregarResumoHome(); }
    if ('serviceWorker' in navigator) navigator.serviceWorker.register('./sw.js').catch(e=>console.log("SW:",e));
}

function atualizarEstiloAba(btnAtivo, btnInativo) {
    if(btnAtivo) btnAtivo.className = STYLE_ACTIVE;
    if(btnInativo) btnInativo.className = STYLE_INACTIVE;
}

/* =================================================================================
   MÓDULO 3: HOME
   ================================================================================= */
async function carregarResumoHome() {
    if(!_supabase) return;
    
    // 1. Pega dados de hoje para o Card Principal
    const hoje = new Date().toISOString().split('T')[0];
    const { data: vHoje } = await _supabase.from('historico_vendas').select('total').gte('created_at', `${hoje}T00:00:00`).lte('created_at', `${hoje}T23:59:59`);
    const totalHoje = (vHoje||[]).reduce((acc, i) => acc + (parseFloat(i.total)||0), 0);
    const el = document.getElementById('faturamento-hoje'); 
    if(el) el.innerText = `R$ ${totalHoje.toFixed(2).replace('.', ',')}`;

    // 2. Badge de Comandas
    const { count } = await _supabase.from('comandas').select('*', { count: 'exact', head: true }).eq('status', 'aberta');
    const badge = document.getElementById('badge-comandas');
    if(badge) { badge.innerText = count; badge.classList.toggle('hidden', count === 0); }
}

/* =================================================================================
   MÓDULO 4: VENDAS (MANTIDO IGUAL)
   ================================================================================= */
async function renderizarVenda() {
    if(!_supabase) return;
    const { data: pds } = await _supabase.from('produtos').select('*').eq('status', true).order('nome');
    const cont = document.getElementById('lista-venda'); if(!cont) return;

    const icons = { 'espetos': '🍢', 'cervejas': '🍺', 'bebidas': '🥤', 'refeicao': '🍽️', 'acompanhamentos': '🍚' };

    cont.innerHTML = (pds||[]).map(p => {
        const qtd = carrinho.find(c => c.id === p.id)?.qtd || 0;
        const catKey = (p.categoria || '').toLowerCase();
        const icone = icons[catKey] || '📦';

        return `
        <button onclick="adicionarAoCarrinho(${p.id})" class="relative bg-white p-4 rounded-3xl shadow-sm flex flex-col items-center border-2 ${qtd>0?'border-emerald-400':'border-white'} active:scale-95 transition-all">
            <span class="text-3xl mb-1">${icone}</span>
            <h4 class="font-black text-[10px] uppercase italic text-center leading-tight">${p.nome}</h4>
            <span class="text-[9px] font-bold text-red-500">R$ ${parseFloat(p.preco).toFixed(2)}</span>
            
            ${qtd>0 ? `
                <span class="absolute -top-2 -right-2 bg-emerald-500 text-white text-[9px] w-6 h-6 rounded-full flex items-center justify-center font-black shadow-sm z-10">${qtd}</span>
                <div onclick="event.stopPropagation(); removerDoCarrinho(${p.id})" class="absolute -bottom-2 -right-2 bg-red-500 text-white w-8 h-8 rounded-full flex items-center justify-center shadow-md active:scale-90 transition-all z-20 font-black text-xs border-2 border-white hover:bg-red-600">
                    -
                </div>
            ` : ''}
        </button>`;
    }).join('');
    atualizarFAB();
}

function adicionarAoCarrinho(id) {
    _supabase.from('produtos').select('*').eq('id', id).single().then(({data:p}) => {
        const item = carrinho.find(i => i.id === id);
        if(item) item.qtd++; else carrinho.push({...p, qtd: 1});
        renderizarVenda(); showToast("ADICIONADO");
    });
}

function removerDoCarrinho(id) {
    const item = carrinho.find(i => i.id === id);
    if (item) {
        if (item.qtd > 1) { item.qtd--; } else { carrinho = carrinho.filter(i => i.id !== id); }
        renderizarVenda();
    }
}

function atualizarFAB() {
    const fab = document.getElementById('fab-finalizar');
    if(fab) {
        fab.classList.toggle('hidden', carrinho.length === 0);
        document.getElementById('fab-count').innerText = `${carrinho.reduce((a,i)=>a+i.qtd,0)} ITENS`;
        if(sessionStorage.getItem('comandaAtivaId')) document.getElementById('btn-finalizar-texto').innerText = "LANÇAR NA COMANDA";
    }
}

function abrirResumoPedido() {
    const mesaId = sessionStorage.getItem('comandaAtivaId');
    if (mesaId) { abrirConfirmacaoComanda(mesaId); } 
    else {
        const lista = document.getElementById('itens-carrinho-modal');
        lista.innerHTML = carrinho.map(i => `<div class="flex justify-between p-2 text-[10px] border-b border-slate-50 last:border-0"><span>${i.qtd}x ${i.nome}</span><span>R$ ${(i.preco*i.qtd).toFixed(2)}</span></div>`).join('');
        document.getElementById('total-modal').innerText = `R$ ${carrinho.reduce((a,i)=>a+(i.preco*i.qtd),0).toFixed(2)}`;
        setLoading('btn-confirmar-venda-balcao', false, "CONFIRMAR E PAGAR");
        document.getElementById('modal-resumo').classList.remove('hidden'); document.getElementById('modal-resumo').classList.add('flex');
    }
}
function fecharResumoPedido() { document.getElementById('modal-resumo').classList.add('hidden'); }

function handlePagamentoChange() { document.getElementById('sessao-troco').classList.toggle('hidden', document.getElementById('forma-pagamento').value !== 'Dinheiro'); }
function calcularTroco() {
    const total = carrinho.reduce((a,i) => a+(i.preco*i.qtd), 0);
    const rec = convMoedaFloat(document.getElementById('valor-recebido').value);
    const el = document.getElementById('valor-troco');
    if(el) { el.innerText = `R$ ${(rec-total).toFixed(2)}`; el.className = `p-4 font-black text-center rounded-xl ${(rec-total)<0?'text-red-500 bg-red-50':'text-emerald-500 bg-emerald-50'}`; }
}

async function confirmarVenda() {
    const total = carrinho.reduce((a,i) => a+(i.preco*i.qtd), 0);
    const pag = document.getElementById('forma-pagamento').value;
    
    if (pag === 'Dinheiro') {
        const recebido = convMoedaFloat(document.getElementById('valor-recebido').value);
        if (recebido < total) { return showToast("VALOR INSUFICIENTE", "erro"); }
    }

    setLoading('btn-confirmar-venda-balcao', true);

    try {
        dadosUltimaVenda = { tipo: 'BALCÃO', itens: [...carrinho], total: total, pagamento: pag, data: new Date() };

        await _supabase.from('historico_vendas').insert([{ itens: carrinho, total: total, forma_pagamento: pag, vendedor: localStorage.getItem('userName'), created_at: new Date().toISOString() }]);
        
        const resumoItens = carrinho.map(i => `${i.qtd}x ${i.nome}`).join(', ');
        registrarLog('VENDA BALCÃO', `${resumoItens} | Total: R$ ${total.toFixed(2)} | Pag: ${pag}`);

        showToast("VENDA REALIZADA!"); 
        fecharResumoPedido(); 
        carrinho = []; 
        renderizarVenda();
        document.getElementById('modal-confirmacao-impressao').classList.remove('hidden');
    } catch (e) {
        console.error(e);
        showToast("ERRO AO PROCESSAR", "erro");
        setLoading('btn-confirmar-venda-balcao', false, "CONFIRMAR E PAGAR");
    }
}

async function abrirConfirmacaoComanda(id) {
    const { data: c } = await _supabase.from('comandas').select('*').eq('id', id).single();
    document.getElementById('titulo-confirmacao-mesa').innerText = c.identificacao;
    document.getElementById('itens-confirmacao-comanda').innerHTML = carrinho.map(i => `<div class="flex justify-between text-[10px] font-bold text-slate-600"><span>${i.qtd}x ${i.nome}</span><span>R$ ${(i.preco*i.qtd).toFixed(2)}</span></div>`).join('');
    setLoading('btn-lancar-comanda', false, "LANÇAR PEDIDO");
    document.getElementById('modal-confirmacao-comanda').classList.remove('hidden'); document.getElementById('modal-confirmacao-comanda').classList.add('flex');
}
function fecharConfirmacaoComanda() { document.getElementById('modal-confirmacao-comanda').classList.add('hidden'); }

async function concluirLancamentoComanda() {
    setLoading('btn-lancar-comanda', true);

    try {
        const id = sessionStorage.getItem('comandaAtivaId');
        const { data: c } = await _supabase.from('comandas').select('*').eq('id', id).single();
        const novosItens = [...c.itens, ...carrinho];
        const novoTotal = novosItens.reduce((a,i) => a+(parseFloat(i.preco)*i.qtd), 0);
        await _supabase.from('comandas').update({ itens: novosItens, total: novoTotal }).eq('id', id);
        
        const resumoItens = carrinho.map(i => `${i.qtd}x ${i.nome}`).join(', ');
        registrarLog('PEDIDO MESA', `Mesa: ${c.identificacao} | Itens: ${resumoItens}`);

        showToast("LANÇADO NA COMANDA!"); carrinho = []; sessionStorage.removeItem('comandaAtivaId'); 
        window.location.href = 'comandas.html';
    } catch (e) {
        showToast("ERRO AO LANÇAR", "erro");
        setLoading('btn-lancar-comanda', false, "LANÇAR PEDIDO");
    }
}

function voltarDaVenda() { goBack(); }
function verificarContextoVenda() { 
    if(sessionStorage.getItem('comandaAtivaId')) {
        document.querySelector('h1').innerText = "LANÇAR NA COMANDA"; 
        document.querySelector('button[onclick="voltarDaVenda()"]').classList.remove('hidden');
    }
}

function fecharModalImpressao() { document.getElementById('modal-confirmacao-impressao').classList.add('hidden'); }
function confirmarImpressaoAction() { if (!dadosUltimaVenda) return showToast("NADA PARA IMPRIMIR", "erro"); imprimirCupom(dadosUltimaVenda); fecharModalImpressao(); }

function visualizarTicketTeste() {
    const mockVenda = {
        tipo: 'TESTE DE SISTEMA',
        data: new Date(),
        itens: [
            {nome: 'ESPETINHO DE CARNE', preco: 12.00, qtd: 1},
            {nome: 'CERVEJA LATA', preco: 6.00, qtd: 2}
        ],
        total: 24.00,
        pagamento: 'Dinheiro'
    };
    imprimirCupom(mockVenda);
}

function imprimirCupom(venda) {
    const loja = localStorage.getItem('nomeLoja') || "ESPETINHO & CIA";
    let ticketsHtml = '';
    venda.itens.forEach(item => {
        if(parseFloat(item.preco) > 0) {
            for (let i = 0; i < (item.qtd || 1); i++) {
                ticketsHtml += `
                <div class="ticket-block">
                    <div class="header"><div class="store-name">${loja}</div><div class="meta">Data: ${venda.data.toLocaleDateString()} - ${venda.data.toLocaleTimeString().substring(0,5)}</div></div>
                    <div class="main-box"><div class="item-name">${item.nome}</div><div class="item-price">VALOR: R$ ${parseFloat(item.preco).toFixed(2)}</div></div>
                    <div class="instruction">RETIRAR NO BALCÃO</div><div class="line"></div>
                    <div class="footer">Transação N. ${Math.floor(Math.random()*9000)+1000} | Op: ${localStorage.getItem('userName') || 'Admin'}<br>Via Única | Consumo Local<br><br>*** SE BEBER NÃO DIRIJA ***</div>
                </div>`;
            }
        }
    });
    const conteudo = `<html><head><style>@page { margin: 0; size: 58mm auto; } body { margin: 0; padding: 0; font-family: Arial, Helvetica, sans-serif; width: 58mm; background: #fff; color: #000; } .ticket-wrapper { margin-bottom: 10px; page-break-inside: avoid; } .ticket-block { border-left: 10px solid #e63946; border-right: 10px solid #e63946; padding: 10px 5px; text-align: center; border-top: 1px dashed #000; border-bottom: 1px dashed #000; } .store-name { font-weight: 900; font-size: 12px; margin-bottom: 2px; } .meta { font-size: 9px; font-weight: bold; margin-top: 2px; } .main-box { border: 2px solid #000; padding: 5px; margin: 5px 0; background: #f0f0f0; } .item-name { font-size: 14px; font-weight: 900; text-transform: uppercase; line-height: 1.1; } .item-price { font-size: 12px; font-weight: bold; margin-top: 2px; } .instruction { font-size: 10px; font-weight: 900; margin-top: 5px; text-decoration: underline; } .footer { font-size: 9px; margin-top: 5px; } .cut-line { text-align: center; font-size: 10px; margin-top: 5px; color: #666; }</style></head><body>${ticketsHtml}<script>window.onload = function() { window.print(); setTimeout(function(){ window.close(); }, 500); }</script></body></html>`;
    const janela = window.open('', 'Imprimir Cupom', 'height=600,width=400');
    janela.document.write(conteudo);
    janela.document.close();
}

/* =================================================================================
   MÓDULO 5: COMANDAS
   ================================================================================= */
async function carregarComandas() {
    if(!_supabase) return;
    const { data: cms } = await _supabase.from('comandas').select('*').eq('status', 'aberta').order('id', {ascending: true});
    const cont = document.getElementById('lista-comandas-ativas'); if(!cont) return;
    
    cont.innerHTML = (cms||[]).map(c => `
        <div class="bg-white p-4 rounded-[2.5rem] shadow-sm mb-4 border border-slate-50">
            <div class="flex justify-between items-center mb-4 px-2">
                <div class="flex items-center gap-3">
                    <div class="bg-orange-50 w-9 h-9 rounded-full flex items-center justify-center text-lg">📝</div>
                    <h4 class="font-black text-slate-800 text-sm uppercase italic">${c.identificacao}</h4>
                </div>
                <p class="text-lg font-black text-red-500 italic">R$ ${parseFloat(c.total).toFixed(2)}</p>
            </div>
            <div class="grid grid-cols-4 gap-2">
                <button onclick="lancarNaMesa(${c.id})" class="h-14 rounded-xl bg-white border-2 border-slate-100 flex flex-row items-center justify-center gap-1 active:bg-slate-50 transition-all hover:border-slate-300"><span class="text-sm">🛒</span><span class="text-[11px] font-black text-slate-600 uppercase tracking-tighter">Lançar</span></button>
                <button onclick="abrirDetalhesComanda(${c.id})" class="h-14 rounded-xl bg-blue-50 border border-blue-100 flex flex-row items-center justify-center gap-1 active:bg-blue-100 transition-all"><span class="text-sm">👁️</span><span class="text-[11px] font-black text-blue-500 uppercase tracking-tighter">Ver</span></button>
                <button onclick="irParaDivisao(${c.id})" class="h-14 rounded-xl bg-[#fff7ed] border border-orange-100 flex flex-row items-center justify-center gap-1 active:bg-orange-100 transition-all"><span class="text-sm">÷</span><span class="text-[11px] font-black text-orange-500 uppercase tracking-tighter">Dividir</span></button>
                <button onclick="abrirModalFechamento(${c.id})" class="h-14 rounded-xl bg-emerald-500 border border-emerald-600 flex flex-row items-center justify-center gap-1 active:bg-emerald-600 transition-all shadow-md shadow-emerald-200"><span class="text-sm text-white">💲</span><span class="text-[11px] font-black text-white uppercase tracking-tighter">Pagar</span></button>
            </div>
        </div>`).join('');
}

async function abrirNovaComanda() {
    const id = document.getElementById('c-identificacao').value.toUpperCase();
    if(!id) return showToast("INFORME NOME", "erro");
    await _supabase.from('comandas').insert([{ identificacao: id, status: 'aberta', itens: [], total: 0 }]);
    registrarLog('ABERTURA MESA', `Nova mesa aberta: ${id}`);
    document.getElementById('c-identificacao').value = ''; carregarComandas(); alternarAbasComanda('lista');
}

function alternarAbasComanda(a) { 
    const lista = document.getElementById('aba-lista-comanda');
    const abrir = document.getElementById('aba-abrir-comanda');
    const btnLista = document.getElementById('btn-comanda-lista');
    const btnAbrir = document.getElementById('btn-comanda-abrir');
    lista.classList.toggle('hidden', a!=='lista'); 
    abrir.classList.toggle('hidden', a!=='abrir'); 
    if (a === 'lista') { atualizarEstiloAba(btnLista, btnAbrir); } else { atualizarEstiloAba(btnAbrir, btnLista); }
}

function lancarNaMesa(id) { sessionStorage.setItem('comandaAtivaId', id); window.location.href = 'venda.html'; }

async function abrirDetalhesComanda(id) {
    const { data: c } = await _supabase.from('comandas').select('*').eq('id', id).single();
    document.getElementById('titulo-detalhes-mesa').innerText = c.identificacao;
    document.getElementById('total-detalhes').innerText = `R$ ${parseFloat(c.total).toFixed(2)}`;
    document.getElementById('lista-itens-detalhes').innerHTML = c.itens.map(i => `<div class="flex justify-between p-3 bg-slate-50 rounded-xl mb-1"><span class="text-[10px] font-black uppercase">${i.qtd}x ${i.nome}</span><span class="text-[10px] font-bold">R$ ${(parseFloat(i.preco)*i.qtd).toFixed(2)}</span></div>`).join('');
    document.getElementById('btn-add-item-modal').onclick = () => lancarNaMesa(id);
    document.getElementById('btn-pagar-modal-detalhes').onclick = () => { fecharDetalhesComanda(); abrirModalFechamento(id); };
    document.getElementById('modal-detalhes-comanda').classList.remove('hidden'); document.getElementById('modal-detalhes-comanda').classList.add('flex');
}
function fecharDetalhesComanda() { document.getElementById('modal-detalhes-comanda').classList.add('hidden'); }

async function abrirModalFechamento(id) {
    comandaEmFechamentoId = id;
    const { data: c } = await _supabase.from('comandas').select('*').eq('id', id).single();
    totalFechamentoCache = parseFloat(c.total);
    document.getElementById('total-fechamento').innerText = `R$ ${totalFechamentoCache.toFixed(2)}`;
    document.getElementById('titulo-fechamento-mesa').innerText = c.identificacao;
    document.getElementById('lista-itens-fechamento').innerHTML = c.itens.map(i => `<div class="flex justify-between py-2 border-b text-[10px]"><span class="uppercase">${i.qtd}x ${i.nome}</span><span class="font-black">R$ ${(parseFloat(i.preco)*i.qtd).toFixed(2)}</span></div>`).join('');
    document.getElementById('forma-pagamento-fechamento').value = 'Pix';
    handlePagamentoFechamentoChange();
    setLoading('btn-fechar-comanda', false, "RECEBER E FINALIZAR");
    document.getElementById('modal-fechamento').classList.remove('hidden'); document.getElementById('modal-fechamento').classList.add('flex');
}
function fecharModalFechamento() { document.getElementById('modal-fechamento').classList.add('hidden'); }

function handlePagamentoFechamentoChange() {
    const metodo = document.getElementById('forma-pagamento-fechamento').value;
    const container = document.getElementById('container-recebido-fechamento');
    const areaTroco = document.getElementById('area-troco-fechamento');
    const labelTroco = document.getElementById('label-troco-fechamento');
    
    if (metodo === 'Dinheiro') {
        container.classList.remove('opacity-50', 'pointer-events-none');
        document.getElementById('valor-recebido-fechamento').focus();
    } else {
        container.classList.add('opacity-50', 'pointer-events-none');
        areaTroco.classList.add('hidden');
        document.getElementById('valor-recebido-fechamento').value = '';
        labelTroco.innerText = "TROCO DO CLIENTE";
        labelTroco.className = "text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1";
    }
}

function calcularTrocoFechamento() {
    const r = convMoedaFloat(document.getElementById('valor-recebido-fechamento').value);
    const areaTroco = document.getElementById('area-troco-fechamento');
    const labelTroco = document.getElementById('label-troco-fechamento');
    const valorTroco = document.getElementById('valor-troco-fechamento');
    const diff = r - totalFechamentoCache;
    
    if (r > 0) {
        areaTroco.classList.remove('hidden');
        if (diff >= 0) {
            labelTroco.innerText = "TROCO DO CLIENTE";
            labelTroco.className = "text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1";
            valorTroco.innerText = `R$ ${diff.toFixed(2)}`;
            valorTroco.className = "text-2xl font-black text-emerald-500";
        } else {
            labelTroco.innerText = "FALTANDO";
            labelTroco.className = "text-[9px] font-black text-red-400 uppercase tracking-widest mb-1";
            valorTroco.innerText = `R$ ${Math.abs(diff).toFixed(2)}`;
            valorTroco.className = "text-2xl font-black text-red-500";
        }
    } else { areaTroco.classList.add('hidden'); }
}

window.confirmarFechamento = async function() {
    const f = document.getElementById('forma-pagamento-fechamento').value;
    
    setLoading('btn-fechar-comanda', true);

    try {
        const { data: c } = await _supabase.from('comandas').select('*').eq('id', comandaEmFechamentoId).single();
        
        if (f === 'Dinheiro') {
            const recebido = convMoedaFloat(document.getElementById('valor-recebido-fechamento').value);
            if (recebido < c.total) { 
                showToast("VALOR INSUFICIENTE", "erro"); 
                setLoading('btn-fechar-comanda', false, "RECEBER E FINALIZAR"); 
                return;
            }
        }
        
        await _supabase.from('historico_vendas').insert([{ itens: c.itens, total: c.total, forma_pagamento: f, vendedor: localStorage.getItem('userName'), comanda_id: c.id, created_at: new Date().toISOString() }]);
        await _supabase.from('comandas').update({ status: 'fechada', fechada_em: new Date().toISOString() }).eq('id', comandaEmFechamentoId);
        
        const resumoItens = c.itens.map(i => `${i.qtd}x ${i.nome}`).join(', ');
        registrarLog('FECHAMENTO DE MESA', `Mesa: ${c.identificacao} | Total: R$ ${c.total} | Pag: ${f} | Itens: ${resumoItens}`);

        showToast("COMANDA FECHADA!"); fecharModalFechamento(); carregarComandas();
    } catch (e) {
        showToast("ERRO AO FECHAR", "erro");
        setLoading('btn-fechar-comanda', false, "RECEBER E FINALIZAR");
    }
};

/* =================================================================================
   MÓDULO 6: PRODUTOS
   ================================================================================= */
async function renderizarCatalogo() {
    if(!_supabase) return;
    const { data: pds } = await _supabase.from('produtos').select('*').order('nome');
    const container = document.getElementById('lista-catalogo'); if (!container) return;
    
    const icons = { 'espetos': '🍢', 'cervejas': '🍺', 'bebidas': '🥤', 'refeicao': '🍽️', 'acompanhamentos': '🍚' };
    
    container.innerHTML = (pds||[]).map(p => {
        const catKey = (p.categoria || '').toLowerCase();
        const icone = icons[catKey] || '📦';
        const statusClass = p.status ? 'opacity-100' : 'opacity-50 grayscale bg-slate-50';
        const checked = p.status ? 'checked' : '';

        return `
        <div class="bg-white p-4 rounded-3xl shadow-sm flex items-center justify-between border-2 border-white mb-2 transition-all ${statusClass}">
            <div class="flex items-center gap-3">
                <span class="text-3xl">${icone}</span>
                <div>
                    <h4 class="font-black text-xs uppercase italic text-slate-800">${p.nome}</h4>
                    <p class="text-[9px] font-bold text-red-500">R$ ${parseFloat(p.preco).toFixed(2)}</p>
                </div>
            </div>
            <div class="flex gap-2 items-center">
                <label class="relative inline-flex items-center cursor-pointer mr-2">
                    <input type="checkbox" class="sr-only peer" ${checked} onchange="toggleStatusProduto(${p.id}, this.checked)">
                    <div class="w-9 h-5 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-emerald-500"></div>
                </label>
                <button onclick="prepararEdicao(${p.id})" class="bg-slate-100 w-8 h-8 rounded-xl text-[12px] active:scale-95 transition-all">✏️</button>
                <button onclick="confirmarExclusaoProduto(${p.id})" class="bg-red-50 text-red-500 w-8 h-8 rounded-xl text-[12px] active:scale-95 transition-all">🗑️</button>
            </div>
        </div>`;
    }).join('');
}

async function toggleStatusProduto(id, novoStatus) {
    await _supabase.from('produtos').update({ status: novoStatus }).eq('id', id);
    registrarLog('STATUS PRODUTO', `Produto ID ${id} alterado para: ${novoStatus ? 'Ativo' : 'Inativo'}`);
    renderizarCatalogo();
    showToast(novoStatus ? "PRODUTO ATIVADO" : "PRODUTO INATIVADO");
}

async function salvarProduto() {
    const nome = document.getElementById('p-nome').value.toUpperCase();
    const cat = document.getElementById('p-categoria').value;
    const preco = convMoedaFloat(document.getElementById('p-preco').value);
    const status = document.getElementById('p-status')?.checked ?? true;
    if (!nome || preco <= 0) return showToast("INVÁLIDO", "erro");
    const dados = { nome, categoria: cat, preco, status };
    if (produtoEdicaoId) {
        await _supabase.from('produtos').update(dados).eq('id', produtoEdicaoId);
        registrarLog('EDITAR PRODUTO', `Produto editado: ${nome} | Preço: ${preco}`);
    } else {
        await _supabase.from('produtos').insert([dados]);
        registrarLog('NOVO PRODUTO', `Produto cadastrado: ${nome} | Preço: ${preco}`);
    }
    cancelarEdicao(); renderizarCatalogo(); showToast("SALVO!");
}
function prepararEdicao(id) { _supabase.from('produtos').select('*').eq('id', id).single().then(({data:p}) => { document.getElementById('p-nome').value = p.nome; document.getElementById('p-categoria').value = p.categoria; document.getElementById('p-preco').value = parseFloat(p.preco).toFixed(2).replace('.', ','); produtoEdicaoId = id; alternarAbas('cadastro'); }); }
function cancelarEdicao() { produtoEdicaoId = null; document.getElementById('p-nome').value = ''; document.getElementById('p-preco').value = '0,00'; alternarAbas('lista'); }
function confirmarExclusaoProduto(id) { 
    abrirConfirmacao("EXCLUIR?", "Remover?", async () => { 
        await _supabase.from('produtos').delete().eq('id', id); 
        registrarLog('EXCLUIR PRODUTO', `Produto ID ${id} excluído`);
        renderizarCatalogo(); 
    }); 
}

/* =================================================================================
   MÓDULO 7: DIVISÃO E ESTORNO
   ================================================================================= */
async function initPaginaDivisao() {
    const id = sessionStorage.getItem('comandaDivisaoId'); if(!id) return;
    const { data: c } = await _supabase.from('comandas').select('*').eq('id', id).single();
    comandaAtualDivisao = c; itensExpandidosDivisao = [];
    let totalCalculado = 0;
    c.itens.forEach((item, idx) => { 
        const valorItem = parseFloat(item.preco) * (item.qtd || 1);
        totalCalculado += valorItem;
        if(parseFloat(item.preco) > 0) { for(let i=0; i < (item.qtd||1); i++) itensExpandidosDivisao.push({...item, qtd: 1, originalIndex: idx}); } 
        else { itensExpandidosDivisao.push({...item, qtd: 1, originalIndex: idx}); }
    });
    renderizarItensParaAbate();
    document.getElementById('total-restante').innerText = `R$ ${Math.max(0, totalCalculado).toFixed(2)}`;
}

function renderizarItensParaAbate() { 
    document.getElementById('lista-itens-divisao').innerHTML = itensExpandidosDivisao.map((item, idx) => {
        const isAbatimento = parseFloat(item.preco) < 0;
        if (isAbatimento) { return `<div class="bg-red-50 p-4 rounded-2xl mb-2 flex justify-between border-2 border-red-100 opacity-80"><span class="text-[10px] font-black uppercase text-red-500 italic">🔻 ${item.nome}</span><span class="text-[10px] font-bold text-red-500">R$ ${parseFloat(item.preco).toFixed(2)}</span></div>`; } 
        else { return `<div onclick="selecionarItemAbate(${idx})" id="item-abate-${idx}" class="bg-white p-4 rounded-2xl mb-2 flex justify-between border-2 border-white transition-all active:scale-95"><span class="text-[10px] font-black uppercase text-slate-700">1x ${item.nome}</span><span class="text-[10px] font-bold text-slate-700">R$ ${parseFloat(item.preco).toFixed(2)}</span></div>`; }
    }).join(''); 
}

function selecionarItemAbate(idx) {
    const el = document.getElementById(`item-abate-${idx}`);
    const pos = itensParaAbater.indexOf(idx);
    if(pos > -1) { itensParaAbater.splice(pos, 1); el.classList.remove('border-emerald-500', 'bg-emerald-50'); }
    else { itensParaAbater.push(idx); el.classList.add('border-emerald-500', 'bg-emerald-50'); }
    document.getElementById('fab-divisao').classList.toggle('hidden', itensParaAbater.length === 0);
    document.getElementById('fab-div-count').innerText = `${itensParaAbater.length} itens`;
}

function alternarAbasDivisao(aba) {
    const v = document.getElementById('aba-div-valor'); const i = document.getElementById('aba-div-itens');
    const bv = document.getElementById('btn-div-valor'); const bi = document.getElementById('btn-div-itens');
    v.classList.toggle('hidden', aba !== 'valor'); i.classList.toggle('hidden', aba !== 'itens');
    if(aba === 'valor') { atualizarEstiloAba(bv, bi); document.getElementById('fab-divisao').classList.add('hidden'); } else { atualizarEstiloAba(bi, bv); if(itensParaAbater.length > 0) document.getElementById('fab-divisao').classList.remove('hidden'); }
}

function abrirResumoDivisao() {
    const total = itensParaAbater.reduce((acc, idx) => acc + parseFloat(itensExpandidosDivisao[idx].preco), 0);
    document.getElementById('itens-divisao-modal').innerHTML = itensParaAbater.map(idx => { const item = itensExpandidosDivisao[idx]; return `<div class="flex justify-between text-[10px] font-bold"><span>${item.nome}</span><span>R$ ${parseFloat(item.preco).toFixed(2)}</span></div>`; }).join('');
    document.getElementById('total-divisao-modal').innerText = `R$ ${total.toFixed(2)}`;
    // Reseta botões
    setLoading('btn-pagar-itens', false, "CONFIRMAR PAGAMENTO");
    document.getElementById('modal-divisao').classList.remove('hidden'); document.getElementById('modal-divisao').classList.add('flex');
}
function fecharModalDivisao() { document.getElementById('modal-divisao').classList.add('hidden'); }
function handlePagamentoParcialChange() { document.getElementById('sessao-troco-divisao').classList.toggle('hidden', document.getElementById('forma-parcial-itens').value !== 'Dinheiro'); }
function calcularTrocoDivisao() {
    const total = itensParaAbater.reduce((acc, idx) => acc + parseFloat(itensExpandidosDivisao[idx].preco), 0);
    const rec = convMoedaFloat(document.getElementById('recebido-divisao').value);
    const el = document.getElementById('troco-divisao');
    el.innerText = `R$ ${(rec-total).toFixed(2)}`; el.className = `bg-slate-100 p-4 rounded-2xl text-xs font-black min-w-[80px] flex justify-center items-center ${(rec-total)<0?'text-red-500':'text-emerald-500'}`;
}

// CORREÇÃO: BLINDAGEM DIVISÃO (ITENS)
async function confirmarAbateItens() {
    const total = itensParaAbater.reduce((acc, idx) => acc + parseFloat(itensExpandidosDivisao[idx].preco), 0);
    const forma = document.getElementById('forma-parcial-itens').value;
    
    // TRAVA
    setLoading('btn-pagar-itens', true);

    try {
        if (forma === 'Dinheiro') { const recebido = convMoedaFloat(document.getElementById('recebido-divisao').value); if (recebido < total) { showToast("VALOR INSUFICIENTE", "erro"); setLoading('btn-pagar-itens', false, "CONFIRMAR PAGAMENTO"); return; } }

        const itensNegativos = itensParaAbater.map(idx => { const item = itensExpandidosDivisao[idx]; return { nome: `PGTO PARCIAL (${item.nome})`, preco: -Math.abs(item.preco), qtd: 1 }; });
        const novosItens = [...comandaAtualDivisao.itens, ...itensNegativos];
        const novoTotal = Math.max(0, novosItens.reduce((a, i) => a + (parseFloat(i.preco)*i.qtd), 0));
        await _supabase.from('historico_vendas').insert([{ itens: itensNegativos, total: total, forma_pagamento: forma, comanda_id: comandaAtualDivisao.id, vendedor: localStorage.getItem('userName'), created_at: new Date().toISOString() }]);
        await _supabase.from('comandas').update({ itens: novosItens, total: parseFloat(novoTotal.toFixed(2)), status: novoTotal < 0.05 ? 'fechada' : 'aberta' }).eq('id', comandaAtualDivisao.id);
        
        registrarLog('PAGAMENTO PARCIAL (ITEM)', `Mesa: ${comandaAtualDivisao.identificacao} | Valor: R$ ${total} | Itens Pagos: ${itensParaAbater.length}`);

        showToast("PAGAMENTO REALIZADO!"); window.location.href = 'comandas.html';
    } catch (e) {
        showToast("ERRO", "erro");
        setLoading('btn-pagar-itens', false, "CONFIRMAR PAGAMENTO");
    }
}

// CORREÇÃO: BLINDAGEM DIVISÃO (VALOR)
async function confirmarAbateValor() {
    // TRAVA
    setLoading('btn-pagar-valor', true);

    try {
        const v = convMoedaFloat(document.getElementById('valor-parcial').value);
        const f = document.getElementById('forma-parcial-valor').value;
        if(v <= 0) { showToast("INVÁLIDO", "erro"); setLoading('btn-pagar-valor', false, "CONFIRMAR PAGAMENTO"); return; }

        const itemNeg = { nome: `PAGAMENTO ADIANTADO (${f})`, preco: -Math.abs(v), qtd: 1 };
        const novosItens = [...comandaAtualDivisao.itens, itemNeg];
        const novoT = Math.max(0, novosItens.reduce((a, i) => a + (parseFloat(i.preco)*i.qtd), 0));
        await _supabase.from('historico_vendas').insert([{ itens: [itemNeg], total: v, forma_pagamento: f, comanda_id: comandaAtualDivisao.id, vendedor: localStorage.getItem('userName'), created_at: new Date().toISOString() }]);
        await _supabase.from('comandas').update({ itens: novosItens, total: parseFloat(novoT.toFixed(2)), status: novoT < 0.05 ? 'fechada' : 'aberta' }).eq('id', comandaAtualDivisao.id);
        
        registrarLog('PAGAMENTO ADIANTADO (VALOR)', `Mesa: ${comandaAtualDivisao.identificacao} | Valor: R$ ${v} | Forma: ${f}`);

        showToast("ABATIDO!"); window.location.href = 'comandas.html';
    } catch (e) {
        showToast("ERRO", "erro");
        setLoading('btn-pagar-valor', false, "CONFIRMAR PAGAMENTO");
    }
}
function irParaDivisao(id) { sessionStorage.setItem('comandaDivisaoId', id); window.location.href = 'divisao.html'; }

// CORREÇÃO: Botão de estorno estilizado
async function carregarHistoricoEstorno() {
    const { data: v } = await _supabase.from('historico_vendas').select('*').order('created_at', {ascending: false}).limit(50);
    document.getElementById('lista-vendas-estorno').innerHTML = (v||[]).map(i => `
        <div class="flex justify-between items-center p-4 border-b border-slate-50 last:border-0 hover:bg-slate-50 transition-colors rounded-xl">
            <div>
                <p class="text-sm font-black text-slate-700">R$ ${parseFloat(i.total).toFixed(2)}</p>
                <p class="text-[9px] text-slate-400 uppercase tracking-wide font-bold">${i.forma_pagamento} - ${formatarData(i.created_at)}</p>
            </div>
            <button onclick="realizarEstorno(${i.id})" class="bg-red-50 text-red-500 px-4 py-3 rounded-xl text-[9px] font-black uppercase border border-red-100 flex items-center gap-2 active:scale-95 transition-all hover:bg-red-100 hover:border-red-200">
                🗑️ ESTORNAR
            </button>
        </div>
    `).join('');
}

async function realizarEstorno(id) {
    abrirConfirmacao("CONFIRMA?", "Excluir?", async () => {
        const { data: v } = await _supabase.from('historico_vendas').select('*').eq('id', id).single();
        if(v.comanda_id) await _supabase.from('comandas').update({status: 'aberta'}).eq('id', v.comanda_id);
        await _supabase.from('historico_vendas').delete().eq('id', id);
        
        registrarLog('ESTORNO', `Venda ID ${id} estornada | Valor: R$ ${v.total}`);

        showToast("ESTORNADO!"); carregarHistoricoEstorno();
    });
}

/* =================================================================================
   MÓDULO 8: ADMINISTRAÇÃO E RELATÓRIOS
   ================================================================================= */
function abrirSubSecao(s) { 
    // CORREÇÃO: Verifica se os elementos existem antes de manipular e fecha todos
    const menu = document.getElementById('admin-menu-principal');
    if(menu) menu.classList.add('hidden');

    ['secao-produtos', 'secao-relatorios', 'secao-estorno', 'secao-configuracoes'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.classList.add('hidden');
    }); 
    
    // Abre apenas a seção alvo
    const target = document.getElementById(`secao-${s}`);
    if(target) target.classList.remove('hidden'); 
    
    // CORREÇÃO: Garante que os sub-menus de relatórios/config abram limpos
    if (s === 'relatorios') {
        const menuRel = document.getElementById('menu-relatorios-cards');
        if(menuRel) menuRel.classList.remove('hidden');
        ['view-financeiro', 'view-produtos', 'view-comandas', 'view-dashboard'].forEach(id => {
            const el = document.getElementById(id);
            if(el) el.classList.add('hidden');
        });
    }
    
    if (s === 'configuracoes') {
        const menuCfg = document.getElementById('menu-config-cards');
        if(menuCfg) menuCfg.classList.remove('hidden');
        ['view-cfg-ticket', 'view-cfg-auditoria', 'view-cfg-perigo', 'view-cfg-usuarios'].forEach(id => {
            const el = document.getElementById(id);
            if(el) el.classList.add('hidden');
        });
        // Carrega dados se necessário
        carregarAuditoria(); 
        carregarFiltroUsuarios(); 
    }

    if (s === 'produtos') renderizarCatalogo();
    if (s === 'estorno') carregarHistoricoEstorno();
}

function voltarAoMenuAdmin() { 
    ['secao-produtos', 'secao-relatorios', 'secao-estorno', 'secao-configuracoes'].forEach(id => {
        const el = document.getElementById(id);
        if(el) el.classList.add('hidden');
    });
    const menu = document.getElementById('admin-menu-principal');
    if(menu) menu.classList.remove('hidden');
}

function abrirRelatorioEspecifico(t) { 
    document.getElementById('menu-relatorios-cards').classList.add('hidden'); 
    ['view-financeiro', 'view-produtos', 'view-comandas', 'view-dashboard'].forEach(id => document.getElementById(id).classList.add('hidden')); 
    
    const el = document.getElementById(`view-${t}`);
    if(el) el.classList.remove('hidden'); 
    
    if (t === 'dashboard') {
        gerarDashboard();
        return;
    }

    // DEFINE AUTOMATICAMENTE A DATA DE INÍCIO COMO 7 DIAS ATRÁS
    const hoje = new Date();
    const passado = new Date();
    passado.setDate(hoje.getDate() - 7);

    const inputInicio = document.getElementById(`data-inicio-rel-${t}`);
    const inputFim = document.getElementById(`data-fim-rel-${t}`);

    if(inputInicio && inputFim) {
        inputInicio.value = passado.toISOString().split('T')[0];
        inputFim.value = hoje.toISOString().split('T')[0];

        if(t === 'financeiro') gerarRelatorioFinanceiro();
        if(t === 'produtos') gerarRelatorioProdutos();
        if(t === 'comandas') gerarRelatorioComandas();
    }
}

function voltarMenuRelatorios() { ['view-financeiro', 'view-produtos', 'view-comandas', 'view-dashboard'].forEach(id => document.getElementById(id).classList.add('hidden')); document.getElementById('menu-relatorios-cards').classList.remove('hidden'); }

// LÓGICA DO DASHBOARD (MOVIDA PARA CÁ)
async function gerarDashboard() {
    if(!_supabase) return;
    const seteDiasAtras = new Date();
    seteDiasAtras.setDate(seteDiasAtras.getDate() - 6);
    const inicioDash = seteDiasAtras.toISOString().split('T')[0];

    const { data: vDash } = await _supabase.from('historico_vendas')
        .select('*')
        .gte('created_at', `${inicioDash}T00:00:00`)
        .order('created_at', {ascending: true});

    if(vDash && vDash.length > 0) renderizarGraficosAdmin(vDash);
}

function renderizarGraficosAdmin(vendas) {
    if(typeof Chart === 'undefined') return;

    // Destrói gráficos antigos se existirem para não bugar
    Chart.getChart("chart-semana")?.destroy();
    Chart.getChart("chart-categorias")?.destroy();
    Chart.getChart("chart-pagamentos")?.destroy();

    const dias = {};
    const categorias = {};
    const pagamentos = {};

    vendas.forEach(v => {
        const dataFormatada = new Date(v.created_at).toLocaleDateString('pt-BR', {day: '2-digit', month: '2-digit'});
        dias[dataFormatada] = (dias[dataFormatada] || 0) + parseFloat(v.total);
        pagamentos[v.forma_pagamento] = (pagamentos[v.forma_pagamento] || 0) + 1;
        if(v.itens) {
            v.itens.forEach(item => {
                if(parseFloat(item.preco) > 0 && !item.nome.includes('PAGAMENTO')) {
                    const cat = item.categoria ? item.categoria.toUpperCase() : 'OUTROS';
                    categorias[cat] = (categorias[cat] || 0) + (item.qtd || 1);
                }
            });
        }
    });

    new Chart(document.getElementById('chart-semana'), {
        type: 'line',
        data: {
            labels: Object.keys(dias),
            datasets: [{ label: 'Vendas (R$)', data: Object.values(dias), borderColor: '#e63946', backgroundColor: 'rgba(230, 57, 70, 0.1)', tension: 0.4, fill: true }]
        },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } } }
    });

    new Chart(document.getElementById('chart-categorias'), {
        type: 'doughnut',
        data: { labels: Object.keys(categorias), datasets: [{ data: Object.values(categorias), backgroundColor: ['#FF6384', '#36A2EB', '#FFCE56', '#4BC0C0'], borderWidth: 0 }] },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } } }
    });

    new Chart(document.getElementById('chart-pagamentos'), {
        type: 'bar',
        data: { labels: Object.keys(pagamentos), datasets: [{ label: 'Qtd', data: Object.values(pagamentos), backgroundColor: ['#10b981', '#3b82f6', '#f59e0b'], borderRadius: 5 }] },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { x: { grid: { display: false } }, y: { display: false } } }
    });
}

function alternarAbas(a) { 
    const lista = document.getElementById('aba-lista');
    const cadastro = document.getElementById('aba-cadastro');
    const btnLista = document.getElementById('btn-aba-lista');
    const btnCadastro = document.getElementById('btn-aba-cadastro');
    lista.classList.toggle('hidden', a!=='lista'); 
    cadastro.classList.toggle('hidden', a!=='cadastro'); 
    if (a === 'lista') { atualizarEstiloAba(btnLista, btnCadastro); } else { atualizarEstiloAba(btnCadastro, btnLista); }
}

function abrirConfigEspecifica(tipo) { 
    // CORREÇÃO: Fecha o menu de cards e garante que só a view certa abra
    document.getElementById('menu-config-cards').classList.add('hidden'); 
    
    ['view-cfg-ticket', 'view-cfg-auditoria', 'view-cfg-perigo', 'view-cfg-usuarios'].forEach(id => {
        const el = document.getElementById(id);
        if(el) el.classList.add('hidden');
    });

    const target = document.getElementById(`view-cfg-${tipo}`);
    if(target) target.classList.remove('hidden'); 
    
    if (tipo === 'usuarios') carregarListaUsuarios();
    if (tipo === 'auditoria') carregarAuditoria();
}

function voltarMenuConfig() { 
    ['view-cfg-ticket', 'view-cfg-auditoria', 'view-cfg-perigo', 'view-cfg-usuarios'].forEach(id => {
        const el = document.getElementById(id);
        if(el) el.classList.add('hidden');
    });
    document.getElementById('menu-config-cards').classList.remove('hidden'); 
}

async function gerarRelatorioFinanceiro() {
    const inicio = document.getElementById('data-inicio-rel-financeiro').value;
    const fim = document.getElementById('data-fim-rel-financeiro').value;
    if(!inicio || !fim) return;

    const { data: v } = await _supabase.from('historico_vendas')
        .select('*')
        .gte('created_at', `${inicio}T00:00:00`)
        .lte('created_at', `${fim}T23:59:59`);

    const total = v.reduce((a,b)=>a+b.total,0);
    const pix = v.filter(i=>i.forma_pagamento==='Pix').reduce((a,b)=>a+b.total,0);
    const din = v.filter(i=>i.forma_pagamento==='Dinheiro').reduce((a,b)=>a+b.total,0);
    const deb = v.filter(i=>i.forma_pagamento==='Debito').reduce((a,b)=>a+b.total,0);
    const cre = v.filter(i=>i.forma_pagamento==='Credito').reduce((a,b)=>a+b.total,0);
    
    document.getElementById('conteudo-rel-financeiro').innerHTML = `
    <div class="bg-white p-4 rounded-[2rem] border border-slate-100 text-center mb-4"><p class="text-xs text-slate-400 font-bold uppercase">TOTAL GERAL</p><h2 class="text-3xl font-black text-emerald-500">R$ ${total.toFixed(2)}</h2></div>
    <div class="space-y-3">
        <div class="bg-blue-50 p-4 rounded-2xl flex justify-between items-center border border-blue-100"><div class="flex items-center gap-3"><span class="text-2xl">💠</span><span class="text-xs font-black text-blue-400 uppercase">PIX</span></div><span class="text-lg font-black text-blue-600">R$ ${pix.toFixed(2)}</span></div>
        <div class="bg-green-50 p-4 rounded-2xl flex justify-between items-center border border-green-100"><div class="flex items-center gap-3"><span class="text-2xl">💵</span><span class="text-xs font-black text-green-400 uppercase">DINHEIRO</span></div><span class="text-lg font-black text-green-600">R$ ${din.toFixed(2)}</span></div>
        <div class="bg-purple-50 p-4 rounded-2xl flex justify-between items-center border border-purple-100"><div class="flex items-center gap-3"><span class="text-2xl">💳</span><span class="text-xs font-black text-purple-400 uppercase">DÉBITO</span></div><span class="text-lg font-black text-purple-600">R$ ${deb.toFixed(2)}</span></div>
        <div class="bg-orange-50 p-4 rounded-2xl flex justify-between items-center border border-orange-100"><div class="flex items-center gap-3"><span class="text-2xl">💳</span><span class="text-xs font-black text-orange-400 uppercase">CRÉDITO</span></div><span class="text-lg font-black text-orange-600">R$ ${cre.toFixed(2)}</span></div>
    </div>`;
}

// CORREÇÃO: Filtro Avançado para ignorar pagamentos parciais no ranking
async function gerarRelatorioProdutos() {
    const inicio = document.getElementById('data-inicio-rel-produtos').value;
    const fim = document.getElementById('data-fim-rel-produtos').value;
    if(!inicio || !fim) return;

    const { data: v } = await _supabase.from('historico_vendas')
        .select('itens')
        .gte('created_at', `${inicio}T00:00:00`)
        .lte('created_at', `${fim}T23:59:59`);

    const contagem = {}; 
    
    v.forEach(venda => {
        venda.itens.forEach(item => { 
            const preco = parseFloat(item.preco);
            const nome = (item.nome || '').toUpperCase();
            // Ignora se for negativo ou se o nome indicar pagamento/troco
            const ehPagamento = nome.includes('PAGAMENTO') || nome.includes('PGTO') || nome.includes('TROCO') || nome.includes('TAXA');
            
            if(preco > 0 && !ehPagamento) { 
                contagem[item.nome] = (contagem[item.nome] || 0) + (item.qtd || 1); 
            } 
        }); 
    });
    
    const ranking = Object.entries(contagem).sort((a,b)=>b[1]-a[1]);
    document.getElementById('conteudo-rel-produtos').innerHTML = ranking.map(([nome,qtd], i) => `<div class="flex justify-between items-center border-b border-slate-50 py-2"><span class="font-bold text-[10px] text-slate-600 uppercase">${i+1}. ${nome}</span><span class="font-black text-slate-800 bg-slate-100 px-2 rounded-lg text-xs">${qtd}x</span></div>`).join('');
}

// CORREÇÃO: Relatório de Comandas Visual + Reabertura (EM CARDS)
async function gerarRelatorioComandas() {
    const inicio = document.getElementById('data-inicio-rel-comandas').value;
    const fim = document.getElementById('data-fim-rel-comandas').value;
    if(!inicio || !fim) return;

    const { data: c } = await _supabase.from('comandas')
        .select('*')
        .gte('fechada_em', `${inicio}T00:00:00`)
        .lte('fechada_em', `${fim}T23:59:59`)
        .eq('status', 'fechada');
    
    document.getElementById('conteudo-rel-comandas').innerHTML = c.map(mesa => `
        <div class="bg-white p-4 rounded-2xl border border-slate-100 mb-3 shadow-sm flex flex-col justify-between">
            <div class="flex items-center gap-3 mb-2">
                <div class="bg-orange-50 w-10 h-10 rounded-full flex items-center justify-center text-lg">📝</div>
                <div>
                    <h4 class="font-black text-xs text-slate-700 uppercase truncate w-24">${mesa.identificacao}</h4>
                    <p class="text-[8px] font-bold text-slate-400">${formatarHora(mesa.fechada_em)}</p>
                </div>
            </div>
            <div class="flex items-center justify-between mt-2 pt-2 border-t border-slate-50">
                <span class="font-black text-sm text-slate-700">R$ ${parseFloat(mesa.total).toFixed(2)}</span>
                <button onclick="confirmarReaberturaComanda(${mesa.id})" class="bg-orange-50 text-orange-500 w-8 h-8 rounded-lg flex items-center justify-center hover:bg-orange-100 transition-all border border-orange-100 shadow-sm" title="Reabrir Comanda">
                    ↺
                </button>
            </div>
        </div>
    `).join('');
}

// NOVA FUNÇÃO: Reabrir Comanda com Senha
function confirmarReaberturaComanda(id) {
    solicitarAutenticacao(async () => {
        abrirConfirmacao("REABRIR?", "A comanda voltará a ficar ativa.", async () => {
            await _supabase.from('comandas').update({ status: 'aberta', fechada_em: null }).eq('id', id);
            registrarLog('REABERTURA', `Comanda ID ${id} reaberta`);
            gerarRelatorioComandas(); // Atualiza a lista
            showToast("COMANDA REABERTA!");
        });
    });
}

// Configurações e Auditoria
async function salvarConfiguracoes() {
    const nome = document.getElementById('cfg-nome-loja').value;
    localStorage.setItem('nomeLoja', nome); 
    registrarLog('CONFIGURAÇÃO', `Nome da loja alterado para: ${nome}`);
    showToast("NOME SALVO!");
}

async function carregarFiltroUsuarios() {
    const { data: users } = await _supabase.from('usuarios').select('usuario');
    const sel = document.getElementById('filtro-auditoria-usuario');
    sel.innerHTML = '<option value="">Todos os Usuários</option>'; // LIMPEZA
    if(sel && users) users.forEach(u => sel.innerHTML += `<option value="${u.usuario}">${u.usuario.toUpperCase()}</option>`);
}

async function carregarAuditoria() {
    const user = document.getElementById('filtro-auditoria-usuario')?.value;
    let query = _supabase.from('auditoria_sistema').select('*').order('created_at', {ascending: false}).limit(50);
    if(user) query = query.eq('usuario', user);
    const { data: l } = await query;
    document.getElementById('lista-auditoria').innerHTML = (l||[]).map(i => `<div class="text-[9px] border-b py-2"><span class="font-black text-blue-500">[${formatarHora(i.created_at)}]</span> ${i.usuario}: ${i.acao}</div>`).join('');
}

// GESTÃO DE USUÁRIOS COM TRAVA
async function carregarListaUsuarios() {
    const { data: users } = await _supabase.from('usuarios').select('*');
    const lista = document.getElementById('lista-usuarios-sistema');
    lista.innerHTML = (users||[]).map(u => {
        // Exibe o nome real se tiver, senão o login
        const nomeExibicao = u.nome ? `${u.nome} (${u.usuario})` : u.usuario;
        return `
        <div class="flex justify-between items-center bg-slate-50 p-3 rounded-xl border border-slate-100">
            <span class="text-[10px] font-bold uppercase text-slate-700">${nomeExibicao}</span>
            <button onclick="excluirUsuario('${u.id}')" class="bg-red-50 text-red-500 px-3 py-2 rounded-xl text-[9px] font-black uppercase border border-red-100 flex items-center gap-1 active:scale-95 transition-all hover:bg-red-100">
                🗑️ EXCLUIR
            </button>
        </div>`;
    }).join('');
}

// CORREÇÃO CRÍTICA: Tratamento de erro e feedback no cadastro
async function salvarNovoUsuario() {
    const u = document.getElementById('novo-user-nome').value.trim().toLowerCase();
    const s = document.getElementById('novo-user-pass').value.trim();
    // NOVO: Captura o nome completo
    const n = document.getElementById('novo-user-completo').value.trim().toUpperCase();
    
    if(!u || !s) {
        showToast("PREENCHA TUDO", "erro");
        return;
    }
    
    const { data: existente } = await _supabase.from('usuarios').select('*').eq('usuario', u).single();
    if (existente) {
        showToast("USUÁRIO JÁ EXISTE", "erro");
        return;
    }

    solicitarAutenticacao(async () => {
        // NOVO: Inclui o campo 'nome' no insert
        const { error } = await _supabase.from('usuarios').insert([{ usuario: u, senha: s, nome: n, role: 'admin' }]);
        
        if (error) {
            console.error(error);
            showToast("ERRO AO SALVAR", "erro");
        } else {
            registrarLog('NOVO USUÁRIO', `Usuário criado: ${u} (${n})`);
            document.getElementById('novo-user-nome').value = '';
            document.getElementById('novo-user-pass').value = '';
            document.getElementById('novo-user-completo').value = '';
            showToast("USUÁRIO CRIADO!");
            carregarListaUsuarios();
        }
    });
}

async function excluirUsuario(id) {
    solicitarAutenticacao(() => {
        // Callback para garantir que o modal de senha feche
        setTimeout(() => {
            abrirConfirmacao("EXCLUIR?", "Remover acesso?", async () => {
                await _supabase.from('usuarios').delete().eq('id', id);
                registrarLog('EXCLUIR USUÁRIO', `Usuário ID ${id} removido`);
                carregarListaUsuarios();
            });
        }, 300);
    });
}

async function zerarSistema(tipo) {
    abrirConfirmacao("TEM CERTEZA?", "Isso não pode ser desfeito!", async () => {
        if(tipo === 'comandas') {
            await _supabase.from('comandas').delete().neq('id', 0);
            registrarLog('ZERAR SISTEMA', 'Todas as comandas foram apagadas');
        }
        if(tipo === 'vendas') {
            await _supabase.from('historico_vendas').delete().neq('id', 0);
            registrarLog('ZERAR SISTEMA', 'Histórico de vendas foi apagado');
        }
        showToast("DADOS APAGADOS!");
    });
}

function mascaraMoeda(e) { let v = e.target.value.replace(/\D/g, ""); e.target.value = (parseInt(v || 0)/100).toFixed(2).replace(".", ","); }
function convMoedaFloat(v) { return parseFloat((v || "0").replace(/\./g, '').replace(',', '.')) || 0; }
function formatarData(iso) { return new Date(iso).toLocaleDateString('pt-BR'); }
function formatarHora(iso) { return new Date(iso).toLocaleTimeString('pt-BR', {hour:'2-digit', minute:'2-digit'}); }
// CORREÇÃO: Z-INDEX AUMENTADO PARA GARANTIR VISIBILIDADE SOBRE MODAL
function showToast(m, t='sucesso') { const el = document.createElement('div'); el.className = `fixed bottom-24 left-1/2 -translate-x-1/2 px-8 py-4 rounded-[1.5rem] shadow-2xl font-black text-[10px] text-white z-[9999] ${t==='erro'?'bg-red-500':'bg-slate-800'}`; el.innerText = m; document.body.appendChild(el); setTimeout(()=>el.remove(), 3000); }
function abrirConfirmacao(t, m, c) { document.getElementById('titulo-modal-conf').innerText = t; document.getElementById('msg-modal-conf').innerText = m; callbackConfirmacao = c; document.getElementById('modal-confirmacao-sistema').classList.remove('hidden'); document.getElementById('modal-confirmacao-sistema').classList.add('flex'); }
function executarConfirmacao() { if(callbackConfirmacao) callbackConfirmacao(); fecharModalConfirmacao(); }
function fecharModalConfirmacao() { document.getElementById('modal-confirmacao-sistema').classList.add('hidden'); }
function garantirModalConfirmacao() { if(!document.getElementById('modal-confirmacao-sistema')) { const h = `<div id="modal-confirmacao-sistema" class="hidden fixed inset-0 bg-slate-900/95 z-[100] items-center justify-center px-6 backdrop-blur-md"><div class="bg-white w-full max-w-[320px] rounded-[3rem] p-8 text-center shadow-2xl border-4 border-white"><h3 id="titulo-modal-conf" class="text-[#e63946] font-black text-sm uppercase mb-2"></h3><p id="msg-modal-conf" class="text-[10px] font-bold text-slate-400 mb-8"></p><div class="flex gap-4"><button onclick="fecharModalConfirmacao()" class="flex-1 bg-slate-100 py-4 rounded-[1.5rem] text-[9px] font-black">NÃO</button><button onclick="executarConfirmacao()" class="flex-1 bg-[#e63946] text-white py-4 rounded-[1.5rem] text-[9px] font-black">SIM</button></div></div></div>`; document.body.insertAdjacentHTML('beforeend', h); } }
garantirModalConfirmacao();