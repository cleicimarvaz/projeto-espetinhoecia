/* =================================================================================
   MÓDULO DE COMANDAS E MESAS - ESPETINHO & CIA (OTIMIZADO)
   ================================================================================= */

window.comandaEmFechamentoId = null;
window.totalFechamentoCache  = 0;
window.dadosComandaImpressao = null;

/* --- 1. REGRA DE NEGÓCIO: O QUE VAI PARA A COZINHA --- */

window.isItemCozinha = function(item) {
    if (!item) return false;
    const cat  = (item.categoria || '').toLowerCase();
    const nome = (item.nome || '').toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

    if (item.precisa_preparo === false) return false;
    if (cat.includes('bebida') || cat.includes('cerveja') || cat.includes('refrigerante') ||
        cat.includes('agua')   || cat.includes('água')   || cat.includes('suco')) return false;
    if (nome.includes('PGTO') || nome.includes('AGUA') || nome.includes('REFRIGERANTE') ||
        nome.includes('CERVEJA') || nome.includes('SUCO') || nome.includes('COCA') ||
        nome.includes('GUARANA') || nome.includes('PEPSI') || nome.includes('HEINEKEN')) return false;
    return true;
};

/* --- 2. CARREGAMENTO E GESTÃO DAS MESAS --- */

window.carregarComandas = async function() {
    if (typeof _supabase === 'undefined') return;

    const cont = document.getElementById('lista-comandas-ativas');
    if (!cont) return;

    try {
        const { data: cms, error } = await _supabase
            .from('comandas')
            .select('*')
            .eq('status', 'aberta')
            .order('id');

        if (error) throw error;

        if (!cms || cms.length === 0) {
            cont.innerHTML = `
                <div class="col-span-full py-20 text-center opacity-30">
                    <div class="w-20 h-20 bg-slate-200 dark:bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-4 text-3xl">📋</div>
                    <p class="font-black uppercase text-[10px] tracking-widest">Nenhuma mesa aberta no momento.</p>
                </div>`;
            return;
        }

        cont.innerHTML = cms.map(c => `
            <div class="bg-white dark:bg-slate-900 p-5 rounded-[2.5rem] shadow-sm mb-4 border border-slate-50 dark:border-slate-800 transition-colors duration-300">
                <div class="flex justify-between items-center mb-5 px-2">
                    <div class="flex items-center gap-3">
                        <div class="bg-orange-50 dark:bg-orange-900/20 w-10 h-10 rounded-2xl flex items-center justify-center text-xl shadow-inner border border-orange-100 dark:border-orange-800/50">📝</div>
                        <div>
                            <span class="text-[8px] font-black text-slate-300 dark:text-slate-600 uppercase tracking-widest italic">IDENTIFICAÇÃO</span>
                            <h4 class="font-black text-slate-800 dark:text-white text-sm uppercase italic leading-none">${c.identificacao}</h4>
                        </div>
                    </div>
                    <div class="text-right">
                        <p class="text-[9px] font-black text-slate-300 dark:text-slate-600 uppercase italic mb-1">TOTAL DA MESA</p>
                        <p class="text-xl font-black text-[#e63946] italic leading-none">R$ ${window.fmSeguro(c.total)}</p>
                    </div>
                </div>
                <div class="grid grid-cols-4 gap-2">
                    <button onclick="lancarNaMesa(${c.id})" class="h-16 rounded-2xl bg-white dark:bg-slate-800 border-2 border-slate-100 dark:border-slate-700 flex flex-col justify-center items-center active:scale-95 transition-all text-slate-600 dark:text-slate-300">
                        <span class="text-base mb-1">🛒</span><span class="text-[9px] font-black uppercase italic leading-none">LANÇAR</span>
                    </button>
                    <button onclick="abrirDetalhesComanda(${c.id})" class="h-16 rounded-2xl bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800 flex flex-col justify-center items-center active:scale-95 transition-all text-blue-500">
                        <span class="text-base mb-1">👁️</span><span class="text-[9px] font-black uppercase italic leading-none">VER</span>
                    </button>
                    <button onclick="irParaDivisao(${c.id})" class="h-16 rounded-2xl bg-[#fff7ed] dark:bg-orange-900/20 border border-orange-100 dark:border-orange-800 flex flex-col justify-center items-center active:scale-95 transition-all text-orange-500">
                        <span class="text-base mb-1">÷</span><span class="text-[9px] font-black uppercase italic leading-none">DIVIDIR</span>
                    </button>
                    <button onclick="abrirModalFechamento(${c.id})" class="h-16 rounded-2xl bg-emerald-500 border border-emerald-600 flex flex-col justify-center items-center active:scale-95 transition-all text-white shadow-lg shadow-emerald-200 dark:shadow-emerald-900/20">
                        <span class="text-base mb-1">💲</span><span class="text-[9px] font-black uppercase italic leading-none">PAGAR</span>
                    </button>
                </div>
            </div>`).join('');

    } catch (e) {
        console.error('[COMANDAS] Erro ao carregar mesas:', e);
        cont.innerHTML = `
            <div class="col-span-full py-20 text-center opacity-60">
                <p class="font-black uppercase text-[10px] tracking-widest text-red-400">Erro ao carregar mesas. Verifique a conexão.</p>
                <button onclick="carregarComandas()" class="mt-4 text-[10px] font-black text-slate-400 uppercase underline">Tentar novamente</button>
            </div>`;
    }
};

