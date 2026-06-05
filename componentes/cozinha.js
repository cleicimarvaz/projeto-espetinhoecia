/* =================================================================================
   SISTEMA KDS - COZINHA (MONITOR DE PRODUÇÃO)
   ================================================================================= */

let COMANDAS_ATIVAS = [];
let somHabilitado = false;
let intervaloSomPendente = null;
let intervaloAutoRefresh = null;

/* --- FUNÇÃO ESCUDO: GARANTE QUE BEBIDAS/ÁGUA NUNCA ENTREM NA COZINHA --- */
window.isItemCozinha = function(item) {
    if (!item) return false;

    const cat = (item.categoria || '').toLowerCase();
    const nome = (item.nome || '').toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

    if (item.precisa_preparo === false) return false;

    if (cat.includes('bebida') || cat.includes('cerveja') || cat.includes('refrigerante') ||
        cat.includes('agua') || cat.includes('água') || cat.includes('suco')) return false;

    if (nome.includes('PGTO') || nome.includes('AGUA') || nome.includes('REFRIGERANTE') ||
        nome.includes('CERVEJA') || nome.includes('SUCO') || nome.includes('COCA') ||
        nome.includes('GUARANA') || nome.includes('PEPSI') || nome.includes('HEINEKEN')) return false;

    return true;
};

/* --- 1. EVENTOS GLOBAIS E MODAIS DA COZINHA --- */

window.addEventListener('click', function(e) {
    if (e.target.id === 'modal-alerta') window.fecharAlerta();
    if (e.target.id === 'modal-confirmacao') {
        document.getElementById('btn-confirm-nao')?.click();
    }
});

window.abrirModalGenerico = function(idModal) {
    const modal = document.getElementById(idModal);
    const boxId = idModal.replace('modal-', '') + '-box';
    const box = document.getElementById(boxId);
    if (!modal) return;

    // TRUQUE DE MESTRE: Arranca o modal de onde estiver e joga na raiz da página
    document.body.appendChild(modal);
    
    // Força a camada máxima possível no navegador
    modal.style.zIndex = "2147483647"; 

    modal.classList.remove('hidden');
    modal.style.display = 'flex';
    
    setTimeout(() => {
        modal.style.opacity = '1';
        box?.classList.remove('scale-95');
    }, 10);
};

window.fecharModalGenerico = function(idModal) {
    const modal = document.getElementById(idModal);
    const boxId = idModal.replace('modal-', '') + '-box';
    const box = document.getElementById(boxId);
    if (!modal) return;
    modal.style.opacity = '0';
    box?.classList.add('scale-95');
    setTimeout(() => {
        modal.classList.add('hidden');
        modal.style.display = 'none';
    }, 250);
};

window.sysAlert = function(titulo, texto, tipo = 'info', botoesArr = null) {
    const modal = document.getElementById('modal-alerta');
    
    // ----------------------------------------------------
    // SUBSTITUIÇÃO DO ALERT DE FALLBACK (PLANO B)
    // ----------------------------------------------------
    if (!modal) { 
        if (typeof alertaSistema === 'function') {
            // Se o modal antigo falhar, chama o nosso novo modal global
            alertaSistema(texto, titulo);
        } else {
            // Plano C: Último recurso de sobrevivência
            alert(`${titulo}: ${texto}`); 
        }
        return; 
    }

    document.getElementById('alerta-titulo').innerText = titulo;
    document.getElementById('alerta-texto').innerText = texto;

    const icone = document.getElementById('alerta-icone');
    const containerBotoes = document.getElementById('alerta-botoes');

    const configs = {
        erro:    { cls: 'bg-red-50 dark:bg-red-900/30 text-red-500 border-red-200 dark:border-red-500/50',    ico: '⚠️', btn: `<button onclick="window.fecharAlerta()" class="w-full bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-white py-4 rounded-xl font-black uppercase text-xs active:bg-slate-200 transition-colors">Fechar</button>` },
        sucesso: { cls: 'bg-emerald-50 dark:bg-emerald-900/30 text-emerald-500 border-emerald-200 dark:border-emerald-500/50', ico: '✅', btn: `<button onclick="window.fecharAlerta()" class="w-full bg-emerald-500 text-white py-4 rounded-xl font-black uppercase text-xs shadow-lg active:scale-95 transition-all">OK</button>` },
        info:    { cls: 'bg-blue-50 dark:bg-blue-900/30 text-blue-500 border-blue-200 dark:border-blue-500/50',  ico: 'ℹ️', btn: `<button onclick="window.fecharAlerta()" class="w-full bg-blue-500 text-white py-4 rounded-xl font-black uppercase text-xs shadow-lg active:scale-95 transition-all">Entendi</button>` }
    };

    const cfg = configs[tipo] || configs.info;
    icone.className = `w-20 h-20 rounded-full flex items-center justify-center mb-4 text-4xl shadow-inner border ${cfg.cls}`;
    icone.innerHTML = cfg.ico;
    containerBotoes.innerHTML = botoesArr
        ? botoesArr.map(b => `<button onclick="event.stopPropagation(); ${b.onclick}" class="w-full ${b.class} py-4 rounded-xl font-black uppercase text-[10px] transition-all active:scale-95 italic tracking-widest">${b.label}</button>`).join('')
        : cfg.btn;

    window.abrirModalGenerico('modal-alerta');
};

