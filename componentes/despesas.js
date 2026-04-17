/* =================================================================================
   MÓDULO: CONTAS A PAGAR / DESPESAS - WEBCOMANDA V3.0
   ================================================================================= */

// Variáveis globais para controle de estado do sistema
window.filtroStatusDespesa = 'pendente';
window.filtroDespesasDataInicio = null;
window.filtroDespesasDataFim = null;

/* =================================================================================
   1. FILTROS E INTERFACE (CONTROLE DE UI)
   ================================================================================= */

/**
 * Aplica os filtros de data (Hoje, 7 dias, 30 dias ou personalizado)
 */
window.aplicarFiltroDespesas = function(dias) {
    const inputIni = document.getElementById('data-inicio-despesas');
    const inputFim = document.getElementById('data-fim-despesas');
    const painel = document.getElementById('container-periodo-despesas');

    const hoje = new Date();
    const dataFimStr = hoje.toISOString().split('T')[0];
    let dataIniStr = dataFimStr;

    // 1. Lógica de Cálculo de Período
    if (dias === 'custom') {
        // Clicou na Lupa 🔍: Mantém os valores atuais dos inputs
        dataIniStr = inputIni ? inputIni.value : dataIniStr;
    } else if (dias === 99) {
        // Clicou em "PERÍODO": Apenas destaca o botão, não altera datas
    } else {
        // Filtros Rápidos (Hoje, 7 ou 30)
        const passada = new Date();
        passada.setDate(hoje.getDate() - dias);
        dataIniStr = passada.toISOString().split('T')[0];
        
        // Atualiza os campos de input na tela
        if (inputIni) inputIni.value = dataIniStr;
        if (inputFim) inputFim.value = dataFimStr;
        
        // Esconde a gaveta de período
        if (painel) painel.classList.add('hidden');
    }

    // Grava nas variáveis globais para persistência
    window.filtroDespesasDataInicio = dataIniStr;
    window.filtroDespesasDataFim = dataFimStr;

    // 2. Atualização Visual dos Botões de Filtro
    const opcoes = [0, 7, 30, 'periodo'];
    opcoes.forEach(id => {
        const btn = document.getElementById(`btn-desp-${id}`);
        if (btn) {
            const isActive = (id === dias) || ((dias === 99 || dias === 'custom') && id === 'periodo');
            
            if (isActive) {
                btn.className = "flex-1 py-3 text-[9px] font-black uppercase rounded-lg transition-all shadow-sm bg-white dark:bg-slate-700 text-slate-800 dark:text-white border border-slate-200 dark:border-slate-600";
            } else {
                btn.className = "flex-1 py-3 text-[9px] font-black uppercase rounded-lg transition-all text-slate-500 dark:text-slate-400 hover:bg-white dark:hover:bg-slate-700";
            }
        }
    });

    // 3. Dispara o carregamento no banco (exceto se for apenas abertura do painel)
    if (dias !== 99 && typeof carregarDespesas === 'function') {
        carregarDespesas(); 
    }
};

/**
 * Abre e fecha a gaveta de datas personalizadas
 */
window.toggleFiltroPeriodoDespesas = function() {
    const painel = document.getElementById('container-periodo-despesas');
    const btnPeriodo = document.getElementById('btn-desp-periodo');

    if (painel) {
        const estaEscondido = painel.classList.contains('hidden');
        painel.classList.toggle('hidden');

        if (estaEscondido) {
            // Remove destaque dos botões rápidos para focar na customização
            document.querySelectorAll('[id^="btn-desp-"]').forEach(btn => {
                btn.classList.remove('bg-white', 'dark:bg-slate-700', 'shadow-sm', 'text-slate-900', 'dark:text-white');
            });
            
            if (btnPeriodo) {
                btnPeriodo.classList.add('bg-white', 'dark:bg-slate-700', 'shadow-sm', 'text-slate-900', 'dark:text-white');
                btnPeriodo.innerHTML = 'PERÍODO ▲'; 
            }
            window.aplicarFiltroDespesas(99); // Apenas marca como ativo
        } else {
            if (btnPeriodo) btnPeriodo.innerHTML = 'PERÍODO ▼';
        }
    }
};

