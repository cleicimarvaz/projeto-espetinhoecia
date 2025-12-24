/* =============================================================
   CONFIGURAÇÃO GERAL E ESTADO
   ============================================================= */
const SUPABASE_URL = 'https://vtexlttnjzmgknmbwbwl.supabase.co';
const SUPABASE_KEY = 'sb_publishable_C5SP_ulU5lhJjTdokxdegA_6ZIdeGPk'; 
const _supabase = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

let carrinho = []; 
let comandaSendoFechada = null;
let comandaAtualDivisao = null;
let itensParaAbater = [];

/* =============================================================
   MÓDULO 1: ACESSO, SEGURANÇA E NAVEGAÇÃO (6 Funções)
   ============================================================= */

// 1. Inicializador Geral de Ciclo de Vida
document.addEventListener('DOMContentLoaded', () => {
    initNavbar();
    exibirNomeUsuario();
    if (document.getElementById('home-page')) initHome();
    if (document.getElementById('produtos-page')) { renderizarCatalogo(); verificarPermissoesAdmin(); }
    if (document.getElementById('venda-page')) { renderizarVenda(); verificarContextoVenda(); }
    if (document.getElementById('comandas-page')) renderizarComandasAtivas();
    if (document.getElementById('divisao-page')) initPaginaDivisao();
    if (document.getElementById('fechamento-page')) initPaginaFechamento();
});

// 2. Exibição Dinâmica do Operador no Header
function exibirNomeUsuario() {
    const el = document.getElementById('usuario-logado');
    const nome = localStorage.getItem('userName');
    if (el && nome) el.innerText = `Olá, ${nome}`;
}

// 3. Processamento de Autenticação (Login)
async function fazerLogin() {
    const uInp = document.getElementById('user'), pInp = document.getElementById('pass');
    if (!uInp || !pInp) return;
    const { data: u } = await _supabase.from('usuarios').select('*')
        .eq('usuario', uInp.value.toLowerCase().trim())
        .eq('senha', pInp.value).single();
    if (u) {
        localStorage.setItem('userRole', u.cargo); localStorage.setItem('userName', u.nome);
        window.location.replace('home.html');
    } else { showToast("Acesso Negado", "erro"); }
}

// 4. Encerramento de Sessão (Logout)
function logout() { localStorage.clear(); window.location.href = "index.html"; }

// 5. Gestão de Permissões Administrativas
function verificarPermissoesAdmin() {
    const statusCont = document.getElementById('container-status');
    if (localStorage.getItem('userRole') !== 'admin' && statusCont) statusCont.classList.add('hidden');
}

// 6. Sincronização de Estado da Navbar
function initNavbar() {
    const page = window.location.pathname.split("/").pop() || "home.html";
    const links = { 'home.html': 'nav-home', 'venda.html': 'nav-venda', 'comandas.html': 'nav-comandas', 'fechamento.html': 'nav-relatorio' };
    if (links[page] && document.getElementById(links[page])) document.getElementById(links[page]).classList.add('text-[#e63946]');
}

/* =============================================================
   MÓDULO 2: DASHBOARD E GESTÃO DE ITENS (7 Funções)
   ============================================================= */

// 7. Consolidação de Dados na Home
async function initHome() {
    const [vReq, cReq] = await Promise.all([_supabase.from('historico_vendas').select('*'), _supabase.from('comandas').select('*').eq('status', 'aberta')]);
    const total = (vReq.data || []).reduce((acc, v) => acc + (parseFloat(v.total) || 0), 0);
    if(document.getElementById('faturamento-hoje')) document.getElementById('faturamento-hoje').innerText = `R$ ${total.toFixed(2)}`;
    if(document.getElementById('qtd-comandas')) document.getElementById('qtd-comandas').innerText = (cReq.data || []).length;
}

