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
        // A MÁGICA AQUI: Puxa o nome real em vez do ID
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

        // 3. RENDERIZA A TELA
        renderizarVenda();
    } catch (e) {
        console.error("Erro ao carregar catálogo:", e);
        const cont = document.getElementById('lista-venda');
        if (cont) cont.innerHTML = '<p class="col-span-2 text-center text-red-500 font-bold py-10">Erro ao carregar produtos. Verifique sua conexão.</p>';
    }
}

window.carregarComplementos = async function() {
    try {
        const { data, error } = await _supabase
            .from('complementos')
            .select('*')
            .eq('ativo', true)
            .order('nome', { ascending: true }); 
        
        if (error) throw error;
        
        window.complementosCache = data || [];
        console.log('[SISTEMA] Complementos carregados com sucesso:', window.complementosCache.length);
    } catch (e) {
        console.error('[ERRO] Falha ao carregar complementos:', e);
    }
};

/* --- 1. VITRINE --- */

window.categoriaAtual = 'todos';
window.termoBusca = '';

window.setCategoria = function(cat) {
    window.categoriaAtual = cat;
    
    document.querySelectorAll('.btn-categoria').forEach(btn => {
        btn.classList.remove('bg-[#1e293b]', 'text-white', 'border-[#1e293b]', 'shadow-md');
        btn.classList.add('bg-white', 'dark:bg-transparent', 'text-slate-400', 'border-slate-200', 'dark:border-slate-700', 'hover:bg-slate-50', 'dark:hover:bg-slate-800');
    });

    const btnAtivo = document.getElementById('btn-cat-' + cat);
    if(btnAtivo) {
        btnAtivo.classList.remove('bg-white', 'dark:bg-transparent', 'text-slate-400', 'border-slate-200', 'dark:border-slate-700', 'hover:bg-slate-50', 'dark:hover:bg-slate-800');
        btnAtivo.classList.add('bg-[#1e293b]', 'text-white', 'border-[#1e293b]', 'shadow-md');
    }

    window.renderizarVenda();
}

window.filtrarVitrine = function() {
    const input = document.getElementById('busca-produto-venda');
    window.termoBusca = input ? input.value.toLowerCase() : '';

    const selectOrdem = document.getElementById('ordem-catalogo');
    window.ordemVitrine = selectOrdem ? selectOrdem.value : 'nome-asc';

    window.renderizarVenda();
}

window.renderizarVenda = function() {
    const cont = document.getElementById('lista-venda');
    if (!cont) return;
    
    if (!window.produtosCache || window.produtosCache.length === 0) {
        cont.innerHTML = '<p class="col-span-2 text-center text-slate-400 font-bold py-10 text-[10px] uppercase">Nenhum produto cadastrado.</p>';
        return;
    }

    let produtosFiltrados = window.produtosCache.filter(p => {
        const matchCategoria = window.categoriaAtual === 'todos' || p.categoria === window.categoriaAtual;
        const matchBusca = p.nome.toLowerCase().includes(window.termoBusca || '');
        return matchCategoria && matchBusca;
    });

    const ordem = window.ordemVitrine || 'nome-asc';
    produtosFiltrados.sort((a, b) => {
        if (ordem === 'nome-asc') return a.nome.localeCompare(b.nome);
        if (ordem === 'nome-desc') return b.nome.localeCompare(a.nome);
        if (ordem === 'preco-asc') return parseFloat(a.preco) - parseFloat(b.preco);
        if (ordem === 'preco-desc') return parseFloat(b.preco) - parseFloat(a.preco);
        if (ordem === 'categoria') {
            const catComp = (a.categoria || '').localeCompare(b.categoria || '');
            return catComp !== 0 ? catComp : a.nome.localeCompare(b.nome);
        }
        return 0;
    });

    if (produtosFiltrados.length === 0) {
        cont.innerHTML = '<p class="col-span-2 text-center text-slate-400 py-10 uppercase text-[10px] font-bold">Nenhum produto encontrado</p>';
        return;
    }

    const icons = { 'espetos': '🍢', 'cervejas': '🍺', 'bebidas': '🥤', 'refeicao': '🍽️', 'acompanhamentos': '🍚', 'combos': '🍻' };

    const gerarCardProduto = (p) => {
        // CORREÇÃO AQUI: Soma a quantidade de TODAS as instâncias desse produto no carrinho
        const itensDoProduto = window.carrinho.filter(c => c.id === p.id);
        const qtd = itensDoProduto.reduce((soma, item) => soma + item.qtd, 0);

        return `
            <button onclick="adicionarAoCarrinho(${p.id})" class="relative bg-white dark:bg-slate-900 p-4 rounded-3xl shadow-sm flex flex-col items-center border-2 ${qtd > 0 ? 'border-emerald-400' : 'border-slate-100 dark:border-slate-800'} active:scale-95 transition-all">
                <span class="text-3xl mb-1">${icons[p.categoria] || '📦'}</span>
                <h4 class="font-black text-[10px] uppercase italic text-center text-slate-800 dark:text-slate-200">${p.nome}</h4>
                <span class="text-[9px] font-bold text-red-500 mt-0.5">R$ ${typeof formatarMoeda === 'function' ? formatarMoeda(p.preco) : parseFloat(p.preco).toFixed(2)}</span>
                ${qtd > 0 ? `<span class="absolute -top-2 -right-2 bg-emerald-500 text-white text-[9px] w-6 h-6 rounded-full flex items-center justify-center font-black shadow-md">${qtd}</span>
                <div onclick="event.stopPropagation(); removerDoCarrinho(${p.id})" class="absolute -bottom-2 -right-2 bg-red-500 text-white w-8 h-8 rounded-full flex items-center justify-center font-black text-xs border-2 border-white dark:border-slate-900 shadow-md active:scale-90 transition-transform">-</div>` : ''}
            </button>`;
    };

    if (ordem === 'categoria') {
        const grupos = produtosFiltrados.reduce((acc, p) => {
            const cat = p.categoria || 'OUTROS';
            if (!acc[cat]) acc[cat] = [];
            acc[cat].push(p);
            return acc;
        }, {});

        cont.innerHTML = Object.keys(grupos).map(cat => `
            <div class="col-span-2 mt-4 mb-2">
                <h3 class="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2 italic">${icons[cat] || '📦'} ${cat}</h3>
            </div>
            ${grupos[cat].map(p => gerarCardProduto(p)).join('')}
        `).join('');
    } else {
        cont.innerHTML = produtosFiltrados.map(p => gerarCardProduto(p)).join('');
    }
    
    if (typeof atualizarFAB === 'function') atualizarFAB();
}