window.abrirNovaComanda = async function() {
    const inputIdentificacao = document.getElementById('c-identificacao');
    const id = inputIdentificacao.value.toUpperCase().trim();
    
    // ----------------------------------------------------
    // VALIDAÇÃO 1: NOME DA MESA EM BRANCO
    // ----------------------------------------------------
    if (!id) {
        if (typeof showToast === 'function') {
            showToast('INFORME NOME DA MESA/CLIENTE', 'erro');
        } else if (typeof alertaSistema === 'function') {
            alertaSistema('Por favor, informe a identificação da mesa ou do cliente para abrir a comanda.', 'Atenção');
        } else {
            alert('INFORME A MESA');
        }
        return;
    }

    try {
        const { data: mesaExistente } = await _supabase
            .from('comandas').select('id').eq('identificacao', id).eq('status', 'aberta').maybeSingle();

        // ----------------------------------------------------
        // VALIDAÇÃO 2: MESA JÁ EXISTE E ESTÁ ABERTA
        // ----------------------------------------------------
        if (mesaExistente) { 
            if (typeof showToast === 'function') {
                showToast('ESTA MESA JÁ ESTÁ ABERTA!', 'erro');
            } else if (typeof alertaSistema === 'function') {
                alertaSistema(`Já existe uma comanda aberta para "${id}". Verifique a lista de mesas ocupadas.`, 'Mesa Ocupada');
            } else {
                alert('MESA JÁ ABERTA'); 
            }
            return; 
        }

        const { error } = await _supabase.from('comandas').insert([{
            identificacao: id,
            status: 'aberta',
            itens: [],
            total: 0,
            vendedor: localStorage.getItem('userName') || 'Caixa'
        }]);

        if (error) throw error;

        // --- REGISTRO DE AUDITORIA ---
        if (typeof registrarLog === 'function') {
            await registrarLog('SISTEMA', `ABRIU COMANDA: ${id}`);
        }

        inputIdentificacao.value = '';
        carregarComandas();
        alternarAbasComanda('lista');
        if (typeof showToast === 'function') showToast('MESA ABERTA COM SUCESSO!');

    } catch (e) {
        console.error('[COMANDAS] Erro ao abrir mesa:', e);
        // ----------------------------------------------------
        // TRATAMENTO DE ERRO NO CATCH
        // ----------------------------------------------------
        if (typeof showToast === 'function') {
            showToast('ERRO AO ABRIR MESA', 'erro');
        } else if (typeof alertaSistema === 'function') {
            alertaSistema('Ocorreu um erro de comunicação ao tentar abrir a mesa. Verifique a internet e tente novamente.', 'Erro de Conexão');
        }
    }
};

