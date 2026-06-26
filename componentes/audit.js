/* =================================================================================
   MÓDULO: AUDITORIA E LOGS (VERSÃO UNIFICADA E FINAL)
   ================================================================================= */

/**
 * Função global inteligente para registrar logs.
 * Aceita 2 argumentos (ação, detalhes) ou 3 (tipo, ação, detalhes).
 */
window.registrarLog = async function(arg1, arg2, arg3) {
    if (typeof _supabase === 'undefined') return;

    let tipo, action, description;

    // Lógica de Autodetecção de parâmetros
    if (arg3 === undefined) {
        // Padrão 2 argumentos: registrarLog(acao, detalhes)
        action = arg1;
        description = arg2;
        const txt = action.toUpperCase();
        if (txt.includes('VENDA') || txt.includes('MESA') || txt.includes('COMANDA')) tipo = 'VENDA';
        else if (txt.includes('LOGIN') || txt.includes('LOGOUT')) tipo = 'SEGURANÇA';
        else if (txt.includes('CAIXA') || txt.includes('SANGRIA')) tipo = 'FINANCEIRO';
        else if (txt.includes('PRODUTO') || txt.includes('ESTOQUE')) tipo = 'ESTOQUE';
        else tipo = 'SISTEMA';
    } else {
        // Padrão 3 argumentos: registrarLog(tipo, acao, detalhes)
        tipo = arg1;
        action = arg2;
        description = arg3;
    }

    try {
        const usuarioLogado = localStorage.getItem('userName') || 'SISTEMA';
        
        await _supabase.from('auditoria').insert([{
            tipo: tipo.toUpperCase(),
            action: action.toUpperCase(),
            description: (description || action).toUpperCase(),
            usuario: usuarioLogado.toUpperCase(),
            created_at: new Date().toISOString()
        }]);
    } catch (e) {
        console.error("Erro ao gravar log:", e);
    }
};

window.carregarAuditoria = async function() {
    if (typeof isDatabaseReady === 'function' && !isDatabaseReady()) return;

    const container = document.getElementById('lista-auditoria');
    const dIni = document.getElementById('audit-data-ini')?.value;
    const dFim = document.getElementById('audit-data-fim')?.value;
    
    if (!container) return;

    try {
        let query = _supabase.from('auditoria').select('*').order('created_at', { ascending: false });

        // FILTRAGEM PRECISA
        if (dIni) {
            // "2026-03-29" vira "2026-03-29T00:00:00"
            query = query.gte('created_at', dIni + 'T00:00:00');
        }
        if (dFim) {
            // "2026-03-29" vira "2026-03-29T23:59:59"
            query = query.lte('created_at', dFim + 'T23:59:59');
        }

        const userF = document.getElementById('filtro-auditoria-usuario')?.value;
        const tipoF = document.getElementById('filtro-auditoria-tipo')?.value;

        if (userF && userF !== "TODOS") query = query.eq('usuario', userF.toUpperCase());
        if (tipoF && tipoF !== "TODOS") query = query.eq('tipo', tipoF.toUpperCase());

        const { data: logs, error } = await query.limit(200);
        if (error) throw error;

        if (!logs || logs.length === 0) {
            container.innerHTML = `<div class="text-center py-20 opacity-30 italic text-[10px] font-black uppercase">Nenhum registro neste período</div>`;
            return;
        }

        container.innerHTML = logs.map(l => {
            const cores = { SISTEMA: 'text-purple-500', VENDA: 'text-blue-500', FINANCEIRO: 'text-orange-500', ESTOQUE: 'text-amber-500', SEGURANÇA: 'text-emerald-500' };
            const cor = cores[l.tipo] || 'text-slate-400';
            
            return `
            <div class="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm mb-3">
                <div class="flex justify-between items-center mb-1">
                    <span class="text-[9px] font-black uppercase italic ${cor}">${l.tipo}</span>
                    <span class="text-[8px] font-bold text-slate-300 dark:text-slate-600">${new Date(l.created_at).toLocaleString('pt-BR')}</span>
                </div>
                <p class="text-[10px] font-black text-slate-700 dark:text-slate-200 uppercase leading-tight mb-2">${l.description || l.action}</p>
                <div class="pt-2 border-t border-slate-50 dark:border-slate-800 text-[8px] font-bold text-slate-400 uppercase">
                    OP: <span class="italic text-slate-500">${l.usuario}</span>
                </div>
            </div>`;
        }).join('');

    } catch (e) {
        console.error("Erro na busca:", e);
    }
};

/**
 * Filtros Rápidos (Hoje, 7 dias, 30 dias)
 */
window.filtrarAuditoriaRapido = function(dias) {
    const dtFim = new Date();
    const dtIni = new Date();
    dtIni.setDate(dtFim.getDate() - dias);

    // Atualiza visual dos botões
    [0, 7, 30].forEach(d => {
        const btn = document.getElementById(`btn-audit-${d}`);
        if(btn) btn.className = (d === dias) 
            ? "flex-1 py-2 text-[9px] font-black uppercase rounded-xl bg-white dark:bg-slate-700 shadow-sm text-slate-700 dark:text-white"
            : "flex-1 py-2 text-[9px] font-black uppercase rounded-xl text-slate-400 dark:text-slate-500";
    });
    
    document.getElementById('audit-data-ini').value = dtIni.toISOString().split('T')[0];
    document.getElementById('audit-data-fim').value = dtFim.toISOString().split('T')[0];

    carregarAuditoria();
};