window.fecharAlerta = function() {
    window.fecharModalGenerico('modal-alerta');
};

window.sysConfirm = function(titulo, texto) {
    return new Promise((resolve) => {
        // 1. Procuramos o nosso NOVO modal padronizado de confirmação
        const modal = document.getElementById('modal-confirm-sistema');
        
        if (!modal) { 
            // Fallback de segurança (confirm nativo)
            return resolve(confirm(`${titulo}\n${texto}`)); 
        }

        // 2. Preenchemos com os textos recebidos
        document.getElementById('titulo-modal-confirm').innerText = titulo;
        document.getElementById('msg-modal-confirm').innerText = texto;
        
        // 3. Abrimos o modal na tela
        modal.classList.remove('hidden');
        modal.classList.add('flex');

        // 4. Capturamos os botões SIM e NÃO
        const btnSim = document.getElementById('btn-executar-confirm');
        // Truque Mágico: Como o botão NÃO fica coladinho antes do SIM no nosso HTML, pegamos ele assim:
        const btnNao = btnSim.previousElementSibling; 

        // Função para fechar o modal e devolver a resposta (true ou false)
        const fechar = (resultado) => {
            modal.classList.add('hidden');
            modal.classList.remove('flex');
            // Pequeno delay para a animação não cortar seca
            setTimeout(() => resolve(resultado), 150);
        };

        // 5. Limpamos cliques anteriores e injetamos as novas resoluções da Promise
        btnSim.onclick = () => fechar(true);
        if (btnNao) btnNao.onclick = () => fechar(false);
    });
};

/* --- 2. CONTROLES DE TEMA E SOM --- */

window.atualizarBotaoTema = function() {
    const isDark = document.documentElement.classList.contains('dark');
    const icone = document.getElementById('icone-tema');
    const texto = document.getElementById('texto-tema-2');
    if (!icone || !texto) return;

    if (isDark) {
        icone.className = 'ph-bold ph-sun text-xl text-yellow-500';
        texto.innerHTML = 'MODO<br>CLARO';
    } else {
        icone.className = 'ph-bold ph-moon-stars text-xl text-indigo-500';
        texto.innerHTML = 'MODO<br>ESCURO';
    }
};

window.toggleTema = function() {
    const html = document.documentElement;
    if (html.classList.contains('dark')) {
        html.classList.remove('dark');
        localStorage.setItem('temaCozinha', 'light');
    } else {
        html.classList.add('dark');
        localStorage.setItem('temaCozinha', 'dark');
    }
    window.atualizarBotaoTema();
};

