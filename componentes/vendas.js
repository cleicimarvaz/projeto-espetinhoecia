/* =================================================================================
   MÓDULO DE VENDAS E CARRINHO - INTELIGENTE (BALCÃO & COMANDA)
   ================================================================================= */

window.carrinho = window.carrinho || [];
window.produtosCache = []; 
window.complementosCache = []; // Variável global para guardar os itens em memória

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
        // 1. CARREGA OS PRODUTOS
        const { data: pds, error } = await _supabase.from('produtos').select('*').eq('status', true).order('nome');
        if (error) throw error;
        window.produtosCache = pds || [];

        // ==========================================================
        // 2. CARREGA OS COMPLEMENTOS (Molhos e Farinhas do banco)
        // ==========================================================
        if (typeof window.carregarComplementos === 'function') {
            await window.carregarComplementos();
        }

        // 3. RENDERIZA A TELA (agora com produtos e complementos em memória)
        renderizarVenda();
    } catch (e) {
        console.error("Erro ao carregar catálogo:", e);
        const cont = document.getElementById('lista-venda');
        if (cont) cont.innerHTML = '<p class="col-span-2 text-center text-red-500 font-bold py-10">Erro ao carregar produtos. Verifique sua conexão.</p>';
    }
}



window.carregarComplementos = async function() {
    try {
        // Vai buscar à base de dados apenas os complementos ativos
        const { data, error } = await _supabase
            .from('complementos')
            .select('*')
            .eq('ativo', true)
            .order('nome', { ascending: true }); // Ordena alfabeticamente
        
        if (error) throw error;
        
        window.complementosCache = data || [];
        console.log('[SISTEMA] Complementos carregados com sucesso:', window.complementosCache.length);
    } catch (e) {
        console.error('[ERRO] Falha ao carregar complementos:', e);
    }
};

/* --- 1. VITRINE --- */

// Variáveis para guardar o que está sendo filtrado no momento
window.categoriaAtual = 'todos';
window.termoBusca = '';

// Função que muda a categoria e pinta a "pílula" clicada
window.setCategoria = function(cat) {
    window.categoriaAtual = cat;
    
    // 1. Remove o visual escuro de todos os botões (deixa inativo)
    document.querySelectorAll('.btn-categoria').forEach(btn => {
        btn.classList.remove('bg-[#1e293b]', 'text-white', 'border-[#1e293b]', 'shadow-md');
        btn.classList.add('bg-white', 'dark:bg-transparent', 'text-slate-400', 'border-slate-200', 'dark:border-slate-700', 'hover:bg-slate-50', 'dark:hover:bg-slate-800');
    });

    // 2. Coloca o visual escuro apenas no botão que foi clicado
    const btnAtivo = document.getElementById('btn-cat-' + cat);
    if(btnAtivo) {
        btnAtivo.classList.remove('bg-white', 'dark:bg-transparent', 'text-slate-400', 'border-slate-200', 'dark:border-slate-700', 'hover:bg-slate-50', 'dark:hover:bg-slate-800');
        btnAtivo.classList.add('bg-[#1e293b]', 'text-white', 'border-[#1e293b]', 'shadow-md');
    }

    // 3. Atualiza os produtos na tela
    window.renderizarVenda();
}