/* --- 2. CARRINHO --- */
window.adicionarAoCarrinho = function(id) {
    const p = window.produtosCache.find(prod => prod.id === id);
    if (!p) return;
    
    if (p.categoria === 'refeicao' && p.pedir_complementos !== false) {
        if(typeof abrirModalRefeicao === 'function') abrirModalRefeicao(p);
        return; 
    }

    if (p.categoria === 'espetos' && p.pedir_complementos !== false) {
        if(typeof abrirModalEspeto === 'function') abrirModalEspeto(p);
        return;
    }

    // CORREÇÃO: Procura por itens idênticos sem observação para agrupar
    const index = window.carrinho.findIndex(i => i.id === id && !i.observacao);
    
    if (index > -1) {
        window.carrinho[index].qtd++;
    } else {
        const statusCozinha = p.precisa_preparo === false ? 'pronto' : 'novo';
        window.carrinho.push({ ...p, qtd: 1, cozinha_status: statusCozinha });
    }
    
    renderizarVenda();
    if (typeof window.atualizarFAB === 'function') window.atualizarFAB();
}

window.removerDoCarrinho = function(id) {
    // CORREÇÃO: Tenta remover o item padrão primeiro. Se não achar, remove o último personalizado adicionado.
    let index = window.carrinho.findIndex(i => i.id === id && !i.observacao);
    
    if (index === -1) {
        index = window.carrinho.findLastIndex(i => i.id === id);
    }

    if (index > -1) {
        if (window.carrinho[index].qtd > 1) {
            window.carrinho[index].qtd--;
        } else {
            window.carrinho.splice(index, 1);
        }
        renderizarVenda();
        if (typeof window.atualizarFAB === 'function') window.atualizarFAB();
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
        const mesaId = sessionStorage.getItem('comandaAtivaId');
        btnTexto.innerText = mesaId ? 'LANÇAR NA MESA' : 'FINALIZAR VENDA';
    }
}