window.habilitarSom = function() {
    const audio = document.getElementById('som-notificacao');
    const btn   = document.getElementById('btn-som-container');
    const icone = document.getElementById('icone-som');
    const texto = document.getElementById('texto-som-2');

    if (somHabilitado) {
        somHabilitado = false;
        if (icone) icone.className = 'ph-bold ph-speaker-slash text-xl text-slate-500 dark:text-white';
        if (texto) texto.innerHTML = 'LIGAR<br>SOM';
        if (btn) {
            btn.classList.replace('border-emerald-200', 'border-slate-200');
            btn.classList.replace('dark:border-emerald-500/50', 'dark:border-slate-600');
            btn.classList.replace('bg-emerald-50', 'bg-slate-100');
            btn.classList.replace('dark:bg-slate-800', 'dark:bg-slate-700');
            btn.classList.replace('text-emerald-600', 'text-slate-600');
            btn.classList.replace('dark:text-emerald-500', 'dark:text-white');
        }
        if (intervaloSomPendente) { clearInterval(intervaloSomPendente); intervaloSomPendente = null; }
        
        // Feedback visual rápido ao desativar o som
        if (typeof showToast === 'function') showToast('SOM DESATIVADO', 'info');

    } else {
        if (audio) {
            audio.play().then(() => {
                audio.pause();
                audio.currentTime = 0;
                somHabilitado = true;
                if (icone) icone.className = 'ph-bold ph-speaker-high text-xl text-emerald-500';
                if (texto) texto.innerHTML = 'SOM<br>ATIVO';
                if (btn) {
                    btn.classList.replace('border-slate-200', 'border-emerald-200');
                    btn.classList.replace('dark:border-slate-600', 'dark:border-emerald-500/50');
                    btn.classList.replace('bg-slate-100', 'bg-emerald-50');
                    btn.classList.replace('dark:bg-slate-700', 'dark:bg-slate-800');
                    btn.classList.replace('text-slate-600', 'text-emerald-600');
                    btn.classList.replace('dark:text-white', 'dark:text-emerald-500');
                }
                
                // ----------------------------------------------------
                // SUBSTITUIÇÃO DO sysAlert (SUCESSO)
                // ----------------------------------------------------
                if (typeof showToast === 'function') {
                    showToast('ÁUDIO ATIVADO COM SUCESSO', 'sucesso');
                } else if (typeof alertaSistema === 'function') {
                    alertaSistema('A campainha vai tocar toda vez que um pedido novo chegar.', 'Áudio Ativado');
                }
                
                if (typeof window.verificarLoopSom === 'function') window.verificarLoopSom();
                
            }).catch(() => {
                // ----------------------------------------------------
                // SUBSTITUIÇÃO DO sysAlert (ERRO)
                // ----------------------------------------------------
                if (typeof alertaSistema === 'function') {
                    alertaSistema('O navegador bloqueou o áudio. Tente clicar em alguma parte da tela primeiro e depois clique em Ligar Som novamente.', 'Atenção');
                } else if (typeof showToast === 'function') {
                    showToast('ERRO AO ATIVAR ÁUDIO', 'erro');
                } else {
                    alert('Não foi possível ativar o som automaticamente. Tente novamente.');
                }
            });
        }
    }
};

window.tocarAlerta = function() {
    if (!somHabilitado) return;
    const audio = document.getElementById('som-notificacao');
    if (audio) { audio.currentTime = 0; audio.play().catch(() => {}); }
};

window.verificarLoopSom = function() {
    if (!somHabilitado) return;

    const temPendente = COMANDAS_ATIVAS.some(c =>
        c.itens.some(i => window.isItemCozinha(i) && (!i.cozinha_status || i.cozinha_status === 'novo'))
    );

    if (temPendente) {
        if (!intervaloSomPendente) {
            window.tocarAlerta();
            intervaloSomPendente = setInterval(window.tocarAlerta, 10000);
        }
    } else {
        if (intervaloSomPendente) { clearInterval(intervaloSomPendente); intervaloSomPendente = null; }
    }
};

window.toggleAutoRefresh = function() {
    const toggle = document.getElementById('toggle-refresh');
    const ativo = toggle?.checked;
    localStorage.setItem('autoRefreshCozinha', ativo ? 'true' : 'false');

    if (ativo) {
        window.iniciarAutoRefresh();
    } else {
        if (intervaloAutoRefresh) { clearInterval(intervaloAutoRefresh); intervaloAutoRefresh = null; }
    }
};

window.iniciarAutoRefresh = function() {
    if (localStorage.getItem('autoRefreshCozinha') === null) {
        localStorage.setItem('autoRefreshCozinha', 'true');
    }
    const isAtivo = localStorage.getItem('autoRefreshCozinha') === 'true';
    const toggle = document.getElementById('toggle-refresh');
    if (toggle) toggle.checked = isAtivo;

    if (isAtivo) {
        if (intervaloAutoRefresh) clearInterval(intervaloAutoRefresh);
        intervaloAutoRefresh = setInterval(window.carregarPedidosIniciais, 30000);
    }
};

/* --- 3. DADOS (SUPABASE & REALTIME) --- */

window.carregarPedidosIniciais = async function() {
    if (typeof _supabase === 'undefined') return;

    try {
        const { data, error } = await _supabase
            .from('comandas')
            .select('*')
            .eq('status', 'aberta')
            .order('created_at', { ascending: true });

        if (error) throw error;

        COMANDAS_ATIVAS = data || [];
        window.renderizarMonitor();
        window.verificarLoopSom();
    } catch (e) {
        console.error('[KDS] Erro ao carregar pedidos:', e);
    }
};

window.escutarNovosPedidos = function() {
    if (typeof _supabase === 'undefined') return;

    _supabase.channel('kds-realtime')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'comandas' }, () => {
            window.carregarPedidosIniciais();
            if (somHabilitado) window.tocarAlerta();
        })
        .subscribe();
};

