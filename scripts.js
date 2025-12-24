/* =============================================================
   CONFIGURAÇÃO GERAL E ESTADO DO SISTEMA
   ============================================================= */
const SUPABASE_URL = 'https://vtexlttnjzmgknmbwbwl.supabase.co';
const SUPABASE_KEY = 'sb_publishable_C5SP_ulU5lhJjTdokxdegA_6ZIdeGPk'; 
const _supabase = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

let carrinho = [], comandaSendoFechada = null, comandaAtualDivisao = null, itensParaAbater = [];
let itensParaImpressaoPendente = []; // Armazena itens para o modal de impressão

/* =============================================================
   MÓDULO 1: ACESSO, SEGURANÇA E NAVEGAÇÃO (6 Funções)
   ============================================================= */

// 1. Inicializador de Ciclo de Vida do DOM
document.addEventListener('DOMContentLoaded', () => {
    initNavbar(); exibirNomeUsuario();
    if (document.getElementById('home-page')) initHome();
    if (document.getElementById('produtos-page')) { renderizarCatalogo(); verificarPermissoesAdmin(); }
    if (document.getElementById('venda-page')) { renderizarVenda(); verificarContextoVenda(); }
    if (document.getElementById('comandas-page')) renderizarComandasAtivas();
    if (document.getElementById('divisao-page')) initPaginaDivisao();
    if (document.getElementById('fechamento-page')) initPaginaFechamento();
});

// 2. Exibição Dinâmica do Operador no Header
function exibirNomeUsuario() {
    const el = document.getElementById('usuario-logado'), n = localStorage.getItem('userName');
    if (el && n) el.innerText = `Olá, ${n}`;
}

// 3. Processamento de Login Robusto (Multi-IDs)
async function fazerLogin() {
    const uInp = document.getElementById('user') || document.getElementById('username');
    const pInp = document.getElementById('pass') || document.getElementById('password') || document.getElementById('senha');
    if (!uInp || !pInp) return;
    const { data: usr } = await _supabase.from('usuarios').select('*')
        .eq('usuario', uInp.value.toLowerCase().trim()).eq('senha', pInp.value).single();
    if (usr) {
        localStorage.setItem('userRole', usr.cargo); localStorage.setItem('userName', usr.nome);
        window.location.replace('home.html');
    } else { showToast("Acesso Negado", "erro"); }
}

// 4. Encerramento de Sessão (Logout)
function logout() { localStorage.clear(); window.location.href = "index.html"; }

// 5. Gestão de Permissões Administrativas
function verificarPermissoesAdmin() {
    const s = document.getElementById('container-status');
    if (localStorage.getItem('userRole') !== 'admin' && s) s.classList.add('hidden');
}

// 6. Sincronização de Estado da Navbar Ativa
function initNavbar() {
    const p = window.location.pathname.split("/").pop() || "home.html", l = { 'home.html': 'nav-home', 'venda.html': 'nav-venda', 'comandas.html': 'nav-comandas', 'fechamento.html': 'nav-relatorio' };
    if (l[p] && document.getElementById(l[p])) document.getElementById(l[p]).classList.add('text-[#e63946]');
}

/* =============================================================
   MÓDULO 2: DASHBOARD E GESTÃO DE PRODUTOS (7 Funções)
   ============================================================= */

// 7. Consolidação de Dados na Home
async function initHome() {
    const [v, c] = await Promise.all([_supabase.from('historico_vendas').select('*'), _supabase.from('comandas').select('*').eq('status', 'aberta')]);
    const t = (v.data || []).reduce((acc, sale) => acc + (parseFloat(sale.total) || 0), 0);
    if(document.getElementById('faturamento-hoje')) document.getElementById('faturamento-hoje').innerText = `R$ ${t.toFixed(2)}`;
    if(document.getElementById('qtd-comandas')) document.getElementById('qtd-comandas').innerText = (c.data || []).length;
}