/* --- 3. FLUXO INTELIGENTE (ENCAMINHA PARA BALCÃO OU COMANDA) --- */
window.abrirResumoPedido = function() {
    const mesaId = sessionStorage.getItem('comandaAtivaId');
    
    if (mesaId) {
        window.abrirConfirmacaoComandaVenda(mesaId);
    } else {
        const inputRecebido = document.getElementById('valor-recebido');
        if (inputRecebido) inputRecebido.value = ''; 
        
        const trocoContainer = document.getElementById('valor-troco-container');
        if (trocoContainer) trocoContainer.classList.add('hidden'); 
        
        const sessaoTroco = document.getElementById('sessao-troco');
        if (sessaoTroco) sessaoTroco.classList.add('hidden'); 

        const modalContainer = document.getElementById('itens-carrinho-modal');
        if (modalContainer) {
            modalContainer.innerHTML = window.carrinho.map(i => `
    <div class="flex justify-between items-center p-3 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-100 dark:border-slate-700 mb-2">
        <span class="text-[11px] font-black uppercase text-slate-800 dark:text-white">
            ${i.qtd}x ${i.nome}
        </span>
        <span class="text-[10px] font-bold text-slate-400 dark:text-slate-300">
            R$ ${typeof formatarMoeda === 'function' ? formatarMoeda(i.preco * i.qtd) : (i.preco * i.qtd).toFixed(2)}
        </span>
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
        if (typeof showToast === 'function') {
            showToast('SELECIONE A FORMA DE PAGAMENTO', 'erro');
        } else if (typeof alertaSistema === 'function') {
            alertaSistema('Por favor, selecione a forma de pagamento.', 'Atenção');
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

        if (typeof registrarLog === 'function') {
            const valorF = typeof formatarMoeda === 'function' ? formatarMoeda(subtotal) : subtotal.toFixed(2);
            const listaItensLog = window.carrinho.map(i => `${i.qtd}x ${i.nome}`).join(', ');
            const detalhesBalcao = `VALOR: R$ ${valorF} | PGTO: ${pag.toUpperCase()} | ITENS: ${listaItensLog}`;
            await registrarLog('VENDA', 'VENDA BALCÃO', detalhesBalcao);
        }

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
            alertaSistema('Ocorreu um erro ao registrar a venda.', 'Erro');
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
window.abrirConfirmacaoComandaVenda = async function(mesaId) { 
    const labelMesa = document.getElementById('label-mesa-confirmacao');
    const modal = document.getElementById('modal-confirmacao-comanda');

    if (!modal) return;

    if (labelMesa) {
        labelMesa.innerText = "CARREGANDO DADOS..."; 
        const { data } = await _supabase.from('comandas').select('identificacao').eq('id', mesaId).single();
        labelMesa.innerText = `MESA / CLIENTE: ${data ? data.identificacao : mesaId}`;
    }
    
    window.carrinho.forEach(i => {
        if (typeof window.isItemCozinha === 'function' && window.isItemCozinha(i)) {
            if (i.qtd_cozinha === undefined) i.qtd_cozinha = i.qtd; 
        } else {
            i.qtd_cozinha = 0; 
        }
    });

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
    if (novaQtd > item.qtd) novaQtd = item.qtd; 

    item.qtd_cozinha = novaQtd;
    window.renderizarItensConfirmacaoComanda();
}

window.finalizarPedidoComandaVenda = async function() {
    const enviarCozinhaGlobal = document.getElementById('check-enviar-cozinha')?.checked ?? true;
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

    if (typeof window.gravarPedidoComanda === 'function') {
        await window.gravarPedidoComanda(); 
        sessionStorage.removeItem('comandaAtivaId'); 
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

    const acaoCancelar = async () => {
        try {
            if (typeof setLoading === 'function') setLoading('btn-estorno-' + idVenda, true);

            const { data: venda, error: errBusca } = await _supabase
                .from('historico_vendas')
                .select('total, forma_pagamento, itens')
                .eq('id', idVenda)
                .single();

            if (errBusca) throw new Error("Venda não encontrada.");

            const { error: errUpdate } = await _supabase
                .from('historico_vendas')
                .update({ status: 'cancelada' }) 
                .eq('id', idVenda);

            if (errUpdate) throw errUpdate;

            if (typeof registrarLog === 'function') {
                const valorF = typeof formatarMoeda === 'function' ? formatarMoeda(venda.total) : venda.total;
                await registrarLog(
                    'SEGURANÇA', 
                    'ESTORNO DE VENDA', 
                    `🚨 CANCELAMENTO DA VENDA #${idVenda} | VALOR: R$ ${valorF} | PGTO: ${venda.forma_pagamento.toUpperCase()}`
                );
            }

            if (typeof showToast === 'function') showToast('VENDA CANCELADA COM SUCESSO!', 'sucesso');
            if (typeof carregarHistoricoVendas === 'function') carregarHistoricoVendas();

        } catch (e) {
            console.error('❌ [ESTORNO] Erro:', e);
            if (typeof showToast === 'function') {
                showToast('ERRO AO CANCELAR VENDA', 'erro');
            } else if (typeof alertaSistema === 'function') {
                alertaSistema("Não foi possível cancelar a venda.", "Erro");
            }
        } finally {
            if (typeof setLoading === 'function') setLoading('btn-estorno-' + idVenda, false);
        }
    };

    if (typeof confirmarAcao === 'function') {
        confirmarAcao(mensagem, acaoCancelar, titulo);
    } else {
        if (confirm(mensagem)) acaoCancelar();
    }
}

