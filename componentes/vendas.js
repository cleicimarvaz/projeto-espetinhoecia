/* =================================================================================
   MÓDULO DE VENDAS E CARRINHO - INTELIGENTE (BALCÃO & COMANDA)
   ================================================================================= */

window.carrinho = window.carrinho || [];
window.produtosCache = []; 

/* --- 0. CARREGAMENTO INICIAL DO CATÁLOGO --- */
window.carregarCatalogoVendas = async function() {
    if (typeof _supabase === 'undefined') return;
    
    // Verifica se está lançando em uma comanda para mudar o título da tela
    const mesaId = sessionStorage.getItem('comandaAtivaId');
    if (mesaId) {
        const title = document.querySelector('header h1');
        // A MÁGICA AQUI: Puxa o nome real ("Mesa 06") em vez do ID ("49")
        _supabase.from('comandas').select('identificacao').eq('id', mesaId).single()
            .then(({data}) => {
                if (data && title) title.innerHTML = `${data.identificacao} <br>ESPETINHO & CIA`;
            });
    }

    try {
        const { data: pds, error } = await _supabase.from('produtos').select('*').eq('status', true).order('nome');
        if (error) throw error;
        window.produtosCache = pds || [];
        renderizarVenda();
    } catch (e) {
        console.error("Erro ao carregar catálogo:", e);
        const cont = document.getElementById('lista-venda');
        if (cont) cont.innerHTML = '<p class="col-span-2 text-center text-red-500 font-bold py-10">Erro ao carregar produtos. Verifique sua conexão.</p>';
    }
}

/* --- 1. VITRINE --- */
window.renderizarVenda = function() {
    const cont = document.getElementById('lista-venda');
    if (!cont) return;
    
    if (window.produtosCache.length === 0) {
        cont.innerHTML = '<p class="col-span-2 text-center text-slate-400 font-bold py-10 text-[10px] uppercase">Nenhum produto cadastrado.</p>';
        return;
    }

    const icons = { 'espetos': '🍢', 'cervejas': '🍺', 'bebidas': '🥤', 'refeicao': '🍽️', 'acompanhamentos': '🍚' };
    
    cont.innerHTML = window.produtosCache.map(p => {
        const itemNoCarrinho = window.carrinho.find(c => c.id === p.id);
        const qtd = itemNoCarrinho ? itemNoCarrinho.qtd : 0;
        return `
            <button onclick="adicionarAoCarrinho(${p.id})" class="relative bg-white dark:bg-slate-900 p-4 rounded-3xl shadow-sm flex flex-col items-center border-2 ${qtd > 0 ? 'border-emerald-400' : 'border-white dark:border-slate-800'} active:scale-95 transition-all">
                <span class="text-3xl mb-1">${icons[p.categoria] || '📦'}</span>
                <h4 class="font-black text-[10px] uppercase italic text-center text-slate-800 dark:text-slate-200">${p.nome}</h4>
                <span class="text-[9px] font-bold text-red-500">R$ ${typeof formatarMoeda === 'function' ? formatarMoeda(p.preco) : parseFloat(p.preco).toFixed(2)}</span>
                ${qtd > 0 ? `<span class="absolute -top-2 -right-2 bg-emerald-500 text-white text-[9px] w-6 h-6 rounded-full flex items-center justify-center font-black shadow-md">${qtd}</span>
                <div onclick="event.stopPropagation(); removerDoCarrinho(${p.id})" class="absolute -bottom-2 -right-2 bg-red-500 text-white w-8 h-8 rounded-full flex items-center justify-center font-black text-xs border-2 border-white shadow-md active:scale-90 transition-transform">-</div>` : ''}
            </button>`;
    }).join('');
    
    atualizarFAB();
}

/* --- 2. CARRINHO --- */
window.adicionarAoCarrinho = function(id) {
    const p = window.produtosCache.find(prod => prod.id === id);
    if (!p) return;
    
    const item = window.carrinho.find(i => i.id === id);
    if (item) {
        item.qtd++;
    } else {
        const statusCozinha = p.precisa_preparo === false ? 'pronto' : null;
        window.carrinho.push({ ...p, qtd: 1, cozinha_status: statusCozinha });
    }
    renderizarVenda();
}