// 8. Renderização do Catálogo Admin com Switch
async function renderizarCatalogo() {
    const container = document.getElementById('lista-catalogo'); if (!container) return;
    const { data: pds } = await _supabase.from('produtos').select('*').order('nome');
    container.innerHTML = (pds || []).map(p => {
        const inat = p.status === false;
        return `<div class="bg-white p-4 rounded-3xl shadow-sm flex justify-between items-center border-2 ${inat ? 'border-slate-100 opacity-60' : 'border-white'} mb-2">
            <div class="flex items-center space-x-4"><div class="text-2xl ${inat ? 'grayscale' : ''}">${p.categoria === 'Bebidas' ? '🥤' : '🍢'}</div><div><h4 class="font-black text-slate-800 text-xs uppercase italic">${p.nome}</h4><p class="text-[9px] font-bold ${inat ? 'text-slate-400' : 'text-red-500'}">R$ ${parseFloat(p.preco).toFixed(2)}</p></div></div>
            <div class="flex items-center space-x-3">
                <label class="relative inline-flex items-center cursor-pointer scale-75">
                    <input type="checkbox" onchange="alternarStatusProduto(${p.id}, ${p.status})" class="sr-only peer" ${!inat ? 'checked' : ''}>
                    <div class="w-11 h-6 bg-slate-200 rounded-full peer peer-checked:bg-emerald-500 peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all"></div>
                </label>
                <button onclick="prepararEdicao(${p.id})" class="bg-slate-50 p-3 rounded-2xl text-[10px]">✏️</button>
                <button onclick="removerProduto(${p.id})" class="bg-red-50 text-red-500 p-3 rounded-2xl text-[10px]">🗑️</button>
            </div></div>`;
    }).join('');
}

// 9. Alternância Rápida de Ativo/Inativo
async function alternarStatusProduto(id, s) {
    const { error } = await _supabase.from('produtos').update({ status: !s }).eq('id', id);
    if (!error) { showToast("Status Atualizado"); renderizarCatalogo(); }
}

// 10. Exclusão Permanente de Produto
async function removerProduto(id) { if (confirm("Remover?")) { await _supabase.from('produtos').delete().eq('id', id); renderizarCatalogo(); } }

// 11. Gravação de Dados de Produto
async function salvarProduto() {
    const d = { nome: document.getElementById('p-nome').value, preco: parseFloat(document.getElementById('p-preco').value), categoria: document.getElementById('p-categoria').value, status: document.getElementById('p-status').checked }, id = document.getElementById('p-id').value;
    if (id) await _supabase.from('produtos').update(d).eq('id', id); else await _supabase.from('produtos').insert([d]);
    showToast("Salvo!"); renderizarCatalogo(); alternarAbas('lista');
}

// 12. Carregar Dados para Edição
function prepararEdicao(id) {
    _supabase.from('produtos').select('*').eq('id', id).single().then(({data: p}) => {
        document.getElementById('p-id').value = p.id; document.getElementById('p-nome').value = p.nome; document.getElementById('p-preco').value = p.preco;
        document.getElementById('p-categoria').value = p.categoria; document.getElementById('p-status').checked = p.status; alternarAbas('cadastro');
    });
}

// 13. Alternância entre Lista e Cadastro (Admin)
function alternarAbas(aba) {
    const l = document.getElementById('aba-lista'), c = document.getElementById('aba-cadastro'), bl = document.getElementById('btn-aba-lista'), bc = document.getElementById('btn-aba-cadastro');
    if (aba === 'cadastro') { l.classList.add('hidden'); c.classList.remove('hidden'); if(bc) bc.className = "flex-1 py-3 rounded-[1.5rem] bg-[#e63946] text-white"; if(bl) bl.className = "flex-1 py-3 text-slate-400"; }
    else { c.classList.add('hidden'); l.classList.remove('hidden'); if(bl) bl.className = "flex-1 py-3 rounded-[1.5rem] bg-[#e63946] text-white"; if(bc) bc.className = "flex-1 py-3 text-slate-400"; }
}

