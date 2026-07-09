/**
 * SISTEMA ESPETINHO & CIA (MODO VITRINE PURA)
 */

let PRODUTOS = [];
let LOJA_ABERTA = true;

// =============================================================
// INICIALIZAÇÃO E EVENTOS GERAIS
// =============================================================
window.onload = async () => { 
    localStorage.removeItem('sessaoCliente'); 
    
    // Recupera a preferência ou define 'list' como padrão
    MODO_VISUALIZACAO = localStorage.getItem('modoView') || 'list';
    
    // Atualiza o ícone corretamente ao carregar a página
    const icone = document.getElementById('icone-view');
    if (icone) {
        icone.className = (MODO_VISUALIZACAO === 'grid') ? 'ph-bold ph-list text-xl' : 'ph-bold ph-squares-four text-xl';
    }
    
    await window.carregarDados(); 
};

window.fecharTodosModais = function() {
    const modaisId = ['modal-detalhes'];
    modaisId.forEach(id => {
        const m = document.getElementById(id);
        if (m) { m.classList.add('hidden'); m.style.setProperty('display', 'none', 'important'); }
    });
}

window.addEventListener('click', function(event) {
    if (event.target.id === 'modal-detalhes') window.fecharDetalhes();
});

// =============================================================
// CARREGAMENTO DE DADOS (SUPABASE)
// =============================================================
window.carregarDados = async function() {
    try {
        if (typeof _supabase === 'undefined') return;

        // 1. Busca Configurações da Loja
        const resC = await _supabase.from('configuracoes_sistema').select('*');
        if (resC.data && resC.data.length > 0) {
            const confLojaAberta = resC.data.find(d => d.chave === 'loja_aberta');
            if (confLojaAberta) LOJA_ABERTA = (confLojaAberta.valor === 'true');
        }

        // 2. Atualiza selo Aberto/Fechado
        const containerStatus = document.getElementById('status-funcionamento-badge');
        if (containerStatus) {
            containerStatus.innerHTML = LOJA_ABERTA ? `
                <div class="inline-flex items-center gap-2 bg-white/95 backdrop-blur-md px-4 py-2 rounded-full shadow-xl border border-emerald-100">
                    <span class="w-2.5 h-2.5 bg-emerald-500 rounded-full animate-pulse shadow-[0_0_8px_#10b981]"></span>
                    <span class="text-[10px] font-black uppercase tracking-widest text-emerald-600 pt-px">Aberto Agora</span>
                </div>` : `
                <div class="inline-flex items-center gap-2 bg-slate-800/90 backdrop-blur-md px-4 py-2 rounded-full shadow-xl border border-slate-700">
                    <span class="w-2.5 h-2.5 bg-red-500 rounded-full shadow-[0_0_8px_#ef4444]"></span>
                    <span class="text-[10px] font-black uppercase tracking-widest text-white pt-px">Fechado no Momento</span>
                </div>`;
        }

        // 3. Busca Produtos Ativos
        const resP = await _supabase.from('produtos').select('*').eq('status', true).order('nome');
        if (resP.data) { 
            PRODUTOS = resP.data; 
            window.render(PRODUTOS); 
        }
    } catch(e) { 
        console.error("Erro ao carregar a vitrine:", e); 
    }
}