// 8. Renderização do Catálogo com Switch de Status
async function renderizarCatalogo() {
    const container = document.getElementById('lista-catalogo'); if (!container) return;
    const { data: pds } = await _supabase.from('produtos').select('*').order('nome');
    container.innerHTML = (pds || []).map(p => {
        const isInativo = p.status === false;
        return `<div class="bg-white p-4 rounded-3xl shadow-sm flex justify-between items-center border-2 ${isInativo ? 'border-slate-100 opacity-60' : 'border-white'} mb-2">
            <div class="flex items-center space-x-4"><div class="text-2xl ${isInativo ? 'grayscale' : ''}">${p.categoria === 'Bebidas' ? '🥤' : '🍢'}</div><div><h4 class="font-black text-slate-800 text-xs uppercase italic">${p.nome}</h4><p class="text-[9px] font-bold ${isInativo ? 'text-slate-400' : 'text-red-500'}">R$ ${parseFloat(p.preco).toFixed(2)}</p></div></div>
            <div class="flex items-center space-x-3">
                <label class="relative inline-flex items-center cursor-pointer scale-75">
                    <input type="checkbox" onchange="alternarStatusProduto(${p.id}, ${p.status})" class="sr-only peer" ${!isInativo ? 'checked' : ''}>
                    <div class="w-11 h-6 bg-slate-200 rounded-full peer peer-checked:bg-emerald-500 peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all"></div>
                </label>
                <button onclick="prepararEdicao(${p.id})" class="bg-slate-50 p-3 rounded-2xl text-[10px]">✏️</button>
                <button onclick="removerProduto(${p.id})" class="bg-red-50 text-red-500 p-3 rounded-2xl text-[10px]">🗑️</button>
            </div></div>`;
    }).join('');
}

// 9. Alternância Rápida de Ativo/Inativo
async function alternarStatusProduto(id, statusAtual) {
    const { error } = await _supabase.from('produtos').update({ status: !statusAtual }).eq('id', id);
    if (!error) { showToast("Status Atualizado"); renderizarCatalogo(); }
}

// 10. Exclusão de Item do Cardápio
async function removerProduto(id) {
    if (confirm("Remover permanentemente?")) { await _supabase.from('produtos').delete().eq('id', id); renderizarCatalogo(); }
}

// 11. Gravação/Persistência de Dados de Produto
async function salvarProduto() {
    const dados = { nome: document.getElementById('p-nome').value, preco: parseFloat(document.getElementById('p-preco').value), categoria: document.getElementById('p-categoria').value, status: document.getElementById('p-status').checked };
    const id = document.getElementById('p-id').value;
    if (id) await _supabase.from('produtos').update(dados).eq('id', id); else await _supabase.from('produtos').insert([dados]);
    showToast("Salvo!"); renderizarCatalogo(); alternarAbas('lista');
}

// 12. Mapeamento de Dados para o Formulário de Edição
function prepararEdicao(id) {
    _supabase.from('produtos').select('*').eq('id', id).single().then(({data: p}) => {
        document.getElementById('p-id').value = p.id; document.getElementById('p-nome').value = p.nome; document.getElementById('p-preco').value = p.preco;
        document.getElementById('p-categoria').value = p.categoria; document.getElementById('p-status').checked = p.status; alternarAbas('cadastro');
    });
}

// 13. Alternância de Visualização de Abas (Produtos)
function alternarAbas(aba) {
    const l = document.getElementById('aba-lista'), c = document.getElementById('aba-cadastro'), bl = document.getElementById('btn-aba-lista'), bc = document.getElementById('btn-aba-cadastro');
    if (aba === 'cadastro') { l.classList.add('hidden'); c.classList.remove('hidden'); if(bc) bc.className = "flex-1 py-3 rounded-[1.5rem] bg-[#e63946] text-white"; if(bl) bl.className = "flex-1 py-3 text-slate-400"; }
    else { c.classList.add('hidden'); l.classList.remove('hidden'); if(bl) bl.className = "flex-1 py-3 rounded-[1.5rem] bg-[#e63946] text-white"; if(bc) bc.className = "flex-1 py-3 text-slate-400"; }
}

/* =============================================================
   MÓDULO 3: OPERAÇÕES DE VENDA E CARRINHO (10 Funções)
   ============================================================= */