window.alternarAbasComanda = function(a) {
    document.getElementById('aba-lista-comanda')?.classList.toggle('hidden', a !== 'lista');
    document.getElementById('aba-abrir-comanda')?.classList.toggle('hidden', a !== 'abrir');

    const act   = 'flex-1 py-3 rounded-full bg-[#e63946] text-white text-[9px] font-black uppercase italic tracking-widest shadow-sm';
    const inact = 'flex-1 py-3 rounded-full bg-transparent text-slate-400 dark:text-slate-500 text-[9px] font-black uppercase italic tracking-widest';
    const btnL = document.getElementById('btn-comanda-lista');
    const btnA = document.getElementById('btn-comanda-abrir');
    if (btnL) btnL.className = a === 'lista' ? act : inact;
    if (btnA) btnA.className = a === 'abrir'  ? act : inact;
};

/* --- NAVEGAÇÃO: VENDA DIRETA --- */
window.irParaVendaDireta = function() {
    // 1. Limpa a memória da mesa ativa
    sessionStorage.removeItem('comandaAtivaId');
    
    // 2. Redireciona para a tela de vendas "limpa"
    window.location.href = 'venda.html';
};

window.lancarNaMesa = function(id) {
    sessionStorage.setItem('comandaAtivaId', id);
    window.location.href = 'venda.html';
};

window.irParaDivisao = function(id) {
    window.location.href = `divisao.html?id=${id}`;
};

/* --- 3. DETALHES E FECHAMENTO --- */

window.abrirDetalhesComanda = async function(id) {
    try {
        const { data: c, error } = await _supabase.from('comandas').select('*').eq('id', id).single();
        if (error || !c) return;

        // Adicionamos o "idx" no map para saber qual item remover
        const htmlItens = (c.itens || []).map((i, idx) => {
            const isCozinha = window.isItemCozinha(i);
            const isPronto  = i.cozinha_status === 'pronto';
            let badgeStatus = '';

            if (isCozinha) {
                badgeStatus = isPronto
                    ? '<span class="bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 px-1.5 py-0.5 rounded text-[8px] font-black uppercase ml-2 border border-emerald-100">✓ ENTREGUE</span>'
                    : '<span class="bg-orange-50 dark:bg-orange-900/30 text-orange-500 dark:text-orange-400 px-1.5 py-0.5 rounded text-[8px] font-black uppercase ml-2 border border-orange-100">⏳ NA COZINHA</span>';
            } else {
                badgeStatus = '<span class="bg-slate-100 dark:bg-slate-800 text-slate-400 px-1.5 py-0.5 rounded text-[8px] font-black uppercase ml-2 border border-slate-200">S/ PREPARO</span>';
            }

            return `
                <div class="flex justify-between items-center border-b border-slate-100 dark:border-slate-800 pb-2 mb-2 last:border-0 last:mb-0">
                    <div class="flex items-center flex-1">
                        <span class="font-black text-slate-700 dark:text-slate-200 text-[11px] uppercase">${i.qtd}x ${i.nome}</span>
                        ${badgeStatus}
                    </div>
                    <div class="flex items-center gap-3">
                        <span class="font-bold text-slate-400 text-[10px]">R$ ${window.fmSeguro(i.preco * i.qtd)}</span>
                        
                        <button onclick="window.removerItemComanda(${c.id}, ${idx}, '${(i.nome || '').replace(/'/g, "\\'")}')" 
                                class="text-xs opacity-50 hover:opacity-100 hover:text-red-500 transition-all p-1" 
                                title="Remover item">
                            🗑️
                        </button>
                    </div>
                </div>`;
        }).join('');

        document.getElementById('titulo-detalhes-mesa').innerText = `MESA ${c.identificacao}`;
        document.getElementById('lista-itens-detalhes').innerHTML = htmlItens;
        document.getElementById('total-detalhes').innerText = `R$ ${window.fmSeguro(c.total)}`;

        // Reutilizando o motor de impressão para a "PRÉ-CONTA"
        document.getElementById('btn-imprimir-preconta').onclick = () => {
            const dadosPreConta = { ...c, tipo: `PRÉ-CONTA - MESA ${c.identificacao}` };
            if(typeof window.imprimirTicketVenda === 'function') window.imprimirTicketVenda(dadosPreConta);
        };
        
        document.getElementById('btn-add-item-modal').onclick    = () => { fecharDetalhesComanda(); lancarNaMesa(c.id); };
        document.getElementById('btn-pagar-modal-detalhes').onclick = () => { fecharDetalhesComanda(); abrirModalFechamento(c.id); };

        document.getElementById('modal-detalhes-comanda').classList.remove('hidden');
        document.getElementById('modal-detalhes-comanda').classList.add('flex');
    } catch (e) {
        console.error('[COMANDAS] Erro ao abrir detalhes:', e);
        if (typeof showToast === 'function') showToast('ERRO AO CARREGAR DETALHES', 'erro');
    }
};

