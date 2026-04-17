/* =================================================================================
   MÓDULO: RELATÓRIOS E FECHAMENTO DE CAIXA (INTEGRAL E BLINDADO)
   ================================================================================= */

window.dadosFechamentoCache = null;

/**
 * Constrói o objeto de resumo a partir de vendas e movimentações.
 * (Ajustado para ler JSON perfeitamente)
 */
window._construirResumo = function(nomeLoja, vendas, movs, valorInicial = 0) {
    const resumo = {
        loja:           nomeLoja,
        totalVendido:   0,
        totalDescontos: 0,
        totalTaxas:     0,
        metodos:        {},
        suprimentos:    0,
        sangrias:       0,
        dinheiroEmVendas: 0,
        vendasRaw:      vendas,
        movsRaw:        movs,
        itensVendidos:  {},
        vendasPorVendedor: {},
        valorInicial: valorInicial
    };

    vendas.forEach(v => {
        const totalVenda = parseFloat(v.total) || 0;
        resumo.totalVendido   += totalVenda;
        resumo.totalDescontos += parseFloat(v.desconto || 0);
        resumo.totalTaxas     += parseFloat(v.taxa_servico || 0);

        const m = typeof padronizarPagamento === 'function' ? padronizarPagamento(v.forma_pagamento) : (v.forma_pagamento || 'DINHEIRO');
        resumo.metodos[m] = (resumo.metodos[m] || 0) + totalVenda;
        if (m === 'DINHEIRO') resumo.dinheiroEmVendas += totalVenda;

        const vendedor = v.atendente || v.usuario || v.vendedor || 'SISTEMA';
        resumo.vendasPorVendedor[vendedor] = (resumo.vendasPorVendedor[vendedor] || 0) + totalVenda;

        let itensArr = [];
        if (typeof v.itens === 'string') {
            try { 
                itensArr = JSON.parse(v.itens); 
            } catch(e) {
                console.warn("Falha ao ler itens da venda", v.id);
            }
        } else if (Array.isArray(v.itens)) {
            itensArr = v.itens;
        }

        (itensArr || []).forEach(i => {
            const preco = parseFloat(i.preco) || 0;
            const nomeItem = i.nome || '';
            if (preco > 0 && !nomeItem.toUpperCase().includes('PGTO')) {
                const nomeF = typeof formatarNomeProduto === 'function' ? formatarNomeProduto(nomeItem) : nomeItem;
                resumo.itensVendidos[nomeF] = (resumo.itensVendidos[nomeF] || 0) + (i.qtd || 1);
            }
        });
    });

    movs.forEach(m => {
        const val = parseFloat(m.valor) || 0;
        if (m.tipo === 'SUPRIMENTO') resumo.suprimentos += val;
        if (m.tipo === 'SANGRIA')    resumo.sangrias    += val;
    });

    resumo.saldoGaveta = (resumo.dinheiroEmVendas + valorInicial + resumo.suprimentos) - resumo.sangrias;
    return resumo;
};

/**
 * Inicia o processo de fechamento (Relatório A4 / Fechar do Dia)
 */
window.gerarFechamentoCaixa = async function(fechamentoSilencioso = false) {
    if (typeof isDatabaseReady === 'function' && !isDatabaseReady()) return;

    const idCaixa = localStorage.getItem('idCaixaAtual');
    if (!idCaixa) return showToast('NENHUM CAIXA ABERTO', 'erro');

    try {
        const [{ data: cx }, { data: vds, error: errV }, { data: movs }] = await Promise.all([
            _supabase.from('caixa').select('valor_inicial').eq('id', idCaixa).single(),
            _supabase.from('historico_vendas').select('*').eq('id_caixa', idCaixa),
            _supabase.from('movimentacoes_caixa').select('*').eq('id_caixa', idCaixa)
        ]);

        if (errV) throw errV;

        const resumo = window._construirResumo(
            localStorage.getItem('nomeLoja') || 'ESPETINHO & CIA',
            vds || [],
            movs || [],
            parseFloat(cx?.valor_inicial || 0)
        );

        window.dadosFechamentoCache = resumo;

        if (fechamentoSilencioso) {
            return window.executarFechamentoFinal('nenhum');
        }

        const modal = document.getElementById('modal-decisao-fechamento');
        if (modal) {
            modal.classList.remove('hidden');
            modal.classList.add('flex');
        }

    } catch (e) {
        console.error('Erro no fechamento:', e);
        showToast('ERRO AO PROCESSAR DADOS', 'erro');
    }
};

/* =============================================================
    CONTROLE DO MODAL DE CONFIRMAÇÃO (SISTEMA)
   ============================================================= */
let acaoPendente = null;

window.abrirModalConfirmacao = function(titulo, mensagem, callback) {
    document.getElementById('titulo-modal-conf').innerText = titulo;
    document.getElementById('msg-modal-conf').innerText = mensagem;
    acaoPendente = callback;
    document.getElementById('modal-confirmacao-sistema').classList.remove('hidden');
};