/* =============================================================
   MÓDULO 3: VENDAS, CARRINHO E IMPRESSÃO (12 Funções)
   ============================================================= */

// 14. Renderização do PDV com Botão Remover Seguro
async function renderizarVenda() {
    const container = document.getElementById('lista-venda'); if (!container) return;
    const { data: todos } = await _supabase.from('produtos').select('*').order('nome');
    container.innerHTML = (todos || []).filter(p => p.status !== false).map(p => {
        const item = carrinho.find(i => i.id === p.id), qtd = item ? item.qtd : 0;
        return `<div class="relative"><button onclick="adicionarAoCarrinho(${p.id})" class="bg-white p-5 rounded-[2.2rem] shadow-sm border-2 ${qtd > 0 ? 'border-emerald-400' : 'border-white'} flex flex-col items-center justify-center w-full active:scale-95 transition-all"><div class="text-3xl mb-2">${p.categoria === 'Bebidas' ? '🥤' : '🍢'}</div><h4 class="font-black text-slate-800 text-[11px] uppercase italic text-center leading-tight mb-1">${p.nome}</h4><span class="bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full text-[9px] font-bold">R$ ${parseFloat(p.preco).toFixed(2)}</span></button>${qtd > 0 ? `<span class="absolute -top-2 -right-2 bg-emerald-500 text-white text-[10px] font-black w-7 h-7 flex items-center justify-center rounded-full border-2 border-white">${qtd}</span><button onclick="removerUmDoCarrinho(${p.id})" class="absolute -bottom-2 -right-2 bg-red-500 text-white w-8 h-8 flex items-center justify-center rounded-full border-2 border-white shadow-lg active:scale-125"> - </button>` : ''}</div>`;
    }).join('');
    atualizarBotaoFinalizar();
}

// 15. Somar Item / 16. Subtrair Item do Carrinho
function adicionarAoCarrinho(id) { _supabase.from('produtos').select('*').eq('id', id).single().then(({data: p}) => { const item = carrinho.find(i => i.id === id); if (item) item.qtd++; else carrinho.push({ ...p, qtd: 1 }); renderizarVenda(); }); }
function removerUmDoCarrinho(id) { const idx = carrinho.findIndex(i => i.id === id); if (idx > -1) { if (carrinho[idx].qtd > 1) carrinho[idx].qtd--; else carrinho.splice(idx, 1); renderizarVenda(); } }

// 17. Sincronização do Botão Flutuante (FAB) de Venda
function atualizarBotaoFinalizar() { const fab = document.getElementById('fab-finalizar'), qtd = carrinho.reduce((acc, i) => acc + i.qtd, 0); if (qtd > 0 && fab) fab.classList.remove('hidden'); if(document.getElementById('fab-count')) document.getElementById('fab-count').innerText = `${qtd} itens`; }

// 18. Abertura do Checkout de Venda
function abrirResumoPedido() {
    const modal = document.getElementById('modal-resumo'), lista = document.getElementById('itens-carrinho-modal'); if(!modal) return;
    const t = carrinho.reduce((acc, i) => acc + (parseFloat(i.preco) * i.qtd), 0);
    if(lista) lista.innerHTML = carrinho.map(i => `<div class="flex justify-between p-2 bg-slate-50 rounded-xl mb-1 text-[10px] font-bold"><span>${i.qtd}x ${i.nome}</span><span>R$ ${(parseFloat(i.preco) * i.qtd).toFixed(2)}</span></div>`).join('');
    if(document.getElementById('total-modal')) document.getElementById('total-modal').innerText = `R$ ${t.toFixed(2)}`;
    const finCont = document.querySelector('.financeiro-container'); if(finCont) finCont.classList.toggle('hidden', !!sessionStorage.getItem('comandaAtivaId'));
    modal.classList.remove('hidden'); modal.classList.add('flex'); handlePagamentoChange(); 
}