/* --- 4. RENDERIZAÇÃO DO MONITOR --- */

window.renderizarMonitor = function() {
    const monitor = document.getElementById('lista-pedidos-cozinha');
    const contador = document.getElementById('contador-pedidos');
    if (!monitor) return;

    const lotes = {};

    COMANDAS_ATIVAS.forEach(c => {
        (c.itens || []).forEach((item, indexOriginal) => {
            if (!window.isItemCozinha(item) || item.cozinha_status === 'pronto') return;

            const dataISO = item.hora_pedido || item.hora || c.created_at;
            const loteKey = `${c.id}_${dataISO}`;

            if (!lotes[loteKey]) {
                lotes[loteKey] = {
                    comandaId: c.id,
                    identificacao: c.identificacao,
                    idLote: dataISO,
                    tempo: new Date(dataISO),
                    itens: []
                };
            }
            lotes[loteKey].itens.push({ ...item, indexOriginal });
        });
    });

    const listaLotes = Object.values(lotes).sort((a, b) => a.tempo - b.tempo);
    if (contador) contador.innerText = listaLotes.length;

    if (listaLotes.length === 0) {
        monitor.innerHTML = `<div class="col-span-full py-32 text-center opacity-40"><h3 class="text-slate-500 font-black text-xl uppercase italic">Sem pedidos no momento...</h3></div>`;
        return;
    }

    monitor.innerHTML = listaLotes.map(lote => {
        const temItemNovo = lote.itens.some(obj => !obj.cozinha_status || obj.cozinha_status === 'novo');
        
        const badgeLoteHtml = temItemNovo 
            ? `<div class="flex items-center gap-1.5 bg-red-500/10 border border-red-500/30 px-3 py-1.5 rounded-full shrink-0 animate-pulse">
                   <i class="ph-fill ph-fire text-red-500 text-[10px]"></i>
                   <span class="text-[9px] font-black text-red-500 uppercase tracking-tighter">NOVO</span>
               </div>`
            : `<div class="flex items-center gap-1.5 bg-blue-500/10 border border-blue-500/20 px-3 py-1.5 rounded-full shrink-0">
                   <i class="ph-bold ph-hourglass-high text-blue-400 text-[10px] animate-spin-slow"></i>
                   <span class="text-[9px] font-black text-blue-400 uppercase tracking-tighter">PREPARANDO...</span>
               </div>`;
        
        return `
            <div class="flex flex-col h-auto border-2 ${temItemNovo ? 'border-red-900/50' : 'border-slate-200 dark:border-slate-800'} bg-white dark:bg-[#0f172a] rounded-[2.5rem] shadow-2xl overflow-hidden mb-4 transition-colors duration-300">
                <div class="p-6 border-b border-slate-200 dark:border-slate-700/50 bg-slate-50 dark:bg-slate-800/20 transition-colors">
                    <div class="flex justify-between items-center">
                        <div>
                            <span class="text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">MESA / CLIENTE</span>
                            <h3 class="text-2xl font-black text-slate-900 dark:text-white uppercase italic leading-none">${lote.identificacao}</h3>
                        </div>
                        <div class="flex items-center gap-3">
                            ${badgeLoteHtml}
                            <button onclick="window.imprimirTicket58mm(${lote.comandaId}, '${lote.idLote}')" class="text-slate-400 dark:text-slate-500 hover:text-slate-900 dark:hover:text-white transition-all">
                                <i class="ph-bold ph-printer text-2xl"></i>
                            </button>
                        </div>
                    </div>
                </div>

                <div class="p-4 space-y-3">
                    ${lote.itens.map(obj => {
                        const isNovo = (!obj.cozinha_status || obj.cozinha_status === 'novo');
                        
                        const renderObservacoes = (obj.detalhes || obj.observacao) 
                            ? (obj.detalhes || obj.observacao)
                                .split('|')
                                .map(parte => parte.trim())
                                .filter(parte => parte.length > 0)
                                .map(parte => `
                                    <p class="text-[10px] font-black text-red-500 dark:text-red-400 italic mt-1 leading-tight whitespace-normal break-words flex items-start">
                                        <span class="mr-1">↳</span> ${parte}
                                    </p>`)
                                .join('')
                            : '';

                        return `
                        <div class="flex items-start gap-4 p-4 rounded-[2rem] border ${isNovo ? 'border-red-500/20' : 'border-slate-200 dark:border-slate-700/50'} bg-slate-50 dark:bg-slate-800/40 transition-colors duration-300">
                            <div class="w-14 h-14 bg-amber-500/10 text-amber-500 rounded-2xl flex items-center justify-center font-black text-lg shrink-0 mt-1">${obj.qtd}X</div>
                            <div class="flex-1 min-w-0 flex flex-col justify-center py-1">
                                <p class="font-bold text-slate-800 dark:text-slate-100 uppercase text-[12px] leading-tight whitespace-normal break-words">${obj.nome}</p>
                                ${renderObservacoes}
                            </div>
                            <button onclick="window.${isNovo ? 'aceitarItemProducao' : 'concluirItemProducao'}(${lote.comandaId}, ${obj.indexOriginal})" 
                                class="w-28 h-12 rounded-2xl font-black text-[10px] uppercase ${isNovo ? 'bg-red-600' : 'bg-emerald-600'} text-white shadow-lg shrink-0 self-center active:scale-95 transition-all">
                                ${isNovo ? 'ACEITAR' : 'CONCLUIR'}
                            </button>
                        </div>`;
                    }).join('')}
                </div>
            </div>`;
    }).join('');
};

