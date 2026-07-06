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
        let fatBruto = 0, fatMesa = 0, fatBalcao = 0, totalTaxas = 0, totalEstornado = 0, vendasValidasCount = 0;
        let tempoMesaMs = 0, qtdMesaTempo = 0, tempoPreparoMs = 0, qtdPreparo = 0;
        
        const atendentes = {}, categorias = {}, pagamentos = {}, evolucao = {}, horasPico = {}, topProd = {};

        // --- 5. LOOP DE PROCESSAMENTO ÚNICO ---
        vendasUnicas.forEach(v => {
            const valor = parseFloat(v.total) || 0;
            const status = (v.status || '').toLowerCase();

            // Auditoria de Estornos
            if (status === 'estornada' || status === 'cancelada') {
                totalEstornado += valor;
                return; // Pula o resto, não entra no faturamento nem no ticket médio
            }

            vendasValidasCount++; // Contagem correta para Ticket Médio
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

            // Formas de Pagamento (Agora somando o valor em R$ em vez da quantidade de pedidos)
            const pg = (v.forma_pagamento || 'OUTROS').toUpperCase();
            pagamentos[pg] = (pagamentos[pg] || 0) + valor;

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
                // Tempo Preparo
                if (item.inicio_preparo && item.fim_preparo) {
                    tempoPreparoMs += (new Date(item.fim_preparo) - new Date(item.inicio_preparo));
                    qtdPreparo++;
                }
            });
        });

        // --- 6. CÁLCULOS FINANCEIROS E ESTRATÉGICOS ---
        const totalDespesas = (resDespesas.data || []).reduce((acc, d) => acc + parseFloat(d.valor), 0);
        const riscoFiado = (resClientes.data || []).reduce((acc, c) => acc + parseFloat(c.limite_fiado || 0), 0);
        const lucroLiquido = fatBruto - totalDespesas;
        
        // Novo KPI de Gestão: Taxa de Perda (%)
        const taxaPerda = fatBruto > 0 ? ((totalEstornado / (fatBruto + totalEstornado)) * 100).toFixed(1) : 0;

        // --- 7. ATUALIZAÇÃO DA UI (KPIs PADRONIZADOS) ---
        const fm = (v) => v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        const calcMin = (ms, qtd) => qtd > 0 ? Math.round((ms/qtd)/60000) : 0;

        const elLucro = document.getElementById('kpi-lucro');
        if (elLucro) {
            elLucro.innerText = `R$ ${fm(lucroLiquido)}`;
            // Muda cor do texto se o lucro/saldo for negativo (prejuízo)
            elLucro.className = lucroLiquido < 0 ? 'text-red-500 font-black' : 'text-emerald-500 font-black';
        }
        
        if (document.getElementById('kpi-faturamento')) document.getElementById('kpi-faturamento').innerText = `R$ ${fm(fatBruto)}`;
        if (document.getElementById('kpi-despesas')) document.getElementById('kpi-despesas').innerText = `R$ ${fm(totalDespesas)}`;
        if (document.getElementById('kpi-fiado')) document.getElementById('kpi-fiado').innerText = `R$ ${fm(riscoFiado)}`;
        if (document.getElementById('kpi-vendas')) document.getElementById('kpi-vendas').innerText = vendasValidasCount;
        if (document.getElementById('kpi-ticket')) document.getElementById('kpi-ticket').innerText = `R$ ${fm(vendasValidasCount > 0 ? fatBruto/vendasValidasCount : 0)}`;
        if (document.getElementById('kpi-taxas')) document.getElementById('kpi-taxas').innerText = `R$ ${fm(totalTaxas)}`;
        
        // Estornos exibe o valor E a taxa de perda ao lado
        if (document.getElementById('kpi-estornos')) document.getElementById('kpi-estornos').innerText = `R$ ${fm(totalEstornado)} (${taxaPerda}%)`;
        
        if (document.getElementById('kpi-tempo-mesa')) document.getElementById('kpi-tempo-mesa').innerText = `${calcMin(tempoMesaMs, qtdMesaTempo)} MIN`;
        if (document.getElementById('kpi-tempo-preparo')) document.getElementById('kpi-tempo-preparo').innerText = `${calcMin(tempoPreparoMs, qtdPreparo)} MIN`;

        // Alerta de Estoque Crítico
        const criticos = (resEstoque.data || []).filter(p => p.estoque_atual <= p.estoque_minimo);
        const elEstoque = document.getElementById('kpi-estoque-aviso');
        if (elEstoque) {
            if (criticos.length > 0) {
                elEstoque.innerText = `${criticos.length} ITENS EM ALERTA ⚠️`;
                elEstoque.className = "text-[10px] font-black text-red-500 animate-pulse uppercase";
            } else {
                elEstoque.innerText = "TUDO EM DIA ✅";
                elEstoque.className = "text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase";
            }
        }

        // --- 8. RENDERIZAÇÃO DOS GRÁFICOS (OU MENSAGEM VAZIA) ---
        if (vendasValidasCount === 0) {
            window.exibirMensagemVazia();
        } else {
            renderizarGraficosDashboard(evolucao, atendentes, categorias, {fatMesa, fatBalcao}, horasPico, topProd, pagamentos);
        }

    } catch (e) { console.error("❌ Erro BI Dashboard:", e); }
};