window.fecharDetalhesComanda = function() {
    document.getElementById('modal-detalhes-comanda')?.classList.add('hidden');
};

window.abrirModalFechamento = async function(id) {
    window.comandaEmFechamentoId = id;
    try {
        const { data: c, error } = await _supabase.from('comandas').select('*').eq('id', id).single();
        if (error || !c) return;

        window.totalFechamentoCache = parseFloat(c.total);
        document.getElementById('total-fechamento').innerText = `R$ ${window.fmSeguro(c.total)}`;
        document.getElementById('titulo-fechamento-mesa').innerText = c.identificacao;

        document.getElementById('lista-itens-fechamento').innerHTML = c.itens.map(i => `
            <div class="flex justify-between py-2 border-b border-slate-100 dark:border-slate-800 text-[10px]">
                <span class="uppercase">${i.qtd}x ${i.nome}</span>
                <span class="font-black">R$ ${window.fmSeguro(parseFloat(i.preco) * i.qtd)}</span>
            </div>`).join('');

        document.getElementById('forma-pagamento-fechamento').value = 'Pix';
        window.handlePagamentoFechamentoChange();

        document.getElementById('modal-fechamento').classList.remove('hidden');
        document.getElementById('modal-fechamento').classList.add('flex');
    } catch (e) {
        if (typeof showToast === 'function') showToast('ERRO AO ABRIR FECHAMENTO', 'erro');
    }
};

window.fecharModalFechamento = function() {
    document.getElementById('modal-fechamento')?.classList.add('hidden');
};

window.handlePagamentoFechamentoChange = function() {
    const forma = document.getElementById('forma-pagamento-fechamento').value;
    const container = document.getElementById('container-recebido-fechamento');
    const btnFinalizar = document.getElementById('btn-confirmar-fechamento');
    
    // Reseta o botão ao trocar de forma de pagamento
    btnFinalizar.disabled = false;
    btnFinalizar.style.opacity = "1";
    btnFinalizar.innerText = "FINALIZAR E FECHAR CONTA";

    if (forma === 'Dinheiro') {
        container.classList.remove('hidden');
        container.classList.add('flex');
        document.getElementById('valor-recebido-fechamento').focus();
    } else {
        container.classList.add('hidden');
        container.classList.remove('flex');
    }
};