window.removerDoCarrinho = function(id) {
    const item = window.carrinho.find(i => i.id === id);
    if (item) {
        if (item.qtd > 1) item.qtd--;
        else window.carrinho = window.carrinho.filter(i => i.id !== id);
        renderizarVenda();
    }
}

window.atualizarFAB = function() {
    const fab = document.getElementById('fab-finalizar');
    if (!fab) return;

    const totalItens = window.carrinho.reduce((a, i) => a + i.qtd, 0);
    fab.classList.toggle('hidden', window.carrinho.length === 0);

    const countEl = document.getElementById('fab-count');
    if (countEl) countEl.innerText = `${totalItens} ITEM${totalItens !== 1 ? 'S' : ''}`;

    const btnTexto = document.getElementById('btn-finalizar-texto');
    if (btnTexto) {
        // DECISÃO INTELIGENTE: É comanda ou venda balcão?
        const mesaId = sessionStorage.getItem('comandaAtivaId');
        btnTexto.innerText = mesaId ? 'LANÇAR NA MESA' : 'FINALIZAR VENDA';
    }
}

/* --- 3. FLUXO INTELIGENTE (ENCAMINHA PARA BALCÃO OU COMANDA) --- */
window.abrirResumoPedido = function() {
    const mesaId = sessionStorage.getItem('comandaAtivaId');
    
    if (mesaId) {
        // Se for comanda, abre o modal de lançar itens
        window.abrirConfirmacaoComandaVenda(mesaId);
    } else {
        // VENDA DIRETA (BALCÃO)
        
        // ============================================================
        // CORREÇÃO: Limpa o input de dinheiro e reseta os alertas de troco
        // ============================================================
        const inputRecebido = document.getElementById('valor-recebido');
        if (inputRecebido) {
            inputRecebido.value = ''; // Deixa o campo totalmente limpo para a nova digitação
        }
        
        const trocoContainer = document.getElementById('valor-troco-container');
        if (trocoContainer) {
            trocoContainer.classList.add('hidden'); // Esconde o painel de troco antigo
        }
        
        const sessaoTroco = document.getElementById('sessao-troco');
        if (sessaoTroco) {
            sessaoTroco.classList.add('hidden'); // Esconde a gaveta até que escolham "Dinheiro" de novo
        }
        // ============================================================

        const modalContainer = document.getElementById('itens-carrinho-modal');
        if (modalContainer) {
            modalContainer.innerHTML = window.carrinho.map(i => `
                <div class="flex justify-between items-center p-3 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-100 dark:border-slate-700 mb-2">
                    <span class="text-[11px] font-black uppercase">${i.qtd}x ${i.nome}</span>
                    <span class="text-[10px] font-bold text-slate-400">R$ ${typeof formatarMoeda === 'function' ? formatarMoeda(i.preco * i.qtd) : (i.preco * i.qtd).toFixed(2)}</span>
                </div>`).join('');
        }

        const totalEl = document.getElementById('total-modal');
        if (totalEl) {
            const total = window.carrinho.reduce((a, i) => a + (i.preco * i.qtd), 0);
            totalEl.innerText = `R$ ${typeof formatarMoeda === 'function' ? formatarMoeda(total) : total.toFixed(2)}`;
        }

        const modal = document.getElementById('modal-resumo');
        if (modal) {
            modal.classList.remove('hidden');
            modal.classList.add('flex');
        }
    }
}

window.fecharResumoPedido = function() {
    const modal = document.getElementById('modal-resumo');
    if (modal) modal.classList.add('hidden');
}