// Função que captura o texto digitado
window.filtrarVitrine = function() {
    const input = document.getElementById('busca-produto-venda');
    window.termoBusca = input ? input.value.toLowerCase() : '';
    window.renderizarVenda();
}
window.renderizarVenda = function() {
    const cont = document.getElementById('lista-venda');
    if (!cont) return;
    
    if (!window.produtosCache || window.produtosCache.length === 0) {
        cont.innerHTML = '<p class="col-span-2 text-center text-slate-400 font-bold py-10 text-[10px] uppercase">Nenhum produto cadastrado.</p>';
        return;
    }

    // ====================================================
    // APLICA OS FILTROS (Categoria + Busca por Texto)
    // ====================================================
    const produtosFiltrados = window.produtosCache.filter(p => {
        const matchCategoria = window.categoriaAtual === 'todos' || p.categoria === window.categoriaAtual;
        const matchBusca = p.nome.toLowerCase().includes(window.termoBusca);
        return matchCategoria && matchBusca;
    });

    // Se o filtro não encontrar nada, avisa na tela
    if (produtosFiltrados.length === 0) {
        cont.innerHTML = `
            <div class="col-span-2 flex flex-col items-center justify-center py-10 opacity-50">
                <span class="text-4xl mb-3">🔍</span>
                <p class="text-slate-500 dark:text-slate-400 font-black text-[10px] uppercase tracking-widest text-center">Nenhum produto encontrado</p>
            </div>`;
        return;
    }
    // ====================================================

    const icons = { 'espetos': '🍢', 'cervejas': '🍺', 'bebidas': '🥤', 'refeicao': '🍽️', 'acompanhamentos': '🍚' };
    
    cont.innerHTML = produtosFiltrados.map(p => {
        const itemNoCarrinho = window.carrinho.find(c => c.id === p.id);
        const qtd = itemNoCarrinho ? itemNoCarrinho.qtd : 0;
        return `
            <button onclick="adicionarAoCarrinho(${p.id})" class="relative bg-white dark:bg-slate-900 p-4 rounded-3xl shadow-sm flex flex-col items-center border-2 ${qtd > 0 ? 'border-emerald-400' : 'border-slate-100 dark:border-slate-800'} active:scale-95 transition-all">
                <span class="text-3xl mb-1">${icons[p.categoria] || '📦'}</span>
                <h4 class="font-black text-[10px] uppercase italic text-center text-slate-800 dark:text-slate-200">${p.nome}</h4>
                <span class="text-[9px] font-bold text-red-500 mt-0.5">R$ ${typeof formatarMoeda === 'function' ? formatarMoeda(p.preco) : parseFloat(p.preco).toFixed(2)}</span>
                ${qtd > 0 ? `<span class="absolute -top-2 -right-2 bg-emerald-500 text-white text-[9px] w-6 h-6 rounded-full flex items-center justify-center font-black shadow-md">${qtd}</span>
                <div onclick="event.stopPropagation(); removerDoCarrinho(${p.id})" class="absolute -bottom-2 -right-2 bg-red-500 text-white w-8 h-8 rounded-full flex items-center justify-center font-black text-xs border-2 border-white dark:border-slate-900 shadow-md active:scale-90 transition-transform">-</div>` : ''}
            </button>`;
    }).join('');
    
    if (typeof atualizarFAB === 'function') atualizarFAB();
}

