/* =============================================================
    MÓDULO: DASHBOARD ANALÍTICO (BI - VERSÃO 2.0 COMPLETA)
    SISTEMA: WebComanda - Inteligência de Gestão
   ============================================================= */

// Controle global de instâncias para limpeza de memória e UI
let charts = {
    evolucao: null,
    atendentes: null,
    categorias: null,
    origem: null,
    pico: null,
    produtos: null,
    pagamentos: null
};

/**
 * Função Mestra: Orquestra a busca, processamento e exibição dos dados
 */
window.gerarDashboard = async function(diasBusca = 0, dataInicioManual = null, dataFimManual = null) {
    if (typeof _supabase === 'undefined' || typeof ApexCharts === 'undefined') return;

    // --- 1. CONFIGURAÇÃO DO PERÍODO ---
    let dataFiltroStr, fimFiltroStr;
    try {
        if (diasBusca === 'custom' || diasBusca === 99) {
            if (!dataInicioManual || !dataFimManual) return;
            dataFiltroStr = new Date(dataInicioManual + "T00:00:00").toISOString();
            fimFiltroStr = new Date(dataFimManual + "T23:59:59").toISOString();
        } else {
            const hoje = new Date();
            const dInicio = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate() - parseInt(diasBusca), 0, 0, 0);
            dataFiltroStr = dInicio.toISOString();
            fimFiltroStr = hoje.toISOString();
        }
    } catch (e) { return; }

    // Reset Visual de todos os KPIs (Loading State)
    const kpis = ['kpi-lucro', 'kpi-faturamento', 'kpi-despesas', 'kpi-fiado', 'kpi-vendas', 'kpi-ticket', 'kpi-taxas', 'kpi-estornos', 'kpi-tempo-preparo', 'kpi-tempo-mesa', 'kpi-estoque-aviso'];
    kpis.forEach(id => { if(document.getElementById(id)) document.getElementById(id).innerText = "..."; });

    try {
        // --- 2. BUSCA DE DADOS EM PARALELO (CROSS-DATABASE) ---
        // Buscamos em 5 tabelas diferentes simultaneamente para máxima performance
        const [resVendas, resComandas, resDespesas, resClientes, resEstoque] = await Promise.all([
            _supabase.from('historico_vendas').select('*').gte('created_at', dataFiltroStr).lte('created_at', fimFiltroStr),
            _supabase.from('comandas').select('*').eq('status', 'fechada').gte('fechada_em', dataFiltroStr).lte('fechada_em', fimFiltroStr),
            _supabase.from('despesas').select('valor').eq('paga', true).gte('data_pagamento', dataFiltroStr.split('T')[0]).lte('data_pagamento', fimFiltroStr.split('T')[0]),
            _supabase.from('clientes').select('limite_fiado'),
            _supabase.from('produtos').select('nome, estoque_atual, estoque_minimo').eq('controlar_estoque', true)
        ]);

        // --- 3. FILTRO ANTI-DUPLICIDADE (USANDO MAP) ---
        let mapVendas = new Map();
        if (resVendas.data) {
            resVendas.data.forEach(v => {
                mapVendas.set(v.id, { ...v, tabelaOrigem: v.comanda_id ? 'mesa' : 'balcao', dRef: v.created_at });
            });
        }
        if (resComandas.data) {
            resComandas.data.forEach(c => {
                if (!mapVendas.has(c.id)) {
                    mapVendas.set(c.id, { ...c, tabelaOrigem: 'mesa', dRef: c.fechada_em });
                }
            });
        }
        const vendasUnicas = Array.from(mapVendas.values());

        // --- 4. VARIÁVEIS DE PROCESSAMENTO ---
        let fatBruto = 0, fatMesa = 0, fatBalcao = 0, totalTaxas = 0, totalEstornado = 0;
        let tempoMesaMs = 0, qtdMesaTempo = 0, tempoPreparoMs = 0, qtdPreparo = 0;
        
        const atendentes = {}, categorias = {}, pagamentos = {}, evolucao = {}, horasPico = {}, topProd = {};

        // --- 5. LOOP DE PROCESSAMENTO ÚNICO ---
        vendasUnicas.forEach(v => {
            const valor = parseFloat(v.total) || 0;
            const status = (v.status || '').toLowerCase();

            // Auditoria de Estornos
            if (status === 'estornada' || status === 'cancelada') {
                totalEstornado += valor;
                return; 
            }

            fatBruto += valor;
            totalTaxas += parseFloat(v.taxa_servico || 0);

            // Segmentação Origem e Tempo de Mesa
            if (v.tabelaOrigem === 'mesa') {
                fatMesa += valor;
                if (v.aberta_em && v.fechada_em) {
                    tempoMesaMs += (new Date(v.fechada_em) - new Date(v.aberta_em));
                    qtdMesaTempo++;
                }
            } else { fatBalcao += valor; }

            // Ranking Atendentes (Unifica atendente/vendedor)
            const nomeAtenc = (v.atendente || v.vendedor || 'BALCÃO').toUpperCase();
            atendentes[nomeAtenc] = (atendentes[nomeAtenc] || 0) + valor;

            // Gráfico de Evolução e Horas de Pico
            const d = new Date(v.dRef);
            const hora = d.getHours() + 'h';
            horasPico[hora] = (horasPico[hora] || 0) + 1;
            const chaveEv = diasBusca === 0 ? hora : d.toLocaleDateString('pt-BR', {day:'2-digit', month:'2-digit'});
            evolucao[chaveEv] = (evolucao[chaveEv] || 0) + valor;

            // Formas de Pagamento
            const pg = (v.forma_pagamento || 'OUTROS').toUpperCase();
            pagamentos[pg] = (pagamentos[pg] || 0) + 1;

            // Processamento de Itens (Categorias e Ranking)
            let itens = typeof v.itens === 'string' ? JSON.parse(v.itens) : (v.itens || []);
            itens.forEach(item => {
                const precoItem = parseFloat(item.preco || 0);
                if (precoItem > 0 && !(item.nome || '').toUpperCase().includes('PGTO')) {
                    // Ranking de Produtos
                    const n = item.nome.toUpperCase();
                    topProd[n] = (topProd[n] || 0) + (item.qtd || item.quantidade || 1);
                    // Ranking por Categoria
                    const c = (item.categoria || 'OUTROS').toUpperCase();
                    categorias[c] = (categorias[c] || 0) + (precoItem * (item.qtd || item.quantidade || 1));
                }
                // Tempo Preparo (se houver marcação de tempo nos itens)
                if (item.inicio_preparo && item.fim_preparo) {
                    tempoPreparoMs += (new Date(item.fim_preparo) - new Date(item.inicio_preparo));
                    qtdPreparo++;
                }
            });
        });

        // --- 6. CÁLCULOS FINANCEIROS E ESTRATÉGICOS ---
        const totalDespesas = (resDespesas.data || []).reduce((acc, d) => acc + parseFloat(d.valor), 0);
        const riscoFiado = (resClientes.data || []).reduce((acc, c) => acc + parseFloat(c.limite_fiado), 0);
        const lucroLiquido = fatBruto - totalDespesas;

        // --- 7. ATUALIZAÇÃO DA UI (KPIs PADRONIZADOS) ---
        const fm = (v) => v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        const calcMin = (ms, qtd) => qtd > 0 ? Math.round((ms/qtd)/60000) : 0;

        document.getElementById('kpi-lucro').innerText = `R$ ${fm(lucroLiquido)}`;
        document.getElementById('kpi-faturamento').innerText = `R$ ${fm(fatBruto)}`;
        document.getElementById('kpi-despesas').innerText = `R$ ${fm(totalDespesas)}`;
        document.getElementById('kpi-fiado').innerText = `R$ ${fm(riscoFiado)}`;
        document.getElementById('kpi-vendas').innerText = vendasUnicas.length;
        document.getElementById('kpi-ticket').innerText = `R$ ${fm(vendasUnicas.length > 0 ? fatBruto/vendasUnicas.length : 0)}`;
        document.getElementById('kpi-taxas').innerText = `R$ ${fm(totalTaxas)}`;
        document.getElementById('kpi-estornos').innerText = `R$ ${fm(totalEstornado)}`;
        document.getElementById('kpi-tempo-mesa').innerText = `${calcMin(tempoMesaMs, qtdMesaTempo)} MIN`;
        document.getElementById('kpi-tempo-preparo').innerText = `${calcMin(tempoPreparoMs, qtdPreparo)} MIN`;

        // Alerta de Estoque Crítico
        const criticos = (resEstoque.data || []).filter(p => p.estoque_atual <= p.estoque_minimo);
        const elEstoque = document.getElementById('kpi-estoque-aviso');
        if (criticos.length > 0) {
            elEstoque.innerText = `${criticos.length} ITENS EM ALERTA ⚠️`;
            elEstoque.className = "text-[10px] font-black text-red-500 animate-pulse uppercase";
        } else {
            elEstoque.innerText = "TUDO EM DIA ✅";
            elEstoque.className = "text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase";
        }

        // --- 8. RENDERIZAÇÃO DOS GRÁFICOS ---
        renderizarGraficosDashboard(evolucao, atendentes, categorias, {fatMesa, fatBalcao}, horasPico, topProd, pagamentos);

    } catch (e) { console.error("❌ Erro BI Dashboard:", e); }
};