/* --- 4. EXCLUSIVO VENDA BALCÃO (PAGAMENTO E IMPRESSÃO) --- */
window.confirmarVenda = async function() {
    const subtotal = window.carrinho.reduce((a, i) => a + (i.preco * i.qtd), 0);
    const pag = document.getElementById('forma-pagamento')?.value;
    const idCaixa = localStorage.getItem('idCaixaAtual');

    if (!pag) {
        // Agora usamos o Toast ou o nosso novo Alerta Padronizado
        if (typeof showToast === 'function') {
            showToast('SELECIONE A FORMA DE PAGAMENTO', 'erro');
        } else if (typeof alertaSistema === 'function') {
            alertaSistema('Por favor, selecione a forma de pagamento antes de confirmar.', 'Atenção');
        }
        return;
    }

    try {
        const dadosEnvio = {
            itens: [...window.carrinho],
            total: subtotal,
            forma_pagamento: pag,
            vendedor: localStorage.getItem('userName') || 'SISTEMA',
            id_caixa: idCaixa ? parseInt(idCaixa) : null,
            created_at: new Date().toISOString()
        };

        const dadosBanco = { ...dadosEnvio, itens: JSON.stringify(dadosEnvio.itens) };

        const { data, error } = await _supabase.from('historico_vendas').insert([dadosBanco]).select();
        if (error) throw error;

        if (typeof window.processarBaixaEstoqueAutomatica === 'function') {
            await window.processarBaixaEstoqueAutomatica(window.carrinho, 'VENDA BALCÃO');
        }

        // ============================================================
        // TRECHO CORRIGIDO PARA LOG DETALHADO (3 ARGUMENTOS)
        // ============================================================
        if (typeof registrarLog === 'function') {
            const valorF = typeof formatarMoeda === 'function' ? formatarMoeda(subtotal) : subtotal.toFixed(2);
            
            // Montamos a lista de itens para o log: "2x Coca, 1x Espeto"
            const listaItensLog = window.carrinho.map(i => `${i.qtd}x ${i.nome}`).join(', ');
            
            // Montamos a string de descrição completa
            const detalhesBalcao = `VALOR: R$ ${valorF} | PGTO: ${pag.toUpperCase()} | ITENS: ${listaItensLog}`;
            
            // Enviamos os 3 parâmetros: TIPO, AÇÃO, DESCRIÇÃO
            await registrarLog('VENDA', 'VENDA BALCÃO', detalhesBalcao);
        }
        // ============================================================

        window.ultimaVendaParaImpressao = dadosEnvio;
        fecharResumoPedido();
        window.carrinho = []; 
        renderizarVenda();

        const modalImpressao = document.getElementById('modal-confirmacao-impressao');
        if (modalImpressao) {
            modalImpressao.classList.remove('hidden');
            modalImpressao.classList.add('flex');
        }

    } catch (e) {
        console.error('[VENDA] Erro:', e);
        if (typeof showToast === 'function') {
            showToast('ERRO AO REGISTRAR VENDA', 'erro');
        } else if (typeof alertaSistema === 'function') {
            alertaSistema('Ocorreu um erro ao registrar a venda no banco de dados.', 'Erro de Conexão');
        }
    }
}

window.handlePagamentoChange = function() {
    const sessao = document.getElementById('sessao-troco');
    const forma = document.getElementById('forma-pagamento')?.value || '';
    if (sessao) {
        if (forma.toUpperCase() === 'DINHEIRO') {
            sessao.classList.remove('hidden');
            window.calcularTroco();
        } else {
            sessao.classList.add('hidden');
        }
    }
}

window.calcularTroco = function() {
    const total = window.carrinho.reduce((a, i) => a + (i.preco * i.qtd), 0);
    let recebidoTexto = document.getElementById('valor-recebido')?.value || '0';
    let recebido = 0;
    
    if (typeof convMoedaFloat === 'function') {
        recebido = convMoedaFloat(recebidoTexto);
    } else {
        recebidoTexto = recebidoTexto.replace('R$', '').replace(/\./g, '').replace(',', '.').trim();
        recebido = parseFloat(recebidoTexto) || 0;
    }
    
    const trocoContainer = document.getElementById('valor-troco-container');
    const trocoEl = document.getElementById('valor-troco');

    if (!trocoContainer || !trocoEl) return;

    if (recebido > 0) {
        trocoContainer.classList.remove('hidden');
        if (recebido >= total) {
            const troco = recebido - total;
            const valorFormatado = typeof formatarMoeda === 'function' ? formatarMoeda(troco) : troco.toFixed(2);
            trocoEl.innerHTML = `<span class="text-slate-400 text-[10px] uppercase mr-1">Troco:</span> R$ ${valorFormatado}`;
            trocoEl.className = "text-emerald-500 font-black text-lg text-right w-full block"; 
        } else {
            const falta = total - recebido;
            const valorFormatado = typeof formatarMoeda === 'function' ? formatarMoeda(falta) : falta.toFixed(2);
            trocoEl.innerHTML = `<span class="text-slate-400 text-[10px] uppercase mr-1">Faltam:</span> R$ ${valorFormatado}`;
            trocoEl.className = "text-red-500 font-black text-lg text-right w-full block";
        }
    } else {
        trocoContainer.classList.add('hidden');
    }
}