// 19. Ajuste de Contexto Visual (Venda vs Lançamento em Mesa)
function verificarContextoVenda() { const title = document.querySelector('#venda-page h1'); if (sessionStorage.getItem('comandaAtivaId') && title) title.innerText = "LANÇAR NA MESA"; }

// 20. Confirmação com TRAVA DE PARIDADE UNIVERSAL E IMPRESSÃO
async function confirmarVenda() {
    const cId = sessionStorage.getItem('comandaAtivaId'); if (carrinho.length === 0) return;
    const t = carrinho.reduce((acc, i) => acc + (parseFloat(i.preco) * i.qtd), 0);
    if (!cId) { 
        const rec = parseFloat(document.getElementById('valor-recebido').value) || 0;
        if (rec.toFixed(2) !== t.toFixed(2)) return showToast("VALOR PAGO É DIFERENTE DO CONSUMIDO!", "erro");
        const itensVenda = [...carrinho], f = document.getElementById('forma-pagamento').value;
        await _supabase.from('historico_vendas').insert([{ itens: itensVenda, total: t, forma_pagamento: f, vendedor: localStorage.getItem('userName'), created_at: new Date().toISOString() }]);
        showToast("VENDA FINALIZADA!"); fecharResumoPedido(); abrirModalImpressao(itensVenda); carrinho = []; renderizarVenda(); return;
    }
    const { data: c } = await _supabase.from('comandas').select('*').eq('id', cId).single(), nI = [...(c.itens || []), ...carrinho], nT = nI.reduce((acc, i) => acc + (parseFloat(i.preco) * i.qtd), 0);
    await _supabase.from('comandas').update({ itens: nI, total: nT }).eq('id', cId);
    showToast("LANÇADO COM SUCESSO!"); sessionStorage.removeItem('comandaAtivaId'); carrinho = []; window.location.href = 'comandas.html';
}

// 21. Fechar Modal / 22. Toggle Campo Financeiro
function fecharResumoPedido() { const m = document.getElementById('modal-resumo'); if(m) m.classList.add('hidden'); }
function handlePagamentoChange() { const s = document.getElementById('sessao-troco'); if(s) s.classList.remove('hidden'); }

// 23. Cálculo de Troco com Alerta de Cor (Paridade Total)
function calcularTroco() {
    const t = carrinho.reduce((acc, i) => acc + (parseFloat(i.preco) * i.qtd), 0), rec = parseFloat(document.getElementById('valor-recebido').value) || 0, troco = rec - t, el = document.getElementById('valor-troco');
    if(el) { el.innerText = `R$ ${troco.toFixed(2)}`; el.className = `p-4 font-black text-xl italic ${troco !== 0 ? 'text-red-500' : 'text-emerald-500'}`; }
}

/* =============================================================
   MÓDULO 4: GESTÃO DE COMANDAS E MESAS (7 Funções)
   ============================================================= */

// 24. Renderização de Mesas (LAYOUT RESPONSIVO MOBILE)
async function renderizarComandasAtivas() {
    const container = document.getElementById('lista-comandas-ativas'); if (!container) return;
    const { data: cmds } = await _supabase.from('comandas').select('*').eq('status', 'aberta').order('aberta_em', { ascending: false });
    container.innerHTML = (cmds || []).map(c => `
        <div class="bg-white p-4 rounded-[2.5rem] shadow-sm border border-white flex flex-col space-y-3 mb-3">
            <div class="flex items-center justify-between">
                <div class="flex items-center space-x-2">
                    <div class="bg-orange-50 w-10 h-10 rounded-2xl flex items-center justify-center text-xl">📋</div>
                    <h4 class="font-black text-slate-800 text-xs uppercase italic truncate max-w-[120px]">${c.identificacao}</h4>
                </div>
                <p class="text-[#e63946] font-black text-lg italic leading-none whitespace-nowrap">R$ ${parseFloat(c.total || 0).toFixed(2)}</p>
            </div>
            <div class="flex space-x-2">
                <button onclick="gerenciarItensComanda(${c.id})" class="flex-1 h-12 bg-slate-50 text-slate-600 rounded-2xl font-black text-[9px] border uppercase">+ Lançar</button>
                <button onclick="irParaDivisao(${c.id})" class="flex-1 h-12 bg-orange-50 text-orange-600 rounded-2xl font-black text-[9px] border uppercase">Dividir</button>
                <button onclick="prepararFechamentoComanda(${c.id})" class="flex-1 h-12 bg-emerald-500 text-white rounded-2xl font-black text-[9px] shadow-md uppercase">Fechar</button>
            </div>
        </div>`).join('');
}