/* --- 2. CARRINHO --- */
window.adicionarAoCarrinho = function(id) {
    const p = window.produtosCache.find(prod => prod.id === id);
    if (!p) return;
    
    // ====================================================
    // INTERCEPTADORES: Abrir modais de personalização
    // ====================================================
    
    // 1. Refeições
    // Só abre o modal se for refeição E a opção de pedir complementos NÃO estiver desativada
    if (p.categoria === 'refeicao' && p.pedir_complementos !== false) {
        if(typeof abrirModalRefeicao === 'function') {
            abrirModalRefeicao(p);
        } else {
            console.error("Função abrirModalRefeicao não encontrada.");
        }
        return; 
    }

    // 2. Espetos
    // Só abre o modal se for espeto E a opção de pedir complementos NÃO estiver desativada
    if (p.categoria === 'espetos' && p.pedir_complementos !== false) {
        if(typeof abrirModalEspeto === 'function') {
            abrirModalEspeto(p);
        } else {
            console.error("Função abrirModalEspeto não encontrada.");
        }
        return;
    }
    // ====================================================

    // Fluxo normal para bebidas, cervejas, porções simples, 
    // OU produtos (espetos/refeições) que estão marcados para venda rápida (ticket)
    const item = window.carrinho.find(i => i.id === id && !i.observacao);
    if (item) {
        item.qtd++;
    } else {
        // Assume 'pronto' se não precisar de preparo
        const statusCozinha = p.precisa_preparo === false ? 'pronto' : 'novo';
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

        // ===============================================================
        // EXIBE AS INFORMAÇÕES DA REFEIÇÃO (ESPETO, REMOÇÕES E ADICIONAIS)
        // ===============================================================
        const observacaoHtml = i.observacao 
            ? `<span class="block text-[8px] font-black text-[#e63946] dark:text-red-400 uppercase mt-1 leading-tight tracking-widest border-l-2 border-[#e63946] pl-1.5">${i.observacao}</span>` 
            : '';

        return `
        <div class="py-3 border-b border-slate-100 dark:border-slate-800 last:border-0 flex justify-between items-start">
            <div>
                <span class="text-[11px] font-black uppercase text-slate-700 dark:text-slate-200 block">${i.qtd}x ${i.nome}</span>
                ${observacaoHtml}
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
                const copiaCozinha = { ...item, qtd: qtdCozinha, cozinha_status: 'novo' };
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
   ROTINA DE PRODUÇÃO: MOTOR DE CUPONS INDIVIDUAIS POR ITEM
   ================================================================================= */
if (typeof window.executarImpressaoVendaBalcao !== 'function') {
    window.executarImpressaoVendaBalcao = function() {
        try {
            const dadosVenda = window.ultimaVendaParaImpressao;
            
            if (!dadosVenda) {
                if (typeof window.fecharModalImpressao === 'function') window.fecharModalImpressao();
                return;
            }

            // Sincroniza dados e datas
            if (dadosVenda && !dadosVenda.pagamento && dadosVenda.forma_pagamento) {
                dadosVenda.pagamento = dadosVenda.forma_pagamento;
            }
            if (dadosVenda && !dadosVenda.data && dadosVenda.created_at) {
                dadosVenda.data = dadosVenda.created_at;
            }

            // MANDA SEMPRE PARA O MOTOR DE CUPONS INDIVIDUAIS (RETIRADA NO BALCÃO)
            // A função imprimirCupom vai montar os itens isolados e acionar a impressora (RawBT ou PDF)
            if (typeof window.imprimirCupom === 'function') {
                window.imprimirCupom(dadosVenda);
            } else {
                console.error("[IMPRESSÃO] Função imprimirCupom não encontrada.");
            }

        } catch (error) {
            console.error("[CRÍTICO - ROTA IMPRESSÃO BALCÃO]:", error);
        } finally {
            if (typeof window.fecharModalImpressao === 'function') {
                window.fecharModalImpressao();
            }
        }
    };
}

// =======================================================================
// LÓGICA DE PERSONALIZAÇÃO DE REFEIÇÕES
// =======================================================================
window.refeicaoAtual = null;
window.refeicaoAdicionais = [];

window.abrirModalRefeicao = function(produto) {
    window.refeicaoAtual = produto;
    window.refeicaoAdicionais = []; // Limpa adicionais anteriores

    // 1. Preenche cabeçalho
    document.getElementById('modal-ref-nome').innerText = produto.nome;
    document.getElementById('modal-ref-preco').innerText = `R$ ${parseFloat(produto.preco).toFixed(2)}`;

    // 2. Carrega todos os Espetos para os Selects
    const espetos = window.produtosCache.filter(p => p.categoria === 'espetos');
    
    // NOVIDADE: Descobre qual é o valor do espeto mais barato (o "Padrão" da Jantinha)
    window.precoBaseEspeto = Math.min(...espetos.map(e => parseFloat(e.preco)));

    let optionsHtml = espetos.map(e => `<option value="${e.nome}" data-preco="${e.preco}">${e.nome}</option>`).join('');
    
    const selectIncluso = document.getElementById('ref-espeto-incluso');
    selectIncluso.innerHTML = optionsHtml;
    // NOVIDADE: Manda o sistema recalcular a Jantinha sempre que trocar o espeto!
    selectIncluso.onchange = window.atualizarTotalRefeicao; 

    document.getElementById('ref-espeto-adicional').innerHTML = optionsHtml;

    // 3. Renderiza os Ingredientes (Checkbox)
    const containerIng = document.getElementById('container-ref-ingredientes');
    const listaIng = document.getElementById('ref-ingredientes-lista');
    
    if (produto.ingredientes && produto.ingredientes.trim() !== '') {
        const ingrArray = produto.ingredientes.split(',').map(i => i.trim());
        listaIng.innerHTML = ingrArray.map(ing => `
            <label class="flex items-center gap-3 p-3 bg-white dark:bg-slate-900 rounded-xl border border-slate-100 dark:border-slate-700 cursor-pointer transition-colors hover:border-emerald-300">
                <input type="checkbox" checked value="${ing}" class="ref-check-ingrediente w-5 h-5 text-emerald-500 rounded border-slate-300 focus:ring-emerald-500 accent-emerald-500">
                <span class="text-[10px] font-black text-slate-700 dark:text-slate-200 uppercase tracking-widest">${ing}</span>
            </label>
        `).join('');
        containerIng.classList.remove('hidden');
    } else {
        containerIng.classList.add('hidden');
        listaIng.innerHTML = '';
    }

    // 4. Atualiza a tela
    if (typeof renderizarAdicionaisRefeicao === 'function') renderizarAdicionaisRefeicao();
    window.atualizarTotalRefeicao();

    // 5. Mostra o Modal
    document.getElementById('modal-refeicao').classList.remove('hidden');
}

window.fecharModalRefeicao = function() {
    document.getElementById('modal-refeicao').classList.add('hidden');
}

// Botão [+] dos Adicionais
window.addAdicionalRefeicao = function() {
    const select = document.getElementById('ref-espeto-adicional');
    const option = select.options[select.selectedIndex];
    if(!option) return;

    window.refeicaoAdicionais.push({
        nome: option.value,
        preco: parseFloat(option.getAttribute('data-preco'))
    });
    
    renderizarAdicionaisRefeicao();
    atualizarTotalRefeicao();
}

window.removerAdicionalRefeicao = function(index) {
    window.refeicaoAdicionais.splice(index, 1);
    renderizarAdicionaisRefeicao();
    atualizarTotalRefeicao();
}

window.renderizarAdicionaisRefeicao = function() {
    const lista = document.getElementById('ref-adicionais-lista');
    lista.innerHTML = window.refeicaoAdicionais.map((add, idx) => `
        <div class="flex justify-between items-center p-3 bg-emerald-50 dark:bg-emerald-900/20 rounded-xl border border-emerald-200 dark:border-emerald-800">
            <span class="text-[10px] font-black text-emerald-700 dark:text-emerald-400 uppercase tracking-widest">+ ${add.nome}</span>
            <div class="flex items-center gap-3">
                <span class="text-[10px] font-black text-emerald-600">R$ ${add.preco.toFixed(2)}</span>
                <button onclick="removerAdicionalRefeicao(${idx})" class="w-7 h-7 bg-red-100 dark:bg-red-900/30 text-red-500 rounded-full flex items-center justify-center font-bold active:scale-95">✕</button>
            </div>
        </div>
    `).join('');
}

window.atualizarTotalRefeicao = function() {
    if (!window.refeicaoAtual) return;

    let total = parseFloat(window.refeicaoAtual.preco);

    // =================================================================
    // LÓGICA DA DIFERENÇA DO ESPETO (Ex: Medalhão, Pão de Alho, etc)
    // =================================================================
    const selectIncluso = document.getElementById('ref-espeto-incluso');
    if (selectIncluso && selectIncluso.selectedIndex >= 0) {
        const opcaoSelecionada = selectIncluso.options[selectIncluso.selectedIndex];
        const precoEspetoSelecionado = parseFloat(opcaoSelecionada.getAttribute('data-preco') || 0);
        
        // Se o espeto escolhido for mais caro que o Padrão, soma a diferença!
        if (precoEspetoSelecionado > window.precoBaseEspeto) {
            const diferenca = precoEspetoSelecionado - window.precoBaseEspeto;
            total += diferenca;
        }
    }

    // Lógica dos espetos Extras/Adicionais
    if (window.refeicaoAdicionais && window.refeicaoAdicionais.length > 0) {
        total += window.refeicaoAdicionais.reduce((acc, item) => acc + parseFloat(item.preco), 0);
    }

    // Atualiza a tela e guarda na variável Global para a confirmação
    window.refeicaoTotalAtual = total; 
    
    const spanTotal = document.getElementById('modal-ref-total');
    if (spanTotal) {
        spanTotal.innerText = `R$ ${total.toFixed(2).replace('.', ',')}`;
    }
}

// O Botão de Lançar
window.confirmarRefeicao = function() {
    const espetoIncluso = document.getElementById('ref-espeto-incluso').value;
    
    // Varre os checkboxes para ver o que foi desmarcado (Ex: SEM FAROFA)
    const checks = document.querySelectorAll('.ref-check-ingrediente');
    let removidos = [];
    checks.forEach(c => {
        if(!c.checked) removidos.push(c.value);
    });

    // ===============================================================
    // MONTA O TEXTO DA OBSERVAÇÃO PARA A COZINHA E IMPRESSORA
    // ===============================================================
    let obs = `[ESPETO] ${espetoIncluso}`; // O que acompanha a jantinha
    
    if(removidos.length > 0) {
        obs += ` | [SEM] ${removidos.join(', ')}`; // O que tirou
    }

    if(window.refeicaoAdicionais && window.refeicaoAdicionais.length > 0) {
        const addNomes = window.refeicaoAdicionais.map(a => a.nome).join(', ');
        obs += ` | [ADICIONAL] ${addNomes}`; // Os extras pagos
    }

    // ===============================================================
    // PREÇO FINAL (Diferença do Espeto Premium + Adicionais)
    // ===============================================================
    // Captura o valor exato que está a aparecer no ecrã do modal
    let precoFinal = window.refeicaoTotalAtual !== undefined ? window.refeicaoTotalAtual : window.refeicaoAtual.preco;

    // Adiciona ao carrinho com o PREÇO NOVO e a OBSERVAÇÃO
    const itemExistente = window.carrinho.find(i => i.id === window.refeicaoAtual.id && i.observacao === obs);
    
    if (itemExistente) {
        // Se já tiver uma jantinha EXATAMENTE IGUAL, soma a quantidade
        itemExistente.qtd++;
    } else {
        // Se for diferente, cria uma nova linha no carrinho
        window.carrinho.push({
            ...window.refeicaoAtual,
            preco: precoFinal, // Preço cravado com todos os cálculos automáticos!
            observacao: obs,
            qtd: 1,
            cozinha_status: 'novo'
        });
    }

    if (typeof renderizarVenda === 'function') renderizarVenda();
    if (typeof fecharModalRefeicao === 'function') fecharModalRefeicao();
    
    if(typeof showToast === 'function') showToast("REFEIÇÃO ADICIONADA!", "sucesso");
}

window.abrirModalEspeto = function(produto) {
    window.espetoAtual = produto;
    
    // 1. FILTRA OS ITENS QUE VIERAM DO BANCO (Aqui está a mágica!)
    const molhos = window.complementosCache.filter(c => c.tipo === 'molho');
    const farinhas = window.complementosCache.filter(c => c.tipo === 'farinha');

    document.getElementById('modal-esp-nome').innerText = produto.nome;

    // 2. Renderizar Molhos dinâmicos
    const divMolhos = document.getElementById('espeto-molhos-lista');
    if (divMolhos) {
        divMolhos.innerHTML = molhos.length > 0 
            ? molhos.map(m => `
                <label class="flex items-center gap-2 bg-slate-50 dark:bg-slate-800 p-2 rounded-xl border border-slate-100 dark:border-slate-700 cursor-pointer">
                    <input type="checkbox" value="${m.nome}" class="espeto-molho w-4 h-4 text-red-500 accent-red-500">
                    <span class="text-[9px] font-bold uppercase">${m.nome}</span>
                </label>
            `).join('')
            : '<p class="text-xs text-slate-400 italic">Nenhum molho cadastrado.</p>';
    }

    // 3. Renderizar Farinha dinâmica
    const divFarinhas = document.getElementById('espeto-farinha-lista');
    if (divFarinhas) {
        divFarinhas.innerHTML = farinhas.length > 0 
            ? farinhas.map(f => `
                <label class="flex items-center gap-3 p-3 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-100 dark:border-slate-700 cursor-pointer">
                    <input type="radio" name="farinha" value="${f.nome}" ${f.nome === 'Mandioca' ? 'checked' : ''} class="espeto-farinha w-4 h-4 text-red-500 accent-red-500">
                    <span class="text-[9px] font-bold uppercase">${f.nome}</span>
                </label>
            `).join('')
            : '<p class="text-xs text-slate-400 italic">Nenhuma farinha cadastrada.</p>';
    }

    document.getElementById('modal-espeto').classList.remove('hidden');
}

// =========================================================================
// CONFIRMAR ESPETO (Pega os dados do modal e joga no carrinho)
// =========================================================================
window.confirmarEspetoPersonalizado = function() {
    // 1. Pega os molhos que o usuário marcou
    let molhos = [];
    document.querySelectorAll('.espeto-molho:checked').forEach(c => molhos.push(c.value));
    
    // 2. Pega a farinha selecionada
    const farinhaRadio = document.querySelector('.espeto-farinha:checked');
    const farinha = farinhaRadio ? farinhaRadio.value : 'Sem Farinha';

    // 3. Monta o texto em destaque que vai aparecer para a cozinha
    const obs = `[MOLHOS: ${molhos.length > 0 ? molhos.join(', ') : 'Nenhum'}] - [FARINHA: ${farinha}]`;

    // 4. Adiciona o espeto ao carrinho com a observação e status para a cozinha
    window.carrinho.push({
        ...window.espetoAtual,
        observacao: obs,
        qtd: 1,
        cozinha_status: 'novo'
    });

    // 5. Atualiza o carrinho na tela e fecha o modal
    if (typeof renderizarVenda === 'function') renderizarVenda();
    
    const modal = document.getElementById('modal-espeto');
    if (modal) modal.classList.add('hidden');
    
    if (typeof showToast === 'function') showToast("Espeto adicionado ao pedido!");
};

window.confirmarEspetoPersonalizado = function() {
    let molhos = [];
    document.querySelectorAll('.espeto-molho:checked').forEach(c => molhos.push(c.value));
    
    const farinhaRadio = document.querySelector('.espeto-farinha:checked');
    const farinha = farinhaRadio ? farinhaRadio.value : 'Sem Farinha';

    // A mágica da quebra de linha está no <br> aqui no meio:
    const obs = `[MOLHO] ${molhos.length > 0 ? molhos.join(', ') : 'Nenhum'}<br>↳ [FARINHA] ${farinha}`;

    window.carrinho.push({
        ...window.espetoAtual,
        observacao: obs,
        qtd: 1,
        cozinha_status: 'novo'
    });

    if (typeof renderizarVenda === 'function') renderizarVenda();
    
    const modal = document.getElementById('modal-espeto');
    if (modal) modal.classList.add('hidden');
    
    if (typeof showToast === 'function') showToast("Espeto adicionado!");
};