/* --- 5. AÇÕES DE PRODUÇÃO --- */

// 1. AÇÃO DIRETA NO CARD (Item Individual)
window.aceitarItemProducao = async function(idComanda, indexItem) {
    const comanda = COMANDAS_ATIVAS.find(x => x.id === idComanda);
    if (!comanda) return;

    let itensAtualizados = [...comanda.itens];
    if (itensAtualizados[indexItem]) {
        itensAtualizados[indexItem].cozinha_status = 'em_preparo';
    }

    const { error } = await _supabase.from('comandas').update({ itens: itensAtualizados }).eq('id', idComanda);
    if (!error) window.carregarPedidosIniciais();
};

window.concluirItemProducao = async function(idComanda, indexItem) {
    const comanda = COMANDAS_ATIVAS.find(x => x.id === idComanda);
    if (!comanda) return;

    let itensAtualizados = [...comanda.itens];
    if (itensAtualizados[indexItem]) {
        itensAtualizados[indexItem].cozinha_status = 'pronto';
    }

    try {
        const { error } = await _supabase.from('comandas').update({ itens: itensAtualizados }).eq('id', idComanda);
        
        if (error) throw error;
        
        if (typeof window.carregarPedidosIniciais === 'function') {
            window.carregarPedidosIniciais();
        }

        // ----------------------------------------------------
        // SUBSTITUIÇÃO DO sysAlert - PRIORIZANDO O TOAST
        // ----------------------------------------------------
        if (typeof showToast === 'function') {
            showToast('ITEM PRONTO!', 'sucesso');
        } else if (typeof alertaSistema === 'function') {
            alertaSistema('Item marcado como concluído.', 'Pronto!');
        } else {
            alert('Item concluído!');
        }
        
    } catch (e) {
        console.error("[COZINHA] Erro ao concluir item:", e);
        // ----------------------------------------------------
        // PROTEÇÃO EXTRA: TRATAMENTO DE ERRO
        // ----------------------------------------------------
        if (typeof showToast === 'function') {
            showToast('ERRO AO CONCLUIR ITEM', 'erro');
        } else if (typeof alertaSistema === 'function') {
            alertaSistema('Ocorreu um erro de conexão ao tentar marcar o item como pronto. Tente novamente.', 'Atenção');
        }
    }
};

