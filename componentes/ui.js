/* =============================================================
   MÓDULO: INTERFACE DE USUÁRIO (UI) E COMPORTAMENTO GLOBAL
   ============================================================= */

/* -------------------------------------------------------------
   1. FEEDBACK VISUAL (TOASTS E LOADINGS)
   ------------------------------------------------------------- */

function showToast(mensagem, tipo = 'sucesso') {
    const toastAntigo = document.getElementById('sistema-toast');
    if (toastAntigo) toastAntigo.remove();

    let corBg = 'bg-slate-800 dark:bg-slate-700';
    let icone = '🔔';

    if (tipo === 'erro')     { corBg = 'bg-[#e63946]';    icone = '⚠️'; }
    else if (tipo === 'sucesso') { corBg = 'bg-emerald-500'; icone = '✅'; }
    else if (tipo === 'aviso')  { corBg = 'bg-orange-500';  icone = '💡'; }

    const toast = document.createElement('div');
    toast.id = 'sistema-toast';
    toast.className = `fixed top-10 left-1/2 transform -translate-x-1/2 flex items-center gap-3 px-6 py-4 rounded-full shadow-2xl z-[9999] text-white ${corBg} transition-all duration-300 opacity-0 -translate-y-10 pointer-events-none min-w-[280px] max-w-[90vw] justify-center border border-white/20`;
    toast.innerHTML = `
        <span class="text-lg leading-none">${icone}</span>
        <span class="text-[10px] font-black uppercase tracking-widest text-center mt-[2px]">${mensagem}</span>
    `;

    document.body.appendChild(toast);

    requestAnimationFrame(() => {
        toast.classList.remove('opacity-0', '-translate-y-10');
        toast.classList.add('opacity-100', 'translate-y-0');
    });

    setTimeout(() => {
        toast.classList.remove('opacity-100', 'translate-y-0');
        toast.classList.add('opacity-0', '-translate-y-10');
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

function setLoading(btnId, isLoading, text = 'CONFIRMAR') {
    const btn = document.getElementById(btnId);
    if (!btn) return;

    if (isLoading) {
        if (!btn.dataset.originalText) btn.dataset.originalText = btn.innerHTML;
        btn.innerHTML = `
            <div class="flex items-center gap-2">
                <svg class="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                    <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                <span>PROCESSANDO...</span>
            </div>`;
        btn.disabled = true;
        btn.classList.add('opacity-60', 'cursor-not-allowed');
    } else {
        btn.innerHTML = text || btn.dataset.originalText || 'CONFIRMAR';
        btn.disabled = false;
        btn.classList.remove('opacity-60', 'cursor-not-allowed');
    }
}

/* -------------------------------------------------------------
   2. GESTÃO DE MODAIS E DIÁLOGOS
   ------------------------------------------------------------- */

window.callbackConfirmacao = null;

function abrirConfirmacao(titulo, mensagem, callback) {
    const modal = document.getElementById('modal-confirmacao-sistema');
    if (!modal) return;

    document.getElementById('titulo-modal-conf').innerText = titulo.toUpperCase();
    document.getElementById('msg-modal-conf').innerText = mensagem;
    callbackConfirmacao = callback;

    modal.classList.remove('hidden');
    modal.classList.add('flex');
}

function executarConfirmacao() {
    if (callbackConfirmacao) callbackConfirmacao();
    fecharModalConfirmacao();
}

function fecharModalConfirmacao() {
    const modal = document.getElementById('modal-confirmacao-sistema');
    if (modal) modal.classList.add('hidden');
    callbackConfirmacao = null;
}

function fecharModalAuth() {
    document.getElementById('modal-auth-admin')?.classList.add('hidden');
}

function fecharModalTrocaPagamento() {
    document.getElementById('modal-troca-pagamento')?.classList.add('hidden');
}

/* -------------------------------------------------------------
   3. TEMA GLOBAL (DARK MODE)
   ------------------------------------------------------------- */

window.toggleTemaGlobal = function() {
    const html = document.documentElement;
    const isDark = html.classList.contains('dark');

    if (isDark) {
        html.classList.remove('dark');
        localStorage.setItem('temaSistema', 'light');
    } else {
        html.classList.add('dark');
        localStorage.setItem('temaSistema', 'dark');
    }

    const toggle = document.getElementById('toggle-tema-global');
    if (toggle) toggle.checked = !isDark;
};

window.abrirModalPerfil = function() {
    const modal = document.getElementById('modal-perfil-usuario');
    if (!modal) return;

    const nomeUsuario = localStorage.getItem('userName') || 'OPERADOR';
    const nomeEl = document.getElementById('modal-perfil-nome');
    if (nomeEl) nomeEl.innerText = nomeUsuario.toUpperCase();

    const isDark = document.documentElement.classList.contains('dark');
    const toggle = document.getElementById('toggle-tema-global');
    if (toggle) toggle.checked = isDark;

    modal.classList.remove('hidden');
    modal.classList.add('flex');
};

window.fecharModalPerfil = function() {
    const modal = document.getElementById('modal-perfil-usuario');
    if (modal) modal.classList.add('hidden');
};

/* -------------------------------------------------------------
   4. RELATÓRIOS (FINANCEIRO, COMANDAS E PRODUTOS)
   ------------------------------------------------------------- */


window.gerarRelatorioComandas = async function(valor = 0, iniManual = null, fimManual = null) {
    const container = document.getElementById('conteudo-rel-comandas');
    if (!container || typeof _supabase === 'undefined') return;

    // 1. Feedback visual
    container.innerHTML = '<div class="col-span-full text-center py-10"><p class="text-[10px] font-black text-slate-400 uppercase animate-pulse">Buscando comandas...</p></div>';

    let inicioStr, fimStr;

    try {
        // 2. Lógica de Datas
        if (valor === 'custom' || valor === 99) {
            const dataI = iniManual || document.getElementById('data-inicio-comandas')?.value;
            const dataF = fimManual || document.getElementById('data-fim-comandas')?.value;

            if (!dataI || !dataF) {
                container.innerHTML = '<p class="col-span-full text-center text-[10px] text-orange-400 py-10 font-black uppercase">Selecione o período.</p>';
                return;
            }
            inicioStr = `${dataI}T00:00:00`;
            fimStr = `${dataF}T23:59:59`;
        } else {
            const hoje = new Date();
            const dInicio = new Date();
            dInicio.setDate(hoje.getDate() - parseInt(valor));
            
            const isoInicio = dInicio.toISOString().split('T')[0];
            const isoFim = hoje.toISOString().split('T')[0];
            
            inicioStr = `${isoInicio}T00:00:00`;
            fimStr = `${isoFim}T23:59:59`;
        }

        // 3. Busca no Supabase
        const { data: cms, error } = await _supabase
            .from('comandas')
            .select('*')
            .eq('status', 'fechada')
            .gte('fechada_em', inicioStr)
            .lte('fechada_em', fimStr)
            .order('fechada_em', { ascending: false });

        if (error) throw error;

        if (!cms || cms.length === 0) {
            container.innerHTML = '<p class="col-span-full text-center text-[10px] text-slate-400 py-10 font-black uppercase italic tracking-widest">Nenhuma comanda no período.</p>';
            return;
        }

        // 4. Renderização Corrigida com R$ e Ações
        container.innerHTML = cms.map(m => {
            const dataF = new Date(m.fechada_em);
            
            // Garante que o valor tenha R$ e esteja formatado
            const valorFinal = typeof formatarMoeda === 'function' 
                ? `R$ ${formatarMoeda(m.total)}` 
                : `R$ ${parseFloat(m.total).toFixed(2).replace('.', ',')}`;

            return `
            <div class="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm flex items-center justify-between hover:border-slate-200 dark:hover:border-slate-700 transition-all">
                
                <div class="flex items-center gap-3">
                    <div class="bg-orange-50 dark:bg-orange-950/30 w-10 h-10 rounded-full flex items-center justify-center text-lg">📝</div>
                    <div>
                        <h4 class="font-black text-xs text-slate-700 dark:text-slate-200 uppercase truncate max-w-[140px]">${m.identificacao}</h4>
                        <p class="text-[8px] font-bold text-slate-400 uppercase tracking-widest">
                            📅 ${dataF.toLocaleDateString('pt-BR')} 🕒 ${dataF.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                        </p>
                    </div>
                </div>

                <div class="flex items-center gap-2">
                    <div class="text-right mr-2">
                        <span class="block font-black text-sm text-slate-800 dark:text-white">${valorFinal}</span>
                        <span class="block text-[7px] font-bold text-slate-400 uppercase">${m.forma_pagamento || 'S/ INFO'}</span>
                    </div>

                    <div class="flex gap-1">
                        <button onclick="reimprimirComanda('${m.id}')" 
                            class="p-2.5 bg-slate-50 dark:bg-slate-800 rounded-xl hover:bg-blue-100 dark:hover:bg-blue-900/30 text-blue-600 transition-all shadow-sm">
                            🖨️
                        </button>
                        
                        <button onclick="solicitarEstorno('${m.id}', '${m.total}')" 
                            class="p-2.5 bg-slate-50 dark:bg-slate-800 rounded-xl hover:bg-red-100 dark:hover:bg-red-900/30 text-red-600 transition-all shadow-sm">
                            ↩️
                        </button>
                    </div>
                </div>
            </div>`;
        }).join('');

    } catch (e) {
        console.error('[RELATÓRIO] Erro comandas:', e);
        if (typeof showToast === 'function') showToast('ERRO AO CARREGAR', 'erro');
    }
}


// Mostra ou esconde as caixinhas de data
window.togglePeriodoProdutos = function() {
    const container = document.getElementById('container-periodo-prod');
    if (container.classList.contains('hidden')) {
        container.classList.remove('hidden');
        atualizarEstiloBotoesProdutos(99); // Deixa o "PERÍODO" ativo
    } else {
        container.classList.add('hidden');
    }
};

// Pinta o botão selecionado e deixa os outros cinzas
window.atualizarEstiloBotoesProdutos = function(ativo) {
    [0, 7, 30, 99].forEach(id => {
        const btn = document.getElementById(`btn-prod-${id}`);
        if (btn) {
            if (id === ativo) {
                btn.className = "flex-1 py-3 text-[9px] font-black uppercase rounded-xl transition-all shadow-sm bg-white dark:bg-slate-700 text-slate-800 dark:text-white";
            } else {
                btn.className = "flex-1 py-3 text-[9px] font-black uppercase rounded-xl transition-all text-slate-400";
            }
        }
    });
};

// Ação principal de quando você clica em HOJE, 7 DIAS ou na Lupa
window.mudarFiltroComandas = function(dias) {
    const inputIni = document.getElementById('data-inicio-comandas');
    const inputFim = document.getElementById('data-fim-comandas');
    const painelPeriodo = document.getElementById('container-periodo-comandas');

    const hoje = new Date();
    const dataFimStr = hoje.toISOString().split('T')[0];
    let dataIniStr = dataFimStr;

    // 1. Lógica de cálculo das datas
    if (dias === 'custom') {
        // Apenas pesquisa com o que o usuário digitou
    } else if (dias === 0) {
        dataIniStr = dataFimStr; // Hoje
        if (painelPeriodo) painelPeriodo.classList.add('hidden');
    } else {
        const passada = new Date();
        passada.setDate(hoje.getDate() - dias);
        dataIniStr = passada.toISOString().split('T')[0];
        if (painelPeriodo) painelPeriodo.classList.add('hidden');
    }

    // 2. Injeta os valores nos campos corretos da tela de Comandas
    if (inputIni) inputIni.value = dataIniStr;
    if (inputFim) inputFim.value = dataFimStr;

    // 3. Atualiza visualmente os botões (Pinta o ativo)
    [0, 7, 30, 99].forEach(id => {
        const btn = document.getElementById(`btn-comandas-${id}`);
        if (btn) {
            if (id === dias) {
                btn.className = "flex-1 py-3 text-[9px] font-black uppercase rounded-lg transition-all shadow-sm bg-white dark:bg-slate-700 text-slate-800 dark:text-white";
            } else {
                btn.className = "flex-1 py-3 text-[9px] font-black uppercase rounded-lg transition-all text-slate-500 dark:text-slate-400 hover:bg-white/50 dark:hover:bg-slate-700/50";
            }
        }
    });

    // 4. CHAMA A BUSCA (Certifique-se que o nome da sua função de carregar a lista é esse)
    if (typeof carregarHistoricoComandas === 'function') {
        carregarHistoricoComandas();
    }
};

window.togglePeriodoComandas = function() {
    const painel = document.getElementById('container-periodo-comandas');
    if (painel) {
        painel.classList.toggle('hidden');
        if (!painel.classList.contains('hidden')) {
            window.mudarFiltroComandas(99); // Ativa o botão PERÍODO
        }
    }
};

window.mudarFiltroProdutos = function(dias) {
    const inputIni = document.getElementById('data-inicio-rel-produtos');
    const inputFim = document.getElementById('data-fim-rel-produtos');
    const containerPeriodo = document.getElementById('container-periodo-prod');

    const hoje = new Date();
    const dataFimStr = hoje.toISOString().split('T')[0];
    let dataIniStr = dataFimStr;

    // Se clicou na lupa, não muda as datas, só pesquisa
    if (dias === 'custom') {
        atualizarEstiloBotoesProdutos(99);
        if(typeof gerarRelatorioProdutos === 'function') gerarRelatorioProdutos();
        return;
    }

    // Calcula as datas automáticas
    if (dias === 0) {
        dataIniStr = dataFimStr; // Hoje
        containerPeriodo.classList.add('hidden');
    } else if (dias === 7 || dias === 30) {
        const dataPassada = new Date();
        dataPassada.setDate(hoje.getDate() - dias);
        dataIniStr = dataPassada.toISOString().split('T')[0];
        containerPeriodo.classList.add('hidden');
    }

    // Preenche os campos invisíveis
    if (inputIni) inputIni.value = dataIniStr;
    if (inputFim) inputFim.value = dataFimStr;

    // Pinta o botão e chama a geração do ranking
    atualizarEstiloBotoesProdutos(dias);
    if(typeof gerarRelatorioProdutos === 'function') gerarRelatorioProdutos();
};
/**
 * RESTAURADA: Função que gera o ranking de produtos vendidos.
 * Inclui o "tradutor" de itens em formato de texto.
 */
window.gerarRelatorioProdutos = async function() {
    let iniInput = document.getElementById('data-inicio-rel-produtos');
    let fimInput = document.getElementById('data-fim-rel-produtos');
    const container = document.getElementById('conteudo-rel-produtos');

    if (!iniInput || !fimInput || !container) return;

    // 1. CORREÇÃO DA TELA BRANCA: Se não tiver data, preenche com "Hoje"
    const hoje = new Date().toISOString().split('T')[0];
    if (!iniInput.value) iniInput.value = hoje;
    if (!fimInput.value) fimInput.value = hoje;

    const ini = iniInput.value;
    const fim = fimInput.value;

    // 2. Feedback visual de carregamento
    container.innerHTML = '<p class="text-center text-xs text-slate-400 py-10 font-bold uppercase animate-pulse">Analisando vendas do período...</p>';

    if(typeof showToast === 'function') showToast('ANALISANDO VENDAS...', 'aviso');

    try {
        // 3. Busca no banco usando created_at e ignorando as canceladas
        const { data: vendas, error } = await _supabase
            .from('historico_vendas')
            .select('itens, status')
            .gte('created_at', `${ini}T00:00:00`)
            .lte('created_at', `${fim}T23:59:59`)
            .neq('status', 'cancelada'); // Proteção extra!

        if (error) throw error;

        const contagem = {};
        let totalUnidadesPeriodo = 0;

        (vendas || []).forEach(v => {
            let itensArr = [];
            // Tradutor: Transforma texto JSON em Lista de Itens
            if (typeof v.itens === 'string') {
                try { itensArr = JSON.parse(v.itens); } catch(e) { itensArr = []; }
            } else if (Array.isArray(v.itens)) {
                itensArr = v.itens;
            }

            itensArr.forEach(i => {
                const nome = i.nome || 'PRODUTO DESCONHECIDO';
                const precoItem = parseFloat(i.preco || 0);
                const qtdItem = parseFloat(i.qtd || i.quantidade || 1); // Aceita qtd ou quantidade

                // Ignora lançamentos de pagamento ou valores zerados
                if (!nome.toUpperCase().includes('PGTO') && precoItem > 0) {
                    contagem[nome] = (contagem[nome] || 0) + qtdItem;
                    totalUnidadesPeriodo += qtdItem;
                }
            });
        });

        const ranking = Object.entries(contagem).sort((a, b) => b[1] - a[1]);

        if (ranking.length === 0) {
            container.innerHTML = '<p class="text-center text-[10px] text-slate-400 py-10 font-black uppercase tracking-widest">Sem vendas de produtos no período.</p>';
            return;
        }

        // 4. Monta a Interface com os seus cards originais
        let html = ranking.map(([nome, qtd], index) => {
            const medalhas = ['🥇', '🥈', '🥉'];
            const icone = medalhas[index] || '🍢';
            return `
            <div class="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-100 dark:border-slate-800 mb-2 shadow-sm flex items-center justify-between">
                <div class="flex items-center gap-3">
                    <div class="text-lg w-8 text-center">${icone}</div>
                    <h4 class="font-black text-[11px] text-slate-700 dark:text-slate-200 uppercase">${nome}</h4>
                </div>
                <div class="bg-slate-50 dark:bg-slate-800 px-3 py-1 rounded-lg border border-slate-100 dark:border-slate-700">
                    <span class="font-black text-xs text-emerald-500">${qtd} <small class="text-[8px] opacity-60">UN</small></span>
                </div>
            </div>`;
        }).join('');

        // Adiciona um pequeno rodapé com o total geral no final da lista
        html += `
        <div class="mt-2 pt-4 border-t border-slate-100 dark:border-slate-800 flex justify-end pr-2">
            <span class="text-[9px] font-black text-slate-400 uppercase tracking-widest">Total Movimentado: ${totalUnidadesPeriodo} UN</span>
        </div>`;

        container.innerHTML = html;

    } catch (e) {
        console.error('[RELATÓRIO] Erro produtos:', e);
        if(typeof showToast === 'function') showToast('FALHA NO RANKING', 'erro');
        container.innerHTML = '<p class="text-center text-xs text-red-500 py-10 font-bold uppercase animate-pulse">Erro ao carregar o ranking.</p>';
    }
}

window.carregarHistoricoComandas = async function() {
    const container = document.getElementById('conteudo-rel-comandas');
    if (!container) return;

    const dIni = document.getElementById('data-inicio-comandas')?.value;
    const dFim = document.getElementById('data-fim-comandas')?.value;

    if (!dIni || !dFim) return;

    // Coloca um loading bonitinho para o usuário não achar que travou
    container.innerHTML = `
        <div class="col-span-full flex flex-col items-center justify-center py-10">
            <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500 mb-2"></div>
            <p class="text-[10px] font-black uppercase text-slate-400 animate-pulse">Buscando Comandas...</p>
        </div>
    `;

    try {
        const { data: vendas, error } = await _supabase
            .from('historico_vendas')
            .select('*')
            .gte('created_at', `${dIni}T00:00:00`)
            .lte('created_at', `${dFim}T23:59:59`)
            .order('created_at', { ascending: false });

        if (error) throw error;

        if (!vendas || vendas.length === 0) {
            container.innerHTML = `
                <div class="col-span-full text-center py-10">
                    <p class="text-[10px] font-black uppercase text-slate-400 italic">Nenhuma comanda encontrada neste período.</p>
                </div>
            `;
            return;
        }

        // Monta os cards das comandas na tela
        container.innerHTML = vendas.map(v => {
            const dataFmt = new Date(v.created_at).toLocaleString('pt-BR');
            const total = parseFloat(v.total || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 });
            
            return `
                <div class="bg-white dark:bg-slate-900 p-4 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-sm hover:shadow-md transition-all">
                    <div class="flex justify-between items-start mb-3">
                        <div>
                            <span class="text-[9px] font-black text-slate-400 uppercase tracking-widest">${dataFmt}</span>
                            <h4 class="text-xs font-black text-slate-700 dark:text-slate-200 uppercase">Mesa/Cliente: ${v.mesa || 'Balcão'}</h4>
                        </div>
                        <span class="bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 text-[9px] font-black px-2 py-1 rounded-lg uppercase">Finalizada</span>
                    </div>
                    <div class="flex justify-between items-end">
                        <div class="text-[10px] text-slate-500 font-bold">
                            <p>Pagamento: <span class="text-slate-700 dark:text-slate-300">${v.metodo_pagamento || '---'}</span></p>
                        </div>
                        <div class="text-right">
                            <p class="text-[8px] font-black text-slate-400 uppercase">Total</p>
                            <p class="text-sm font-black text-orange-500 tracking-tighter">R$ ${total}</p>
                        </div>
                    </div>
                </div>
            `;
        }).join('');

    } catch (e) {
        console.error("Erro ao carregar histórico:", e);
        container.innerHTML = `<p class="col-span-full text-center text-red-500 text-[10px] font-black uppercase py-10">Erro ao conectar com o servidor.</p>`;
    }
};

/* -------------------------------------------------------------
   5. ATALHOS DE TECLADO E EVENTOS GLOBAIS
   ------------------------------------------------------------- */

function vincularEnter(id, funcao) {
    const el = document.getElementById(id);
    if (el && typeof funcao === 'function') {
        el.onkeydown = (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                e.stopPropagation();
                funcao();
            }
        };
    }
}

document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;

    const ids = [
        'modal-auth-admin', 'modal-editar-usuario', 'modal-confirmacao-sistema',
        'modal-troca-pagamento', 'modal-gerar-cardapio', 'modal-perfil-usuario'
    ];

    ids.forEach(id => {
        const m = document.getElementById(id);
        if (!m || m.classList.contains('hidden')) return;

        if (id === 'modal-perfil-usuario') fecharModalPerfil();
        else if (id === 'modal-confirmacao-sistema') fecharModalConfirmacao();
        else m.classList.add('hidden');
    });
});