// 25. Abrir Nova Comanda
async function abrirNovaComanda() {
    const iden = document.getElementById('c-identificacao').value.trim(); if (!iden) return showToast("Mesa?", "erro");
    await _supabase.from('comandas').insert([{ identificacao: iden, itens: [], total: 0, status: 'aberta', aberta_em: new Date().toISOString() }]);
    showToast(`Mesa ${iden} aberta!`); renderizarComandasAtivas(); alternarAbasComanda('lista');
}

// 26. Vínculo de Mesa / 27. Direcionamento Divisão
function gerenciarItensComanda(id) { sessionStorage.setItem('comandaAtivaId', id); window.location.href = 'venda.html'; }
function irParaDivisao(id) { sessionStorage.setItem('comandaDivisaoId', id); window.location.href = 'divisao.html'; }

// 28. Alternância de Abas de Comandas
function alternarAbasComanda(aba) {
    const l = document.getElementById('aba-lista-comanda'), a = document.getElementById('aba-abrir-comanda'), bl = document.getElementById('btn-comanda-lista'), ba = document.getElementById('btn-comanda-abrir');
    if (aba === 'abrir') { l.classList.add('hidden'); a.classList.remove('hidden'); if(ba) ba.className = "flex-1 py-3 rounded-[1.5rem] bg-[#e63946] text-white"; if(bl) bl.className = "flex-1 py-3 text-slate-400"; }
    else { a.classList.add('hidden'); l.classList.remove('hidden'); if(bl) bl.className = "flex-1 py-3 rounded-[1.5rem] bg-[#e63946] text-white"; if(ba) ba.className = "flex-1 py-3 text-slate-400"; }
}

// 29. Preparar Encerramento Total (Abrir Modal)
async function prepararFechamentoComanda(id) {
    _supabase.from('comandas').select('*').eq('id', id).single().then(({data: c}) => { 
        comandaSendoFechada = c; carrinho = c.itens; const modal = document.getElementById('modal-resumo'), lista = document.getElementById('itens-carrinho-modal');
        if(lista) lista.innerHTML = (c.itens || []).map(i => `<div class="flex justify-between p-2 bg-slate-50 rounded-xl mb-1 text-[10px] font-bold"><span>${i.qtd}x ${i.nome}</span><span>R$ ${(parseFloat(i.preco) * i.qtd).toFixed(2)}</span></div>`).join('');
        if(document.getElementById('total-modal')) document.getElementById('total-modal').innerText = `R$ ${parseFloat(c.total).toFixed(2)}`;
        if(modal) { modal.classList.remove('hidden'); modal.classList.add('flex'); handlePagamentoChange(); }
    });
}

// 30. Confirmar Fechamento Total com Trava de Paridade
async function confirmarFechamentoComanda() {
    if (!comandaSendoFechada) return; const rec = parseFloat(document.getElementById('valor-recebido').value) || 0;
    if (rec.toFixed(2) !== comandaSendoFechada.total.toFixed(2)) return showToast("VALOR PAGO É DIFERENTE!", "erro");
    await _supabase.from('historico_vendas').insert([{ itens: comandaSendoFechada.itens, total: comandaSendoFechada.total, forma_pagamento: document.getElementById('forma-pagamento').value, vendedor: localStorage.getItem('userName'), created_at: new Date().toISOString() }]);
    await _supabase.from('comandas').update({ status: 'fechada', fechada_em: new Date().toISOString() }).eq('id', comandaSendoFechada.id);
    showToast("MESA FECHADA!"); fecharResumoPedido(); renderizarComandasAtivas();
}

