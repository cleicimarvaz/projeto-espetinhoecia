/* =================================================================================
   MÓDULO DE CATÁLOGO DE PRODUTOS E ESTOQUE AVANÇADO (COM AUDITORIA)
   ================================================================================= */

window.produtoEdicaoId = null;

// --- 1. GESTÃO DE CATÁLOGO ---

window.renderizarCatalogo = async function() {
    if (typeof _supabase === 'undefined') return;
    
    const inputPesquisa = document.getElementById('filtro-pesquisa-catalogo');
    const termoPesquisa = inputPesquisa ? inputPesquisa.value.trim() : "";
    const selectOrdem = document.getElementById('ordem-catalogo');
    const criterio = selectOrdem ? selectOrdem.value : 'nome-asc';
    const nivelUsuario = localStorage.getItem('userNivel') || 'GARCOM';

    let campo = 'nome';
    let ascendente = true;
    switch (criterio) {
        case 'nome-desc': ascendente = false; break;
        case 'preco-asc': campo = 'preco'; ascendente = true; break;
        case 'preco-desc': campo = 'preco'; ascendente = false; break;
        case 'categoria': campo = 'categoria'; ascendente = true; break;
        default: campo = 'nome'; ascendente = true;
    }

    const { data: pds, error } = await _supabase.from('produtos').select('*').order(campo, { ascending: ascendente });
    const container = document.getElementById('lista-catalogo');
    if (!container || error) return;

    let produtosExibicao = pds;
    if (termoPesquisa) {
        const termoLimpo = typeof removerAcentos === 'function' ? removerAcentos(termoPesquisa) : termoPesquisa.toLowerCase();
        produtosExibicao = pds.filter(p => {
            const nomeStr = typeof removerAcentos === 'function' ? removerAcentos(p.nome) : p.nome.toLowerCase();
            return nomeStr.includes(termoLimpo);
        });
    }

    // NOVO: Verifica se o botão "Ativos" está marcado e esconde os que status === false
    const chkAtivos = document.getElementById('filtro-ocultar-inativos');
    if (chkAtivos && chkAtivos.checked) {
        produtosExibicao = produtosExibicao.filter(p => p.status === true);
    }

    if (produtosExibicao.length === 0) {
        container.innerHTML = '<p class="text-center text-[10px] text-slate-400 py-10 font-black uppercase italic">Nenhum resultado.</p>';
        return;
    }

    const icons = { 'espetos': '🍢', 'cervejas': '🍺', 'bebidas': '🥤', 'refeicao': '🍽️', 'acompanhamentos': '🍚' };
    
    container.innerHTML = produtosExibicao.map(p => {
        const statusClass = p.status ? 'opacity-100' : 'opacity-50 grayscale bg-slate-50 dark:bg-slate-800';
        
        // Esconde os botões de edição se for Garçom
        const botoesAcao = nivelUsuario.toUpperCase() !== 'GARCOM' ? `
            <div class="flex gap-2 items-center">
                <button onclick="prepararEdicao(${p.id})" class="bg-slate-100 dark:bg-slate-800 w-9 h-9 rounded-xl flex items-center justify-center border border-slate-200 dark:border-slate-700 active:scale-95 transition-all">✏️</button>
                <button onclick="toggleStatusProduto(${p.id}, ${!p.status})" class="bg-slate-100 dark:bg-slate-800 w-9 h-9 rounded-xl flex items-center justify-center border border-slate-200 dark:border-slate-700 active:scale-95 transition-all">${p.status ? '🟢' : '⚪'}</button>
                <button onclick="confirmarExclusaoProduto(${p.id})" class="bg-red-50 dark:bg-red-900/20 text-red-500 w-9 h-9 rounded-xl flex items-center justify-center border border-red-100 dark:border-red-800/50 active:scale-95 transition-all">🗑️</button>
            </div>
        ` : '';

// Garante que bebidas e cervejas NUNCA mostrem a etiqueta de cozinha
        const isBebida = p.categoria === 'bebidas' || p.categoria === 'cervejas';
        const badgeCozinha = (p.precisa_preparo !== false && !isBebida)
            ? '<span class="text-[8px] bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400 px-1 py-0.5 rounded font-black ml-2">🔥 COZINHA</span>' 
            : '';
        const badgeEstoque = p.controlar_estoque === true
            ? '<span class="text-[8px] bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 px-1 py-0.5 rounded font-black ml-2">📦 ESTOQUE</span>' 
            : '';

        return `
            <div class="bg-white dark:bg-slate-900 p-4 rounded-3xl shadow-sm flex items-center justify-between border-2 border-white dark:border-slate-800 mb-2 transition-all ${statusClass}">
                <div class="flex items-center gap-3">
                    <div class="bg-slate-50 dark:bg-slate-800 w-12 h-12 rounded-2xl flex items-center justify-center text-3xl shadow-inner">${icons[p.categoria] || '📦'}</div>
                    <div>
                        <div class="flex items-center flex-wrap gap-y-1">
                            <h4 class="font-black text-[11px] uppercase italic text-slate-800 dark:text-slate-200 leading-tight">${p.nome}</h4>
                            ${badgeCozinha} ${badgeEstoque}
                        </div>
                        <div class="flex items-center gap-2 mt-1">
                            <span class="text-[10px] font-black text-red-500">R$ ${formatarMoeda(p.preco)}</span>
                            <span class="text-[8px] font-black text-slate-300 uppercase italic">/ ${p.categoria}</span>
                        </div>
                    </div>
                </div>
                ${botoesAcao}
            </div>`;
    }).join('');
}

