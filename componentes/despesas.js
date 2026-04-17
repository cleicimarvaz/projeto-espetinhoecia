/* =================================================================================
   MÓDULO: CONTAS A PAGAR / DESPESAS
   ================================================================================= */

// Variável global para controlar a aba ativa (pendente ou paga)
window.filtroStatusDespesa = 'pendente';

// Variáveis globais para controlar o período de datas
window.filtroDespesasDataInicio = null;
window.filtroDespesasDataFim = null;


/* =================================================================================
   1. FILTROS E INTERFACE
   ================================================================================= */

window.aplicarFiltroDespesas = function(dias) {
    const inputIni = document.getElementById('data-inicio-despesas');
    const inputFim = document.getElementById('data-fim-despesas');
    const painel = document.getElementById('container-periodo-despesas');

    const hoje = new Date();
    const dataFimStr = hoje.toISOString().split('T')[0];
    let dataIniStr = dataFimStr;

    // 1. LÓGICA DE CÁLCULO E VISIBILIDADE
    if (dias === 'custom') {
        // Clicou na Lupa 🔍: Não fazemos nada com os inputs, apenas filtramos
        // O painel continua aberto para o usuário ver o que filtrou
    } else if (dias === 99) {
        // Clicou em "PERÍODO": Apenas destaca o botão, não altera datas nem esconde o painel
    } else {
        // Clicou em HOJE (0), 7 ou 30 dias:
        const passada = new Date();
        passada.setDate(hoje.getDate() - dias);
        dataIniStr = passada.toISOString().split('T')[0];
        
        // Injeta as datas calculadas
        if (inputIni) inputIni.value = dataIniStr;
        if (inputFim) inputFim.value = dataFimStr;
        
        // Esconde o painel pois é um filtro rápido
        if (painel) painel.classList.add('hidden');
    }

    // 2. ATUALIZA O VISUAL DOS BOTÕES
    const opcoes = [0, 7, 30, 'periodo'];
    opcoes.forEach(id => {
        const btn = document.getElementById(`btn-desp-${id}`);
        if (btn) {
            // Se for 99 ou 'custom', o botão 'periodo' fica ativo
            const isActive = (id === dias) || ((dias === 99 || dias === 'custom') && id === 'periodo');
            
            if (isActive) {
                btn.className = "flex-1 py-3 text-[9px] font-black uppercase rounded-lg transition-all shadow-sm bg-white dark:bg-slate-700 text-slate-800 dark:text-white border border-slate-200 dark:border-slate-600";
            } else {
                btn.className = "flex-1 py-3 text-[9px] font-black uppercase rounded-lg transition-all text-slate-500 dark:text-slate-400 hover:bg-white dark:hover:bg-slate-700";
            }
        }
    });

    // 3. EXECUTA A BUSCA (Apenas se não for o 99, pois o 99 é só para abrir a gaveta)
    if (dias !== 99 && typeof carregarDespesas === 'function') {
        carregarDespesas(); 
    }
};

window.toggleFiltroPeriodoDespesas = function() {
    const painel = document.getElementById('container-periodo-despesas');
    const btnPeriodo = document.getElementById('btn-desp-periodo');

    if (painel) {
        const estaEscondido = painel.classList.contains('hidden');
        
        // 1. Alterna a visibilidade
        painel.classList.toggle('hidden');

        // 2. Se abriu o painel, destacamos o botão visualmente
        if (estaEscondido) {
            // Remove destaque de outros botões (0, 7, 30) para focar no período
            document.querySelectorAll('[id^="btn-desp-"]').forEach(btn => {
                btn.classList.remove('bg-white', 'dark:bg-slate-700', 'shadow-sm', 'text-slate-900', 'dark:text-white');
            });
            
            // Adiciona destaque ao botão de período
            if (btnPeriodo) {
                btnPeriodo.classList.add('bg-white', 'dark:bg-slate-700', 'shadow-sm', 'text-slate-900', 'dark:text-white');
                btnPeriodo.innerHTML = 'PERÍODO ▲'; // Muda a seta para cima
            }
        } else {
            // Se fechou, apenas volta a seta ao normal
            if (btnPeriodo) btnPeriodo.innerHTML = 'PERÍODO ▼';
        }
    }
};