window.fecharModalConfirmacao = function() {
    const modal = document.getElementById('modal-confirmacao-sistema');
    if (modal) modal.classList.add('hidden');
    acaoPendente = null;
};

window.executarConfirmacao = function() {
    if (acaoPendente) acaoPendente();
    window.fecharModalConfirmacao();
};

/* =============================================================
    ENCERRAMENTO DE CAIXA: TURNO (PARCIAL) E FINAL (COM SENHA)
   ============================================================= */

// --- 1. TURNO PARCIAL (Apenas imprime, não fecha no banco) ---
// --- 1. IMPRIMIR PARCIAL (LEITURA X) ---
// Renomeado para não conflitar com o botão de encerrar turno do painel
window.imprimirRelatorioParcialX = function() {
    window.abrirModalConfirmacao(
        "RESUMO PARCIAL",
        "Deseja imprimir o resumo parcial do turno atual? O caixa continuará aberto e pronto para novas vendas.",
        () => window.executarEncerramentoParcial() // Esta função já faz a impressão e está ok no seu código
    );
};

window.executarEncerramentoParcial = async function() {
    try {
        if(typeof showToast === 'function') showToast("Gerando impressão parcial...", "info");
        
        const idCx = localStorage.getItem('idCaixaAtual');
        if(!idCx) {
            if(typeof showToast === 'function') showToast("Nenhum caixa aberto para este terminal.", "aviso");
            return;
        }

        const { data: cx } = await _supabase.from('caixa').select('*').eq('id', idCx).single();
        if(!cx) return;
        
        const [resV, resM] = await Promise.all([
            _supabase.from('historico_vendas').select('*').eq('id_caixa', idCx).neq('status', 'estornada'),
            _supabase.from('movimentacoes_caixa').select('*').eq('id_caixa', idCx)
        ]);

        let totD = 0, totC = 0, totP = 0, sang = 0, supr = 0;
        
        (resV.data || []).forEach(v => {
            const val = parseFloat(v.total || 0);
            const pg = (v.forma_pagamento || 'DINHEIRO').toUpperCase();
            if (pg === 'DINHEIRO') totD += val;
            else if (pg === 'PIX') totP += val;
            else totC += val;
        });
        
        (resM.data || []).forEach(m => {
            const val = parseFloat(m.valor || 0);
            if (m.tipo === 'SANGRIA') sang += val; else supr += val;
        });

        const inicial = parseFloat(cx.valor_inicial || 0);
        const saldoGaveta = (inicial + totD + supr) - sang;

        // Imprime passando flag 'true' para NÃO recarregar a página
        window.imprimirFechamentoTermico({
            id: idCx, 
            tipo: "RESUMO PARCIAL (X)",
            operador: cx.criado_por || 'Admin',
            abertura: cx.aberto_em,
            fechamento: new Date().toISOString(),
            inicial: inicial, dinheiro: totD, cartao: totC, pix: totP,
            sangrias: sang, suprimentos: supr, saldoGaveta: saldoGaveta
        }, true);

        if(typeof showToast === 'function') showToast("Resumo de turno enviado para impressora!", "sucesso");

    } catch (e) { 
        console.error(e);
        if(typeof showToast === 'function') showToast("Erro ao gerar parcial: " + e.message, "erro");
    }
};

// --- 2. FECHAMENTO DEFINITIVO COM SENHA NO BANCO (ADMIN) ---

window.abrirModalSenhaAdmin = function() {
    const input = document.getElementById('input-senha-admin');
    const modal = document.getElementById('modal-senha-admin');
    
    if(input) input.value = '';
    if(modal) modal.classList.remove('hidden');
    
    setTimeout(() => { if(input) input.focus(); }, 300);
};

window.fecharModalSenha = function() {
    const modal = document.getElementById('modal-senha-admin');
    if(modal) modal.classList.add('hidden');
};

window.validarFechamentoGeral = async function() {
    const input = document.getElementById('input-senha-admin');
    if(!input) return;
    
    const senhaDigitada = input.value;

    if (!senhaDigitada) {
        if(typeof showToast === 'function') showToast("DIGITE A SENHA DO ADMINISTRADOR!", "aviso");
        return;
    }

    try {
        if(typeof showToast === 'function') showToast("Validando credenciais...", "info");

        // Valida no Banco de Dados (Tabela 'usuarios', buscando pelo ID e role/nivel)
        const { data: admin, error } = await _supabase
            .from('usuarios') 
            .select('id, role, nivel')
            .eq('senha', senhaDigitada)
            .maybeSingle();

        if (error) {
            console.error("Erro do Supabase:", error);
            if(typeof showToast === 'function') showToast("ERRO AO BUSCAR USUÁRIO!", "erro");
            return;
        }

        if (!admin) {
            if(typeof showToast === 'function') showToast("SENHA INCORRETA!", "erro");
            return;
        }

        // Verifica se o usuário encontrado é administrador (checando 'role' ou 'nivel')
        const isAdm = (admin.role && admin.role.toUpperCase() === 'ADMIN') || 
                      (admin.nivel && admin.nivel.toUpperCase() === 'ADMIN');

        if (!isAdm) {
            if(typeof showToast === 'function') showToast("ESTE USUÁRIO NÃO É ADMINISTRADOR!", "erro");
            return;
        }

        // Senha correta e é ADMIN: fecha o modal e executa o encerramento no banco
        window.fecharModalSenha();
        await window.executarFechamentoDefinitivoBanco();

    } catch (e) {
        console.error("Erro na validação:", e);
        if(typeof showToast === 'function') showToast("ERRO DE CONEXÃO AO VALIDAR!", "erro");
    }
};