/* =============================================================
   MÓDULO 5: DIVISÃO DE CONTA E ABATIMENTOS (11 Funções)
   ============================================================= */

// 31. Init Divisão / 32. Injetar Itens
async function initPaginaDivisao() { const id = sessionStorage.getItem('comandaDivisaoId'); if (!id) return; const { data: c } = await _supabase.from('comandas').select('*').eq('id', id).single(); comandaAtualDivisao = c; itensParaAbater = []; if (document.getElementById('total-restante')) document.getElementById('total-restante').innerText = `R$ ${parseFloat(c.total).toFixed(2)}`; renderizarItensParaAbate(c.itens); }
function renderizarItensParaAbate(itens) { const container = document.getElementById('lista-itens-divisao'); if (!container) return; container.innerHTML = (itens || []).map((item, idx) => `<div onclick="selecionarItemAbate(${idx})" id="item-abate-${idx}" class="bg-white p-4 rounded-2xl border-2 border-white flex justify-between items-center transition-all shadow-sm active:scale-95"><p class="text-[10px] font-black uppercase italic">${item.nome}</p><p class="font-black text-slate-800 text-[10px]">R$ ${parseFloat(item.preco).toFixed(2)}</p></div>`).join(''); }

// 33. Seleção / 34. Controle FAB Divisão
function selecionarItemAbate(idx) { const el = document.getElementById(`item-abate-${idx}`), pos = itensParaAbater.indexOf(idx); if (pos > -1) { itensParaAbater.splice(pos, 1); el.classList.remove('border-emerald-500', 'bg-emerald-50'); } else { itensParaAbater.push(idx); el.classList.add('border-emerald-500', 'bg-emerald-50'); } atualizarFABDivisao(); }
function atualizarFABDivisao() { const fab = document.getElementById('fab-divisao'); if (!fab) return; if (itensParaAbater.length > 0) { fab.classList.remove('hidden'); if(document.getElementById('fab-div-count')) document.getElementById('fab-div-count').innerText = `${itensParaAbater.length} itens`; } else { fab.classList.add('hidden'); } }

// 35. Abrir Resumo Parcial
function abrirResumoDivisao() {
    const modal = document.getElementById('modal-divisao'), lista = document.getElementById('itens-divisao-modal');
    const pagos = comandaAtualDivisao.itens.filter((_, i) => itensParaAbater.includes(i)), total = pagos.reduce((acc, i) => acc + parseFloat(i.preco), 0);
    if(lista) lista.innerHTML = pagos.map(i => `<div class="flex justify-between p-2 text-[10px] font-bold"><span>${i.nome}</span><span>R$ ${parseFloat(i.preco).toFixed(2)}</span></div>`).join('');
    if(document.getElementById('total-divisao-modal')) document.getElementById('total-divisao-modal').innerText = `R$ ${total.toFixed(2)}`;
    modal.classList.remove('hidden'); modal.classList.add('flex'); handlePagamentoParcialChange();
}

// 36. Fechar Modal / 37. Visibilidade Troco Parcial
function fecharModalDivisao() { if(document.getElementById('modal-divisao')) document.getElementById('modal-divisao').classList.add('hidden'); }
function handlePagamentoParcialChange() { const s = document.getElementById('sessao-troco-divisao'); if(s) s.classList.remove('hidden'); }