// 14. Renderização do PDV com Botão Remover no Canto Inferior Direito
async function renderizarVenda() {
    const container = document.getElementById('lista-venda'); if (!container) return;
    const { data: todos } = await _supabase.from('produtos').select('*').order('nome');
    container.innerHTML = (todos || []).filter(p => p.status !== false).map(p => {
        const item = carrinho.find(i => i.id === p.id), qtd = item ? item.qtd : 0;
        return `<div class="relative"><button onclick="adicionarAoCarrinho(${p.id})" class="bg-white p-5 rounded-[2.2rem] shadow-sm border-2 ${qtd > 0 ? 'border-emerald-400' : 'border-white'} flex flex-col items-center justify-center w-full active:scale-95 transition-all"><div class="text-3xl mb-2">${p.categoria === 'Bebidas' ? '🥤' : '🍢'}</div><h4 class="font-black text-slate-800 text-[11px] uppercase italic text-center leading-tight mb-1">${p.nome}</h4><span class="bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full text-[9px] font-bold">R$ ${parseFloat(p.preco).toFixed(2)}</span></button>${qtd > 0 ? `<span class="absolute -top-2 -right-2 bg-emerald-500 text-white text-[10px] font-black w-7 h-7 flex items-center justify-center rounded-full border-2 border-white">${qtd}</span><button onclick="removerUmDoCarrinho(${p.id})" class="absolute -bottom-2 -right-2 bg-red-500 text-white w-8 h-8 flex items-center justify-center rounded-full border-2 border-white shadow-lg active:scale-125"> - </button>` : ''}</div>`;
    }).join('');
    atualizarBotaoFinalizar();
}

// 15. Inclusão de Item/Aumento de Quantidade
function adicionarAoCarrinho(id) {
    _supabase.from('produtos').select('*').eq('id', id).single().then(({data: p}) => {
        const item = carrinho.find(i => i.id === id); if (item) item.qtd++; else carrinho.push({ ...p, qtd: 1 }); renderizarVenda();
    });
}

// 16. Subtração de Item/Remoção do Carrinho
function removerUmDoCarrinho(id) {
    const idx = carrinho.findIndex(i => i.id === id); if (idx > -1) { if (carrinho[idx].qtd > 1) carrinho[idx].qtd--; else carrinho.splice(idx, 1); renderizarVenda(); }
}

// 17. Sincronização do Botão Flutuante (FAB) de Venda
function atualizarBotaoFinalizar() {
    const fab = document.getElementById('fab-finalizar'); const qtd = carrinho.reduce((acc, i) => acc + i.qtd, 0);
    if (qtd > 0 && fab) fab.classList.remove('hidden');
    if(document.getElementById('fab-count')) document.getElementById('fab-count').innerText = `${qtd} itens`;
}

// 18. Abertura do Checkout de Venda
function abrirResumoPedido() {
    const modal = document.getElementById('modal-resumo'), lista = document.getElementById('itens-carrinho-modal');
    if(!modal) return; const t = carrinho.reduce((acc, i) => acc + (parseFloat(i.preco) * i.qtd), 0);
    if(lista) lista.innerHTML = carrinho.map(i => `<div class="flex justify-between p-2 bg-slate-50 rounded-xl mb-1 text-[10px] font-bold"><span>${i.qtd}x ${i.nome}</span><span>R$ ${(parseFloat(i.preco) * i.qtd).toFixed(2)}</span></div>`).join('');
    if(document.getElementById('total-modal')) document.getElementById('total-modal').innerText = `R$ ${t.toFixed(2)}`;
    const finCont = document.querySelector('.financeiro-container');
    if(finCont) finCont.classList.toggle('hidden', !!sessionStorage.getItem('comandaAtivaId'));
    modal.classList.remove('hidden'); modal.classList.add('flex');
    handlePagamentoChange(); 
}

// 19. Ajuste Dinâmico de Contexto (Venda vs Lançamento)
function verificarContextoVenda() {
    const title = document.querySelector('#venda-page h1');
    if (sessionStorage.getItem('comandaAtivaId') && title) title.innerText = "LANÇAR NA MESA";
}

// 20. Confirmação com TRAVA DE PARIDADE UNIVERSAL
async function confirmarVenda() {
    const cId = sessionStorage.getItem('comandaAtivaId'); if (carrinho.length === 0) return;
    const total = carrinho.reduce((acc, i) => acc + (parseFloat(i.preco) * i.qtd), 0);

    if (!cId) { 
        const recebido = parseFloat(document.getElementById('valor-recebido').value) || 0;
        // NOVA TRAVA: Bloqueia valores menores OU maiores
        if (recebido.toFixed(2) !== total.toFixed(2)) return showToast("VALOR PAGO É DIFERENTE DO CONSUMIDO!", "erro");

        const forma = document.getElementById('forma-pagamento').value;
        await _supabase.from('historico_vendas').insert([{ itens: carrinho, total, forma_pagamento: forma, vendedor: localStorage.getItem('userName'), created_at: new Date().toISOString() }]);
        showToast("VENDA FINALIZADA!"); carrinho = []; fecharResumoPedido(); renderizarVenda();
        return;
    }

    const { data: c } = await _supabase.from('comandas').select('*').eq('id', cId).single();
    const nI = [...(c.itens || []), ...carrinho], nT = nI.reduce((acc, i) => acc + (parseFloat(i.preco) * i.qtd), 0);
    await _supabase.from('comandas').update({ itens: nI, total: nT }).eq('id', cId);
    showToast("LANÇADO COM SUCESSO!"); sessionStorage.removeItem('comandaAtivaId'); window.location.href = 'comandas.html';
}