function preencherDatasPadrao() {
    const hoje = new Date();
    const seteDias = new Date();
    seteDias.setDate(hoje.getDate() - 7);
    const iso = (d) => d.toISOString().split('T')[0];

    ['financeiro', 'produtos', 'comandas'].forEach(t => {
        const ini = document.getElementById(`data-inicio-rel-${t}`);
        const fim = document.getElementById(`data-fim-rel-${t}`);
        if (ini) ini.value = iso(seteDias);
        if (fim) fim.value = iso(hoje);
    });
}

function inicializarAtalhosInterface() {
    vincularEnter('input-auth-senha', typeof confirmarAuth === 'function' ? confirmarAuth : null);
    vincularEnter('p-nome',  typeof salvarProduto === 'function' ? salvarProduto : null);
    vincularEnter('p-preco', typeof salvarProduto === 'function' ? salvarProduto : null);
    vincularEnter('c-identificacao', typeof abrirNovaComanda === 'function' ? abrirNovaComanda : null);

    ['novo-user-completo', 'novo-user-nome', 'novo-user-pass'].forEach(id =>
        vincularEnter(id, typeof salvarNovoUsuario === 'function' ? salvarNovoUsuario : null)
    );
    ['edit-user-completo', 'edit-user-nome', 'edit-user-pass'].forEach(id =>
        vincularEnter(id, typeof salvarEdicaoUsuario === 'function' ? salvarEdicaoUsuario : null)
    );
}

document.addEventListener('DOMContentLoaded', () => {
    inicializarAtalhosInterface();
    preencherDatasPadrao();
});

window.irParaNovaVenda = function() {
    sessionStorage.removeItem('comandaAtivaId');
    sessionStorage.removeItem('comandaAtivaNome');
    window.location.href = 'venda.html';
};