window.executarFechamentoDefinitivoBanco = async function() {
    try {
        if(typeof showToast === 'function') showToast("Finalizando Caixa...", "info");

        const idCx = localStorage.getItem('idCaixaAtual');
        if(!idCx) {
            if(typeof showToast === 'function') showToast("Erro: Nenhum caixa ativo encontrado no terminal.", "aviso");
            return;
        }
        
        const { data: cx } = await _supabase.from('caixa').select('*').eq('id', idCx).single();
        if(!cx) return;

        const [resV, resM] = await Promise.all([
            _supabase.from('historico_vendas').select('*').eq('id_caixa', idCx).neq('status', 'estornada'),
            _supabase.from('movimentacoes_caixa').select('*').eq('id_caixa', idCx)
        ]);

        let totD = 0, totC = 0, totP = 0, sang = 0, supr = 0;
        
        (resV.data || []).forEach(v => {
            const vlr = parseFloat(v.total || 0);
            const pg = (v.forma_pagamento || '').toUpperCase();
            if (pg === 'DINHEIRO') totD += vlr;
            else if (pg === 'PIX') totP += vlr;
            else totC += vlr;
        });
        
        (resM.data || []).forEach(m => {
            const vlr = parseFloat(m.valor || 0);
            if (m.tipo === 'SANGRIA') sang += vlr; else supr += vlr;
        });

        const inicial = parseFloat(cx.valor_inicial || 0);
        const saldoGaveta = (inicial + totD + supr) - sang;
        const dataFechamento = new Date().toISOString();

        // 1. Salva Status Fechado no Supabase
        const { error: errUpd } = await _supabase
            .from('caixa')
            .update({
                status: 'fechado',
                fechado_em: dataFechamento,
                valor_final_dinheiro: totD,
                valor_final_cartao: totC,
                valor_final_pix: totP
            })
            .eq('id', idCx);

        if (errUpd) throw errUpd;

        // --- 2. LIMPEZA TOTAL DA MEMÓRIA DO TURNO (O Pulo do Gato) ---
        localStorage.removeItem('idCaixaAtual');
        localStorage.removeItem('dataAberturaCaixa');
        localStorage.removeItem('horaAberturaCaixa'); // Para o relógio parar!

        // 3. Imprime cupom definitivo e força o Reload
        window.imprimirFechamentoTermico({
            id: idCx,
            tipo: "FECHAMENTO DEFINITIVO (Z)",
            operador: cx.criado_por || 'Sistema',
            abertura: cx.aberto_em,
            fechamento: dataFechamento,
            inicial: inicial,
            dinheiro: totD, cartao: totC, pix: totP,
            sangrias: sang, suprimentos: supr, saldoGaveta: saldoGaveta
        }, false); 

    } catch (e) {
        console.error(e);
        if(typeof showToast === 'function') showToast("Erro no fechamento definitivo: " + e.message, "erro");
    }
};