/* --- 5. EXCLUSIVO COMANDAS (Lançamento na tela de vendas) --- */
window.abrirConfirmacaoComandaVenda = async function(mesaId) { // <-- Adicionei o 'async' aqui
    const labelMesa = document.getElementById('label-mesa-confirmacao');
    const modal = document.getElementById('modal-confirmacao-comanda');

    if (!modal) return;

    if (labelMesa) {
        labelMesa.innerText = "CARREGANDO DADOS..."; // Feedback visual rápido
        // Busca o nome correto no banco para o modal
        const { data } = await _supabase.from('comandas').select('identificacao').eq('id', mesaId).single();
        labelMesa.innerText = `MESA / CLIENTE: ${data ? data.identificacao : mesaId}`;
    }
    
    // 1. Inicializa a quantidade que vai pra cozinha
    window.carrinho.forEach(i => {
        if (typeof window.isItemCozinha === 'function' && window.isItemCozinha(i)) {
            // Por padrão, toda a quantidade vendida vai pra cozinha
            if (i.qtd_cozinha === undefined) i.qtd_cozinha = i.qtd; 
        } else {
            i.qtd_cozinha = 0; // Bebidas não vão
        }
    });

    // 2. Renderiza os itens com os botões +/-
    window.renderizarItensConfirmacaoComanda();

    modal.classList.remove('hidden');
    modal.classList.add('flex');
}

window.renderizarItensConfirmacaoComanda = function() {
    const container = document.getElementById('lista-itens-confirmacao');
    if (!container) return;

    container.innerHTML = window.carrinho.map((i, idx) => {
        const vaiPraCozinha = typeof window.isItemCozinha === 'function' ? window.isItemCozinha(i) : false;
        let controleCozinha = '';

        if (vaiPraCozinha) {
            // Cria os botões de controle de quantidade para a cozinha
            controleCozinha = `
                <div class="flex items-center gap-2 mt-1.5 bg-orange-50 dark:bg-orange-900/20 p-1.5 rounded-lg border border-orange-100 dark:border-orange-800 w-fit">
                    <span class="text-[8px] font-black text-orange-600 uppercase leading-none">P/ COZINHA:</span>
                    <button onclick="alterarQtdCozinhaModal(${idx}, -1)" class="w-6 h-6 bg-white dark:bg-slate-800 rounded shadow-sm text-orange-500 font-black text-sm flex items-center justify-center active:scale-90 border border-slate-100 dark:border-slate-700">-</button>
                    <span class="font-black text-[12px] w-5 text-center text-slate-700 dark:text-slate-200">${i.qtd_cozinha}</span>
                    <button onclick="alterarQtdCozinhaModal(${idx}, 1)" class="w-6 h-6 bg-white dark:bg-slate-800 rounded shadow-sm text-orange-500 font-black text-sm flex items-center justify-center active:scale-90 border border-slate-100 dark:border-slate-700">+</button>
                </div>
            `;
        } else {
            controleCozinha = `<span class="text-[8px] font-black text-slate-400 uppercase italic mt-1 block">📦 Entrega Direta (Pronto/Bebida)</span>`;
        }

        return `
        <div class="py-3 border-b border-slate-100 dark:border-slate-800 last:border-0 flex justify-between items-start">
            <div>
                <span class="text-[11px] font-black uppercase text-slate-700 dark:text-slate-200 block">${i.qtd}x ${i.nome}</span>
                ${controleCozinha}
            </div>
            <span class="text-[10px] font-bold text-slate-400 mt-0.5">R$ ${typeof window.fmSeguro === 'function' ? window.fmSeguro(i.preco * i.qtd) : (i.preco * i.qtd).toFixed(2)}</span>
        </div>`;
    }).join('');
}