window.calcularTrocoFechamento = function() {
    const total = window.totalFechamentoCache || 0;
    const inputRecebido = document.getElementById('valor-recebido-fechamento').value;
    const recebido = parseFloat(inputRecebido.replace(/[^\d,]/g, '').replace(',', '.')) || 0;
    
    const areaInfo = document.getElementById('area-troco-fechamento');
    const labelInfo = areaInfo.querySelector('p:first-child');
    const valorInfo = document.getElementById('valor-troco-fechamento');
    const btnFinalizar = document.getElementById('btn-confirmar-fechamento');

    // Se o campo estiver vazio ou for 0, esconde a área e habilita o botão (previne trava no início)
    if (recebido === 0) {
        areaInfo.classList.add('hidden');
        btnFinalizar.disabled = false;
        btnFinalizar.style.opacity = "1";
        return;
    }

    areaInfo.classList.remove('hidden');

    if (recebido < total) {
        // --- CASO: FALTA DINHEIRO ---
        const falta = total - recebido;
        labelInfo.innerText = "⚠️ VALOR RESTANTE (FALTANDO)";
        valorInfo.innerText = `R$ ${window.fmSeguro(falta)}`;
        
        // Estilo Vermelho (Atenção)
        areaInfo.className = "p-4 rounded-2xl border bg-red-50 border-red-200 dark:bg-red-900/20 dark:border-red-800/50";
        valorInfo.className = "text-2xl font-black text-red-500 text-center";
        labelInfo.className = "text-[9px] font-black text-red-600 dark:text-red-400 uppercase text-center mb-1 tracking-widest";
        
        // Bloqueia o Botão
        btnFinalizar.disabled = true;
        btnFinalizar.style.opacity = "0.5";
        btnFinalizar.innerText = "VALOR INSUFICIENTE";
    } else {
        // --- CASO: VALOR OK OU TROCO ---
        const troco = recebido - total;
        labelInfo.innerText = troco > 0 ? "✅ TROCO A DEVOLVER" : "✅ VALOR EXATO";
        valorInfo.innerText = `R$ ${window.fmSeguro(troco)}`;
        
        // Estilo Verde (Sucesso)
        areaInfo.className = "p-4 rounded-2xl border bg-emerald-50 border-emerald-100 dark:bg-emerald-900/20 dark:border-emerald-800/50";
        valorInfo.className = "text-2xl font-black text-emerald-500 text-center";
        labelInfo.className = "text-[9px] font-black text-emerald-600 dark:text-emerald-400 uppercase text-center mb-1 tracking-widest";
        
        // Libera o Botão
        btnFinalizar.disabled = false;
        btnFinalizar.style.opacity = "1";
        btnFinalizar.innerText = "FINALIZAR E FECHAR CONTA";
    }
};

window.confirmarFechamento = async function() {
    const f = document.getElementById('forma-pagamento-fechamento')?.value;
    const idCaixa = localStorage.getItem('idCaixaAtual');
    const btn = document.getElementById('btn-confirmar-fechamento');

    // --- CAPTURA E LIMPEZA DO TROCO ---
    const inputRecebido = document.getElementById('valor-recebido-fechamento')?.value || '';
    // Converte "10,00" ou "R$ 10,00" em número decimal puro
    const valorRecebido = parseFloat(inputRecebido.replace(/[^\d,]/g, '').replace(',', '.')) || 0;

    try {
        // Desabilita o botão para evitar clique duplo
        if (btn) { btn.disabled = true; btn.innerText = "FECHANDO..."; }

        const { data: c, error } = await _supabase
            .from('comandas').select('*').eq('id', window.comandaEmFechamentoId).single();
        
        if (error || !c) return;

        // Se for dinheiro, calcula o troco real, senão o recebido é o próprio total
        const totalFinal = parseFloat(c.total);
        const recebidoReal = f === 'Dinheiro' && valorRecebido > 0 ? valorRecebido : totalFinal;
        const trocoFinal = recebidoReal > totalFinal ? recebidoReal - totalFinal : 0;

        // 1. Grava no histórico com as colunas de troco
        await _supabase.from('historico_vendas').insert([{
            itens: c.itens,
            total: totalFinal,
            forma_pagamento: f,
            valor_recebido: recebidoReal,
            troco: trocoFinal,
            vendedor: localStorage.getItem('userName') || 'Balcão',
            comanda_id: c.id,
            id_caixa: idCaixa ? parseInt(idCaixa) : null,
            created_at: new Date().toISOString()
        }]);

        // 2. Atualiza o status da comanda
        await _supabase.from('comandas')
            .update({ status: 'fechada', fechada_em: new Date().toISOString() })
            .eq('id', c.id);

        if (typeof window.processarBaixaEstoqueAutomatica === 'function') {
            window.processarBaixaEstoqueAutomatica(c.itens, `MESA ${c.identificacao}`);
        }

        // 3. Registro de Log Profissional
        if (typeof registrarLog === 'function') {
            const valorF = typeof window.fmSeguro === 'function' ? window.fmSeguro(totalFinal) : totalFinal;
            const listaItens = Array.isArray(c.itens) ? c.itens : JSON.parse(c.itens || '[]');
            const resumoItens = listaItens.map(i => `${i.qtd}x ${i.nome}`).join(', ');
            const detalhesComanda = `MESA: ${c.identificacao.toUpperCase()} | TOTAL: R$ ${valorF} | PGTO: ${f.toUpperCase()} | ITENS: ${resumoItens}`;
            await registrarLog('VENDA', 'FECHAMENTO COMANDA', detalhesComanda);
        }

        if (typeof showToast === 'function') showToast('MESA FINALIZADA!', 'sucesso');
        window.fecharModalFechamento();
        if (typeof carregarComandas === 'function') carregarComandas();

        // =======================================================
        // LÓGICA DE IMPRESSÃO: PASSANDO DADOS DE TROCO
        // =======================================================
        const totalF = typeof window.fmSeguro === 'function' ? window.fmSeguro(totalFinal) : totalFinal;
        
        // Dados globais que o print.js vai ler
        window.dadosComprovanteAtual = {
            tipo: `COMPROVANTE - MESA ${c.identificacao}`,
            total: totalFinal,
            pagamento: f,
            recebido: recebidoReal, // Novo campo para o ticket
            troco: trocoFinal,       // Novo campo para o ticket
            itens: c.itens
        };

        const modalImpressao = document.getElementById('modal-confirmacao-impressao');
        if (modalImpressao) {
            const pText = document.getElementById('texto-modal-impressao');
            if (pText) {
                pText.innerText = `Deseja IMPRIMIR o comprovante de R$ ${totalF}?`;
            }
            modalImpressao.classList.remove('hidden');
            modalImpressao.classList.add('flex');
        }

    } catch (e) {
        console.error('[COMANDAS] Erro ao fechar mesa:', e);
        if (typeof showToast === 'function') showToast('ERRO AO FECHAR MESA', 'erro');
    } finally {
        if (btn) { btn.disabled = false; btn.innerText = "FINALIZAR E FECHAR CONTA"; }
    }
};