// 3. Função de Impressão via Iframe (Ninja Mode - Burlar bloqueador)
// O parâmetro isParcial controla se a tela deve ser recarregada no final.
window.imprimirFechamentoTermico = function(dados, isParcial = false) {
    const formatarData = (iso) => new Date(iso).toLocaleString('pt-BR');
    const fm = (v) => `R$ ${parseFloat(v).toFixed(2).replace('.', ',')}`;
    const totalVendas = dados.dinheiro + dados.cartao + dados.pix;

    const htmlPrint = `
        <!DOCTYPE html>
        <html lang="pt-br">
        <head>
            <meta charset="UTF-8">
            <style>
                @page { margin: 0; size: 80mm auto; }
                body { 
                    font-family: 'Courier New', Courier, monospace; 
                    width: 80mm; margin: 0; padding: 5mm; font-size: 12px; color: black; background: white;
                }
                .text-center { text-align: center; }
                .font-bold { font-weight: bold; }
                .border-b { border-bottom: 1px dashed black; margin-bottom: 5px; padding-bottom: 5px; }
                .border-t { border-top: 1px dashed black; margin-top: 5px; padding-top: 5px; }
                .flex { display: flex; justify-content: space-between; }
                .mt-2 { margin-top: 10px; }
                .title { font-size: 14px; font-weight: bold; margin: 0; }
            </style>
        </head>
        <body>
            <div class="text-center border-b">
                <p class="title">ESPETINHO & CIA</p>
                <p>${dados.tipo || 'FECHAMENTO DE TURNO'}</p>
            </div>
            <div class="border-b">
                <p><strong>CAIXA Nº:</strong> ${dados.id}</p>
                <p><strong>OPERADOR:</strong> ${dados.operador.toUpperCase()}</p>
                <p><strong>ABERTURA:</strong> <br>${formatarData(dados.abertura)}</p>
                <p><strong>FECHAMENTO:</strong> <br>${formatarData(dados.fechamento)}</p>
            </div>
            <div class="text-center font-bold mt-2 border-b"><p>RESUMO DE VENDAS</p></div>
            <div class="flex"><span>DINHEIRO</span> <span>${fm(dados.dinheiro)}</span></div>
            <div class="flex"><span>CARTÃO</span> <span>${fm(dados.cartao)}</span></div>
            <div class="flex border-b"><span>PIX</span> <span>${fm(dados.pix)}</span></div>
            <div class="flex font-bold"><span>TOTAL VENDAS</span> <span>${fm(totalVendas)}</span></div>
            
            <div class="text-center font-bold mt-2 border-b border-t"><p>GAVETA FÍSICA</p></div>
            <div class="flex"><span>FUNDO INICIAL</span> <span>${fm(dados.inicial)}</span></div>
            <div class="flex"><span>(+) SUPRIMENTOS</span> <span>${fm(dados.suprimentos)}</span></div>
            <div class="flex"><span>(-) SANGRIAS</span> <span>${fm(dados.sangrias)}</span></div>
            <div class="flex"><span>(+) DINHEIRO</span> <span>${fm(dados.dinheiro)}</span></div>
            
            <div class="flex font-bold border-t border-b mt-2">
                <span>SALDO ESPERADO</span> <span>${fm(dados.saldoGaveta)}</span>
            </div>

            <div class="mt-2 text-center" style="margin-top: 40px;"><p>_________________________________</p><p>Assinatura Operador</p></div>
            <div class="mt-2 text-center" style="margin-top: 30px; margin-bottom: 20px;"><p>_________________________________</p><p>Assinatura Gerência</p></div>
        </body>
        </html>
    `;

    const iframe = document.createElement('iframe');
    
    iframe.style.position = 'absolute';
    iframe.style.width = '0px';
    iframe.style.height = '0px';
    iframe.style.border = 'none';
    
    document.body.appendChild(iframe);

    const doc = iframe.contentWindow.document;
    doc.open();
    doc.write(htmlPrint);
    doc.close();

    setTimeout(() => {
        iframe.contentWindow.focus();
        iframe.contentWindow.print(); 

        setTimeout(() => {
            document.body.removeChild(iframe);
            // Só recarrega e trava o caixa se for fechamento definitivo (Z)
            if (!isParcial) {
                window.location.reload();
            }
        }, 1000); 
    }, 500);
};

/* =================================================================================
   FUNÇÕES DE HISTÓRICO DE CAIXAS FECHADOS
   ================================================================================= */