window.alterarQtdCozinhaModal = function(index, delta) {
    const item = window.carrinho[index];
    if (!item) return;

    let novaQtd = item.qtd_cozinha + delta;
    if (novaQtd < 0) novaQtd = 0;
    if (novaQtd > item.qtd) novaQtd = item.qtd; // Bloqueio: não deixa mandar pra cozinha mais do que o cliente pediu

    item.qtd_cozinha = novaQtd;
    window.renderizarItensConfirmacaoComanda();
}

window.finalizarPedidoComandaVenda = async function() {
    // 1. Lê o Switch Global da interface
    const enviarCozinhaGlobal = document.getElementById('check-enviar-cozinha')?.checked ?? true;

    // A MÁGICA: Dividir os itens antes de salvar!
    let carrinhoProcessado = [];

    window.carrinho.forEach(item => {
        const vaiPraCozinha = typeof window.isItemCozinha === 'function' ? window.isItemCozinha(item) : false;

        if (vaiPraCozinha) {
            const qtdCozinha = enviarCozinhaGlobal ? (item.qtd_cozinha !== undefined ? item.qtd_cozinha : item.qtd) : 0;
            const qtdDireta = item.qtd - qtdCozinha;

            if (qtdCozinha > 0) {
                const copiaCozinha = { ...item, qtd: qtdCozinha, cozinha_status: 'em_preparo' };
                delete copiaCozinha.qtd_cozinha; 
                carrinhoProcessado.push(copiaCozinha);
            }

            if (qtdDireta > 0) {
                const copiaDireta = { ...item, qtd: qtdDireta, cozinha_status: 'pronto' };
                delete copiaDireta.qtd_cozinha;
                carrinhoProcessado.push(copiaDireta);
            }
        } else {
            const copiaNormal = { ...item, cozinha_status: 'pronto' };
            delete copiaNormal.qtd_cozinha;
            carrinhoProcessado.push(copiaNormal);
        }
    });

    window.carrinho = carrinhoProcessado;

    // Chama a função de gravação oficial
    if (typeof window.gravarPedidoComanda === 'function') {
        await window.gravarPedidoComanda(); 
        
        // ============================================================
        // A SOLUÇÃO ESTÁ AQUI:
        // Remove o ID da mesa da memória após o sucesso no banco
        // ============================================================
        sessionStorage.removeItem('comandaAtivaId'); 
        // ============================================================

        window.fecharConfirmacaoComandaVenda();
        window.carrinho = [];
        window.location.href = 'comandas.html';
    }
}

window.fecharConfirmacaoComandaVenda = function() {
    document.getElementById('modal-confirmacao-comanda')?.classList.add('hidden');
}

window.voltarDaVenda = function() {
    window.carrinho = [];
    if (sessionStorage.getItem('comandaAtivaId')) {
        sessionStorage.removeItem('comandaAtivaId');
        window.location.href = 'comandas.html';
    } else {
        window.location.href = 'home.html';
    }
}

document.addEventListener('DOMContentLoaded', () => {
    if (window.location.pathname.includes('venda.html')) {
        window.carregarCatalogoVendas();
    }
});