// 2. FUNÇÕES DO MODAL DE PRÉVIA (Para Impressão)
window.abrirPreviaPedido = function(id) {
    const c = COMANDAS_ATIVAS.find(x => x.id === id);
    if (!c) return;

    const previaIdEl = document.getElementById('previa-id');
    const previaListaEl = document.getElementById('previa-lista-itens');
    if (previaIdEl) previaIdEl.innerText = `COMANDA ${c.identificacao}`;

    const itensProduzindo = c.itens.filter(i => window.isItemCozinha(i) && i.cozinha_status === 'em_preparo');

    if (previaListaEl) {
        previaListaEl.innerHTML = itensProduzindo.map(i => `
            <div class="flex items-center justify-between p-4 bg-slate-800/60 rounded-2xl mb-2 border border-slate-700/50">
                <div class="flex items-center gap-3">
                    <span class="text-xl font-black text-amber-400">${i.qtd}X</span>
                    <p class="font-bold text-white uppercase text-sm">${i.nome}</p>
                </div>
                <span class="text-emerald-400 text-lg">✔️</span>
            </div>`).join('');
    }

    const btnConcluir = document.getElementById('btn-concluir-modal');
    if (btnConcluir) {
        btnConcluir.onclick = async () => {
            // Adicionado bloco try/catch para segurança
            try {
                const itensConcluidos = c.itens.map(i =>
                    i.cozinha_status === 'em_preparo' ? { ...i, cozinha_status: 'pronto' } : i
                );
                
                const { error } = await _supabase.from('comandas').update({ itens: itensConcluidos }).eq('id', c.id);
                
                if (error) throw error;
                
                window.fecharPrevia();
                if (typeof window.carregarPedidosIniciais === 'function') window.carregarPedidosIniciais();
                
                // ----------------------------------------------------
                // SUBSTITUIÇÃO DO sysAlert - PRIORIZANDO O TOAST
                // ----------------------------------------------------
                if (typeof showToast === 'function') {
                    showToast('ITENS CONCLUÍDOS!', 'sucesso');
                } else if (typeof alertaSistema === 'function') {
                    alertaSistema('Todos os itens da comanda foram marcados como prontos.', 'Pronto!');
                } else {
                    alert('Itens concluídos!');
                }

            } catch (e) {
                console.error("[COZINHA] Erro ao concluir itens da prévia:", e);
                // ----------------------------------------------------
                // TRATAMENTO DE ERRO DE CONEXÃO
                // ----------------------------------------------------
                if (typeof showToast === 'function') {
                    showToast('ERRO AO CONCLUIR ITENS', 'erro');
                } else if (typeof alertaSistema === 'function') {
                    alertaSistema('Ocorreu um erro de comunicação com o banco de dados. Tente novamente.', 'Erro de Conexão');
                }
            }
        };
    }
    window.abrirModalGenerico('modal-previa-pedido');
};

window.fecharPrevia = function() {
    window.fecharModalGenerico('modal-previa-pedido');
};

/* --- 6. HISTÓRICO E DESFAZER --- */

window.abrirHistoricoCozinha = async function() {
    const lista = document.getElementById('lista-historico-cozinha');
    if (!lista) return;

    lista.innerHTML = `<div class="text-center py-10 opacity-30"><i class="ph-bold ph-spinner animate-spin text-4xl text-white"></i></div>`;
    window.abrirModalGenerico('modal-historico-cozinha');

    try {
        const { data: comandas, error } = await _supabase
            .from('comandas')
            .select('*')
            .eq('status', 'aberta')
            .order('updated_at', { ascending: false });

        if (error) throw error;

        // 1. ACHATA A LISTA (Separa todos os itens prontos de suas comandas em uma lista única)
        let todosItensProntos = [];
        (comandas || []).forEach(c => {
            if (c.itens) {
                c.itens.forEach((item, indexOriginal) => {
                    if (window.isItemCozinha(item) && item.cozinha_status === 'pronto') {
                        todosItensProntos.push({
                            comandaId: c.id,
                            identificacao: c.identificacao,
                            // Se o seu item tiver um horário próprio (item.hora), você pode trocar a linha abaixo
                            dataHora: new Date(c.updated_at).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }),
                            item: item,
                            indexOriginal: indexOriginal
                        });
                    }
                });
            }
        });

        if (todosItensProntos.length === 0) {
            lista.innerHTML = `<div class="text-center py-10 opacity-40"><p class="font-black uppercase text-xs tracking-widest text-slate-400">Nenhum finalizado.</p></div>`;
            return;
        }

        // 2. RENDERIZA CADA ITEM COMO UM BLOCO TOTALMENTE INDIVIDUAL
        lista.innerHTML = todosItensProntos.map(obj => `
            <div class="bg-[#1e293b] p-4 rounded-[1.5rem] border border-slate-700 flex items-center justify-between gap-4 mb-3 shadow-sm">
                <div class="flex-1">
                    <div class="flex items-center gap-2 mb-2">
                        <span class="bg-slate-800 text-slate-300 text-[9px] px-2.5 py-1 rounded-md font-bold uppercase tracking-widest border border-slate-700">
                            COMANDA: ${obj.identificacao}
                        </span>
                        <span class="text-slate-500 text-[9px] font-bold uppercase tracking-widest">
                            ${obj.dataHora}
                        </span>
                    </div>
                    
                    <div class="flex items-center gap-2.5 pl-1 mt-1">
                        <span class="text-emerald-500 text-lg">✔️</span>
                        <p class="text-slate-100 flex items-baseline">
                            <span class="font-black text-amber-500 pr-2 text-lg">${obj.item.qtd}X</span>
                            <span class="font-bold uppercase tracking-wide text-sm">${obj.item.nome}</span>
                        </p>
                    </div>
                </div>
                
                <button onclick="window.confirmarDesfazerPedido(${obj.comandaId}, ${obj.indexOriginal})" class="text-orange-500 border border-orange-500/40 px-4 py-2.5 rounded-xl font-black uppercase text-[10px] active:scale-95 transition-all hover:bg-orange-500 hover:text-white shrink-0">
                    Desfazer
                </button>
            </div>
        `).join('');
        
    } catch (e) {
        console.error("Erro ao carregar histórico:", e);
        lista.innerHTML = `<div class="text-center py-10 text-red-500 font-bold uppercase text-xs tracking-wider">Erro ao carregar os dados.</div>`;
    }
};