window.carregarHistoricoCaixas = async function(dataInicio, dataFim) {
    if (typeof isDatabaseReady === 'function' && !isDatabaseReady()) return;

    const container  = document.getElementById('lista-caixas-fechados');
    if (!container) return;

    container.innerHTML = `
        <div class="animate-pulse space-y-4">
            <div class="h-32 bg-slate-200 dark:bg-slate-800/50 rounded-[2rem] w-full"></div>
            <div class="h-32 bg-slate-200 dark:bg-slate-800/50 rounded-[2rem] w-full"></div>
        </div>`;

    try {
        let query = _supabase
            .from('caixa')
            .select('*')
            .eq('status', 'fechado')
            .order('fechado_em', { ascending: false });

        if (dataInicio && dataFim) {
            query = query
                .gte('fechado_em', `${dataInicio}T00:00:00`)
                .lte('fechado_em', `${dataFim}T23:59:59`);
        }

        const { data: caixas, error } = await query;
        if (error) throw error;

        if (!caixas || caixas.length === 0) {
            container.innerHTML = `
                <div class="text-center py-16">
                    <div class="text-4xl mb-3 opacity-30">📭</div>
                    <p class="text-slate-400 font-black uppercase tracking-widest text-[10px]">Nenhum caixa encontrado neste período.</p>
                </div>`;
            return;
        }

        const formatMoeda = typeof window.formatarMoeda === 'function' ? window.formatarMoeda : val => parseFloat(val).toFixed(2);
        const idsCaixas = caixas.map(c => c.id);
        const { data: todasMovs } = await _supabase.from('movimentacoes_caixa').select('*').in('id_caixa', idsCaixas);

        container.innerHTML = caixas.map(cx => {
            const abertura   = new Date(cx.aberto_em);
            const fechamento = new Date(cx.fechado_em);
            const movsCaixa = (todasMovs || []).filter(m => m.id_caixa === cx.id);
            
            let htmlMovs = movsCaixa.length === 0 
                ? `<p class="text-[9px] font-bold text-slate-400 uppercase italic py-2">Nenhuma movimentação extra registrada.</p>`
                : movsCaixa.map(m => `
                    <div class="flex justify-between items-center py-1 border-b border-slate-100 dark:border-slate-800/50 last:border-0">
                        <span class="text-[9px] font-black uppercase ${m.tipo === 'SANGRIA' ? 'text-red-500' : 'text-emerald-500'}">
                            ${m.tipo === 'SANGRIA' ? '🔴 Saída' : '🟢 Entrada'} - ${m.motivo}
                        </span>
                        <span class="text-[9px] font-black text-slate-600 dark:text-slate-300">R$ ${formatMoeda(m.valor)}</span>
                    </div>
                `).join('');

            return `
            <div class="bg-white dark:bg-slate-900 p-5 rounded-[2.2rem] shadow-sm border border-slate-100 dark:border-slate-800 mb-4 transition-all overflow-hidden relative">
                <div class="flex justify-between items-start mb-3">
                    <div>
                        <div class="flex items-center gap-2 mb-1">
                            <span class="bg-[#1e293b] text-white text-[8px] font-black px-2 py-0.5 rounded-md uppercase tracking-wider">Turno #${cx.id}</span>
                            <span class="text-[9px] font-bold text-slate-400 dark:text-slate-500 uppercase">${abertura.toLocaleDateString('pt-BR')}</span>
                        </div>
                        <h3 class="font-black text-slate-700 dark:text-slate-200 text-[11px] uppercase italic leading-tight">
                            ${abertura.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} ➜ ${fechamento.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </h3>
                        <p class="text-[8px] font-black text-slate-400 mt-1 uppercase">Operador: ${cx.criado_por || 'Sistema'}</p>
                    </div>
                    <button onclick="window.regerarPDFRetroativo(${cx.id})" class="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 px-4 py-2 rounded-xl flex items-center gap-2 shadow-sm active:scale-95 transition-all hover:bg-slate-200 dark:hover:bg-slate-700">
                        <span class="text-sm">🖨️</span>
                        <span class="text-[9px] font-black uppercase tracking-widest hidden sm:inline">Relatório</span>
                    </button>
                </div>
                <div class="grid grid-cols-2 bg-slate-50 dark:bg-slate-800/50 p-3 rounded-xl gap-2 mb-3 border border-slate-100 dark:border-slate-700">
                    <div class="flex flex-col">
                        <span class="text-[8px] font-black text-slate-400 dark:text-slate-500 uppercase">Fundo Inicial</span>
                        <span class="text-[11px] font-bold text-slate-600 dark:text-slate-300">R$ ${formatMoeda(cx.valor_inicial)}</span>
                    </div>
                    <div class="flex flex-col text-right">
                        <span class="text-[8px] font-black text-slate-400 dark:text-slate-500 uppercase">Dinheiro na Gaveta</span>
                        <span class="text-[12px] font-black text-emerald-500">R$ ${formatMoeda(cx.valor_final_dinheiro)}</span>
                    </div>
                </div>
                <button onclick="toggleMovimentosCard(${cx.id})" class="w-full flex justify-between items-center text-[9px] font-black text-slate-500 uppercase italic py-2 border-t border-slate-100 dark:border-slate-800 mt-1 hover:text-slate-700 dark:hover:text-slate-300 transition-colors">
                    <span>Ver Entradas e Saídas Extras</span>
                    <span id="icone-mov-${cx.id}" class="text-[10px]">▼</span>
                </button>
                <div id="movimentos-card-${cx.id}" class="hidden bg-slate-50 dark:bg-slate-800 p-3 rounded-xl mt-2 border border-slate-200 dark:border-slate-700 transition-all">
                    <h4 class="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-2 border-b border-slate-200 dark:border-slate-700 pb-1">Detalhes de Movimentação</h4>
                    ${htmlMovs}
                </div>
            </div>`;
        }).join('');

    } catch (e) {
        console.error('[CAIXA-REPORTS] Erro ao carregar histórico:', e);
        container.innerHTML = `<p class="text-center text-red-500 font-black uppercase italic text-[10px] py-10">Erro ao buscar dados. Verifique a conexão.</p>`;
    }
};

window.regerarPDFRetroativo = async function(idCaixa) {
    if (typeof isDatabaseReady === 'function' && !isDatabaseReady()) return;
    if (typeof showToast === 'function') showToast('RECUPERANDO DADOS...');

    try {
        const [ { data: cx }, { data: vendas }, { data: movs } ] = await Promise.all([
            _supabase.from('caixa').select('*').eq('id', idCaixa).single(),
            _supabase.from('historico_vendas').select('*').eq('id_caixa', idCaixa),
            _supabase.from('movimentacoes_caixa').select('*').eq('id_caixa', idCaixa)
        ]);

        if (!cx || !vendas) throw new Error('Dados não encontrados.');

        const nomeLoja = cx.loja || localStorage.getItem('nomeLoja') || 'ESPETINHO & CIA';
        const resumo = window._construirResumo(nomeLoja, vendas, movs || [], parseFloat(cx.valor_inicial) || 0);

        if (typeof exportarFechamentoPDF === 'function') {
            exportarFechamentoPDF(resumo);
            if (typeof showToast === 'function') showToast('PDF RECUPERADO!', 'sucesso');
        }
    } catch (e) {
        console.error('Erro ao regerar PDF:', e);
        if (typeof showToast === 'function') showToast('ERRO AO RECUPERAR', 'erro');
    }
};