/* --- 4. LANÇAMENTO COM CONTROLE INDIVIDUAL POR ITEM --- */

window.toggleCozinhaItemCarrinho = function(index) {
    const item = window.carrinho[index];
    if (!item) return;
    item.cozinha_status = (item.cozinha_status === 'em_preparo') ? 'cancelado_preparo' : 'em_preparo';
    window.abrirConfirmacaoComanda(sessionStorage.getItem('comandaAtivaId'));
};

window.abrirConfirmacaoComanda = async function(id) {
    try {
        const { data: c } = await _supabase.from('comandas').select('*').eq('id', id).single();
        if (!c) return;

        document.getElementById('titulo-confirmacao-mesa').innerText = c.identificacao;

        document.getElementById('itens-confirmacao-comanda').innerHTML = window.carrinho.map((i, idx) => {
            const vaiPraCozinha = window.isItemCozinha(i);
            if (vaiPraCozinha && !i.cozinha_status) i.cozinha_status = 'em_preparo';

            let controleHtml = '';
            if (vaiPraCozinha) {
                const isAtivo = i.cozinha_status === 'em_preparo';
                controleHtml = `
                    <div class="flex items-center gap-2">
                        <span class="text-[7px] font-black ${isAtivo ? 'text-orange-500' : 'text-slate-400'} uppercase">${isAtivo ? 'P/ BRASA' : 'NÃO MANDAR'}</span>
                        <label class="relative inline-flex items-center cursor-pointer scale-90">
                            <input type="checkbox" class="sr-only peer" ${isAtivo ? 'checked' : ''} onchange="window.toggleCozinhaItemCarrinho(${idx})">
                            <div class="w-8 h-4 bg-slate-200 dark:bg-slate-700 rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-orange-500"></div>
                        </label>
                    </div>`;
            } else {
                controleHtml = `<span class="text-[7px] font-black text-slate-300 dark:text-slate-600 uppercase italic">📦 ENTREGA DIRETA</span>`;
            }

            return `
            <div class="flex justify-between items-center p-3 border-b border-slate-100 dark:border-slate-800 last:border-0">
                <div class="flex-1 pr-2">
                    <span class="text-[11px] font-black uppercase text-slate-700 dark:text-slate-200 block">${i.qtd}x ${i.nome}</span>
                    <span class="text-[9px] font-bold text-slate-400 block mt-0.5">R$ ${window.fmSeguro(i.preco * i.qtd)}</span>
                </div>
                ${controleHtml}
            </div>`;
        }).join('');

        const switchGlobal = document.getElementById('container-switch-cozinha-global');
        if (switchGlobal) switchGlobal.style.display = 'none';

        document.getElementById('modal-confirmacao-comanda')?.classList.remove('hidden');
        document.getElementById('modal-confirmacao-comanda')?.classList.add('flex');
    } catch (e) {
        console.error('[COMANDAS] Erro ao abrir confirmação:', e);
    }
};
window.concluirLancamentoComanda = async function() {
    if (!window.carrinho || window.carrinho.length === 0) return;
    
    try {
        await window.gravarPedidoComanda();
        // SÓ PASSA PARA CÁ SE GRAVOU COM SUCESSO
        document.getElementById('modal-confirmacao-comanda')?.classList.add('hidden');
        window.carrinho = [];
        window.location.href = 'comandas.html'; 
    } catch (e) {
        // SE DEU ERRO, ELE PARA AQUI E A TELA NÃO MUDA!
        console.error("Redirecionamento cancelado devido a erro:", e);
    }
};