/**
 * Função de Renderização ApexCharts (Desenha e Limpa Gráficos)
 */
function renderizarGraficosDashboard(evol, aten, cat, orig, pico, prod, pag) {
    const isDark = document.documentElement.classList.contains('dark');
    const corBase = isDark ? '#94a3b8' : '#64748b';
    const gridCor = isDark ? '#1e293b' : '#f1f5f9';

    // Limpeza de instâncias anteriores para evitar bugs de hover e memória
    Object.values(charts).forEach(c => { if(c) c.destroy(); });

    // 1. Evolução Diária/Hora
    charts.evolucao = new ApexCharts(document.getElementById('chart-faturamento'), {
        series: [{ name: 'Vendido (R$)', data: Object.values(evol).map(v => v.toFixed(2)) }],
        chart: { type: 'area', height: 160, toolbar: {show:false}, foreColor: corBase },
        colors: ['#e63946'], stroke: { curve: 'smooth', width: 2 },
        xaxis: { categories: Object.keys(evol) }, yaxis: { show: false }, grid: { borderColor: gridCor }
    }); charts.evolucao.render();

    // 2. Ranking de Atendentes (Faturamento por pessoa)
    const dAten = Object.entries(aten).sort((a,b) => b[1] - a[1]).slice(0, 5);
    charts.atendentes = new ApexCharts(document.getElementById('chart-atendentes'), {
        series: [{ name: 'R$', data: dAten.map(a => a[1].toFixed(2)) }],
        chart: { type: 'bar', height: 160, toolbar: {show:false}, foreColor: corBase },
        plotOptions: { bar: { horizontal: true, borderRadius: 4, barHeight: '60%' } },
        colors: ['#6366f1'], xaxis: { categories: dAten.map(a => a[0]) }
    }); charts.atendentes.render();

    // 3. Vendas por Categoria (Gráfico Donut)
    charts.categorias = new ApexCharts(document.getElementById('chart-categorias'), {
        series: Object.values(cat),
        labels: Object.keys(cat),
        chart: { type: 'donut', height: 160, foreColor: corBase },
        colors: ['#10b981', '#8b5cf6', '#f59e0b', '#ef4444', '#3b82f6'],
        legend: { position: 'bottom', fontSize: '9px' }, stroke: { show: false }, dataLabels: { enabled: false }
    }); charts.categorias.render();

    // 4. Origem (Mesa x Balcão)
    charts.origem = new ApexCharts(document.getElementById('chart-origem'), {
        series: [orig.fatMesa, orig.fatBalcao],
        labels: ['Mesas', 'Balcão'],
        chart: { type: 'donut', height: 160, foreColor: corBase },
        colors: ['#6366f1', '#f97316'],
        legend: { position: 'bottom', fontSize: '9px' }, stroke: { show: false }, dataLabels: { enabled: false }
    }); charts.origem.render();

    // 5. Horários de Pico
    const hCat = Object.keys(pico).sort((a,b) => parseInt(a) - parseInt(b));
    charts.pico = new ApexCharts(document.getElementById('chart-pico'), {
        series: [{ name: 'Pedidos', data: hCat.map(h => pico[h]) }],
        chart: { type: 'bar', height: 160, toolbar: {show:false}, foreColor: corBase },
        colors: ['#f59e0b'], plotOptions: { bar: { borderRadius: 4 } },
        xaxis: { categories: hCat }, grid: { borderColor: gridCor }
    }); charts.pico.render();

    // 6. Top 5 Produtos
    const dProd = Object.entries(prod).sort((a,b) => b[1] - a[1]).slice(0, 5);
    charts.produtos = new ApexCharts(document.getElementById('chart-top-produtos'), {
        series: [{ name: 'Unid.', data: dProd.map(p => p[1]) }],
        chart: { type: 'bar', height: 180, toolbar: {show:false}, foreColor: corBase },
        plotOptions: { bar: { horizontal: true, borderRadius: 4 } },
        colors: ['#3b82f6'], xaxis: { categories: dProd.map(p => p[0].substring(0, 12)) }
    }); charts.produtos.render();

    // 7. Meios de Pagamento
    charts.pagamentos = new ApexCharts(document.getElementById('chart-pagamentos'), {
        series: Object.values(pag),
        labels: Object.keys(pag),
        chart: { type: 'donut', height: 160, foreColor: corBase },
        colors: ['#10b981', '#6366f1', '#f59e0b', '#3b82f6', '#94a3b8'],
        legend: { position: 'bottom', fontSize: '9px' }, stroke: { show: false }, dataLabels: { enabled: false }
    }); charts.pagamentos.render();
}