/**
 * Função de Renderização ApexCharts (Desenha e Limpa Gráficos)
 */
function renderizarGraficosDashboard(evol, aten, cat, orig, pico, prod, pag) {
    const isDark = document.documentElement.classList.contains('dark');
    const corBase = isDark ? '#94a3b8' : '#64748b';
    const gridCor = isDark ? '#1e293b' : '#f1f5f9';

    // 1. Limpeza de instâncias de gráficos anteriores
    Object.values(charts).forEach(c => { if(c) c.destroy(); });

    // 2. Limpeza forçada do HTML
    const ids = ['chart-faturamento', 'chart-atendentes', 'chart-categorias', 'chart-origem', 'chart-pico', 'chart-top-produtos', 'chart-pagamentos'];
    ids.forEach(id => {
        const el = document.getElementById(id); 
        if(el) el.innerHTML = ''; 
    });

    // --- FUNÇÕES MÁGICAS DE FORMATAÇÃO VISUAL ---
    const fmtBRL = (val) => 'R$ ' + parseFloat(val || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const fmtQtd = (val) => parseInt(val || 0).toLocaleString('pt-BR');

    // 3. Evolução Diária/Hora (Monetário R$)
    charts.evolucao = new ApexCharts(document.getElementById('chart-faturamento'), {
        series: [{ name: 'Vendido', data: Object.values(evol).map(v => v.toFixed(2)) }],
        chart: { type: 'area', height: 160, toolbar: {show:false}, foreColor: corBase },
        colors: ['#e63946'], stroke: { curve: 'smooth', width: 2 },
        xaxis: { categories: Object.keys(evol) }, yaxis: { show: false }, grid: { borderColor: gridCor },
        dataLabels: { enabled: false },
        tooltip: { y: { formatter: function (val) { return fmtBRL(val); } } } // Exibe R$ ao clicar
    }); charts.evolucao.render();

    // 4. Ranking de Atendentes (Monetário R$)
    const dAten = Object.entries(aten).sort((a,b) => b[1] - a[1]).slice(0, 5);
    charts.atendentes = new ApexCharts(document.getElementById('chart-atendentes'), {
        series: [{ name: 'Faturamento', data: dAten.map(a => a[1].toFixed(2)) }],
        chart: { type: 'bar', height: 160, toolbar: {show:false}, foreColor: corBase },
        plotOptions: { bar: { horizontal: true, borderRadius: 4, barHeight: '60%' } },
        colors: ['#6366f1'], 
        xaxis: { 
            categories: dAten.map(a => a[0]), 
            labels: { formatter: function(val) { return fmtBRL(val); } } // Formata o eixo inferior
        },
        dataLabels: { enabled: true, formatter: function(val) { return fmtBRL(val); }, style: { fontSize: '9px' } }, // Formata o número dentro da barra
        tooltip: { y: { formatter: function (val) { return fmtBRL(val); } } }
    }); charts.atendentes.render();

    // 5. Vendas por Categoria (Gráfico Donut - Monetário R$)
    charts.categorias = new ApexCharts(document.getElementById('chart-categorias'), {
        series: Object.values(cat),
        labels: Object.keys(cat),
        chart: { type: 'donut', height: 160, foreColor: corBase },
        colors: ['#10b981', '#8b5cf6', '#f59e0b', '#ef4444', '#3b82f6'],
        legend: { position: 'bottom', fontSize: '9px' }, stroke: { show: false }, dataLabels: { enabled: false },
        tooltip: { y: { formatter: function (val) { return fmtBRL(val); } } }
    }); charts.categorias.render();

    // 6. Origem (Mesa x Balcão) (Gráfico Donut - Monetário R$)
    charts.origem = new ApexCharts(document.getElementById('chart-origem'), {
        series: [orig.fatMesa, orig.fatBalcao],
        labels: ['Mesas', 'Balcão'],
        chart: { type: 'donut', height: 160, foreColor: corBase },
        colors: ['#6366f1', '#f97316'],
        legend: { position: 'bottom', fontSize: '9px' }, stroke: { show: false }, dataLabels: { enabled: false },
        tooltip: { y: { formatter: function (val) { return fmtBRL(val); } } }
    }); charts.origem.render();

    // 7. Horários de Pico (Quantidade Numérica)
    const hCat = Object.keys(pico).sort((a,b) => parseInt(a) - parseInt(b));
    charts.pico = new ApexCharts(document.getElementById('chart-pico'), {
        series: [{ name: 'Pedidos', data: hCat.map(h => pico[h]) }],
        chart: { type: 'bar', height: 160, toolbar: {show:false}, foreColor: corBase },
        colors: ['#f59e0b'], plotOptions: { bar: { borderRadius: 4 } },
        xaxis: { categories: hCat }, grid: { borderColor: gridCor },
        dataLabels: { enabled: true, formatter: function(val) { return fmtQtd(val); }, style: { fontSize: '9px' } },
        tooltip: { y: { formatter: function (val) { return fmtQtd(val) + ' Pedidos'; } } } // Exibe "1.000 Pedidos" ao clicar
    }); charts.pico.render();

    // 8. Top 5 Produtos (Quantidade Numérica)
    const dProd = Object.entries(prod).sort((a,b) => b[1] - a[1]).slice(0, 5);
    charts.produtos = new ApexCharts(document.getElementById('chart-top-produtos'), {
        series: [{ name: 'Quantidade', data: dProd.map(p => p[1]) }],
        chart: { type: 'bar', height: 180, toolbar: {show:false}, foreColor: corBase },
        plotOptions: { bar: { horizontal: true, borderRadius: 4 } },
        colors: ['#3b82f6'], xaxis: { categories: dProd.map(p => p[0].substring(0, 12)) },
        dataLabels: { enabled: true, formatter: function(val) { return fmtQtd(val); }, style: { fontSize: '9px' } },
        tooltip: { y: { formatter: function (val) { return fmtQtd(val) + ' Unid.'; } } } // Exibe "250 Unid." ao clicar
    }); charts.produtos.render();

    // 9. Meios de Pagamento (Gráfico Donut - Monetário R$)
    charts.pagamentos = new ApexCharts(document.getElementById('chart-pagamentos'), {
        series: Object.values(pag),
        labels: Object.keys(pag),
        chart: { type: 'donut', height: 160, foreColor: corBase },
        colors: ['#10b981', '#6366f1', '#f59e0b', '#3b82f6', '#94a3b8'],
        legend: { position: 'bottom', fontSize: '9px' }, stroke: { show: false }, dataLabels: { enabled: false },
        tooltip: { y: { formatter: function (val) { return fmtBRL(val); } } }
    }); charts.pagamentos.render();
}

/**
 * Função Auxiliar: Exibe mensagem quando não há dados no período selecionado
 */
window.exibirMensagemVazia = function() {
    const msg = '<div class="flex items-center justify-center h-full min-h-[160px] text-[10px] text-slate-400 uppercase italic font-bold">Sem vendas válidas no período</div>';
    const ids = ['chart-faturamento', 'chart-atendentes', 'chart-categorias', 'chart-origem', 'chart-pico', 'chart-top-produtos', 'chart-pagamentos'];
    ids.forEach(id => {
        const el = document.getElementById(id); if(el) el.innerHTML = msg;
    });
};

/**HOME */
window.atualizarFaturamentoHoje = async function() {
    try {
        const hoje = new Date();
        // Ajuste para pegar desde a meia-noite do dia atual no seu fuso horário
        const inicioDia = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate()).toISOString();

        // Buscamos todas as vendas do dia sem restringir pelo IN (para não pular nada por erro de digitação)
        const { data: vendas, error } = await _supabase
            .from('historico_vendas')
            .select('total, status, created_at')
            .gte('created_at', inicioDia);

        if (error) throw error;

        // Soma apenas o que NÃO for estornada
        const totalFaturado = vendas.reduce((acc, venda) => {
            const status = (venda.status || '').toLowerCase().trim();
            
            // FILTRO DE SEGURANÇA: ignora explicitamente as estornadas
            if (status === 'estornada') return acc;
            
            return acc + (parseFloat(venda.total) || 0);
        }, 0);

        const elementoFaturamento = document.getElementById('faturamento-hoje');
        if (elementoFaturamento) {
            const formatarBRL = (v) => v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
            const formatador = typeof window.fmSeguro === 'function' ? window.fmSeguro : formatarBRL;
            elementoFaturamento.innerText = `R$ ${formatador(totalFaturado)}`;
        }

    } catch (e) {
        console.error("[DASHBOARD] Erro ao calcular faturamento:", e);
        const el = document.getElementById('faturamento-hoje');
        if (el) el.innerText = "R$ 0,00";
    }
};

document.addEventListener('DOMContentLoaded', () => {
    if (typeof window.atualizarFaturamentoHoje === 'function') {
        window.atualizarFaturamentoHoje();
        setInterval(window.atualizarFaturamentoHoje, 5 * 60 * 1000); 
    }
});