window.alternarAbasAdminProdutos = function(aba) {
    ['lista', 'cadastro', 'estoque'].forEach(id => {
        const el = document.getElementById(`aba-${id}`);
        if(el) el.classList.add('hidden');
        
        const btn = document.getElementById(`btn-aba-${id}`);
        if(btn) btn.className = "flex-1 py-3 rounded-full bg-transparent text-slate-400 dark:text-slate-500 text-[9px] font-black uppercase transition-all font-sans italic tracking-widest hover:bg-slate-50 dark:hover:bg-slate-800";
    });

    const abaAtiva = document.getElementById(`aba-${aba}`);
    const btnAtivo = document.getElementById(`btn-aba-${aba}`);
    
    if (abaAtiva) abaAtiva.classList.remove('hidden');
    if (btnAtivo) btnAtivo.className = "flex-1 py-3 rounded-full bg-[#e63946] text-white text-[9px] font-black uppercase transition-all font-sans italic tracking-widest shadow-sm";

if (aba === 'lista') renderizarCatalogo();
    if (aba === 'estoque') renderizarEstoque();
    if (aba === 'cadastro' && !window.produtoEdicaoId) {
        document.getElementById('p-nome').value = '';
        document.getElementById('p-preco').value = '';
        document.getElementById('p-categoria').value = 'espetos';
        if(document.getElementById('p-controla-estoque')) document.getElementById('p-controla-estoque').checked = false;
        
        // Garante que o botão de cozinha resete corretamente
        if(typeof atualizarToggleCozinha === 'function') atualizarToggleCozinha();
    }
}