// 38. Cálculo Troco Parcial / 39. Confirmar Abate Itens (Trava Paridade)
function calcularTrocoDivisao() { const total = comandaAtualDivisao.itens.filter((_, i) => itensParaAbater.includes(i)).reduce((acc, i) => acc + parseFloat(i.preco), 0), rec = parseFloat(document.getElementById('recebido-divisao').value) || 0, troco = rec - total, el = document.getElementById('troco-divisao'); if(el) { el.innerText = `R$ ${troco.toFixed(2)}`; el.className = `p-4 font-black text-xl italic ${troco !== 0 ? 'text-red-500' : 'text-emerald-500'}`; } }
async function confirmarAbateItens() {
    const f = document.getElementById('forma-parcial-itens').value, pagos = comandaAtualDivisao.itens.filter((_, i) => itensParaAbater.includes(i)), rest = comandaAtualDivisao.itens.filter((_, i) => !itensParaAbater.includes(i)), tP = pagos.reduce((acc, i) => acc + parseFloat(i.preco), 0);
    if ((parseFloat(document.getElementById('recebido-divisao').value) || 0).toFixed(2) !== tP.toFixed(2)) return showToast("VALOR DIVERGENTE!", "erro");
    await _supabase.from('historico_vendas').insert([{ itens: pagos, total: tP, forma_pagamento: f, vendedor: localStorage.getItem('userName'), created_at: new Date().toISOString() }]);
    await _supabase.from('comandas').update({ itens: rest, total: rest.reduce((acc, i) => acc + parseFloat(i.preco), 0) }).eq('id', comandaAtualDivisao.id);
    showToast("ITENS PAGOS!"); fecharModalDivisao(); if (rest.length === 0) finalizarComandaTotal(comandaAtualDivisao.id); else initPaginaDivisao();
}

// 40. Abate Manual por Valor / 41. Alternar Abas Divisão
async function confirmarAbateValor() { const v = parseFloat(document.getElementById('valor-parcial').value), f = document.getElementById('forma-parcial-valor').value; if (v <= 0) return; await _supabase.from('historico_vendas').insert([{ itens: [{nome: `ABATE: ${comandaAtualDivisao.identificacao}`, preco: v, qtd: 1}], total: v, forma_pagamento: f, vendedor: localStorage.getItem('userName'), created_at: new Date().toISOString() }]); const nT = comandaAtualDivisao.total - v; await _supabase.from('comandas').update({ total: nT }).eq('id', comandaAtualDivisao.id); showToast("ABATIDO!"); if (nT <= 0.05) finalizarComandaTotal(comandaAtualDivisao.id); else initPaginaDivisao(); }
function alternarAbasDivisao(aba) { const v = document.getElementById('aba-div-valor'), i = document.getElementById('aba-div-itens'), bv = document.getElementById('btn-div-valor'), bi = document.getElementById('btn-div-itens'); if (!v || !i) return; if (aba === 'itens') { v.classList.add('hidden'); i.classList.remove('hidden'); if(bi) bi.className = "flex-1 py-3 rounded-[1.5rem] bg-[#e63946] text-white"; if(bv) bv.className = "flex-1 py-3 text-slate-400"; } else { i.classList.add('hidden'); v.classList.remove('hidden'); if(bv) bv.className = "flex-1 py-3 rounded-[1.5rem] bg-[#e63946] text-white"; if(bi) bi.className = "flex-1 py-3 text-slate-400"; } }

/* =============================================================
   MÓDULO 6: RELATÓRIOS E FINALIZAÇÃO AUTOMÁTICA (3 Funções)
   ============================================================= */