// =============================================================
// RENDERIZAÇÃO
// =============================================================
window.render = function(lista) {
    const container = document.getElementById('cardapio');
    if (!container) return;
    
    // Armazena a lista atual para os filtros funcionarem corretamente
    window.PRODUTOS_FILTRADOS = lista;

    if (lista.length === 0) { 
        container.innerHTML = `<p class="col-span-full text-center py-20 font-black text-slate-300 uppercase italic text-xs">Nenhum item disponível.</p>`; 
        return; 
    }
    
    const emojis = { 
        'espetos': '🍢', 'espetinhos': '🍢', 
        'cervejas': '🍺', 'bebidas': '🥤', 
        'refeicao': '🍽️', 'jantinhas': '🍽️', 
        'acompanhamentos': '🍚', 'combos': '🍻' 
    };

    // MODO GRADE (BLOCO)
    if (MODO_VISUALIZACAO === 'grid') {
        container.className = "grid grid-cols-2 gap-4 px-4 pb-10";
        container.innerHTML = lista.map(p => {
            const catLimpa = (p.categoria || '').toLowerCase().trim();
            const emojiPadrao = emojis[catLimpa] || '🍢';
            // Verifica o campo observacao conforme sua tabela
            const temObs = p.observacao && p.observacao.trim() !== "";
            
            return `
            <div onclick="window.abrirDetalhes(${p.id})" class="bg-white p-2.5 rounded-[2rem] shadow-sm border border-slate-100 active:scale-95 transition-all cursor-pointer group hover:border-red-100 flex flex-col h-full relative">
                ${temObs ? '<div class="absolute top-4 left-4 bg-blue-500 text-white text-[8px] font-black px-2 py-0.5 rounded-full z-10 shadow-sm uppercase italic">Opções</div>' : ''}
                <div class="h-32 sm:h-36 bg-slate-50 rounded-[1.5rem] overflow-hidden mb-3 shrink-0 flex items-center justify-center text-4xl">
                    ${p.foto ? `<img src="${p.foto}" class="w-full h-full object-cover">` : `<span>${emojiPadrao}</span>`}
                </div>
                <div class="px-2 pb-2 flex-1 flex flex-col justify-between">
                    <div class="mb-2">
                        <p class="text-[9px] font-black text-slate-300 uppercase tracking-widest mb-1">/ ${p.categoria || 'Geral'}</p>
                        <h4 class="font-black text-xs uppercase text-slate-800 leading-tight italic truncate">${p.nome}</h4>
                    </div>
                    <div>
                        <span class="bg-red-600 text-white font-black text-xs px-3 py-1.5 rounded-xl shadow-md italic inline-block">R$ ${parseFloat(p.preco).toFixed(2).replace('.', ',')}</span>
                    </div>
                </div>
            </div>`;
        }).join('');
    } 
    // MODO LISTA
    else {
        container.className = "flex flex-col gap-3 px-4 pb-10";
        container.innerHTML = lista.map(p => {
            const temObs = p.observacao && p.observacao.trim() !== "";
            
            return `
            <div onclick="window.abrirDetalhes(${p.id})" class="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 flex items-center gap-4 cursor-pointer hover:border-red-100 transition-all">
                <div class="w-16 h-16 bg-slate-50 rounded-xl overflow-hidden shrink-0 flex items-center justify-center text-2xl border border-slate-100">
                    ${p.foto ? `<img src="${p.foto}" class="w-full h-full object-cover">` : '🍢'}
                </div>
                <div class="flex-1 min-w-0">
                    <h4 class="font-black text-xs uppercase text-slate-800 italic truncate">${p.nome}
                        ${temObs ? '<span class="ml-2 bg-blue-100 text-blue-600 text-[8px] px-1.5 py-0.5 rounded italic uppercase">Opções</span>' : ''}
                    </h4>
                    <p class="text-[9px] font-black text-slate-300 uppercase tracking-widest mt-0.5">/ ${p.categoria || 'Geral'}</p>
                </div>
                <span class="font-black text-red-600 text-xs italic shrink-0">R$ ${parseFloat(p.preco).toFixed(2).replace('.', ',')}</span>
            </div>`;
        }).join('');
    }
}