/**
 * FUNÇÃO PARA DESFAZER O PEDIDO (Voltar para a fila de preparo)
 */
let comandaParaDesfazer = null;
let itemIndexParaDesfazer = null; // Agora guarda também qual item da lista foi clicado

window.confirmarDesfazerPedido = function(idComanda, indexDoItem) {
    comandaParaDesfazer = idComanda;
    itemIndexParaDesfazer = indexDoItem;
    
    const modal = document.getElementById('modal-confirmacao-desfazer');
    if (modal) {
        document.body.appendChild(modal);
        modal.style.zIndex = "2147483647"; 
        modal.classList.remove('hidden');
        modal.classList.add('flex');
    }
};

window.fecharModalConfirmacaoDesfazer = function() {
    comandaParaDesfazer = null;
    itemIndexParaDesfazer = null;
    const modal = document.getElementById('modal-confirmacao-desfazer');
    if (modal) {
        modal.classList.add('hidden');
        modal.classList.remove('flex');
    }
};

window.executarDesfazerPedido = async function() {
    if (!comandaParaDesfazer || itemIndexParaDesfazer === null) return;
    
    const idComanda = comandaParaDesfazer;
    const indexDoItem = itemIndexParaDesfazer;
    window.fecharModalConfirmacaoDesfazer(); 

    try {
        if (typeof showToast === 'function') showToast("Voltando item para a fila...", "info");

        // 1. Busca a comanda no banco
        const { data: comanda, error: errBusca } = await _supabase
            .from('comandas')
            .select('id, itens')
            .eq('id', idComanda)
            .single();

        if (errBusca || !comanda) throw errBusca || new Error("Comanda não encontrada.");

        // 2. Altera APENAS o item específico usando o índice dele
        let itensAtualizados = [...(comanda.itens || [])];
        
        if (itensAtualizados[indexDoItem]) {
             itensAtualizados[indexDoItem].cozinha_status = 'pendente';
        }

        // 3. Salva no banco de dados
        const { error: errUpdate } = await _supabase
            .from('comandas')
            .update({ itens: itensAtualizados })
            .eq('id', idComanda);

        if (errUpdate) throw errUpdate;

        if (typeof showToast === 'function') showToast("Desfeito! Item voltou para a cozinha.", "sucesso");

        // 4. ATUALIZA AS TELAS SUAVEMENTE
        if (typeof window.abrirHistoricoCozinha === 'function') {
            window.abrirHistoricoCozinha(); 
        }
        if (typeof window.carregarPedidosIniciais === 'function') {
            window.carregarPedidosIniciais(); 
        }

    } catch (e) {
        console.error("Erro ao desfazer:", e);
        
        // ----------------------------------------------------
        // SUBSTITUIÇÃO DO ALERT NO TRATAMENTO DE ERRO
        // ----------------------------------------------------
        if (typeof showToast === 'function') {
            showToast("ERRO AO DESFAZER PEDIDO", "erro");
        } else if (typeof alertaSistema === 'function') {
            alertaSistema("Não foi possível retornar o item para a fila da cozinha. Detalhe: " + e.message, "Erro de Conexão");
        } else {
            alert("Erro ao desfazer o pedido: " + e.message);
        }
    }
};

/**
 * 2. FECHA O MODAL DE CONFIRMAÇÃO (Se cancelar)
 */
window.fecharModalConfirmacaoDesfazer = function() {
    comandaParaDesfazer = null; // Limpa o ID
    const modal = document.getElementById('modal-confirmacao-desfazer');
    if (modal) {
        modal.classList.add('hidden');
        modal.classList.remove('flex');
    }
};

/**
 * 3. EXECUTA A AÇÃO NO BANCO DE DADOS (Se confirmar)
 */

window.fecharHistoricoCozinha = function() {
    window.fecharModalGenerico('modal-historico-cozinha');
};

/* --- 7. IMPRESSÃO 58MM --- */

/* --- FUNÇÃO DE IMPRESSÃO (TICKET 58mm) --- */