window.salvarProduto = async function() {
    const nome = document.getElementById('p-nome').value.toUpperCase().trim();
    const cat = document.getElementById('p-categoria').value;
    
    const inputPreco = document.getElementById('p-preco').value;
    const preco = typeof convMoedaFloat === 'function' ? convMoedaFloat(inputPreco) : parseFloat(inputPreco.replace(/\D/g, "")) / 100;
    
    const controlaEstoque = document.getElementById('p-controla-estoque') ? document.getElementById('p-controla-estoque').checked : false;
    
    // ====================================================
    // 1. CAPTURA O NOVO CAMPO DE INGREDIENTES
    // ====================================================
    const inputIngredientes = document.getElementById('p-ingredientes');
    const ingredientes = inputIngredientes ? inputIngredientes.value.trim() : null;
    
    let prepara = false;
    if (cat !== 'bebidas' && cat !== 'cervejas') {
        prepara = document.getElementById('p-preparo') ? document.getElementById('p-preparo').checked : true;
    }

    if (!nome || preco <= 0) {
        if (typeof showToast === 'function') {
            showToast("PREENCHA NOME E PREÇO", "erro");
        } else if (typeof alertaSistema === 'function') {
            alertaSistema("Por favor, preencha o nome do produto e um preço maior que zero.", "Campos Inválidos");
        } else {
            alert("Preencha nome e preço válido");
        }
        return;
    }
    
    if (typeof setLoading === 'function') setLoading('btn-salvar-produto', true);

    try {
        const dados = { 
            nome, 
            categoria: cat, 
            preco, 
            status: true, 
            precisa_preparo: prepara,
            controlar_estoque: controlaEstoque,
            // ====================================================
            // 2. ENVIA OS INGREDIENTES PARA O BANCO DE DADOS
            // ====================================================
            ingredientes: ingredientes 
        };

        if (window.produtoEdicaoId) {
            const { error } = await _supabase.from('produtos').update(dados).eq('id', window.produtoEdicaoId);
            if (error) throw error;
            
            if(typeof registrarLog === 'function') {
                await registrarLog("ESTOQUE", `EDITOU PRODUTO ID ${window.produtoEdicaoId}: ${nome} | NOVO PREÇO: R$ ${preco.toFixed(2)} | CAT: ${cat.toUpperCase()}`);
            }
            
        } else {
            dados.estoque_atual = 0; 
            const { error } = await _supabase.from('produtos').insert([dados]);
            if (error) throw error;
            
            if(typeof registrarLog === 'function') {
                await registrarLog("ESTOQUE", `CADASTROU NOVO PRODUTO: ${nome} | PREÇO: R$ ${preco.toFixed(2)} | CAT: ${cat.toUpperCase()}`);
            }
        }

        window.produtoEdicaoId = null;
        if (typeof alternarAbasAdminProdutos === 'function') alternarAbasAdminProdutos('lista'); 
        if (typeof showToast === 'function') showToast("PRODUTO SALVO COM SUCESSO!");
        
    } catch (e) {
        console.error("Erro ao salvar produto:", e);
        if (typeof showToast === 'function') {
            showToast("ERRO AO SALVAR PRODUTO", "erro");
        } else if (typeof alertaSistema === 'function') {
            alertaSistema("Ocorreu um erro de comunicação ao tentar salvar este produto no banco de dados.", "Erro de Conexão");
        }
    } finally {
        if (typeof setLoading === 'function') setLoading('btn-salvar-produto', false);
    }
}

window.prepararEdicao = async function(id) {
    try {
        const { data: p, error } = await _supabase.from('produtos').select('*').eq('id', id).single();
        if (error || !p) return;

        document.getElementById('p-nome').value = p.nome;
        document.getElementById('p-categoria').value = p.categoria;
        document.getElementById('p-preco').value = typeof formatarMoeda === 'function' ? formatarMoeda(p.preco) : p.preco;
        
        // ====================================================
        // PREENCHE O CAMPO DE INGREDIENTES NA EDIÇÃO
        // ====================================================
        const inputIngredientes = document.getElementById('p-ingredientes');
        if (inputIngredientes) {
            inputIngredientes.value = p.ingredientes || '';
        }
        // ====================================================

        const checkboxPreparo = document.getElementById('p-preparo');
        if(checkboxPreparo) checkboxPreparo.checked = p.precisa_preparo !== false;

        const checkboxEstoque = document.getElementById('p-controla-estoque');
        if(checkboxEstoque) checkboxEstoque.checked = p.controlar_estoque === true;
        
        window.produtoEdicaoId = id;
        if (typeof alternarAbasAdminProdutos === 'function') alternarAbasAdminProdutos('cadastro');
    } catch (e) {
        console.error("Erro ao preparar edição:", e);
    }
}

window.cancelarEdicao = function() {
    window.produtoEdicaoId = null;
    document.getElementById('p-nome').value = '';
    document.getElementById('p-preco').value = '';
    
    // ====================================================
    // LIMPA O CAMPO DE INGREDIENTES
    // ====================================================
    if (document.getElementById('p-ingredientes')) {
        document.getElementById('p-ingredientes').value = '';
    }
    // ====================================================

    alternarAbasAdminProdutos('lista');
}

window.toggleStatusProduto = async function(id, novoStatus) {
    try {
        const { error } = await _supabase.from('produtos').update({ status: novoStatus }).eq('id', id);
        if (error) throw error;
        
        // LOG DE AUDITORIA: MUDANÇA DE STATUS
        if(typeof registrarLog === 'function') registrarLog("STATUS PRODUTO", `ID: ${id} | NOVO STATUS: ${novoStatus ? 'ATIVO' : 'INATIVO'}`);
        
        renderizarCatalogo();
    } catch (e) {
        console.error("Erro ao mudar status:", e);
        if(typeof showToast === 'function') showToast("ERRO AO ATUALIZAR STATUS", "erro");
    }
}