window.toggleFiltroPeriodoCaixas = function() {
    const container = document.getElementById('container-periodo-caixas');
    if(!container) return;
    
    container.classList.toggle('hidden');
    
    ['0', '7', '30'].forEach(d => {
        const btn = document.getElementById(`btn-hist-${d}`);
        if(btn) btn.className = 'flex-1 py-3 text-[9px] font-black uppercase rounded-lg transition-all text-slate-500 dark:text-slate-400 hover:bg-white dark:hover:bg-slate-700';
    });
    
    const btnPer = document.getElementById('btn-hist-periodo');
    if(btnPer) {
        if(container.classList.contains('hidden')) {
            btnPer.className = 'flex-1 py-3 text-[9px] font-black uppercase rounded-lg transition-all text-slate-500 dark:text-slate-400 hover:bg-white dark:hover:bg-slate-700';
        } else {
            btnPer.className = 'flex-1 py-3 text-[9px] font-black uppercase rounded-lg transition-all bg-white dark:bg-slate-700 shadow-sm text-blue-600 dark:text-blue-400';
        }
    }
};

window.aplicarFiltroCaixas = function(dias) {
    let dataInicio = null;
    let dataFim = new Date().toISOString().split('T')[0];

    if (dias === 'custom') {
        dataInicio = document.getElementById('data-inicio-caixas')?.value;
        dataFim = document.getElementById('data-fim-caixas')?.value;
        if (!dataInicio || !dataFim) {
            if (typeof showToast === 'function') showToast('Preencha as datas!', 'erro');
            return;
        }
    } else {
        const container = document.getElementById('container-periodo-caixas');
        if(container && !container.classList.contains('hidden')) container.classList.add('hidden');
        
        ['0', '7', '30', 'periodo'].forEach(d => {
            const btn = document.getElementById(`btn-hist-${d}`);
            if(btn) btn.className = 'flex-1 py-3 text-[9px] font-black uppercase rounded-lg transition-all text-slate-500 dark:text-slate-400 hover:bg-white dark:hover:bg-slate-700';
        });
        
        const btnAtivo = document.getElementById(`btn-hist-${dias}`);
        if(btnAtivo) btnAtivo.className = 'flex-1 py-3 text-[9px] font-black uppercase rounded-lg transition-all bg-white dark:bg-slate-700 shadow-sm text-slate-700 dark:text-slate-200';

        if (dias > 0) {
            const d = new Date();
            d.setDate(d.getDate() - dias);
            dataInicio = d.toISOString().split('T')[0];
        } else {
            dataInicio = dataFim; 
        }
    }

    if (typeof window.carregarHistoricoCaixas === 'function') {
        window.carregarHistoricoCaixas(dataInicio, dataFim);
    }
};

window.toggleMovimentosCard = function(idCaixa) {
    const el = document.getElementById(`movimentos-card-${idCaixa}`);
    const icone = document.getElementById(`icone-mov-${idCaixa}`);
    if(!el || !icone) return;
    
    if (el.classList.contains('hidden')) {
        el.classList.remove('hidden');
        icone.innerText = '▲';
    } else {
        el.classList.add('hidden');
        icone.innerText = '▼';
    }
};

document.addEventListener('DOMContentLoaded', () => {
    if (window.location.pathname.includes('historico-caixas.html')) {
        window.aplicarFiltroCaixas(0);
    }
});

window.exportarFechamentoPDF = function(resumo) {
    if (typeof window.gerarPDFConsolidado === 'function') {
        window.gerarPDFConsolidado(resumo);
    } else {
        if (typeof showToast === 'function') showToast("Erro: Módulo não carregado", "erro");
    }
};

/* =============================================================
   FLUXO FINANCEIRO COM DRILL-DOWN (DETALHAMENTO)
   ============================================================= */

window.dadosFluxoAtual = { entradas: [], saidas: [] };

window.togglePeriodoFinanceiro = function() {
    document.getElementById('container-periodo-fin').classList.toggle('hidden');
};

window.mudarFiltroFinanceiro = function(dias) {
    [0, 7, 30, 99].forEach(d => {
        const btn = document.getElementById(`btn-fin-${d}`);
        if(btn) {
            btn.classList.remove('bg-white', 'dark:bg-slate-700', 'text-slate-800', 'dark:text-white', 'shadow-sm');
            btn.classList.add('text-slate-400');
        }
    });

    const btnAtivo = document.getElementById(`btn-fin-${dias === 'custom' ? 99 : dias}`);
    if(btnAtivo) {
        btnAtivo.classList.add('bg-white', 'dark:bg-slate-700', 'text-slate-800', 'dark:text-white', 'shadow-sm');
        btnAtivo.classList.remove('text-slate-400');
    }

    if (dias !== 'custom') {
        const hoje = new Date();
        const dataFim = hoje.toISOString().split('T')[0];
        const dataIni = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate() - dias).toISOString().split('T')[0];
        
        document.getElementById('data-inicio-fin').value = dataIni;
        document.getElementById('data-fim-fin').value = dataFim;
        document.getElementById('container-periodo-fin').classList.add('hidden');
    }

    gerarRelatorioFinanceiro();
};