window.imprimirTicket58mm = async function(id, idLote) {
    const c = COMANDAS_ATIVAS.find(x => x.id === id);
    if (!c) return;

    // Filtra os itens que têm EXATAMENTE a mesma referência de hora do lote
    const itensParaImprimir = c.itens.filter(i => {
        const itemRef = i.hora_pedido || i.hora || c.created_at;
        return itemRef === idLote && window.isItemCozinha(i) && i.cozinha_status !== 'pronto';
    });

    if (itensParaImprimir.length === 0) {
        if (typeof showToast === 'function') showToast('Nada para imprimir neste lote!');
        return;
    }

    const dataHora = new Date(idLote).toLocaleString('pt-BR');

    const win = window.open('', '_blank', 'width=300,height=600');
    win.document.write(`
        <html>
        <head>
            <style>
                @page { margin: 0; size: 58mm auto; }
                body { font-family: 'Courier New', Courier, monospace; width: 54mm; padding: 2mm; margin: 0; color: #000; }
                .center { text-align: center; }
                .header { font-weight: bold; font-size: 14px; border-bottom: 2px solid #000; padding-bottom: 5px; }
                .mesa { font-size: 26px; font-weight: 900; margin: 10px 0; }
                .item-container { margin-top: 10px; }
                
                .item-row { display: flex; align-items: flex-start; margin-bottom: 2px; }
                .qtd { font-weight: 900; font-size: 18px; min-width: 30px; }
                .nome { font-weight: bold; font-size: 16px; text-transform: uppercase; line-height: 1.2; word-wrap: break-word; flex: 1; }
                
                .obs { font-size: 13px; font-style: italic; font-weight: bold; margin-left: 30px; margin-bottom: 6px; color: #333; }
                .footer { border-top: 2px solid #000; margin-top: 15px; padding-top: 5px; font-size: 12px; }
            </style>
        </head>
        <body onload="window.print(); window.close();">
            <div class="center header">PEDIDO COZINHA</div>
            <div class="center mesa">${c.identificacao}</div>
            <div class="center" style="font-size: 11px; margin-bottom: 10px;">${dataHora}</div>
            
            <div class="item-container">
                ${itensParaImprimir.map(i => `
                    <div class="item-row">
                        <div class="qtd">${i.qtd}x</div>
                        <div class="nome">${i.nome}</div>
                    </div>
                    ${(i.detalhes || i.observacao) ? `
                        ${(i.detalhes || i.observacao)
                            .split('|')
                            .map(parte => parte.trim())
                            .filter(parte => parte.length > 0)
                            .map(parte => `<div class="obs">↳ ${parte}</div>`)
                            .join('')
                        }
                    ` : ''}
                `).join('')}
            </div>
            
            <div class="footer center">*** FIM DO PEDIDO ***</div>
        </body>
        </html>
    `);
    win.document.close();
};
/* --- 8. INICIALIZAÇÃO --- */

window.onload = async () => {
    window.atualizarBotaoTema();
    window.iniciarAutoRefresh();

    // Som começa ativo por padrão
    somHabilitado = true;
    const btnSom = document.getElementById('btn-som-container');
    const icone  = document.getElementById('icone-som');
    const texto  = document.getElementById('texto-som-2');
    if (icone) icone.className = 'ph-bold ph-speaker-high text-xl text-emerald-500';
    if (texto) texto.innerHTML = 'SOM<br>ATIVO';
    if (btnSom) {
        btnSom.classList.replace('border-slate-200', 'border-emerald-200');
        btnSom.classList.replace('dark:border-slate-600', 'dark:border-emerald-500/50');
        btnSom.classList.replace('bg-slate-100', 'bg-emerald-50');
        btnSom.classList.replace('dark:bg-slate-700', 'dark:bg-slate-800');
        btnSom.classList.replace('text-slate-600', 'text-emerald-600');
        btnSom.classList.replace('dark:text-white', 'dark:text-emerald-500');
    }

    // Desbloqueia o áudio no primeiro toque do usuário (restrição dos navegadores mobile)
    const desbloquearAudio = () => {
        const audio = document.getElementById('som-notificacao');
        if (audio && somHabilitado) {
            audio.play().then(() => { audio.pause(); audio.currentTime = 0; }).catch(() => {});
        }
        document.removeEventListener('click', desbloquearAudio);
        document.removeEventListener('touchstart', desbloquearAudio);
    };
    document.addEventListener('click', desbloquearAudio);
    document.addEventListener('touchstart', desbloquearAudio);

    await window.carregarPedidosIniciais();
    window.escutarNovosPedidos();
};