window.confirmarExclusaoProduto = function(id) {
    const mensagem = "Esta ação removerá o produto do cardápio permanentemente. Deseja continuar?";
    const titulo = "EXCLUIR PRODUTO";

    // 1. Isolamos toda a lógica de exclusão no callback
    const acaoDeletarProduto = async () => {
        try {
            // Busca o nome do produto ANTES de apagar para deixar o log perfeito
            const { data: produto, error: errBusca } = await _supabase
                .from('produtos')
                .select('nome')
                .eq('id', id)
                .single();

            if (errBusca) throw errBusca;

            // Executa a exclusão no banco
            const { error: errDel } = await _supabase.from('produtos').delete().eq('id', id);
            if (errDel) throw errDel;
            
            // --- LOG DE AUDITORIA DETALHADO ---
            if (typeof registrarLog === 'function') {
                const nomeProduto = produto ? produto.nome : `ID ${id}`;
                await registrarLog("ESTOQUE", `EXCLUIU PRODUTO: ${nomeProduto} (ID: ${id})`);
            }
            
            // Atualiza a interface
            if (typeof renderizarCatalogo === 'function') renderizarCatalogo();
            if (typeof showToast === 'function') showToast("PRODUTO EXCLUÍDO!", "sucesso");

        } catch (e) {
            console.error("Erro ao excluir produto:", e);
            
            // Tratamento de erro padronizado
            if (typeof showToast === 'function') {
                showToast("ERRO AO EXCLUIR PRODUTO", "erro");
            } else if (typeof alertaSistema === 'function') {
                alertaSistema("Não foi possível excluir o produto do banco de dados. Tente novamente.", "Erro de Conexão");
            }
        }
    };

    // 2. Chama o nosso modal padronizado de Confirmação (com fallback para o nativo)
    if (typeof confirmarAcao === 'function') {
        confirmarAcao(mensagem, acaoDeletarProduto, titulo);
    } else {
        if (confirm("Deseja realmente excluir este produto?")) {
            acaoDeletarProduto();
        }
    }
}

// --- 2. GESTÃO DE ESTOQUE (INVENTÁRIO) ---

window.renderizarEstoque = async function() {
    if (typeof _supabase === 'undefined') return;
    
    const { data: pds } = await _supabase.from('produtos').select('*').eq('controlar_estoque', true).order('nome');
    const container = document.getElementById('lista-estoque');
    if (!container) return;

    if (!pds || pds.length === 0) {
        container.innerHTML = '<p class="text-center text-[10px] text-slate-400 py-10 font-black uppercase italic">Nenhum produto configurado para controle de estoque.</p>';
        return;
    }

    container.innerHTML = pds.map(p => `
        <div class="bg-white dark:bg-slate-900 p-4 rounded-3xl shadow-sm flex items-center justify-between border-2 border-slate-100 dark:border-slate-800 mb-2">
            <div>
                <h4 class="font-black text-[11px] uppercase italic text-slate-800 dark:text-slate-200 leading-tight">${p.nome}</h4>
                <div class="flex items-center gap-2 mt-1">
                    <span class="text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase">Qtd Atual:</span>
                    <span class="text-[14px] font-black ${p.estoque_atual <= 5 ? 'text-red-500' : 'text-emerald-500'}">${p.estoque_atual || 0}</span>
                </div>
            </div>
            <button onclick="abrirModalEstoque(${p.id}, '${p.nome}')" class="bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 px-4 py-2 rounded-xl text-[9px] font-black uppercase border border-blue-100 dark:border-blue-800/50 active:scale-95 transition-all">
                Ajustar
            </button>
        </div>`).join('');
}

window.abrirModalEstoque = function(id, nome) {
    document.getElementById('id-produto-movimentacao').value = id;
    document.getElementById('nome-produto-movimentacao').innerText = nome;
    document.getElementById('qtd-movimentacao').value = '';
    document.getElementById('motivo-movimentacao').value = '';
    document.getElementById('modal-movimentacao-estoque').classList.remove('hidden');
    document.getElementById('modal-movimentacao-estoque').classList.add('flex');
}