/**
 * Altera entre abas Pendentes e Pagas
 */
window.filtrarDespesas = function(status) {
    window.filtroStatusDespesa = status;
    
    const btnPendente = document.getElementById('btn-filtro-despesa-pendente');
    const btnPaga = document.getElementById('btn-filtro-despesa-paga');
    
    const ativa = 'bg-orange-500 text-white shadow-sm hover:bg-orange-600';
    const inativa = 'bg-slate-200 dark:bg-slate-800 text-slate-500 dark:text-slate-400 hover:bg-slate-300 dark:hover:bg-slate-700';

    if (status === 'pendente') {
        if(btnPendente) btnPendente.className = `flex-1 py-3 rounded-xl text-[9px] font-black uppercase transition-all ${ativa}`;
        if(btnPaga) btnPaga.className = `flex-1 py-3 rounded-xl text-[9px] font-black uppercase transition-all ${inativa}`;
    } else {
        const ativaVerde = ativa.split('orange').join('emerald');
        if(btnPendente) btnPendente.className = `flex-1 py-3 rounded-xl text-[9px] font-black uppercase transition-all ${inativa}`;
        if(btnPaga) btnPaga.className = `flex-1 py-3 rounded-xl text-[9px] font-black uppercase transition-all ${ativaVerde}`;
    }
    
    window.carregarDespesas();
};

/**
 * Controla a exibição do campo de data de pagamento no formulário
 */
window.toggleDataPagamento = function() {
    const isPaga = document.getElementById('d-paga')?.checked;
    const containerData = document.getElementById('container-data-pagamento');
    const inputData = document.getElementById('d-data-pagamento');
    
    if (isPaga) {
        containerData?.classList.remove('hidden');
        if (inputData && !inputData.value) {
            inputData.value = new Date().toISOString().split('T')[0];
        }
    } else {
        containerData?.classList.add('hidden');
        if (inputData) inputData.value = '';
    }
};

/* =================================================================================
   2. LISTAGEM E SINCRONIZAÇÃO COM SUPABASE
   ================================================================================= */