window.filtrarDespesas = function(status) {
    window.filtroStatusDespesa = status;
    
    const btnPendente = document.getElementById('btn-filtro-despesa-pendente');
    const btnPaga = document.getElementById('btn-filtro-despesa-paga');
    if(!btnPendente || !btnPaga) return;
    
    const classeAtiva = 'bg-orange-500 text-white shadow-sm hover:bg-orange-600';
    const classeInativa = 'bg-slate-200 dark:bg-slate-800 text-slate-500 dark:text-slate-400 hover:bg-slate-300 dark:hover:bg-slate-700';

    if (status === 'pendente') {
        btnPendente.className = `flex-1 py-3 rounded-xl text-[9px] font-black uppercase transition-all ${classeAtiva}`;
        btnPaga.className = `flex-1 py-3 rounded-xl text-[9px] font-black uppercase transition-all ${classeInativa}`;
    } else {
        btnPaga.className = `flex-1 py-3 rounded-xl text-[9px] font-black uppercase transition-all ${classeAtiva.replace('orange', 'emerald')}`;
        btnPendente.className = `flex-1 py-3 rounded-xl text-[9px] font-black uppercase transition-all ${classeInativa}`;
    }
    
    window.carregarDespesas();
};

window.toggleDataPagamento = function() {
    const isPaga = document.getElementById('d-paga').checked;
    const containerData = document.getElementById('container-data-pagamento');
    const inputData = document.getElementById('d-data-pagamento');
    
    if (isPaga) {
        containerData.classList.remove('hidden');
        if (!inputData.value) {
            inputData.value = new Date().toISOString().split('T')[0];
        }
    } else {
        containerData.classList.add('hidden');
        inputData.value = '';
    }
};


/* =================================================================================
   2. LISTAGEM E FORMULÁRIO
   ================================================================================= */