// 42. Relatório Financeiro por Período
async function initPaginaFechamento() {
    const container = document.getElementById('resumo-financeiro'); if (!container) return;
    const dIEl = document.getElementById('data-inicio'), dFEl = document.getElementById('data-fim'); if(!dIEl || !dFEl) return;
    let dI = dIEl.value, dF = dFEl.value, h = new Date().toISOString().split('T')[0];
    if (!dI) { dI = h; dIEl.value = h; } if (!dF) { dF = h; dFEl.value = h; }
    const { data: v } = await _supabase.from('historico_vendas').select('*').gte('created_at', `${dI}T00:00:00`).lte('created_at', `${dF}T23:59:59`);
    const porF = (v || []).reduce((acc, s) => { acc[s.forma_pagamento] = (acc[s.forma_pagamento] || 0) + parseFloat(s.total); return acc; }, {});
    container.innerHTML = `<div class="grid grid-cols-1 gap-4 animate-fade-in-up">${Object.entries(porF).map(([f, val]) => `<div class="bg-white p-6 rounded-[2.5rem] shadow-sm border-2 border-white flex justify-between items-center"><span class="text-[11px] font-black text-slate-500 uppercase italic">${f}</span><span class="text-[#e63946] font-black text-xl italic">R$ ${val.toFixed(2)}</span></div>`).join('')}</div>`;
}

// 43. Baixa de Comanda Liquidada
function finalizarComandaTotal(id) { _supabase.from('comandas').update({ status: 'fechada', fechada_em: new Date().toISOString() }).eq('id', id).then(() => window.location.href = 'comandas.html'); }

/* =============================================================
   MÓDULO 7: UTILITÁRIOS E IMPRESSÃO PREMIUM (5 Funções)
   ============================================================= */

// 44. Toast / 45. Abrir Modal Impressão / 46. Fechar Modal
function showToast(m, tipo = 'sucesso') { const t = document.createElement('div'); t.className = `fixed top-10 left-1/2 -translate-x-1/2 ${tipo === 'sucesso' ? 'bg-emerald-500' : 'bg-red-500'} text-white px-6 py-3 rounded-full z-[10000] font-black text-[9px] uppercase animate-bounce text-center shadow-2xl`; t.innerText = m; document.body.appendChild(t); setTimeout(() => t.remove(), 3000); }
function abrirModalImpressao(itens) { itensParaImpressaoPendente = itens; const m = document.getElementById('modal-confirmacao-impressao'); if(m) { m.classList.remove('hidden'); m.classList.add('flex'); } }
function fecharModalImpressao() { const m = document.getElementById('modal-confirmacao-impressao'); if(m) m.classList.add('hidden'); itensParaImpressaoPendente = []; }

// 47. Gatilho Impressão / 48. Geração de Tickets 58mm Individuais
function confirmarImpressaoAction() { if(itensParaImpressaoPendente.length > 0) imprimirTickets(itensParaImpressaoPendente); fecharModalImpressao(); }

function imprimirTickets(itens) {
    let container = document.getElementById('secao-impressao');
    if (!container) { container = document.createElement('div'); container.id = 'secao-impressao'; document.body.appendChild(container); }
    let html = '';
    const op = localStorage.getItem('userName') || 'Caixa', dateStr = new Date().toLocaleDateString('pt-BR'), timeStr = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

    itens.forEach(item => {
        // CORREÇÃO: Gera 1 ticket independente para cada unidade do item
        for (let k = 0; k < item.qtd; k++) {
             const transactionID = Math.floor(1000 + Math.random() * 9000);
             html += `
                <div class="ticket">
                    <p class="ticket-header">ESPETINHO & CIA</p>
                    <p style="font-size: 7px; font-weight: bold;">Data: ${dateStr} - ${timeStr}</p>
                    <div class="ticket-box"><p class="ticket-item">${item.nome}</p><p class="ticket-value">VALOR: R$ ${parseFloat(item.preco).toFixed(2)}</p></div>
                    <p style="font-size: 9px; font-weight: 900; margin-bottom: 2mm;">RETIRAR NO BALCÃO</p>
                    <div class="ticket-footer-info">Transação N. ${transactionID} | Operador: ${op}<br>Via Única | Consumo Local</div>
                    <p style="font-size: 7px; font-weight: bold; margin-top: 2mm;">*** SE BEBER NÃO DIRIJA ***</p>
                </div>`;
        }
    });
    container.innerHTML = html; window.print();
    setTimeout(() => { container.innerHTML = ""; }, 1000);
}