/**
 * Gera PDF dos logs
 */
window.gerarPDFAuditoria = async function() {
    const logs = document.getElementById('lista-auditoria');
    
    if (!logs || logs.children.length === 0 || logs.innerText.includes('Nenhum')) {
        if (typeof showToast === 'function') showToast('SEM DADOS PARA EXPORTAR', 'erro');
        return;
    }

    if (typeof showToast === 'function') showToast('GERANDO PDF...', 'aviso');

    const loja = localStorage.getItem('nomeLoja') || "ESPETINHO & CIA";
    const dataHora = new Date().toLocaleString('pt-BR');
    
    let logoBase64 = '';
    if (typeof obterLogoBase64 === 'function') {
        logoBase64 = await obterLogoBase64('img/logo.jpg');
    }

    const hoje = new Date();
    const nomeArquivo = `${String(hoje.getDate()).padStart(2, '0')}${String(hoje.getMonth() + 1).padStart(2, '0')}${hoje.getFullYear()}_Relatorio_Auditoria`;

    const estilos = `
        <style>
            * { margin: 0; padding: 0; box-sizing: border-box; }
            body { font-family: 'Helvetica', Arial, sans-serif; padding: 40px; color: #1e293b; background: #fff; line-height: 1.4; }
            .header-pdf { position: relative; border-bottom: 4px solid #e63946; padding-bottom: 20px; margin-bottom: 30px; min-height: 100px; }
            .header-info h1 { font-size: 30px; font-weight: 900; color: #e63946; text-transform: uppercase; margin-bottom: 5px; }
            .header-logo { position: absolute; right: 0; top: 0; }
            .header-logo img { width: 90px; height: 90px; border-radius: 50%; object-fit: cover; }
            .secao-titulo { font-size: 14px; color: #e63946; font-weight: bold; text-transform: uppercase; border-left: 5px solid #e63946; padding-left: 10px; margin: 30px 0 15px 0; }
            table { width: 100%; border-collapse: collapse; font-size: 11px; margin-bottom: 25px; }
            th { background: #f1f5f9; padding: 12px; text-align: left; text-transform: uppercase; color: #64748b; border-bottom: 1px solid #e2e8f0; }
            td { padding: 12px; border-bottom: 1px solid #f1f5f9; color: #334155; font-weight: bold; }
            .text-right { text-align: right; }
        </style>
    `;

    const linhasTabela = Array.from(logs.children).map(div => {
        const dataStr = div.querySelector('.text-slate-300')?.innerText || '';
        const tipoStr = div.querySelector('.italic')?.innerText || '';
        const descStr = div.querySelector('p')?.innerText || '';
        const opStr = div.querySelector('.pt-2')?.innerText.replace('OP:', '').trim() || '';

        return `<tr><td>${dataStr}</td><td>${tipoStr}</td><td>${descStr}</td><td class="text-right">${opStr}</td></tr>`;
    }).join('');

    const html = `
        <!DOCTYPE html>
        <html>
        <head><title>${nomeArquivo}</title>${estilos}</head>
        <body>
            <div class="header-pdf">
                <div class="header-info">
                    <h1>${loja}</h1>
                    <p>Relatório de Auditoria e Logs</p>
                    <small>Emitido em: ${dataHora}</small>
                </div>
                <div class="header-logo"><img src="${logoBase64 || ''}" onerror="this.style.display='none'"></div>
            </div>
            <h3 class="secao-titulo">➔ Histórico de Atividades</h3>
            <table>
                <thead><tr><th>Data/Hora</th><th>Módulo</th><th>Descrição</th><th class="text-right">Operador</th></tr></thead>
                <tbody>${linhasTabela}</tbody>
            </table>
        </body></html>
    `;

    // AQUI ESTÁ A MÁGICA: Usamos nosso motor centralizado que não bloqueia
    if (typeof window.imprimirConteudoIframe === 'function') {
        window.imprimirConteudoIframe(html, nomeArquivo);
    } else {
        // Fallback caso print.js não esteja carregado
        const win = window.open('', '_blank');
        win.document.write(html);
        win.document.close();
        setTimeout(() => { win.print(); win.close(); }, 500);
    }
};

window.toggleFiltroPeriodoAudit = function() {
    const wrapper = document.getElementById('wrapper-datas-auditoria');
    
    if (!wrapper) {
        console.error("Erro: O elemento 'wrapper-datas-auditoria' não foi encontrado no HTML.");
        return;
    }

    // Se estiver escondido, mostra. Se estiver visível, esconde.
    if (wrapper.classList.contains('hidden')) {
        wrapper.classList.remove('hidden');
        wrapper.classList.add('grid'); // Usa grid porque seu HTML tem 'grid-cols-2'
    } else {
        wrapper.classList.add('hidden');
        wrapper.classList.remove('grid');
    }
};