window.concluirLancamentoComanda = async function() {
    if (!window.carrinho || window.carrinho.length === 0) return;
    
    try {
        await window.gravarPedidoComanda();
        // SÓ VAI REDIRECIONAR SE A FUNÇÃO ACIMA DER 100% CERTO!
        document.getElementById('modal-confirmacao-comanda')?.classList.add('hidden');
        window.carrinho = [];
        window.location.href = 'comandas.html';
    } catch (e) {
        // SE DER ERRO, ELE PARA AQUI E NÃO MUDA DE TELA!
        console.error("Redirecionamento bloqueado por falha:", e);
    }
};};

/* --- 5. IMPRESSÃO INTEGRADA AO MOTOR PRINCIPAL --- */

window.confirmarImpressaoAction = function() {
    const modal = document.getElementById('modal-confirmacao-impressao');
    if (modal) modal.classList.add('hidden');

    if (window.ultimaVendaParaImpressao) {
        if (typeof window.imprimirCupom === 'function') {
            window.imprimirCupom(window.ultimaVendaParaImpressao);
        } else {
            console.error("Motor 'imprimirCupom' não encontrado no print.js");
            if (typeof showToast === 'function') showToast("ERRO: MOTOR DE IMPRESSÃO INATIVO", "erro");
        }
    }
};

window.fecharModalImpressao = function() {
    const modal = document.getElementById('modal-confirmacao-impressao');
    if (modal) { modal.classList.add('hidden'); modal.classList.remove('flex'); }
    window.dadosComandaImpressao = null;
    window.ultimaVendaParaImpressao = null;
};

// Inicializa a tela de comandas se for a página correta
if (document.getElementById('comandas-page')) {
    window.carregarComandas();
}

// Variáveis temporárias para controle
let itemParaRemoverData = null;

/* --- MÓDULO CIRÚRGICO: EXCLUSÃO DE ITEM COM MODAL PREMIUM --- */

window.removerItemComanda = function(idComanda, indexItem, nomeItem) {
    // Apenas a ponte para chamar o modal premium com o nome limpo
    window.abrirModalExcluirItem(idComanda, indexItem, nomeItem || 'este item');
};

window.abrirModalExcluirItem = function(idComanda, indexItem, nomeItem) {
    itemParaRemoverData = { idComanda, indexItem };
    
    // Injeta o HTML formatado com o "✓" no modal
    const msgElemento = document.getElementById('msg-excluir');
    if (msgElemento) {
        msgElemento.innerHTML = `Deseja remover <br><b class="text-[#e63946]">✓ ${nomeItem.toUpperCase()}</b><br> da comanda?`;
    }
    
    const modal = document.getElementById('modal-excluir');
    if (modal) {
        modal.classList.remove('hidden');
        modal.classList.add('flex');
    }
    
    // Configura o clique do botão
    document.getElementById('btn-confirmar-exclusao').onclick = async () => {
        const btn = document.getElementById('btn-confirmar-exclusao');
        if (btn) {
            btn.disabled = true;
            btn.innerText = "EXCLUINDO...";
        }
        await window.executarRemocaoItem();
        if (btn) {
            btn.disabled = false;
            btn.innerText = "CONFIRMAR EXCLUSÃO";
        }
    };
};