window.carregarDespesas = async function() {
    const lista = document.getElementById('lista-despesas');
    if (!lista) return;

    // Recupera datas dos filtros
    let dataInicio = document.getElementById('data-inicio-despesas')?.value;
    let dataFim = document.getElementById('data-fim-despesas')?.value;

    if (!dataInicio || !dataFim) {
        const hoje = new Date();
        dataFim = hoje.toISOString().split('T')[0];
        const trintaDias = new Date();
        trintaDias.setDate(hoje.getDate() - 30);
        dataInicio = trintaDias.toISOString().split('T')[0];
    }

    try {
        lista.innerHTML = `<p class="text-center text-[10px] font-black text-slate-400 uppercase animate-pulse py-8">Buscando lançamentos...</p>`;

        const { data, error } = await _supabase
            .from('despesas')
            .select('*')
            .gte('vencimento', dataInicio)
            .lte('vencimento', dataFim)
            .order('vencimento', { ascending: true });

        if (error) throw error;

        // Filtragem por status (Pendente / Pago)
        const isPagaFiltro = window.filtroStatusDespesa === 'paga';
        const filtradas = (data || []).filter(d => d.paga === isPagaFiltro);

        if (filtradas.length === 0) {
            lista.innerHTML = `
                <div class="text-center py-10 opacity-40">
                    <div class="text-4xl mb-3">🧾</div>
                    <p class="text-[10px] font-black uppercase text-slate-500">Nenhum registro encontrado para ${window.filtroStatusDespesa}.</p>
                </div>`;
            return;
        }

        const hojeObj = new Date();
        hojeObj.setHours(0,0,0,0);
        
        const formatM = typeof window.formatarMoeda === 'function' ? window.formatarMoeda : val => parseFloat(val).toFixed(2);

        // Renderização do HTML dos Cards
        lista.innerHTML = filtradas.map(d => {
            let badgeStatus = '';
            
            if (!d.paga) {
                const parts = d.vencimento.split('-');
                const venc = new Date(parts[0], parts[1] - 1, parts[2]);
                
                if (venc < hojeObj) {
                    badgeStatus = `<span class="bg-red-100 dark:bg-red-900/40 text-red-600 dark:text-red-400 px-2 py-0.5 rounded text-[8px] font-black uppercase border border-red-200 dark:border-red-800">⚠️ Vencida</span>`;
                } else if (venc.getTime() === hojeObj.getTime()) {
                    badgeStatus = `<span class="bg-orange-100 dark:bg-orange-900/40 text-orange-600 dark:text-orange-400 px-2 py-0.5 rounded text-[8px] font-black uppercase border border-orange-200 dark:border-orange-800">Vence Hoje</span>`;
                }
            }

            const dv = d.vencimento.split('-').reverse().join('/');
            const dp = d.data_pagamento ? d.data_pagamento.split('-').reverse().join('/') : '';

            return `
                <div class="bg-white dark:bg-slate-800 p-4 rounded-2xl border border-slate-100 dark:border-slate-700 flex flex-col gap-3 shadow-sm hover:shadow-md transition-all">
                    <div class="flex justify-between items-start">
                        <div class="flex-1 pr-2">
                            <span class="text-[8px] font-black text-slate-400 uppercase tracking-widest block mb-1">${d.categoria}</span>
                            <h4 class="text-xs font-black text-slate-700 dark:text-slate-200 uppercase leading-tight">${d.descricao}</h4>
                            <div class="mt-2 flex items-center gap-2">
                                <span class="text-[9px] font-bold text-slate-500 uppercase">Venc: ${dv}</span>
                                ${badgeStatus}
                            </div>
                            ${d.paga ? `<span class="text-[9px] font-bold text-emerald-500 uppercase block mt-1">Pago em: ${dp}</span>` : ''}
                        </div>
                        <div class="text-right">
                            <span class="text-sm font-black ${d.paga ? 'text-emerald-500' : 'text-[#e63946]'}">R$ ${formatM(d.valor)}</span>
                        </div>
                    </div>
                    
                    <div class="flex flex-wrap gap-1 border-t border-slate-100 dark:border-slate-700 pt-3 mt-1">
                        ${!d.paga ? `
                            <button onclick="marcarComoPaga(${d.id})" class="flex-[2] min-w-[95px] whitespace-nowrap bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 py-2 px-1 rounded-lg text-[8px] font-black uppercase active:scale-95 transition-all border border-emerald-200 dark:border-emerald-800 tracking-tighter">
                                💸 Pagar Agora
                            </button>
                        ` : `
                            <button onclick="imprimirComprovanteDespesa(${d.id})" class="flex-[2] min-w-[95px] whitespace-nowrap bg-white dark:bg-slate-700 text-slate-600 dark:text-slate-300 py-2 px-1 rounded-lg text-[8px] font-black uppercase active:scale-95 transition-all border border-slate-200 dark:border-slate-600 shadow-sm flex items-center justify-center gap-1 tracking-tighter">
                                🖨️ Comprovante
                            </button>
                        `}

                        <button onclick="abrirFormDespesa(${d.id})" class="flex-1 bg-white dark:bg-slate-700 text-slate-600 dark:text-slate-300 py-2 rounded-lg text-[8px] font-black uppercase active:scale-95 transition-all border border-slate-200 dark:border-slate-600 shadow-sm">
                            ✏️ Editar
                        </button>

                        <button onclick="excluirDespesa(${d.id})" class="flex-none w-9 bg-red-50 dark:bg-red-900/20 text-red-500 py-2 rounded-lg text-[9px] font-black uppercase active:scale-95 transition-all border border-red-100 dark:border-red-900/30">
                            🗑️
                        </button>
                    </div>
                </div>
            `;
        }).join('');

    } catch (e) {
        console.error("❌ Erro ao listar despesas:", e);
        lista.innerHTML = `<p class="text-center text-xs font-bold text-red-500 py-10 uppercase">Erro de conexão com o banco.</p>`;
    }
};

/* =================================================================================
   3. FORMULÁRIO E SALVAMENTO (LOGS E AUDITORIA)
   ================================================================================= */