// =============================================================
// MODAL DE DETALHES (COM TRATAMENTO SEGURO)
// =============================================================
window.abrirDetalhes = function(id) {
    const item = PRODUTOS.find(p => p.id === id);
    if (!item) return;

    // Galeria de Fotos
    const galeriaContainer = document.getElementById('galeria-fotos-container');
    const indicador = document.getElementById('indicador-fotos');
    
    let todasAsFotos = [];
    if (item.foto) todasAsFotos.push(item.foto);
    
    if (item.galeria) {
        try {
            const fotosExtra = typeof item.galeria === 'string' ? JSON.parse(item.galeria) : item.galeria;
            if (Array.isArray(fotosExtra)) todasAsFotos = [...todasAsFotos, ...fotosExtra];
        } catch(e) { console.warn("Erro ao processar galeria extra"); }
    }

    if (todasAsFotos.length === 0) {
        if(galeriaContainer) galeriaContainer.innerHTML = `<div class="w-full h-full flex items-center justify-center text-6xl snap-center bg-slate-100">🍢</div>`;
        if(indicador) indicador.classList.add('hidden');
    } else {
        if(galeriaContainer) {
            galeriaContainer.innerHTML = todasAsFotos.map(url => `
                <div class="min-w-full h-full snap-center shrink-0">
                    <img src="${url}" class="w-full h-full object-cover">
                </div>`).join('');

            if (todasAsFotos.length > 1 && indicador) {
                indicador.innerText = `1 / ${todasAsFotos.length}`;
                indicador.classList.remove('hidden');
                
                galeriaContainer.onscroll = () => {
                    const index = Math.round(galeriaContainer.scrollLeft / galeriaContainer.offsetWidth);
                    indicador.innerText = `${index + 1} / ${todasAsFotos.length}`;
                };
            } else if(indicador) {
                indicador.classList.add('hidden');
            }
        }
    }

    // Elementos da interface
    const elNome = document.getElementById('det-nome');
    const elDesc = document.getElementById('det-desc');
    const elPreco = document.getElementById('det-preco');
    const elObsContainer = document.getElementById('det-obs-container'); // Onde os sabores aparecerão

    if(elNome) elNome.innerText = item.nome;
    if(elDesc) elDesc.innerText = item.descricao || 'Esse produto não possui uma descrição detalhada.';
    if(elPreco) elPreco.innerText = `R$ ${parseFloat(item.preco).toFixed(2).replace('.', ',')}`;

    // Exibe as observações/sabores de forma clara e sem ocultar
    if(elObsContainer) {
        if(item.observacao && item.observacao.trim() !== "") {
            elObsContainer.innerHTML = `
                <div class="mt-4 p-4 bg-slate-50 rounded-2xl border border-slate-100">
                    <p class="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-2 italic">Sabores / Opções:</p>
                    <p class="text-xs font-black text-slate-700 leading-relaxed uppercase italic">${item.observacao.trim()}</p>
                </div>`;
            elObsContainer.classList.remove('hidden');
        } else {
            elObsContainer.classList.add('hidden');
        }
    }

    // Reseta caixas do modal antigo caso ainda existam no HTML
    const bS = document.getElementById('box-sabores'), lS = document.getElementById('lista-sabores');
    if(lS) lS.innerHTML = '';
    if(bS) bS.classList.add('hidden');

    const bR = document.getElementById('box-retirar'), lR = document.getElementById('lista-retirar');
    if(lR) lR.innerHTML = '';
    if(bR) bR.classList.add('hidden');

    const bA = document.getElementById('box-adicionar'), lA = document.getElementById('lista-adicionar');
    if(lA) lA.innerHTML = '';
    if(bA) bA.classList.add('hidden');

    const m = document.getElementById('modal-detalhes');
    if(m) {
        m.classList.remove('hidden');
        m.style.display = 'flex';
    }
}

window.fecharDetalhes = function() { 
    const m = document.getElementById('modal-detalhes'); 
    if(m) { m.classList.add('hidden'); m.style.setProperty('display', 'none', 'important'); }
}

// =============================================================
// FILTROS E BUSCA INTERNA
// =============================================================
window.buscarProduto = function() { 
    const campo = document.getElementById('campo-busca');
    if (!campo) return;
    const t = campo.value.toLowerCase().trim(); 
    window.render(PRODUTOS.filter(p => p.nome.toLowerCase().includes(t))); 
}

window.setCategoria = function(cat) { 
    // 1. Reseta o visual de todos os botões para o estado "inativo" (claro)
    document.querySelectorAll('.btn-categoria').forEach(btn => {
        btn.className = "btn-categoria bg-white dark:bg-transparent text-slate-400 border border-slate-200 dark:border-slate-700 px-6 py-2.5 rounded-full text-[10px] font-black uppercase tracking-widest shrink-0 transition-all hover:bg-slate-50 dark:hover:bg-slate-800";
    }); 
    
    // 2. Destaca visualmente o botão que foi clicado usando o ID (escuro)
    const btnAtivo = document.getElementById(`btn-cat-${cat}`);
    if (btnAtivo) {
        btnAtivo.className = "btn-categoria bg-[#1e293b] text-white border border-[#1e293b] px-6 py-2.5 rounded-full text-[10px] font-black uppercase tracking-widest shrink-0 transition-all shadow-md";
    }
    
    // 3. Filtra e exibe os produtos correspondentes
    if (cat === 'todos') {
        window.render(PRODUTOS);
    } else {
        window.render(PRODUTOS.filter(p => (p.categoria || '').toLowerCase().trim() === cat));
    }
}