// 21. Encerramento do Modal de Checkout
function fecharResumoPedido() { const m = document.getElementById('modal-resumo'); if(m) m.classList.add('hidden'); }

// 22. Forçar Exibição de Campo Financeiro para Conferência
function handlePagamentoChange() { 
    const s = document.getElementById('sessao-troco');
    if(s) s.classList.remove('hidden'); 
}

// 23. Cálculo de Troco com Alerta de Cor (Vermelho/Verde)
function calcularTroco() {
    const t = carrinho.reduce((acc, i) => acc + (parseFloat(i.preco) * i.qtd), 0);
    const recEl = document.getElementById('valor-recebido'), trocoEl = document.getElementById('valor-troco');
    const rec = recEl ? parseFloat(recEl.value) || 0 : 0; const troco = rec - t;
    if(trocoEl) { 
        trocoEl.innerText = `R$ ${troco.toFixed(2)}`; 
        trocoEl.className = `p-4 font-black text-xl italic ${troco !== 0 ? 'text-red-500' : 'text-emerald-500'}`; 
    }
}

/* =============================================================
   MÓDULO 4: GESTÃO DE COMANDAS E FECHAMENTO TOTAL (7 Funções)
   ============================================================= */

// 24. Renderização de Mesas em Aberto
async function renderizarComandasAtivas() {
    const container = document.getElementById('lista-comandas-ativas'); if (!container) return;
    const { data: cmds } = await _supabase.from('comandas').select('*').eq('status', 'aberta').order('aberta_em', { ascending: false });
    container.innerHTML = (cmds || []).map(c => `<div class="bg-white p-4 rounded-[2.5rem] shadow-sm border border-white flex items-center justify-between mb-2"><div class="flex items-center space-x-3"><div class="bg-orange-50 w-10 h-10 rounded-2xl flex items-center justify-center text-xl">📋</div><h4 class="font-black text-slate-800 text-xs uppercase italic">${c.identificacao}</h4></div><div class="flex items-center space-x-4"><p class="text-[#e63946] font-black text-lg mr-2 leading-none">R$ ${parseFloat(c.total || 0).toFixed(2)}</p><div class="flex space-x-1"><button onclick="gerenciarItensComanda(${c.id})" class="h-16 w-20 bg-slate-50 text-slate-600 rounded-2xl font-black text-[8px] border">+ LANÇAR</button><button onclick="irParaDivisao(${c.id})" class="h-16 w-20 bg-orange-50 text-orange-600 rounded-2xl font-black text-[8px] border">DIVIDIR</button><button onclick="prepararFechamentoComanda(${c.id})" class="h-16 w-20 bg-emerald-500 text-white rounded-2xl font-black text-[8px] shadow-md">FECHAR</button></div></div></div>`).join('');
}

// 25. Abertura de Nova Mesa
async function abrirNovaComanda() {
    const ident = document.getElementById('c-identificacao').value.trim(); if (!ident) return showToast("Mesa?", "erro");
    await _supabase.from('comandas').insert([{ identificacao: ident, itens: [], total: 0, status: 'aberta', aberta_em: new Date().toISOString() }]);
    showToast(`Mesa ${ident} aberta!`); renderizarComandasAtivas(); alternarAbasComanda('lista');
}

// 26. Vinculação de Mesa para Pedido de Cozinha
function gerenciarItensComanda(id) { sessionStorage.setItem('comandaAtivaId', id); window.location.href = 'venda.html'; }

// 27. Direcionamento para Checkout Parcial
function irParaDivisao(id) { sessionStorage.setItem('comandaDivisaoId', id); window.location.href = 'divisao.html'; }