window.abrirFormDespesa = async function(id = null) {
    // 1. Limpeza de todos os campos
    const inputs = ['d-id', 'd-descricao', 'd-valor', 'd-vencimento', 'd-data-pagamento'];
    inputs.forEach(idCampo => {
        const el = document.getElementById(idCampo);
        if (el) el.value = '';
    });
    
    const cat = document.getElementById('d-categoria');
    if (cat) cat.value = 'FORNECEDORES';

    const check = document.getElementById('d-paga');
    if (check) check.checked = false;
    
    window.toggleDataPagamento();
    const titulo = document.getElementById('titulo-form-despesa');
    if (titulo) titulo.innerText = 'NOVA CONTA';

    // 2. Se for edição, busca dados no Supabase
    if (id) {
        if (titulo) titulo.innerText = 'EDITAR CONTA';
        try {
            const { data, error } = await _supabase.from('despesas').select('*').eq('id', id).single();
            if (error) throw error;
            if (data) {
                document.getElementById('d-id').value = data.id;
                document.getElementById('d-descricao').value = data.descricao;
                const fmtM = typeof window.formatarMoeda === 'function' ? window.formatarMoeda : v => parseFloat(v).toFixed(2);
                document.getElementById('d-valor').value = fmtM(data.valor);
                document.getElementById('d-vencimento').value = data.vencimento;
                document.getElementById('d-categoria').value = data.categoria;
                document.getElementById('d-paga').checked = data.paga;
                if (data.paga) {
                    document.getElementById('d-data-pagamento').value = data.data_pagamento;
                }
                window.toggleDataPagamento();
            }
        } catch (e) {
            console.error("❌ Erro ao carregar edição:", e);
        }
    }

    // 3. Troca de telas
    document.getElementById('view-lista-despesas')?.classList.add('hidden');
    document.getElementById('view-form-despesa')?.classList.remove('hidden');
};

window.fecharFormDespesa = function() {
    document.getElementById('view-form-despesa')?.classList.add('hidden');
    document.getElementById('view-lista-despesas')?.classList.remove('hidden');
};

window.salvarDespesa = async function() {
    const id = document.getElementById('d-id').value;
    const desc = document.getElementById('d-descricao').value.trim().toUpperCase();
    const valInput = document.getElementById('d-valor').value;
    
    let valorFinal = 0;
    if (typeof window.convMoedaFloat === 'function') {
        valorFinal = window.convMoedaFloat(valInput);
    } else {
        valorFinal = parseFloat(valInput.replace(/\D/g, '')) / 100 || 0;
    }

    const venc = document.getElementById('d-vencimento').value;
    const categ = document.getElementById('d-categoria').value;
    const isPaga = document.getElementById('d-paga').checked;
    const dtPag = document.getElementById('d-data-pagamento').value;

    // Validações básicas
    if (!desc || valorFinal <= 0 || !venc) {
        if (typeof showToast === 'function') showToast("Campos obrigatórios em branco!", "erro");
        return;
    }

    const dados = {
        descricao: desc,
        valor: valorFinal,
        vencimento: venc,
        categoria: categ,
        paga: isPaga,
        data_pagamento: isPaga ? dtPag : null,
        cadastrado_por: localStorage.getItem('userName') || 'Sistema'
    };

    try {
        const vf = typeof window.formatarMoeda === 'function' ? window.formatarMoeda(valorFinal) : `R$ ${valorFinal.toFixed(2)}`;
        const statusStr = isPaga ? "PAGA" : "PENDENTE";

        if (id) {
            // EDITAR
            const { error } = await _supabase.from('despesas').update(dados).eq('id', id);
            if (error) throw error;
            if (typeof registrarLog === 'function') {
                await registrarLog('FINANCEIRO', `EDITOU DESPESA: ${desc} | VALOR: ${vf} | STATUS: ${statusStr}`);
            }
        } else {
            // INSERIR
            const { error } = await _supabase.from('despesas').insert([dados]);
            if (error) throw error;
            if (typeof registrarLog === 'function') {
                await registrarLog('FINANCEIRO', `LANÇOU DESPESA: ${desc} | VALOR: ${vf} | VENC: ${venc}`);
            }
        }
        
        if (typeof showToast === 'function') showToast("Dados salvos com sucesso!", "sucesso");
        window.fecharFormDespesa();
        window.carregarDespesas(); 
        if (typeof window.verificarVencimentos === 'function') window.verificarVencimentos();
        
    } catch (e) {
        console.error("❌ Falha ao salvar:", e);
        if (typeof showToast === 'function') showToast("Erro ao gravar no banco de dados.", "erro");
    }
};