/* =================================================================================
   ROTINA DE PRODUÇÃO E IMPRESSÃO
   ================================================================================= */
   
// CORREÇÃO: Função explícita para fechar o modal de impressão
window.fecharModalImpressaoTicket = function() {
    const modal = document.getElementById('modal-confirmacao-impressao');
    if (modal) {
        modal.classList.add('hidden');
        modal.classList.remove('flex');
    }
};

window.executarImpressaoVendaBalcao = function() {
    try {
        // CORREÇÃO 1: Fecha o modal IMEDIATAMENTE
        window.fecharModalImpressaoTicket();
        
        const dadosVenda = window.ultimaVendaParaImpressao;
        if (!dadosVenda) return;

        // Sincroniza dados e datas
        if (dadosVenda && !dadosVenda.pagamento && dadosVenda.forma_pagamento) {
            dadosVenda.pagamento = dadosVenda.forma_pagamento;
        }
        if (dadosVenda && !dadosVenda.data && dadosVenda.created_at) {
            dadosVenda.data = dadosVenda.created_at;
        }

        // CORREÇÃO 2: setTimeout para dar tempo da interface limpar o modal antes de travar
        setTimeout(() => {
            if (typeof window.imprimirCupom === 'function') {
                window.imprimirCupom(dadosVenda);
            } else {
                console.error("[IMPRESSÃO] Função imprimirCupom não encontrada.");
            }
        }, 300);

    } catch (error) {
        console.error("[CRÍTICO - ROTA IMPRESSÃO BALCÃO]:", error);
    }
};

// =======================================================================
// LÓGICA DE PERSONALIZAÇÃO DE REFEIÇÕES E ESPETOS
// =======================================================================
window.refeicaoAtual = null;
window.refeicaoAdicionais = [];

window.abrirModalRefeicao = function(produto) {
    window.refeicaoAtual = produto;
    window.refeicaoAdicionais = []; 

    document.getElementById('modal-ref-nome').innerText = produto.nome;
    document.getElementById('modal-ref-preco').innerText = `R$ ${parseFloat(produto.preco).toFixed(2)}`;

    const espetos = window.produtosCache.filter(p => p.categoria === 'espetos');
    window.precoBaseEspeto = Math.min(...espetos.map(e => parseFloat(e.preco)));

    let optionsHtml = espetos.map(e => `<option value="${e.nome}" data-preco="${e.preco}">${e.nome}</option>`).join('');
    
    const selectIncluso = document.getElementById('ref-espeto-incluso');
    selectIncluso.innerHTML = optionsHtml;
    selectIncluso.onchange = window.atualizarTotalRefeicao; 

    document.getElementById('ref-espeto-adicional').innerHTML = optionsHtml;

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

    if (typeof renderizarAdicionaisRefeicao === 'function') renderizarAdicionaisRefeicao();
    window.atualizarTotalRefeicao();
    document.getElementById('modal-refeicao').classList.remove('hidden');
}

window.fecharModalRefeicao = function() {
    document.getElementById('modal-refeicao').classList.add('hidden');
}

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

    const precoBaseJantinha = 25.00;
    const precoReferenciaEspeto = 10.00; 
    let total = precoBaseJantinha;

    const selectIncluso = document.getElementById('ref-espeto-incluso');
    if (selectIncluso && selectIncluso.selectedIndex >= 0) {
        const opcaoSelecionada = selectIncluso.options[selectIncluso.selectedIndex];
        const precoEspetoSelecionado = parseFloat(opcaoSelecionada.getAttribute('data-preco') || 0);
        
        if (precoEspetoSelecionado > precoReferenciaEspeto) {
            const diferenca = precoEspetoSelecionado - precoReferenciaEspeto;
            total += diferenca;
        }
    }

    if (window.refeicaoAdicionais && window.refeicaoAdicionais.length > 0) {
        total += window.refeicaoAdicionais.reduce((acc, item) => acc + parseFloat(item.preco), 0);
    }

    window.refeicaoTotalAtual = total; 
    
    const spanTotal = document.getElementById('modal-ref-total');
    if (spanTotal) {
        spanTotal.innerText = `R$ ${total.toFixed(2).replace('.', ',')}`;
    }
}