window.carregarDespesas = async function() {
    const lista = document.getElementById('lista-despesas');
    if (!lista) return;

    // 1. Puxa as datas do novo filtro global (definidas no aplicarFiltroDespesas)
    let dataInicio = window.filtroDespesasDataInicio;
    let dataFim = window.filtroDespesasDataFim;

    // Fallback de segurança: Se for o primeiro carregamento e não tiver filtro ativo, puxa os últimos 30 dias
    if (!dataInicio || !dataFim) {
        const hoje = new Date();
        dataFim = hoje.toISOString().split('T')[0];
        const trintaDiasAtras = new Date();
        trintaDiasAtras.setDate(hoje.getDate() - 30);
        dataInicio = trintaDiasAtras.toISOString().split('T')[0];
    }

    try {
        lista.innerHTML = `<p class="text-center text-[10px] font-black text-slate-400 uppercase animate-pulse py-8">Carregando contas...</p>`;

        // 2. Busca no banco usando o novo intervalo de datas
        const { data, error } = await _supabase
            .from('despesas')
            .select('*')
            .gte('vencimento', dataInicio)
            .lte('vencimento', dataFim)
            .order('vencimento', { ascending: true });

        if (error) throw error;

        // 3. Filtra localmente baseado na aba ativa (Pendente ou Paga)
        const isPagaFiltro = window.filtroStatusDespesa === 'paga';
        const despesasFiltradas = data.filter(d => d.paga === isPagaFiltro);

        if (despesasFiltradas.length === 0) {
            lista.innerHTML = `
                <div class="text-center py-10 opacity-50">
                    <div class="text-3xl mb-2">🧾</div>
                    <p class="text-[10px] font-black uppercase text-slate-500">Nenhuma conta ${window.filtroStatusDespesa} neste período.</p>
                </div>`;
            return;
        }

        const hojeObj = new Date();
        hojeObj.setHours(0,0,0,0);
        
        // Formata moeda usando a utilidade global ou fallback
        const formatMoeda = typeof window.formatarMoeda === 'function' ? window.formatarMoeda : val => parseFloat(val).toFixed(2);

        // 4. Renderiza a lista intocada
        lista.innerHTML = despesasFiltradas.map(d => {
            // Lógica de Alerta de Vencimento (Apenas para pendentes)
            let statusAtrasoHtml = '';
            if (!d.paga) {
                const partesData = d.vencimento.split('-');
                const vencObj = new Date(partesData[0], partesData[1] - 1, partesData[2]);
                
                if (vencObj < hojeObj) {
                    statusAtrasoHtml = `<span class="bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 px-2 py-0.5 rounded text-[8px] font-black uppercase border border-red-200 dark:border-red-800">⚠️ Vencida</span>`;
                } else if (vencObj.getTime() === hojeObj.getTime()) {
                    statusAtrasoHtml = `<span class="bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400 px-2 py-0.5 rounded text-[8px] font-black uppercase border border-orange-200 dark:border-orange-800">Vence Hoje</span>`;
                }
            }

            const dataVencFormatada = d.vencimento.split('-').reverse().join('/');
            const dataPagFormatada = d.data_pagamento ? d.data_pagamento.split('-').reverse().join('/') : '';

            return `
                <div class="bg-slate-50 dark:bg-slate-800 p-4 rounded-2xl border border-slate-100 dark:border-slate-700 flex flex-col gap-3 transition-colors">
                    <div class="flex justify-between items-start">
                        <div class="flex-1 pr-2">
                            <span class="text-[8px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest block mb-1">${d.categoria}</span>
                            <h4 class="text-xs font-black text-slate-700 dark:text-slate-200 uppercase leading-tight">${d.descricao}</h4>
                            <div class="mt-2 flex items-center gap-2">
                                <span class="text-[9px] font-bold text-slate-500 dark:text-slate-400 uppercase">Venc: ${dataVencFormatada}</span>
                                ${statusAtrasoHtml}
                            </div>
                            ${d.paga ? `<span class="text-[9px] font-bold text-emerald-500 uppercase block mt-1">Pago em: ${dataPagFormatada}</span>` : ''}
                        </div>
                        <div class="text-right">
                            <span class="text-sm font-black ${d.paga ? 'text-emerald-500' : 'text-[#e63946]'}">R$ ${formatMoeda(d.valor)}</span>
                        </div>
                    </div>
                    
                    <div class="flex flex-wrap gap-2 border-t border-slate-200 dark:border-slate-700 pt-3 mt-1">
                        ${!d.paga ? `
// --- BOTÃO PAGAR AGORA ---
// Adicionamos whitespace-nowrap e tracking-tighter para o texto não quebrar
<button onclick="marcarComoPaga(${d.id})" class="flex-[2] min-w-[90px] whitespace-nowrap bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 py-2 px-1 rounded-lg text-[8px] font-black uppercase active:scale-95 transition-all border border-emerald-200 dark:border-emerald-800 tracking-tighter">
    💸 Pagar Agora
</button>

// --- BOTÃO COMPROVANTE ---
// Adicionamos whitespace-nowrap e diminuímos levemente a fonte para 8px
<button onclick="imprimirComprovanteDespesa(${d.id})" class="flex-1 whitespace-nowrap bg-white dark:bg-slate-700 text-slate-600 dark:text-slate-300 py-2 px-1 rounded-lg text-[8px] font-black uppercase active:scale-95 transition-all border border-slate-200 dark:border-slate-600 shadow-sm flex items-center justify-center gap-1 tracking-tighter">
    🖨️ Comprovante
</button>

// --- BOTÃO EDITAR ---
<button onclick="abrirFormDespesa(${d.id})" class="flex-1 bg-white dark:bg-slate-700 text-slate-600 dark:text-slate-300 py-2 rounded-lg text-[8px] font-black uppercase active:scale-95 transition-all border border-slate-200 dark:border-slate-600 shadow-sm">
    ✏️ Editar
</button>

// --- BOTÃO EXCLUIR ---
<button onclick="excluirDespesa(${d.id})" class="flex-none w-8 bg-red-50 dark:bg-red-900/20 text-red-500 py-2 rounded-lg text-[9px] font-black uppercase active:scale-95 transition-all border border-red-100 dark:border-red-900/30">
    🗑️
</button>
                    </div>
                </div>
            `;
        }).join('');

    } catch (e) {
        console.error("❌ Erro ao listar despesas:", e);
        lista.innerHTML = `<p class="text-center text-xs font-bold text-red-500 py-10 uppercase">Erro ao carregar dados do banco.</p>`;
    }
};

window.abrirFormDespesa = async function(id = null) {
    document.getElementById('d-id').value = '';
    document.getElementById('d-descricao').value = '';
    document.getElementById('d-valor').value = '';
    document.getElementById('d-vencimento').value = '';
    document.getElementById('d-categoria').value = 'FORNECEDORES';
    document.getElementById('d-paga').checked = false;
    document.getElementById('d-data-pagamento').value = '';
    
    window.toggleDataPagamento();
    document.getElementById('titulo-form-despesa').innerText = 'NOVA DESPESA';

    if (id) {
        document.getElementById('titulo-form-despesa').innerText = 'EDITAR DESPESA';
        try {
            const { data, error } = await _supabase.from('despesas').select('*').eq('id', id).single();
            if (error) throw error;
            if (data) {
                document.getElementById('d-id').value = data.id;
                document.getElementById('d-descricao').value = data.descricao;
                const formatMoeda = typeof window.formatarMoeda === 'function' ? window.formatarMoeda : val => parseFloat(val).toFixed(2);
                document.getElementById('d-valor').value = formatMoeda(data.valor);
                document.getElementById('d-vencimento').value = data.vencimento;
                document.getElementById('d-categoria').value = data.categoria;
                document.getElementById('d-paga').checked = data.paga;
                if (data.paga) {
                    document.getElementById('d-data-pagamento').value = data.data_pagamento;
                }
                window.toggleDataPagamento();
            }
        } catch (e) {
            console.error("❌ Erro ao buscar despesa para edição:", e);
            if (typeof showToast === 'function') showToast("Erro ao carregar despesa", "erro");
        }
    }

    document.getElementById('view-lista-despesas').classList.add('hidden');
    document.getElementById('view-form-despesa').classList.remove('hidden');
};

window.fecharFormDespesa = function() {
    document.getElementById('view-form-despesa').classList.add('hidden');
    document.getElementById('view-lista-despesas').classList.remove('hidden');
};

window.salvarDespesa = async function() {
    const id = document.getElementById('d-id').value;
    const descricao = document.getElementById('d-descricao').value.trim().toUpperCase();
    const valorStr = document.getElementById('d-valor').value;
    
    let valor = 0;
    if (typeof window.convMoedaFloat === 'function') {
        valor = window.convMoedaFloat(valorStr);
    } else {
        valor = parseFloat(valorStr.replace(/\D/g, '')) / 100 || 0;
    }

    const vencimento = document.getElementById('d-vencimento').value;
    const categoria = document.getElementById('d-categoria').value;
    const paga = document.getElementById('d-paga').checked;
    const dataPagamento = document.getElementById('d-data-pagamento').value;

    if (!descricao || valor <= 0 || !vencimento) {
        if (typeof showToast === 'function') showToast("Preencha descrição, valor e vencimento!", "erro");
        return;
    }

    if (paga && !dataPagamento) {
        if (typeof showToast === 'function') showToast("Informe a data em que foi pago!", "erro");
        return;
    }

    const payload = {
        descricao,
        valor,
        vencimento,
        categoria,
        paga,
        data_pagamento: paga ? dataPagamento : null,
        cadastrado_por: localStorage.getItem('userName') || 'Admin'
    };

    try {
        const valorF = typeof window.formatarMoeda === 'function' ? window.formatarMoeda(valor) : `R$ ${valor.toFixed(2)}`;
        const statusTxt = paga ? "PAGA" : "PENDENTE";

        if (id) {
            const { error } = await _supabase.from('despesas').update(payload).eq('id', id);
            if (error) throw error;

            // --- LOG DE AUDITORIA: EDIÇÃO ---
            if (typeof registrarLog === 'function') {
                await registrarLog('FINANCEIRO', `EDITOU DESPESA: ${descricao} | VALOR: ${valorF} | STATUS: ${statusTxt}`);
            }

            if (typeof showToast === 'function') showToast("Despesa atualizada!", "sucesso");
        } else {
            const { error } = await _supabase.from('despesas').insert([payload]);
            if (error) throw error;

            // --- LOG DE AUDITORIA: NOVO LANÇAMENTO ---
            if (typeof registrarLog === 'function') {
                await registrarLog('FINANCEIRO', `LANÇOU NOVA DESPESA: ${descricao} | VALOR: ${valorF} | VENC: ${vencimento} | STATUS: ${statusTxt}`);
            }

            if (typeof showToast === 'function') showToast("Despesa cadastrada!", "sucesso");
        }
        
        window.fecharFormDespesa();
        window.carregarDespesas(); 
        window.verificarVencimentos(); 
        
    } catch (e) {
        console.error("❌ Erro ao salvar despesa:", e);
        if (typeof showToast === 'function') showToast("Erro ao salvar no banco de dados", "erro");
    }
};

/* =================================================================================
   3. AÇÕES DE ITEM (EXCLUIR, PAGAR, IMPRIMIR)
   ================================================================================= */

window.excluirDespesa = function(id) {
    const mensagem = "Tem certeza que deseja apagar este lançamento?";
    const titulo = "APAGAR DESPESA";

    // 1. Separamos toda a lógica de apagar em uma função assíncrona isolada
    const acaoDeletar = async () => {
        try {
            const { data: despesa, error: errBusca } = await _supabase
                .from('despesas')
                .select('descricao, valor')
                .eq('id', id)
                .single();

            if (errBusca) throw errBusca;

            const { error: errDel } = await _supabase.from('despesas').delete().eq('id', id);
            if (errDel) throw errDel;

            // --- REGISTRO DE AUDITORIA DETALHADO ---
            if (typeof registrarLog === 'function') {
                const valorF = typeof window.formatarMoeda === 'function' 
                    ? window.formatarMoeda(despesa.valor) 
                    : `R$ ${despesa.valor.toFixed(2)}`;
                    
                await registrarLog('FINANCEIRO', `EXCLUIU DESPESA: ${despesa.descricao} | VALOR: ${valorF} (ID: ${id})`);
            }

            if (typeof showToast === 'function') showToast("Registro apagado!", "sucesso");
            
            window.carregarDespesas();
            if (typeof window.verificarVencimentos === 'function') window.verificarVencimentos();

        } catch (e) {
            console.error("❌ [FINANCEIRO] Erro ao excluir despesa:", e);
            
            // Tratamento de erro padronizado
            if (typeof showToast === 'function') {
                showToast("Erro ao excluir registro", "erro");
            } else if (typeof alertaSistema === 'function') {
                alertaSistema("Não foi possível excluir a despesa. Verifique a conexão.", "Erro");
            }
        }
    };

    // 2. Chamamos o novo Modal (ou o confirm antigo como Fallback de segurança)
    if (typeof confirmarAcao === 'function') {
        confirmarAcao(mensagem, acaoDeletar, titulo);
    } else {
        if (confirm(mensagem)) {
            acaoDeletar();
        }
    }
};

window.marcarComoPaga = function(id) {
    const mensagem = "Confirmar o pagamento desta conta com a data de hoje?";
    const titulo = "CONFIRMAR PAGAMENTO";

    // 1. Isolamos a lógica de pagamento na função de callback
    const acaoPagar = async () => {
        const hoje = new Date().toISOString().split('T')[0];
        try {
            const { data: despesa, error: errBusca } = await _supabase
                .from('despesas')
                .select('descricao, valor')
                .eq('id', id)
                .single();
                
            if (errBusca) throw errBusca;

            const { error } = await _supabase.from('despesas').update({ paga: true, data_pagamento: hoje }).eq('id', id);
            if (error) throw error;
            
            // --- LOG DE AUDITORIA: BAIXA RÁPIDA ---
            if (typeof registrarLog === 'function') {
                const valorF = typeof window.formatarMoeda === 'function' ? window.formatarMoeda(despesa.valor) : `R$ ${despesa.valor.toFixed(2)}`;
                await registrarLog('FINANCEIRO', `MARCOU COMO PAGA: ${despesa.descricao} | VALOR: ${valorF}`);
            }

            if (typeof showToast === 'function') showToast("Baixa realizada com sucesso!", "sucesso");
            
            window.carregarDespesas();
            if (typeof window.verificarVencimentos === 'function') window.verificarVencimentos();
            
        } catch (e) {
            console.error("❌ Erro ao dar baixa na despesa:", e);
            
            // Tratamento de erro padronizado
            if (typeof showToast === 'function') {
                showToast("Erro ao processar baixa", "erro");
            } else if (typeof alertaSistema === 'function') {
                alertaSistema("Não foi possível registrar o pagamento no banco de dados. Tente novamente.", "Erro de Conexão");
            }
        }
    };

    // 2. Chamamos o novo Modal de Confirmação (com o confirm nativo como plano B)
    if (typeof confirmarAcao === 'function') {
        confirmarAcao(mensagem, acaoPagar, titulo);
    } else {
        if (confirm(mensagem)) {
            acaoPagar();
        }
    }
};

window.verificarVencimentos = async function() {
    const alerta = document.getElementById('alerta-vencimento-hoje');
    if (!alerta) return;
    const hojeStr = new Date().toISOString().split('T')[0];
    try {
        const { data, error } = await _supabase.from('despesas').select('id').eq('paga', false).lte('vencimento', hojeStr);
        if (error) throw error;
        if (data && data.length > 0) {
            alerta.classList.remove('hidden');
        } else {
            alerta.classList.add('hidden');
        }
    } catch (e) {
        console.error("❌ Erro ao verificar vencimentos:", e);
    }
};

window.imprimirComprovanteDespesa = function(id) {
    _supabase.from('despesas').select('*').eq('id', id).single().then(({ data: d }) => {
        if (!d) return;

        const formatMoeda = typeof window.formatarMoeda === 'function' ? window.formatarMoeda : val => val.toFixed(2);
        const dataVenc = d.vencimento.split('-').reverse().join('/');
        const dataPag = d.data_pagamento ? d.data_pagamento.split('-').reverse().join('/') : 'PENDENTE';

        // Estilos específicos para bobina de 58mm (Sem Logo)
        const style = `
            <style>
                @page { 
                    size: 58mm auto; 
                    margin: 0; 
                }
                body { 
                    width: 48mm; 
                    margin: 0; 
                    padding: 4mm; 
                    font-family: 'Courier New', Courier, monospace; 
                    font-size: 11px; 
                    line-height: 1.2;
                    color: #000;
                }
                .txt-center { text-align: center; }
                .divider { border-top: 1px dashed #000; margin: 4px 0; }
                .bold { font-weight: bold; }
                .total { font-size: 14px; margin: 8px 0; }
                .header-title { font-size: 13px; margin-bottom: 2px; }
            </style>
        `;

        let content = `
            ${style}
            <div class="txt-center">
                <span class="bold header-title">${localStorage.getItem('nomeLoja') || 'ESPETINHO & CIA'}</span><br>
                COMPROVANTE DE DESPESA
                <div class="divider"></div>
            </div>
            
            <div style="margin-top: 5px;">
                <span class="bold">DESCRIÇÃO:</span><br>${d.descricao}<br>
                <span class="bold">CATEGORIA:</span> ${d.categoria}<br>
                <span class="bold">VENCIMENTO:</span> ${dataVenc}<br>
                <span class="bold">PAGAMENTO:</span> ${dataPag}<br>
                <span class="bold">STATUS:</span> ${d.paga ? 'PAGO' : 'EM ABERTO'}
            </div>

            <div class="divider"></div>
            <div class="txt-center total bold">
                TOTAL: R$ ${formatMoeda(d.valor)}
            </div>
            <div class="divider"></div>
            
            <div class="txt-center" style="font-size: 8px; margin-top: 5px;">
                EMITIDO EM: ${new Date().toLocaleString('pt-BR')}
            </div>
        `;

        const win = window.open('', '', 'width=300,height=600');
        win.document.write('<html><head><title>Comprovante</title></head><body>' + content + '</body></html>');
        
        win.document.close();
        setTimeout(() => {
            win.print();
            win.close();
        }, 250);
    });
};

window.imprimirPDFDespesas = async function() {
    let dIni = document.getElementById('data-inicio-despesas')?.value;
    let dFim = document.getElementById('data-fim-despesas')?.value;

    if (!dIni || !dFim) {
        const hojeInput = new Date().toISOString().split('T')[0];
        dIni = dIni || hojeInput;
        dFim = dFim || hojeInput;
    }

    if(typeof showToast === 'function') showToast("GERANDO RELATÓRIO...", "aviso");

    try {
        const { data: despesas, error } = await _supabase
            .from('despesas')
            .select('*')
            .gte('vencimento', dIni)
            .lte('vencimento', dFim)
            .order('vencimento', { ascending: true });

        if (error) throw error;

        let totalPago = 0;
        let totalPendente = 0;
        const listaPagas = [];
        const listaPendentes = [];

        (despesas || []).forEach(d => {
            const valor = parseFloat(d.valor || 0);
            if (d.paga === true) { 
                totalPago += valor;
                listaPagas.push(d);
            } else {
                totalPendente += valor;
                listaPendentes.push(d);
            }
        });

        // --- CORREÇÃO DO NOME DO ARQUIVO (DDMMYYYY_Relatorio_Despesas) ---
        const agora = new Date();
        const dia = String(agora.getDate()).padStart(2, '0');
        const mes = String(agora.getMonth() + 1).padStart(2, '0');
        const ano = agora.getFullYear();
        const nomeArquivo = `${dia}${mes}${ano}_Relatorio_Despesas`;

        const logoBase64 = typeof obterLogoBase64 === 'function' ? await obterLogoBase64('img/logo.jpg') : '';
        const nomeLoja = (localStorage.getItem('nomeLoja') || 'ESPETINHO & CIA').toUpperCase();

        const estilos = `
            <style>
                * { margin: 0; padding: 0; box-sizing: border-box; }
                body { font-family: 'Helvetica', sans-serif; padding: 40px; color: #1e293b; font-size: 11px; background: #fff; }
                .header-pdf { border-bottom: 4px solid #e63946; padding-bottom: 20px; margin-bottom: 25px; position: relative; min-height: 100px; }
                .header-info h1 { font-size: 28px; font-weight: 900; font-style: italic; color: #e63946; text-transform: uppercase; margin-bottom: 5px; }
                .header-info p { font-size: 12px; font-weight: bold; color: #64748b; text-transform: uppercase; letter-spacing: 1px; }
                .header-logo { position: absolute; right: 0; top: 0; }
                .header-logo img { width: 90px; height: 90px; border-radius: 50%; border: 3px solid #f1f5f9; object-fit: cover; }
                
                .grid-resumo { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 15px; margin-bottom: 25px; }
                .card { background: #f8fafc; border: 1px solid #e2e8f0; padding: 12px; border-radius: 12px; border-left: 5px solid #e63946; }
                .card label { font-size: 9px; color: #64748b; text-transform: uppercase; font-weight: 900; display: block; margin-bottom: 4px; }
                .card b { font-size: 16px; color: #1e293b; font-weight: 900; }

                .secao-titulo { font-size: 13px; color: #e63946; font-weight: bold; text-transform: uppercase; border-left: 5px solid #e63946; padding: 6px 0 6px 12px; margin: 30px 0 12px 0; background: #fff5f5; }
                table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
                th { background: #f1f5f9; padding: 12px; text-align: left; text-transform: uppercase; color: #64748b; font-size: 9px; border-bottom: 1px solid #e2e8f0; }
                td { padding: 12px; border-bottom: 1px solid #f1f5f9; font-weight: bold; color: #334155; }
                .text-right { text-align: right; }
                .status-pago { color: #10b981; }
                .status-pendente { color: #f59e0b; }
                .footer { margin-top: 50px; text-align: center; font-size: 10px; color: #cbd5e1; border-top: 1px solid #f1f5f9; padding-top: 20px; font-style: italic; }
            </style>
        `;

        const html = `
            <html><head><title>${nomeArquivo}</title>${estilos}</head>
            <body>
                <div class="header-pdf">
                    <div class="header-info">
                        <h1>${nomeLoja}</h1>
                        <p>Relatório Gerencial de Despesas</p>
                        <small style="color: #94a3b8;">Período: ${new Date(dIni + "T12:00:00").toLocaleDateString('pt-BR')} a ${new Date(dFim + "T12:00:00").toLocaleDateString('pt-BR')}</small>
                    </div>
                    <div class="header-logo"><img src="${logoBase64}" onerror="this.style.display='none'"></div>
                </div>

                <div class="grid-resumo">
                    <div class="card" style="border-color: #10b981;"><label>Total Pago</label><b>R$ ${totalPago.toLocaleString('pt-BR', {minimumFractionDigits: 2})}</b></div>
                    <div class="card" style="border-color: #f59e0b;"><label>Total a Pagar</label><b>R$ ${totalPendente.toLocaleString('pt-BR', {minimumFractionDigits: 2})}</b></div>
                    <div class="card" style="border-color: #e63946;"><label>Custo Total</label><b>R$ ${(totalPago + totalPendente).toLocaleString('pt-BR', {minimumFractionDigits: 2})}</b></div>
                </div>

                <h3 class="secao-titulo">➔ Contas Pagas (Saídas)</h3>
                <table>
                    <thead><tr><th>Vencimento</th><th>Descrição</th><th class="text-right">Valor</th></tr></thead>
                    <tbody>
                        ${listaPagas.length > 0 ? listaPagas.map(d => `<tr><td>${new Date(d.vencimento + "T12:00:00").toLocaleDateString('pt-BR')}</td><td>${d.descricao.toUpperCase()}</td><td class="text-right status-pago">R$ ${parseFloat(d.valor).toLocaleString('pt-BR', {minimumFractionDigits: 2})}</td></tr>`).join('') : '<tr><td colspan="3" style="text-align:center; color:#94a3b8">Nenhum registro.</td></tr>'}
                    </tbody>
                </table>

                <h3 class="secao-titulo" style="border-color: #f59e0b; background: #fffbeb; color: #b45309;">➔ Contas a Pagar (Pendentes)</h3>
                <table>
                    <thead><tr><th>Vencimento</th><th>Descrição</th><th class="text-right">Valor</th></tr></thead>
                    <tbody>
                        ${listaPendentes.length > 0 ? listaPendentes.map(d => `<tr><td>${new Date(d.vencimento + "T12:00:00").toLocaleDateString('pt-BR')}</td><td>${d.descricao.toUpperCase()}</td><td class="text-right status-pendente">R$ ${parseFloat(d.valor).toLocaleString('pt-BR', {minimumFractionDigits: 2})}</td></tr>`).join('') : '<tr><td colspan="3" style="text-align:center; color:#94a3b8">Nenhum registro.</td></tr>'}
                    </tbody>
                </table>

                <div class="footer">WebComanda Financeiro - Emitido em ${agora.toLocaleString('pt-BR')}</div>
            </body></html>
        `;

        const win = window.open('', '_blank');
        win.document.write(html);
        win.document.close();
        setTimeout(() => { win.print(); win.close(); }, 800);

    } catch (e) {
        console.error("Erro no PDF:", e);
        if(typeof showToast === 'function') showToast("Falha ao gerar relatório", "erro");
    }
};