window.estornarVenda = function(idVenda) {
    const mensagem = `Tem certeza que deseja cancelar a venda #${idVenda}? A venda ficará permanentemente marcada como cancelada no histórico.`;
    const titulo = "CANCELAR VENDA";

    // 1. Isolamos a lógica de estorno no callback assíncrono
    const acaoCancelar = async () => {
        try {
            if (typeof setLoading === 'function') setLoading('btn-estorno-' + idVenda, true);

            // 2. Buscar os dados da venda ANTES de atualizar para o Log ser completo
            const { data: venda, error: errBusca } = await _supabase
                .from('historico_vendas')
                .select('total, forma_pagamento, itens')
                .eq('id', idVenda)
                .single();

            if (errBusca) throw new Error("Venda não encontrada.");

            // 3. Atualizar o status no Banco de Dados (Exclusão Lógica)
            const { error: errUpdate } = await _supabase
                .from('historico_vendas')
                .update({ status: 'cancelada' }) 
                .eq('id', idVenda);

            if (errUpdate) throw errUpdate;

            // 4. --- REGISTRO DE AUDITORIA CRÍTICO (CORRIGIDO PARA 3 ARGUMENTOS) ---
            if (typeof registrarLog === 'function') {
                const valorF = typeof formatarMoeda === 'function' ? formatarMoeda(venda.total) : venda.total;
                await registrarLog(
                    'SEGURANÇA', 
                    'ESTORNO DE VENDA', 
                    `🚨 CANCELAMENTO DA VENDA #${idVenda} | VALOR: R$ ${valorF} | PGTO: ${venda.forma_pagamento.toUpperCase()}`
                );
            }

            if (typeof showToast === 'function') showToast('VENDA CANCELADA COM SUCESSO!', 'sucesso');
            
            // 5. Recarregar a lista (ajuste o nome da sua função de carregar histórico aqui)
            if (typeof carregarHistoricoVendas === 'function') carregarHistoricoVendas();

        } catch (e) {
            console.error('❌ [ESTORNO] Erro:', e);
            
            // Tratamento de erro padronizado
            if (typeof showToast === 'function') {
                showToast('ERRO AO CANCELAR VENDA', 'erro');
            } else if (typeof alertaSistema === 'function') {
                alertaSistema("Não foi possível registrar o cancelamento da venda no banco de dados. Verifique sua conexão.", "Erro");
            }
        } finally {
            if (typeof setLoading === 'function') setLoading('btn-estorno-' + idVenda, false);
        }
    };

    // 2. Chamamos o novo Modal de Confirmação (com o confirm nativo como fallback)
    if (typeof confirmarAcao === 'function') {
        confirmarAcao(mensagem, acaoCancelar, titulo);
    } else {
        if (confirm(mensagem)) {
            acaoCancelar();
        }
    }
}

/* =================================================================================
   ROTINA DE PRODUÇÃO: MOTOR DE IMPRESSÃO INTEGRADO COM SELEÇÃO DO PAINEL
   ================================================================================= */
if (typeof window.executarImpressaoVendaBalcao !== 'function') {
    window.executarImpressaoVendaBalcao = function() {
        try {
            const dadosVenda = window.ultimaVendaParaImpressao;
            
            if (!dadosVenda) {
                console.warn("[IMPRESSÃO] Cache de venda vazio.");
                if (typeof window.fecharModalImpressao === 'function') window.fecharModalImpressao();
                return;
            }

            // 1. Compatibilidade de Atributo: O seu print.js exige "pagamento" no objeto da venda
            if (dadosVenda && !dadosVenda.pagamento && dadosVenda.forma_pagamento) {
                dadosVenda.pagamento = dadosVenda.forma_pagamento;
            }

            // 2. Lê exatamente a chave que o seu print.js usa internamente
            const modoConfigurado = (localStorage.getItem('modoImpressao') || 'pdf').toLowerCase();

            // 3. Roteamento baseado na escolha do seu painel de configurações
            if (modoConfigurado === 'direto') {
                // Modo Térmico / RawBT Oficial do seu print.js
                if (typeof window.imprimirTicketVenda === 'function') {
                    window.imprimirTicketVenda(dadosVenda);
                } else {
                    console.error("[IMPRESSÃO] Erro: Função imprimirTicketVenda não localizada.");
                }
            } else {
                // Modo PDF / Abrir em Tela Oficial do seu print.js
                if (typeof window.gerarTicketHTML === 'function') {
                    window.gerarTicketHTML(dadosVenda, localStorage.getItem('nomeLoja') || 'ESPETINHO & CIA');
                } else if (typeof window.imprimirCupom === 'function') {
                    window.imprimirCupom(dadosVenda);
                } else {
                    console.error("[IMPRESSÃO] Erro: Nenhum motor HTML/PDF localizado.");
                }
            }

        } catch (error) {
            console.error("[CRÍTICO - EXECUÇÃO IMPRESSÃO BALCÃO]:", error);
        } finally {
            // Garante o fechamento e libera a tela para a próxima venda do espetinho
            if (typeof window.fecharModalImpressao === 'function') {
                window.fecharModalImpressao();
            }
        }
    };
}