/* =================================================================================
   4. AÇÕES RÁPIDAS (EXCLUIR, BAIXA, VENCIMENTOS)
   ================================================================================= */

window.excluirDespesa = function(id) {
    const deletar = async () => {
        try {
            const { data: d } = await _supabase.from('despesas').select('descricao, valor').eq('id', id).single();
            await _supabase.from('despesas').delete().eq('id', id);
            
            if (typeof registrarLog === 'function') {
                const vf = typeof window.formatarMoeda === 'function' ? window.formatarMoeda(d.valor) : d.valor;
                await registrarLog('FINANCEIRO', `EXCLUIU DESPESA: ${d.descricao} | R$ ${vf}`);
            }
            if (typeof showToast === 'function') showToast("Lançamento apagado!", "sucesso");
            window.carregarDespesas();
            if (typeof window.verificarVencimentos === 'function') window.verificarVencimentos();
        } catch (e) { console.error(e); }
    };

    if (typeof confirmarAcao === 'function') {
        confirmarAcao("Apagar permanentemente este registro?", deletar, "EXCLUIR");
    } else if (confirm("Apagar?")) { deletar(); }
};

window.marcarComoPaga = function(id) {
    const pagar = async () => {
        const dataHoje = new Date().toISOString().split('T')[0];
        try {
            const { data: d } = await _supabase.from('despesas').select('descricao, valor').eq('id', id).single();
            await _supabase.from('despesas').update({ paga: true, data_pagamento: dataHoje }).eq('id', id);
            
            if (typeof registrarLog === 'function') {
                const vf = typeof window.formatarMoeda === 'function' ? window.formatarMoeda(d.valor) : d.valor;
                await registrarLog('FINANCEIRO', `MARCOU COMO PAGA: ${d.descricao} | R$ ${vf}`);
            }
            if (typeof showToast === 'function') showToast("Pagamento registrado!", "sucesso");
            window.carregarDespesas();
            if (typeof window.verificarVencimentos === 'function') window.verificarVencimentos();
        } catch (e) { console.error(e); }
    };

    if (typeof confirmarAcao === 'function') {
        confirmarAcao("Confirmar pagamento para o dia de hoje?", pagar, "BAIXA DE CONTA");
    } else if (confirm("Pagar?")) { pagar(); }
};

window.verificarVencimentos = async function() {
    const divAlerta = document.getElementById('alerta-vencimento-hoje');
    if (!divAlerta) return;
    const dStr = new Date().toISOString().split('T')[0];
    try {
        const { data } = await _supabase.from('despesas').select('id').eq('paga', false).lte('vencimento', dStr);
        if (data && data.length > 0) divAlerta.classList.remove('hidden');
        else divAlerta.classList.add('hidden');
    } catch (e) { console.error(e); }
};

/* =================================================================================
   5. RELATÓRIOS E IMPRESSÕES (PDF E BOBINA)
   ================================================================================= */

window.imprimirComprovanteDespesa = function(id) {
    _supabase.from('despesas').select('*').eq('id', id).single().then(({ data: d }) => {
        if (!d) return;
        const fm = typeof window.formatarMoeda === 'function' ? window.formatarMoeda : v => parseFloat(v).toFixed(2);
        const win = window.open('', '', 'width=300,height=600');
        const dVen = d.vencimento.split('-').reverse().join('/');
        const dPag = d.data_pagamento ? d.data_pagamento.split('-').reverse().join('/') : '---';
        
        const html = `
            <style>body{font-family:monospace; font-size:11px; padding:10px; line-height:1.4} .c{text-align:center;} .b{font-weight:bold;}</style>
            <div class="c b">${localStorage.getItem('nomeLoja') || 'ESPETINHO & CIA'}</div>
            <div class="c">RECIBO DE DESPESA</div><hr style="border:0.5px dashed #000">
            <div><span class="b">DESCRIÇÃO:</span> ${d.descricao}</div>
            <div><span class="b">CATEGORIA:</span> ${d.categoria}</div>
            <div><span class="b">VALOR:</span> R$ ${fm(d.valor)}</div>
            <div><span class="b">VENCIMENTO:</span> ${dVen}</div>
            <div><span class="b">PAGO EM:</span> ${dPag}</div>
            <div style="margin-top:10px" class="c b">TOTAL: R$ ${fm(d.valor)}</div><hr style="border:0.5px dashed #000">
            <div class="c" style="font-size:8px">Emitido por WebComanda v3.0</div>
        `;
        win.document.write(`<html><head><title>Recibo</title></head><body>${html}</body></html>`);
        win.document.close();
        setTimeout(() => { win.print(); win.close(); }, 300);
    });
};