let MODO_VISUALIZACAO = 'list'; // 'grid' ou 'list'

window.alternarVisualizacao = function() {
    MODO_VISUALIZACAO = (MODO_VISUALIZACAO === 'grid') ? 'list' : 'grid';
    
    // Salva a preferência para quando o usuário voltar
    localStorage.setItem('modoView', MODO_VISUALIZACAO);
    
    const icone = document.getElementById('icone-view');
    if (icone) {
        icone.className = (MODO_VISUALIZACAO === 'grid') ? 'ph-bold ph-list text-xl' : 'ph-bold ph-squares-four text-xl';
    }
    
    // Renderiza com a lista filtrada atual
    window.render(window.PRODUTOS_FILTRADOS || PRODUTOS);
};

window.render = function(lista) {
    const container = document.getElementById('cardapio');
    if (!container) return;
    
    window.PRODUTOS_FILTRADOS = lista;

    if (lista.length === 0) { 
        container.innerHTML = `<p class="col-span-full text-center py-20 font-black text-slate-300 uppercase italic text-xs">Nenhum item disponível.</p>`; 
        return; 
    }
    
    // MODO GRADE (BLOCO)
    if (MODO_VISUALIZACAO === 'grid') {
        container.className = "grid grid-cols-2 gap-4 px-4 pb-10";
        container.innerHTML = lista.map(p => {
            const temObs = p.observacao && p.observacao.trim() !== "";
            
            return `
            <div onclick="window.abrirDetalhes(${p.id})" class="bg-white p-2.5 rounded-[2rem] shadow-sm border border-slate-100 active:scale-95 transition-all cursor-pointer group hover:border-red-100 flex flex-col h-full relative">
                ${temObs ? '<div class="absolute top-4 left-4 bg-slate-500 text-white text-[8px] font-black px-2 py-0.5 rounded-full z-10 shadow-sm uppercase italic">Opções</div>' : ''}
                <div class="h-32 sm:h-36 bg-slate-50 rounded-[1.5rem] overflow-hidden mb-3 shrink-0 flex items-center justify-center text-4xl">
                    ${p.foto ? `<img src="${p.foto}" class="w-full h-full object-cover">` : '🍢'}
                </div>
                <div class="px-2 pb-2 flex-1 flex flex-col justify-between">
                    <div class="mb-2">
                        <p class="text-[9px] font-black text-slate-300 uppercase tracking-widest mb-1">/ ${p.categoria || 'Geral'}</p>
                        <h4 class="font-black text-xs uppercase text-slate-800 leading-tight italic truncate">${p.nome}</h4>
                    </div>
                    <div>
                        <span class="bg-red-600 text-white font-black text-xs px-3 py-1.5 rounded-xl shadow-md italic inline-block">R$ ${parseFloat(p.preco).toFixed(2).replace('.', ',')}</span>
                    </div>
                </div>
            </div>`;
        }).join('');
    } 
    // MODO LISTA
    else {
        container.className = "flex flex-col gap-3 px-4 pb-10";
        container.innerHTML = lista.map(p => {
            const temObs = p.observacao && p.observacao.trim() !== "";
            
            return `
            <div onclick="window.abrirDetalhes(${p.id})" class="bg-white p-3 rounded-2xl shadow-sm border border-slate-100 flex items-center gap-4 cursor-pointer hover:border-red-100 transition-all">
                <div class="w-16 h-16 bg-slate-50 rounded-xl overflow-hidden shrink-0 flex items-center justify-center text-2xl border border-slate-100">
                    ${p.foto ? `<img src="${p.foto}" class="w-full h-full object-cover">` : '🍢'}
                </div>


<div class="flex-1 min-w-0">
    <h4 class="font-black text-xs uppercase text-slate-800 italic truncate">${p.nome}</h4>
    <p class="text-[9px] font-black text-slate-300 uppercase tracking-widest mt-0.5">/ ${p.categoria || 'Geral'}</p>
    
    ${temObs ? `<p class="text-[9px] font-black text-slate-500 italic mt-1 uppercase whitespace-normal break-words">${p.observacao.trim()}</p>` : ''}
</div>
                <span class="font-black text-red-600 text-xs italic shrink-0">R$ ${parseFloat(p.preco).toFixed(2).replace('.', ',')}</span>
            </div>`;
        }).join('');
    }
}