// 28. Alternância de Abas de Comandas
function alternarAbasComanda(aba) {
    const l = document.getElementById('aba-lista-comanda'), a = document.getElementById('aba-abrir-comanda'), bl = document.getElementById('btn-comanda-lista'), ba = document.getElementById('btn-comanda-abrir');
    if (aba === 'abrir') { l.classList.add('hidden'); a.classList.remove('hidden'); if(ba) ba.className = "flex-1 py-3 rounded-[1.5rem] bg-[#e63946] text-white"; if(bl) bl.className = "flex-1 py-3 text-slate-400"; }
    else { a.classList.add('hidden'); l.classList.remove('hidden'); if(bl) bl.className = "flex-1 py-3 rounded-[1.5rem] bg-[#e63946] text-white"; if(ba) ba.className = "flex-1 py-3 text-slate-400"; }
}

// 29. Preparação de Dados para Encerramento Total
async function prepararFechamentoComanda(id) {
    _supabase.from('comandas').select('*').eq('id', id).single().then(({data: c}) => { 
        comandaSendoFechada = c; carrinho = c.itens; 
        const modal = document.getElementById('modal-resumo'), lista = document.getElementById('itens-carrinho-modal');
        if(lista) lista.innerHTML = (c.itens || []).map(i => `<div class="flex justify-between p-2 bg-slate-50 rounded-xl mb-1 text-[10px] font-bold"><span>${i.qtd}x ${i.nome}</span><span>R$ ${(parseFloat(i.preco) * i.qtd).toFixed(2)}</span></div>`).join('');
        if(document.getElementById('total-modal')) document.getElementById('total-modal').innerText = `R$ ${parseFloat(c.total).toFixed(2)}`;
        if(modal) { modal.classList.remove('hidden'); modal.classList.add('flex'); handlePagamentoChange(); }
    });
}

// 30. Encerramento Total com TRAVA DE PARIDADE
async function confirmarFechamentoComanda() {
    if (!comandaSendoFechada) return;
    const rec = parseFloat(document.getElementById('valor-recebido').value) || 0;
    // Bloqueia divergência para Pix, Cartão ou Dinheiro
    if (rec.toFixed(2) !== comandaSendoFechada.total.toFixed(2)) return showToast("VALOR PAGO É DIFERENTE DO CONSUMIDO!", "erro");

    const f = document.getElementById('forma-pagamento').value;
    await _supabase.from('historico_vendas').insert([{ itens: comandaSendoFechada.itens, total: comandaSendoFechada.total, forma_pagamento: f, vendedor: localStorage.getItem('userName'), created_at: new Date().toISOString() }]);
    await _supabase.from('comandas').update({ status: 'fechada', fechada_em: new Date().toISOString() }).eq('id', comandaSendoFechada.id);
    showToast("MESA FECHADA!"); fecharResumoPedido(); renderizarComandasAtivas();
}

/* =============================================================
   MÓDULO 5: DIVISÃO DE CONTA E ABATIMENTOS (11 Funções)
   ============================================================= */

// 31. Inicialização do Abate de Itens
async function initPaginaDivisao() {
    const id = sessionStorage.getItem('comandaDivisaoId'); if (!id) return;
    const { data: c } = await _supabase.from('comandas').select('*').eq('id', id).single();
    comandaAtualDivisao = c; itensParaAbater = [];
    if (document.getElementById('total-restante')) document.getElementById('total-restante').innerText = `R$ ${parseFloat(c.total).toFixed(2)}`;
    renderizarItensParaAbate(c.itens);
}

// 32. Injeção Visual dos Itens da Comanda
function renderizarItensParaAbate(itens) {
    const container = document.getElementById('lista-itens-divisao'); if (!container) return;
    container.innerHTML = (itens || []).map((item, idx) => `<div onclick="selecionarItemAbate(${idx})" id="item-abate-${idx}" class="bg-white p-4 rounded-2xl border-2 border-white flex justify-between items-center transition-all shadow-sm active:scale-95"><p class="text-[10px] font-black uppercase italic">${item.nome}</p><p class="font-black text-slate-800 text-[10px]">R$ ${parseFloat(item.preco).toFixed(2)}</p></div>`).join('');
}