window.gerarRelatorioFinanceiro = async function() {
    const inputIni = document.getElementById('data-inicio-fin');
    const inputFim = document.getElementById('data-fim-fin');
    const container = document.getElementById('conteudo-rel-financeiro');
    const resumoContainer = document.getElementById('resumo-financeiro-cards');

    if (!inputIni.value) inputIni.value = new Date().toISOString().split('T')[0];
    if (!inputFim.value) inputFim.value = new Date().toISOString().split('T')[0];

    const dataIni = inputIni.value;
    const dataFim = inputFim.value;

    if (!container || !resumoContainer) return;

    container.innerHTML = `<div class="py-10 text-center animate-pulse text-[10px] font-black uppercase text-slate-400 italic">Processando Fluxo...</div>`;

    try {
        const dtIniISO = dataIni + "T00:00:00Z";
        const dtFimISO = dataFim + "T23:59:59Z";

        const [resVendas, resMovs, resDespesas] = await Promise.all([
            _supabase.from('historico_vendas').select('*').gte('created_at', dtIniISO).lte('created_at', dtFimISO).neq('status', 'estornada'),
            _supabase.from('movimentacoes_caixa').select('*').gte('created_at', dtIniISO).lte('created_at', dtFimISO),
            _supabase.from('despesas').select('*').eq('paga', true).gte('data_pagamento', dataIni).lte('data_pagamento', dataFim)
        ]);

        let totalEntradas = 0, totalSaidas = 0;
        const vendas = resVendas.data || [];
        const movs = resMovs.data || [];
        const despesas = resDespesas.data || [];

        vendas.forEach(v => totalEntradas += parseFloat(v.total || 0));
        movs.forEach(m => {
            if (m.tipo === 'SUPRIMENTO') totalEntradas += parseFloat(m.valor || 0);
            else totalSaidas += parseFloat(m.valor || 0);
        });
        despesas.forEach(d => totalSaidas += parseFloat(d.valor || 0));

        window.dadosFluxoAtual.entradas = vendas;
        window.dadosFluxoAtual.saidas = [
            ...despesas.map(d => ({ desc: d.descricao, valor: d.valor, cat: d.categoria, data: d.data_pagamento })),
            ...movs.filter(m => m.tipo === 'SANGRIA').map(m => ({ desc: m.motivo || 'SANGRIA', valor: m.valor, cat: 'CAIXA', data: m.created_at }))
        ];

        const saldo = totalEntradas - totalSaidas;
        resumoContainer.innerHTML = `
            <div onclick="detalharEntradasFluxo()" class="bg-white dark:bg-slate-900 p-2 rounded-xl border border-slate-100 dark:border-slate-800 text-center cursor-pointer active:scale-95 hover:border-emerald-200 dark:hover:border-emerald-900/50 transition-all shadow-sm">
                <p class="text-[6px] font-black text-slate-400 uppercase">Entradas 🔍</p>
                <p class="text-[10px] font-black text-emerald-500">R$ ${totalEntradas.toFixed(2).replace('.', ',')}</p>
            </div>
            <div onclick="detalharSaidasFluxo()" class="bg-white dark:bg-slate-900 p-2 rounded-xl border border-slate-100 dark:border-slate-800 text-center cursor-pointer active:scale-95 hover:border-red-200 dark:hover:border-red-900/50 transition-all shadow-sm">
                <p class="text-[6px] font-black text-slate-400 uppercase">Saídas 🔍</p>
                <p class="text-[10px] font-black text-red-500">R$ ${totalSaidas.toFixed(2).replace('.', ',')}</p>
            </div>
            <div class="bg-slate-800 dark:bg-slate-700 p-2 rounded-xl text-center shadow-lg">
                <p class="text-[6px] font-black text-slate-400 uppercase">Saldo</p>
                <p class="text-[10px] font-black text-white">R$ ${saldo.toFixed(2).replace('.', ',')}</p>
            </div>
        `;

        if (vendas.length === 0 && movs.length === 0 && despesas.length === 0) {
            container.innerHTML = `<p class="text-center text-[10px] font-bold text-slate-400 uppercase py-10 italic">Nenhuma movimentação neste período</p>`;
            return;
        }

        let listaTotal = [
            ...vendas.map(v => ({ data: v.created_at, desc: `VENDA #${v.id}`, valor: v.total, tipo: 'E', cat: v.forma_pagamento })),
            ...movs.map(m => ({ data: m.created_at, desc: m.motivo || m.tipo, valor: m.valor, tipo: m.tipo === 'SUPRIMENTO' ? 'E' : 'S', cat: 'CAIXA' })),
            ...despesas.map(d => ({ data: d.data_pagamento, desc: d.descricao, valor: d.valor, tipo: 'S', cat: d.categoria }))
        ].sort((a, b) => new Date(b.data) - new Date(a.data));

        container.innerHTML = listaTotal.map(item => `
            <div class="flex justify-between items-center bg-white dark:bg-slate-900 p-3 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm">
                <div class="flex flex-col">
                    <span class="text-[9px] font-black text-slate-700 dark:text-slate-200 uppercase">${item.desc}</span>
                    <span class="text-[7px] font-bold text-slate-400 uppercase italic">${new Date(item.data).toLocaleDateString('pt-BR')} • ${item.cat}</span>
                </div>
                <div class="text-right">
                    <span class="text-[10px] font-black ${item.tipo === 'E' ? 'text-emerald-500' : 'text-red-500'}">
                        ${item.tipo === 'E' ? '+' : '-'} R$ ${parseFloat(item.valor).toFixed(2).replace('.', ',')}
                    </span>
                </div>
            </div>
        `).join('');

    } catch (e) {
        console.error("Erro Fluxo:", e);
        container.innerHTML = `<p class="text-red-500 text-[10px] text-center font-black uppercase mt-4">Erro ao carregar dados</p>`;
    }
};