/**
 * Gera o Relatório Geral em PDF com Nome de Arquivo DDMMYYYY
 */
window.imprimirPDFDespesas = async function() {
    let dIni = document.getElementById('data-inicio-despesas')?.value;
    let dFim = document.getElementById('data-fim-despesas')?.value;
    const agora = new Date();
    
    // NOME DO ARQUIVO: DDMMYYYY_Relatorio_Despesas
    const d = String(agora.getDate()).padStart(2, '0');
    const m = String(agora.getMonth() + 1).padStart(2, '0');
    const a = agora.getFullYear();
    const nomeArquivoPDF = `${d}${m}${a}_Relatorio_Despesas`;

    if(typeof showToast === 'function') showToast("Gerando PDF...", "aviso");

    try {
        const { data: listaDesp, error } = await _supabase
            .from('despesas')
            .select('*')
            .gte('vencimento', dIni)
            .lte('vencimento', dFim)
            .order('vencimento', { ascending: true });
            
        if (error) throw error;

        const win = window.open('', '_blank');
        let tPago = 0, tAberto = 0;
        
        const trs = (listaDesp || []).map(item => {
            const v = parseFloat(item.valor);
            if(item.paga) tPago += v; else tAberto += v;
            return `<tr>
                <td>${item.vencimento.split('-').reverse().join('/')}</td>
                <td>${item.descricao}</td>
                <td style="color:${item.paga ? '#10b981' : '#ef4444'}">${item.paga ? 'PAGO' : 'PENDENTE'}</td>
                <td style="text-align:right">R$ ${v.toFixed(2)}</td>
            </tr>`;
        }).join('');

        const est = `
            <style>
                body{font-family:sans-serif;padding:30px;color:#333;} 
                table{width:100%;border-collapse:collapse;margin-top:20px;} 
                th,td{border:1px solid #eee;padding:10px;text-align:left;font-size:11px;} 
                th{background:#f9f9f9;text-transform:uppercase;color:#666;} 
                h2{color:#e63946;margin-bottom:5px;}
                .resumo{margin-top:30px;padding:15px;background:#f8fafc;border-radius:10px;border:1px solid #e2e8f0;}
            </style>
        `;

        const htmlFinal = `
            <html><head><title>${nomeArquivoPDF}</title>${est}</head>
            <body>
                <h2>${localStorage.getItem('nomeLoja') || 'ESPETINHO & CIA'}</h2>
                <p style="font-size:12px;color:#666">Relatório de Despesas (Período: ${dIni} a ${dFim})</p>
                <table><thead><tr><th>VENCIMENTO</th><th>DESCRIÇÃO</th><th>STATUS</th><th style="text-align:right">VALOR</th></tr></thead><tbody>${trs}</tbody></table>
                <div class="resumo">
                    <p><b>VALOR TOTAL PAGO: R$ ${tPago.toFixed(2)}</b></p>
                    <p><b>VALOR TOTAL PENDENTE: R$ ${tAberto.toFixed(2)}</b></p>
                    <p style="margin-top:5px;color:#e63946"><b>CUSTO TOTAL: R$ ${(tPago+tAberto).toFixed(2)}</b></p>
                </div>
            </body></html>
        `;
        win.document.write(htmlFinal);
        win.document.close();
        setTimeout(() => { win.print(); }, 600);
    } catch (e) { console.error("Erro PDF:", e); }
};