// 33. Lógica de Seleção de Itens para Pagamento
function selecionarItemAbate(idx) {
    const el = document.getElementById(`item-abate-${idx}`); const pos = itensParaAbater.indexOf(idx);
    if (pos > -1) { itensParaAbater.splice(pos, 1); el.classList.remove('border-emerald-500', 'bg-emerald-50'); }
    else { itensParaAbater.push(idx); el.classList.add('border-emerald-500', 'bg-emerald-50'); }
    atualizarFABDivisao();
}

// 34. Controle do Botão Flutuante de Abate
function atualizarFABDivisao() {
    const fab = document.getElementById('fab-divisao'); if (!fab) return;
    if (itensParaAbater.length > 0) { fab.classList.remove('hidden'); if(document.getElementById('fab-div-count')) document.getElementById('fab-div-count').innerText = `${itensParaAbater.length} itens`; }
    else { fab.classList.add('hidden'); }
}

// 35. Abertura do Resumo Parcial
function abrirResumoDivisao() {
    const modal = document.getElementById('modal-divisao'), lista = document.getElementById('itens-divisao-modal');
    const pagos = comandaAtualDivisao.itens.filter((_, i) => itensParaAbater.includes(i));
    const total = pagos.reduce((acc, i) => acc + parseFloat(i.preco), 0);
    if(lista) lista.innerHTML = pagos.map(i => `<div class="flex justify-between p-2 text-[10px] font-bold"><span>${i.nome}</span><span>R$ ${parseFloat(i.preco).toFixed(2)}</span></div>`).join('');
    if(document.getElementById('total-divisao-modal')) document.getElementById('total-divisao-modal').innerText = `R$ ${total.toFixed(2)}`;
    modal.classList.remove('hidden'); modal.classList.add('flex'); handlePagamentoParcialChange();
}

// 36. Fechamento do Modal Parcial
function fecharModalDivisao() { if(document.getElementById('modal-divisao')) document.getElementById('modal-divisao').classList.add('hidden'); }

// 37. Visibilidade de Troco Parcial Obrigatória
function handlePagamentoParcialChange() { 
    const sessao = document.getElementById('sessao-troco-divisao');
    if(sessao) sessao.classList.remove('hidden'); 
}

// 38. Cálculo de Troco Parcial com Indicação de Cor
function calcularTrocoDivisao() {
    const total = comandaAtualDivisao.itens.filter((_, i) => itensParaAbater.includes(i)).reduce((acc, i) => acc + parseFloat(i.preco), 0);
    const recEl = document.getElementById('recebido-divisao'), trocoEl = document.getElementById('troco-divisao');
    const rec = recEl ? parseFloat(recEl.value) || 0 : 0; const troco = rec - total;
    if(trocoEl) { 
        trocoEl.innerText = `R$ ${troco.toFixed(2)}`; 
        trocoEl.className = `p-4 font-black text-xl italic ${troco !== 0 ? 'text-red-500' : 'text-emerald-500'}`; 
    }
}

// 39. Efetivação do Abate por Itens com TRAVA DE PARIDADE
async function confirmarAbateItens() {
    const f = document.getElementById('forma-parcial-itens').value;
    const pagos = comandaAtualDivisao.itens.filter((_, i) => itensParaAbater.includes(i)), restantes = comandaAtualDivisao.itens.filter((_, i) => !itensParaAbater.includes(i));
    const tP = pagos.reduce((acc, i) => acc + parseFloat(i.preco), 0);
    
    const rec = parseFloat(document.getElementById('recebido-divisao').value) || 0;
    // Bloqueia divergência (Menor ou Maior)
    if (rec.toFixed(2) !== tP.toFixed(2)) return showToast("VALOR PAGO É DIFERENTE DO CONSUMIDO!", "erro");

    await _supabase.from('historico_vendas').insert([{ itens: pagos, total: tP, forma_pagamento: f, vendedor: localStorage.getItem('userName'), created_at: new Date().toISOString() }]);
    await _supabase.from('comandas').update({ itens: restantes, total: restantes.reduce((acc, i) => acc + parseFloat(i.preco), 0) }).eq('id', comandaAtualDivisao.id);
    showToast("ITENS PAGOS!"); fecharModalDivisao(); if (restantes.length === 0) finalizarComandaTotal(comandaAtualDivisao.id); else initPaginaDivisao();
}