/**
 * Função Auxiliar: Exibe mensagem quando não há dados no período selecionado
 */
window.exibirMensagemVazia = function() {
    const msg = '<div class="flex items-center justify-center h-full min-h-[160px] text-[10px] text-slate-400 uppercase italic font-bold">Sem dados no período</div>';
    const ids = ['chart-faturamento', 'chart-atendentes', 'chart-categorias', 'chart-origem', 'chart-pico', 'chart-top-produtos', 'chart-pagamentos'];
    ids.forEach(id => {
        const el = document.getElementById(id); if(el) el.innerHTML = msg;
    });
};

/**HOME */

window.atualizarFaturamentoHoje = async function() {
    try {
        // 1. Define o início e o fim do dia de HOJE
        const agora = new Date();
        const inicioDia = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate(), 0, 0, 0).toISOString();
        const fimDia = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate(), 23, 59, 59).toISOString();

        // 2. Busca as vendas no Supabase dentro desse período
        const { data: vendas, error } = await _supabase
            .from('historico_vendas')
            .select('total')
            .gte('created_at', inicioDia)
            .lte('created_at', fimDia);

        if (error) throw error;

        // 3. Soma os valores
        const totalFaturado = vendas.reduce((acc, venda) => acc + (parseFloat(venda.total) || 0), 0);

        // 4. Atualiza o elemento na tela (Ajuste o ID se o seu for diferente)
        const elementoFaturamento = document.getElementById('faturamento-hoje');
        if (elementoFaturamento) {
            // Usa a sua função fmSeguro que já criamos para formatar R$
            elementoFaturamento.innerText = `R$ ${window.fmSeguro(totalFaturado)}`;
        }

    } catch (e) {
        console.error("[DASHBOARD] Erro ao calcular faturamento:", e);
        const elementoFaturamento = document.getElementById('faturamento-hoje');
        if (elementoFaturamento) elementoFaturamento.innerText = "R$ 0,00";
    }
};

document.addEventListener('DOMContentLoaded', () => {
    window.atualizarFaturamentoHoje();
    
    // Opcional: Atualiza sozinho a cada 5 minutos para o gerente ver o dinheiro entrando
    setInterval(window.atualizarFaturamentoHoje, 5 * 60 * 1000); 
});