window.fecharModalExcluir = function() {
    const modal = document.getElementById('modal-excluir');
    if (modal) {
        modal.classList.add('hidden');
        modal.classList.remove('flex');
    }
    itemParaRemoverData = null;
};

window.executarRemocaoItem = async function() {
    if (!itemParaRemoverData) return;
    const { idComanda, indexItem } = itemParaRemoverData;

    try {
        const { data: c } = await _supabase.from('comandas').select('*').eq('id', idComanda).single();
        if (!c) return;

        const itemRemovido = c.itens[indexItem];
        const novosItens = c.itens.filter((_, idx) => idx !== indexItem);
        const novoTotal = novosItens.reduce((acc, i) => acc + (parseFloat(i.preco) * i.qtd), 0);

        const { error } = await _supabase.from('comandas').update({ 
            itens: novosItens, 
            total: novoTotal,
            updated_at: new Date().toISOString() 
        }).eq('id', idComanda);

        if (error) throw error;

        if (typeof registrarLog === 'function') {
            await registrarLog('SISTEMA', `REMOVEU ITEM DA MESA ${c.identificacao}: ${itemRemovido.qtd}x ${itemRemovido.nome}`);
        }

        if (typeof showToast === 'function') showToast('ITEM REMOVIDO!', 'sucesso');
        window.fecharModalExcluir();
        
        // Atualiza a tela e recarrega os detalhes para o novo total aparecer
        if(typeof carregarComandas === 'function') carregarComandas();
        window.abrirDetalhesComanda(idComanda);

    } catch (e) {
        console.error('Erro ao remover:', e);
        if (typeof showToast === 'function') showToast('ERRO AO REMOVER', 'erro');
    }
};

/* --- MÓDULO: FECHAMENTO DE CONTA --- */

window.abrirModalPagamento = function(idComanda, valorTotal, identificacao) {
    document.getElementById('total-pagamento').innerText = `R$ ${valorTotal.toFixed(2).replace('.', ',')}`;
    document.getElementById('modal-pagamento').classList.remove('hidden');

    document.getElementById('btn-confirmar-pagamento').onclick = async () => {
        const forma = document.getElementById('forma-pagamento').value;
        await window.executarPagamento(idComanda, valorTotal, forma, identificacao);
    };
};

window.fecharModalPagamento = function() {
    document.getElementById('modal-pagamento').classList.add('hidden');
};

window.executarPagamento = async function(idComanda, total, forma, identificacao) {
    try {
        const { error } = await _supabase.from('comandas').update({ 
            status: 'pago',
            forma_pagamento: forma,
            pago_em: new Date().toISOString()
        }).eq('id', idComanda);

        if (error) throw error;

        if (typeof registrarLog === 'function') {
            await registrarLog('FINANCEIRO', `RECEBEU R$ ${total.toFixed(2)} (${forma.toUpperCase()}) DA MESA ${identificacao}`);
        }

        if (typeof showToast === 'function') showToast('PAGAMENTO REALIZADO!', 'sucesso');
        window.fecharModalPagamento();
        
        setTimeout(() => { window.location.href = 'index.html'; }, 1000);

    } catch (e) {
        if (typeof showToast === 'function') showToast('ERRO NO PAGAMENTO', 'erro');
    }
};

/* --- CONTROLE DO MODAL DE IMPRESSÃO --- */
window.fecharModalImpressao = function() {
    const modal = document.getElementById('modal-confirmacao-impressao');
    if (modal) {
        modal.classList.add('hidden');
        modal.classList.remove('flex');
    }
    window.dadosComprovanteAtual = null; // Limpa a memória
};

window.confirmarImpressaoComprovante = function() {
    // Se o usuário clicar em "SIM", manda imprimir os dados que salvamos e fecha
    if (window.dadosComprovanteAtual && typeof window.imprimirTicketVenda === 'function') {
        window.imprimirTicketVenda(window.dadosComprovanteAtual);
    }
    window.fecharModalImpressao();
};