// 40. Abate Manual por Valor Definido
async function confirmarAbateValor() {
    const valor = parseFloat(document.getElementById('valor-parcial').value), forma = document.getElementById('forma-parcial-valor').value;
    if (valor <= 0) return;
    await _supabase.from('historico_vendas').insert([{ itens: [{nome: `ABATE VALOR: ${comandaAtualDivisao.identificacao}`, preco: valor, qtd: 1}], total: valor, forma_pagamento: forma, vendedor: localStorage.getItem('userName'), created_at: new Date().toISOString() }]);
    const novoTotal = comandaAtualDivisao.total - valor;
    await _supabase.from('comandas').update({ total: novoTotal }).eq('id', comandaAtualDivisao.id);
    showToast("VALOR ABATIDO!"); if (novoTotal <= 0.05) finalizarComandaTotal(comandaAtualDivisao.id); else initPaginaDivisao();
}

// 41. Alternância de Interface de Divisão
function alternarAbasDivisao(aba) {
    const v = document.getElementById('aba-div-valor'), i = document.getElementById('aba-div-itens'), bv = document.getElementById('btn-div-valor'), bi = document.getElementById('btn-div-itens');
    if (!v || !i) return;
    if (aba === 'itens') { v.classList.add('hidden'); i.classList.remove('hidden'); if(bi) bi.className = "flex-1 py-3 rounded-[1.5rem] bg-[#e63946] text-white"; if(bv) bv.className = "flex-1 py-3 text-slate-400"; }
    else { i.classList.add('hidden'); v.classList.remove('hidden'); if(bv) bv.className = "flex-1 py-3 rounded-[1.5rem] bg-[#e63946] text-white"; if(bi) bi.className = "flex-1 py-3 text-slate-400"; }
}

/* =============================================================
   MÓDULO 6: RELATÓRIOS E FINALIZAÇÃO (3 Funções)
   ============================================================= */

// 42. Processamento de Relatório Financeiro
async function initPaginaFechamento() {
    const container = document.getElementById('resumo-financeiro'); if (!container) return;
    const dIniEl = document.getElementById('data-inicio'), dFimEl = document.getElementById('data-fim');
    if(!dIniEl || !dFimEl) return; let dI = dIniEl.value, dF = dFimEl.value; const hoje = new Date().toISOString().split('T')[0];
    if (!dI) { dI = hoje; dIniEl.value = hoje; } if (!dF) { dF = hoje; dFimEl.value = hoje; }
    const { data: v } = await _supabase.from('historico_vendas').select('*').gte('created_at', `${dI}T00:00:00`).lte('created_at', `${dF}T23:59:59`);
    const porF = (v || []).reduce((acc, s) => { acc[s.forma_pagamento] = (acc[s.forma_pagamento] || 0) + parseFloat(s.total); return acc; }, {});
    container.innerHTML = `<div class="grid grid-cols-1 gap-4 animate-fade-in-up">${Object.entries(porF).map(([f, val]) => `<div class="bg-white p-6 rounded-[2.5rem] shadow-sm border-2 border-white flex justify-between items-center"><span class="text-[11px] font-black text-slate-500 uppercase italic">${f}</span><span class="text-[#e63946] font-black text-xl italic">R$ ${val.toFixed(2)}</span></div>`).join('')}</div>`;
}

// 43. Baixa Automática de Comanda Liquidada
function finalizarComandaTotal(id) { _supabase.from('comandas').update({ status: 'fechada', fechada_em: new Date().toISOString() }).eq('id', id).then(() => window.location.href = 'comandas.html'); }

/* =============================================================
   MÓDULO 7: UTILITÁRIOS VISUAIS (2 Funções)
   ============================================================= */

// 44. Gerenciamento de Notificações Toast
function showToast(m, tipo = 'sucesso') {
    const t = document.createElement('div'); t.className = `fixed top-10 left-1/2 -translate-x-1/2 ${tipo === 'sucesso' ? 'bg-emerald-500' : 'bg-red-500'} text-white px-6 py-3 rounded-full z-[10000] font-black text-[9px] uppercase animate-bounce text-center shadow-2xl`;
    t.innerText = m; document.body.appendChild(t); setTimeout(() => t.remove(), 3000);
}

// 45. Persistência de Contexto de Divisão (Injetada via ID dinâmico)
// (Função implícita no fluxo de navegação irParaDivisao e initPaginaDivisao)