window.fecharModalEstoque = function() {
    document.getElementById('modal-movimentacao-estoque').classList.add('hidden');
    document.getElementById('modal-movimentacao-estoque').classList.remove('flex');
}

window.salvarMovimentacao = async function() {
    const idProd = document.getElementById('id-produto-movimentacao').value;
    const tipo = document.getElementById('tipo-movimentacao').value;
    const qtd = parseFloat(document.getElementById('qtd-movimentacao').value);
    const motivo = document.getElementById('motivo-movimentacao').value.trim().toUpperCase();
    const usuario = localStorage.getItem('userName') || 'Admin';

    // ----------------------------------------------------
    // VALIDAÇÃO 1: QUANTIDADE
    // ----------------------------------------------------
    if (!qtd || qtd <= 0) {
        if (typeof showToast === 'function') {
            showToast("Informe uma quantidade válida", "erro");
        } else if (typeof alertaSistema === 'function') {
            alertaSistema("Por favor, informe uma quantidade válida maior que zero para movimentar o estoque.", "Atenção");
        } else {
            alert("Quantidade inválida");
        }
        return;
    }

    // ----------------------------------------------------
    // VALIDAÇÃO 2: MOTIVO
    // ----------------------------------------------------
    if (!motivo) {
        if (typeof showToast === 'function') {
            showToast("Informe o motivo", "erro");
        } else if (typeof alertaSistema === 'function') {
            alertaSistema("Por favor, informe o motivo deste ajuste de estoque (ex: Compra, Perda, Vencimento).", "Atenção");
        } else {
            alert("Informe o motivo");
        }
        return;
    }

    if (typeof setLoading === 'function') setLoading('btn-salvar-movimentacao', true);

    try {
        // Buscamos o nome e o estoque atual para um log mais completo
        const { data: p, error: errP } = await _supabase.from('produtos').select('nome, estoque_atual').eq('id', idProd).single();
        if (errP) throw errP;

        let novoEstoque = parseFloat(p.estoque_atual || 0);

        if (tipo === 'entrada') novoEstoque += qtd;
        else novoEstoque -= qtd;

        // 1. Atualiza o saldo no produto
        const { error: errUpdate } = await _supabase.from('produtos').update({ estoque_atual: novoEstoque }).eq('id', idProd);
        if (errUpdate) throw errUpdate;

        // 2. Registra na tabela de movimentações (histórico do produto)
        const { error: errMov } = await _supabase.from('estoque_movimentacoes').insert([{
            produto_id: idProd, 
            tipo, 
            quantidade: qtd, 
            motivo, 
            usuario
        }]);
        if (errMov) throw errMov;

        // --- REGISTRO DE AUDITORIA DETALHADO ---
        if(typeof registrarLog === 'function') {
            await registrarLog("ESTOQUE", `AJUSTE MANUAL: ${tipo.toUpperCase()} DE ${qtd} UNID. EM: ${p.nome} | MOTIVO: ${motivo}`);
        }

        if (typeof showToast === 'function') showToast("ESTOQUE ATUALIZADO!");
        
        fecharModalEstoque();
        
        if (typeof renderizarEstoque === 'function') renderizarEstoque(); 

    } catch (e) {
        console.error("Erro estoque:", e);
        // ----------------------------------------------------
        // TRATAMENTO DE ERRO NO CATCH
        // ----------------------------------------------------
        if (typeof showToast === 'function') {
            showToast("ERRO AO ATUALIZAR ESTOQUE", "erro");
        } else if (typeof alertaSistema === 'function') {
            alertaSistema("Ocorreu um erro de comunicação com o banco de dados. Tente novamente.", "Erro");
        }
    } finally {
        if (typeof setLoading === 'function') setLoading('btn-salvar-movimentacao', false);
    }
}

window.atualizarToggleCozinha = function() {
    const categoria = document.getElementById('p-categoria').value;
    const togglePreparo = document.getElementById('p-preparo');
    
    if (togglePreparo) {
        if (categoria === 'bebidas' || categoria === 'cervejas') {
            togglePreparo.checked = false; // Desliga o botão
        } else {
            togglePreparo.checked = true;  // Liga o botão
        }
    }
}