window.detalharEntradasFluxo = function() {
    const vendas = window.dadosFluxoAtual.entradas;
    let mesaTotal = 0, balcaoTotal = 0;
    const pagamentos = {};

    vendas.forEach(v => {
        const val = parseFloat(v.total || 0);
        if (v.comanda_id) mesaTotal += val;
        else balcaoTotal += val;

        const pg = (v.forma_pagamento || 'OUTROS').toUpperCase();
        pagamentos[pg] = (pagamentos[pg] || 0) + val;
    });

    let html = `
        <div class="space-y-2">
            <div class="flex justify-between items-center p-4 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-100 dark:border-slate-700">
                <span class="text-[10px] font-black text-slate-500 uppercase">📋 Vendas Comanda</span>
                <span class="text-xs font-black text-slate-700 dark:text-slate-200">R$ ${mesaTotal.toFixed(2).replace('.', ',')}</span>
            </div>
            <div class="flex justify-between items-center p-4 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-100 dark:border-slate-700">
                <span class="text-[10px] font-black text-slate-500 uppercase">🛍️ Vendas Balcão</span>
                <span class="text-xs font-black text-slate-700 dark:text-slate-200">R$ ${balcaoTotal.toFixed(2).replace('.', ',')}</span>
            </div>
        </div>
        <div class="mt-6 pt-4 border-t border-slate-100 dark:border-slate-800">
            <h4 class="text-[9px] font-black text-slate-400 uppercase mb-3 tracking-widest italic">Por Forma de Pagamento</h4>
            <div class="space-y-2">
                ${Object.entries(pagamentos).map(([pg, val]) => {
                    // MÁGICA ACONTECENDO AQUI: Puxando sua função de cores!
                    const classesCor = typeof window.obterEstiloPilaPagamento === 'function' 
                                       ? window.obterEstiloPilaPagamento(pg) 
                                       : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300';
                    return `
                    <div class="flex justify-between items-center py-2 px-3 rounded-xl ${classesCor}">
                        <span class="text-[9px] font-bold uppercase">${pg}</span>
                        <span class="text-[10px] font-black">R$ ${val.toFixed(2).replace('.', ',')}</span>
                    </div>
                `}).join('')}
            </div>
        </div>
    `;

    document.getElementById('detalhe-fluxo-titulo').innerText = "RESUMO DE ENTRADAS";
    document.getElementById('detalhe-fluxo-conteudo').innerHTML = html;
    document.getElementById('modal-detalhe-fluxo').classList.remove('hidden');
};

window.detalharSaidasFluxo = function() {
    const saidas = window.dadosFluxoAtual.saidas;
    
    if (saidas.length === 0) {
        document.getElementById('detalhe-fluxo-conteudo').innerHTML = `<p class="text-center py-10 text-[10px] uppercase font-bold text-slate-400">Sem saídas no período</p>`;
    } else {
        let html = saidas.map(s => `
            <div class="flex justify-between items-center p-3 bg-red-50/50 dark:bg-red-900/10 rounded-xl border border-red-100/50 dark:border-red-900/20 mb-2">
                <div class="flex flex-col">
                    <span class="text-[9px] font-black text-slate-700 dark:text-slate-200 uppercase">${s.desc}</span>
                    <span class="text-[7px] font-bold text-slate-400 uppercase">${s.cat}</span>
                </div>
                <span class="text-[10px] font-black text-red-500">- R$ ${parseFloat(s.valor).toFixed(2).replace('.', ',')}</span>
            </div>
        `).join('');
        document.getElementById('detalhe-fluxo-conteudo').innerHTML = `<div class="space-y-1">${html}</div>`;
    }

    document.getElementById('detalhe-fluxo-titulo').innerText = "LISTAGEM DE SAÍDAS";
    document.getElementById('modal-detalhe-fluxo').classList.remove('hidden');
};