window.confirmarRefeicao = function() {
    const espetoIncluso = document.getElementById('ref-espeto-incluso').value;
    
    const checks = document.querySelectorAll('.ref-check-ingrediente');
    let removidos = [];
    checks.forEach(c => {
        if(!c.checked) removidos.push(c.value);
    });

    let obs = `[ESPETO] ${espetoIncluso}`; 
    
    if(removidos.length > 0) {
        obs += ` | [SEM] ${removidos.join(', ')}`; 
    }

    if(window.refeicaoAdicionais && window.refeicaoAdicionais.length > 0) {
        const addNomes = window.refeicaoAdicionais.map(a => a.nome).join(', ');
        obs += ` | [ADICIONAL] ${addNomes}`; 
    }

    let precoFinal = window.refeicaoTotalAtual !== undefined ? window.refeicaoTotalAtual : window.refeicaoAtual.preco;

    const itemExistente = window.carrinho.find(i => i.id === window.refeicaoAtual.id && i.observacao === obs);
    
    if (itemExistente) {
        itemExistente.qtd++;
    } else {
        window.carrinho.push({
            ...window.refeicaoAtual,
            preco: precoFinal, 
            observacao: obs,
            qtd: 1,
            cozinha_status: 'novo'
        });
    }

    if (typeof renderizarVenda === 'function') renderizarVenda();
    if (typeof fecharModalRefeicao === 'function') fecharModalRefeicao();
    if (typeof showToast === 'function') showToast("REFEIÇÃO ADICIONADA!", "sucesso");
}

window.abrirModalEspeto = function(produto) {
    window.espetoAtual = produto;
    
    const molhos = window.complementosCache.filter(c => c.tipo === 'molho');
    const farinhas = window.complementosCache.filter(c => c.tipo === 'farinha');

    document.getElementById('modal-esp-nome').innerText = produto.nome;

    const divMolhos = document.getElementById('espeto-molhos-lista');
    if (divMolhos) {
        divMolhos.innerHTML = molhos.length > 0 
            ? molhos.map(m => `
                <label class="flex items-center gap-2 bg-slate-50 dark:bg-slate-800 p-2 rounded-xl border border-slate-100 dark:border-slate-700 cursor-pointer">
                    <input type="checkbox" value="${m.nome}" class="espeto-molho w-4 h-4 text-red-500 accent-red-500">
                    <span class="text-[9px] font-bold uppercase text-slate-800 dark:text-slate-200">${m.nome}</span>
                </label>
            `).join('')
            : '<p class="text-xs text-slate-400 dark:text-slate-500 italic">Nenhum molho cadastrado.</p>';
    }

    const divFarinhas = document.getElementById('espeto-farinha-lista');
    if (divFarinhas) {
        divFarinhas.innerHTML = farinhas.length > 0 
            ? farinhas.map(f => `
                <label class="flex items-center gap-3 p-3 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-100 dark:border-slate-700 cursor-pointer">
                    <input type="radio" name="farinha" value="${f.nome}" ${f.nome === 'Mandioca' ? 'checked' : ''} class="espeto-farinha w-4 h-4 text-red-500 accent-red-500">
                    <span class="text-[9px] font-bold uppercase text-slate-800 dark:text-slate-200">${f.nome}</span>
                </label>
            `).join('')
            : '<p class="text-xs text-slate-400 dark:text-slate-500 italic">Nenhuma farinha cadastrada.</p>';
    }

    document.getElementById('modal-espeto').classList.remove('hidden');
}

// CORREÇÃO: Removida a duplicidade. Mantive a versão formatada com quebra de linha.
window.confirmarEspetoPersonalizado = function() {
    let molhos = [];
    document.querySelectorAll('.espeto-molho:checked').forEach(c => molhos.push(c.value));
    
    const farinhaRadio = document.querySelector('.espeto-farinha:checked');
    const farinha = farinhaRadio ? farinhaRadio.value : 'Sem Farinha';

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

function selecionarPagamento(metodo, elementoClicado) {
    document.getElementById('forma-pagamento').value = metodo;

    const classeSelecionado = "bg-emerald-500 text-white border-emerald-600 dark:bg-emerald-600 dark:border-emerald-500";
    const classeInativo = "bg-slate-50 text-slate-500 border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700";
    const baseClasses = "btn-pagamento p-2 rounded-xl text-[10px] font-black uppercase border-2 transition-all active:scale-95 flex flex-col items-center justify-center gap-1";

    const botoes = document.querySelectorAll('.btn-pagamento');
    botoes.forEach(btn => {
        btn.className = baseClasses + " " + classeInativo;
    });

    elementoClicado.className = baseClasses + " " + classeSelecionado;

    if (typeof handlePagamentoChange === 'function') {
        handlePagamentoChange();
    }
}