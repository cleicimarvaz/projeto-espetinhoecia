/* =================================================================================
   MÓDULO: MOTOR DE IMPRESSÃO UNIVERSAL (Versão Corrigida e Unificada p/ RawBT)
   ================================================================================= */

/* ---------------------------------------------------------------------------------
   1. AUXILIARES E FORMATADORES INTERNOS
   --------------------------------------------------------------------------------- */

window.fmSeguro = val => parseFloat(val || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

async function obterLogoBase64(url) {
    try {
        const response = await fetch(url);
        const blob = await response.blob();
        return new Promise((resolve) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result);
            reader.readAsDataURL(blob);
        });
    } catch (e) {
        console.warn("Logo não encontrada para o PDF:", url);
        return null;
    }
}

function getTicketCSS(layout) {
    let css = `
        @media print { @page { margin: 0; size: 58mm auto; } body { margin: 0; padding: 0; } }
        html, body { width: 58mm; margin: 0; padding: 0; background-color: #fff; font-family: sans-serif; color: #000; }
        * { box-sizing: border-box; }
        .ticket-wrapper { width: 100%; display: block; position: relative; padding-bottom: 5mm; margin-bottom: 5mm; border-bottom: 1px dashed #000; page-break-inside: avoid; }
        .ticket-wrapper:last-child { border-bottom: none; margin-bottom: 0; padding-bottom: 0; }
        .text-center { text-align: center; } .bold { font-weight: 900; } .uppercase { text-transform: uppercase; }
        .item-name { display: block; line-height: 1.1; margin-bottom: 4px; font-weight: 900; }
        .item-price { display: block; margin-bottom: 4px; }
        .instruction-text { display: block; font-weight: 900; margin-top: 5px; } 
        .footer { font-size: 10px; margin-top: 5px; opacity: 0.8; line-height: 1.2; }
    `;
    
    if (layout === 'padrao') {
        css += `
            .ticket-wrapper { padding: 10px 0; text-align: center; } 
            .header { margin-bottom: 8px; border-bottom: 1px dashed #000; padding-bottom: 5px; } 
            .store-name { font-size: 13px; font-weight: 900; text-transform: uppercase; } 
            .meta { font-size: 9px; margin-top: 2px; } 
            .box-padrao { border: 3px solid #000; border-radius: 10px; padding: 10px 2px; margin: 5px 0; width: 100%; display: block; } 
            .item-name { font-size: 14px; font-weight: 900; text-transform: uppercase; } 
            .item-price { font-size: 12px; } 
            .instruction-text { font-size: 11px; margin-top: 8px; text-transform: uppercase; display: inline-block; border-bottom: 2px solid #000; }
        `;
    } else if (layout === 'eco') {
        css += `
            body { font-size: 10px; font-family: Arial, sans-serif; } 
            .ticket-wrapper { padding: 5px 0; margin-bottom: 5px; text-align: left; } 
            .header { border-bottom: 1px solid #000; padding-bottom: 4px; margin-bottom: 4px; display: flex; justify-content: space-between; align-items: center; } 
            .store-name { font-size: 10px; font-weight: bold; } 
            .meta { font-size: 8px; } 
            .unified-box { border: 1px solid #999; padding: 4px; margin: 4px 0; } 
            .item-name { font-size: 11px; font-weight: bold; margin-bottom: 2px; } 
            .item-price { font-size: 10px; margin-bottom: 0; } 
            .instruction-text { display: none; } 
            .footer { display: block; border-top: 1px dotted #ccc; padding-top: 2px; text-align: right; font-size: 8px;}
        `;
    } else if (layout === 'gigante') {
        css += `
            .ticket-wrapper { padding: 5px 0; border-bottom: 5px solid #000; text-align: center; } 
            .header { border-bottom: 2px solid #000; padding-bottom: 5px; margin-bottom: 5px; } 
            .store-name { font-size: 10px; text-transform: uppercase; font-weight: bold; } 
            .meta { font-size: 10px; display: block; font-weight: bold; margin-top: 2px; } 
            .unified-box { border: 4px solid #000; padding: 5px; margin: 5px 0; } 
            .item-name { font-size: 20px; font-weight: 900; line-height: 1; margin-bottom: 5px; word-break: break-word; text-transform: uppercase; } 
            .item-price { font-size: 16px; font-weight: bold; display: block; margin-bottom: 5px; } 
            .instruction-text { font-size: 12px; background: #000; color: #fff; display: inline-block; padding: 3px 8px; -webkit-print-color-adjust: exact; text-transform: uppercase; font-weight: 900; } 
            .footer { display: block; font-weight: bold; font-size: 10px; margin-top: 5px; border-top: 1px solid #000; padding-top: 2px;}
        `;
    } else if (layout === 'escuro') {
        css += `
            .ticket-wrapper { border: 4px solid #000; padding: 10px 2px; text-align: center; background: #fff; } 
            .header { background: #000; color: #fff; padding: 5px; margin-bottom: 10px; -webkit-print-color-adjust: exact; } 
            .store-name { font-size: 12px; font-weight: 900; } 
            .meta { font-size: 8px; color: #ccc; } 
            .unified-box { border: 3px solid #000; padding: 10px 2px; margin: 5px 0; } 
            .item-name { font-size: 15px; font-weight: 900; text-transform: uppercase; border-bottom: 2px solid #000; padding-bottom: 5px; } 
            .item-price { font-size: 13px; font-weight: bold; margin-top: 5px;} 
            .instruction-text { font-size: 11px; border-top: 2px solid #000; padding-top: 5px; margin-top: 10px; text-transform: uppercase; font-weight: 900;}
        `;
    } else {
        css += `
            .ticket-wrapper { border-left: 5px solid #e63946; border-right: 5px solid #e63946; padding: 10px 2px; text-align: center; } 
            .header { margin-bottom: 5px; border-bottom: 1px solid #ccc; padding-bottom: 5px; } 
            .store-name { font-size: 11px; font-weight: 900; } 
            .meta { font-size: 8px; color: #555; } 
            .unified-box { border: 2px solid #000; padding: 8px 2px; margin: 5px 0; background: #f8f8f8; border-radius: 8px; } 
            .item-name { font-size: 13px; font-weight: 900; text-transform: uppercase; } 
            .item-price { font-size: 11px; font-weight: bold; color: #333; } 
            .instruction-text { font-size: 10px; text-decoration: none; text-transform: uppercase; } 
            .separator { border-bottom: 1px solid #ccc; margin: 5px 15px; }
        `;
    }
    return css;
}

/* ---------------------------------------------------------------------------------
   2. RELATÓRIO DE FECHAMENTO (PDF DASHBOARD)
   --------------------------------------------------------------------------------- */

window.gerarPDFConsolidado = async function(resumo) {
    if (!resumo) return;
    if (typeof showToast === 'function') showToast('GERANDO PDF...', 'aviso');

    const dataHora = new Date().toLocaleString('pt-BR');
    const logoBase64 = await obterLogoBase64('img/logo.jpg');

    const hoje = new Date();
    const dia = String(hoje.getDate()).padStart(2, '0');
    const mes = String(hoje.getMonth() + 1).padStart(2, '0');
    const ano = hoje.getFullYear();
    
    const nomeArquivo = `${dia}${mes}${ano}_Fechamento_Turno`;

    const estilos = `
        <style>
            * { margin: 0; padding: 0; box-sizing: border-box; }
            body { font-family: 'Helvetica', Arial, sans-serif; padding: 40px; color: #1e293b; background: #fff; line-height: 1.4; }
            .header-pdf { position: relative; border-bottom: 4px solid #e63946; padding-bottom: 20px; margin-bottom: 30px; min-height: 100px; }
            .header-info { padding-right: 110px; }
            .header-info h1 { font-size: 30px; font-weight: 900; font-style: italic; color: #e63946; text-transform: uppercase; margin-bottom: 5px; }
            .header-info p { font-size: 12px; font-weight: bold; color: #64748b; text-transform: uppercase; letter-spacing: 1px; }
            .header-logo { position: absolute; right: 0; top: 0; }
            .header-logo img { width: 90px; height: 90px; border-radius: 50%; object-fit: cover; border: 4px solid #f1f5f9; box-shadow: 0 4px 6px rgba(0,0,0,0.1); }
            
            .grid-kpis { display: grid; grid-template-columns: repeat(4, 1fr); gap: 15px; margin-bottom: 25px; }
            .grid-pgtos { display: grid; grid-template-columns: repeat(auto-fit, minmax(130px, 1fr)); gap: 15px; margin-bottom: 30px; }
            
            .card { background: #ffffff; border: 1px solid #e2e8f0; padding: 18px 12px; border-radius: 12px; text-align: center; box-shadow: 0 1px 3px rgba(0,0,0,0.05); }
            .card label { font-size: 10px; color: #64748b; text-transform: uppercase; font-weight: 900; display: block; margin-bottom: 6px; }
            .card b { font-size: 16px; color: #1e293b; font-weight: 900; }
            
            .box-destaque { background: #f8fafc; border: 2px solid #f1f5f9; padding: 25px; border-radius: 20px; text-align: center; margin-bottom: 30px; }
            .box-destaque label { font-size: 11px; color: #475569; text-transform: uppercase; font-weight: 900; display: block; margin-bottom: 5px; }
            .box-destaque span { font-size: 36px; font-weight: 900; color: #0f172a; display: block; margin-bottom: 5px; }
            .box-destaque small { font-size: 10px; color: #64748b; font-weight: bold; }
            
            .secao-titulo { font-size: 14px; color: #e63946; font-weight: bold; text-transform: uppercase; border-left: 5px solid #e63946; padding-left: 10px; margin: 30px 0 15px 0; }
            table { width: 100%; border-collapse: collapse; font-size: 11px; margin-bottom: 25px; }
            th { background: #f1f5f9; padding: 12px; text-align: left; text-transform: uppercase; color: #64748b; border-bottom: 1px solid #e2e8f0; }
            td { padding: 12px; border-bottom: 1px solid #f1f5f9; color: #334155; font-weight: bold; }
            .text-right { text-align: right; }
            .text-center { text-align: center; }
            .footer-pdf { margin-top: 50px; text-align: center; font-size: 10px; color: #cbd5e1; border-top: 1px solid #f1f5f9; padding-top: 20px; font-style: italic; }
        </style>
    `;

    const html = `
        <html>
        <head>
            <title>${nomeArquivo}</title>
            ${estilos}
        </head>
        <body>
            <div class="header-pdf">
                <div class="header-info">
                    <h1>${resumo.loja}</h1>
                    <p>Relatório de Fechamento de Turno</p>
                    <small style="color: #94a3b8;">Emitido em: ${dataHora}</small>
                </div>
                <div class="header-logo"><img src="${logoBase64 || ''}" onerror="this.style.display='none'"></div>
            </div>

            <div class="grid-kpis">
                <div class="card"><label>Abertura</label><b>R$ ${window.fmSeguro(resumo.valorInicial)}</b></div>
                <div class="card"><label>Entradas (+)</label><b style="color:#16a34a">R$ ${window.fmSeguro(resumo.suprimentos)}</b></div>
                <div class="card"><label>Saídas (-)</label><b style="color:#ef4444">R$ ${window.fmSeguro(resumo.sangrias)}</b></div>
                <div class="card"><label>Saldo (Gaveta)</label><b style="color:#15803d">R$ ${window.fmSeguro(resumo.saldoGaveta)}</b></div>
            </div>

            <div class="box-destaque">
                <label>Total Vendido (Faturamento Bruto)</label>
                <span>R$ ${window.fmSeguro(resumo.totalVendido)}</span>
                <small>Taxas de Serviço: R$ ${window.fmSeguro(resumo.totalTaxas)} &nbsp;|&nbsp; Descontos: R$ ${window.fmSeguro(resumo.totalDescontos)}</small>
            </div>

            <h3 class="secao-titulo">➔ Meios de Recebimento</h3>
            <div class="grid-pgtos">
                ${Object.entries(resumo.metodos).sort((a,b)=>b[1]-a[1]).map(([m, t]) => `
                    <div class="card"><label>${m}</label><b style="color:#0284c7">R$ ${window.fmSeguro(t)}</b></div>
                `).join('')}
            </div>

            <h3 class="secao-titulo">➔ Saída de Estoque (Produtos)</h3>
            <table>
                <thead><tr><th>Item / Produto</th><th class="text-center">Quantidade</th></tr></thead>
                <tbody>
                    ${Object.entries(resumo.itensVendidos).sort((a,b)=>b[1]-a[1]).map(([n, q]) => `
                        <tr><td>${n}</td><td class="text-center" style="color:#e63946; font-size: 13px;">${q}x</td></tr>
                    `).join('')}
                </tbody>
            </table>

            <h3 class="secao-titulo">➔ Produção por Atendente</h3>
            <table>
                <thead><tr><th>Colaborador</th><th class="text-right">Total Produzido</th></tr></thead>
                <tbody>
                    ${Object.entries(resumo.vendasPorVendedor).sort((a,b)=>b[1]-a[1]).map(([v, t]) => `
                        <tr><td>${v.toUpperCase()}</td><td class="text-right">R$ ${window.fmSeguro(t)}</td></tr>
                    `).join('')}
                </tbody>
            </table>
            <div class="footer-pdf">WebComanda - Sistema de Gestão Inteligente</div>
        </body></html>
    `;

    const win = window.open('', '_blank');
    win.document.write(html); 
    win.document.close();
    setTimeout(() => { win.print(); }, 800);
};

window.exportarFechamentoPDF = function(res) {
    window.gerarPDFConsolidado(res);
}

/* ---------------------------------------------------------------------------------
   3. GERAÇÃO DE CARDÁPIO (CABEÇALHO PADRONIZADO)
   --------------------------------------------------------------------------------- */

window.gerarCardapioPDF = function() {
    const modal = document.getElementById('modal-gerar-cardapio');
    if(modal) { modal.classList.remove('hidden'); modal.classList.add('flex'); document.getElementById('input-msg-cardapio')?.focus(); }
}

window.fecharModalCardapio = function() { 
    const modal = document.getElementById('modal-gerar-cardapio'); 
    if(modal) modal.classList.add('hidden'); 
}

window.processarImpressaoCardapio = async function() {
    const radio = document.querySelector('input[name="modelo-cardapio"]:checked');
    const modelo = radio ? radio.value : 'classico';
    const mensagem = document.getElementById('input-msg-cardapio')?.value.toUpperCase() || "AGRADECEMOS A PREFERÊNCIA!";
    
    window.fecharModalCardapio();
    
    if (typeof isDatabaseReady === 'function' && !isDatabaseReady()) return;
    if (typeof showToast === 'function') showToast("GERANDO CARDÁPIO...");
    
    const loja = localStorage.getItem('nomeLoja') || "ESPETINHO & CIA";
    const logoBase64 = await obterLogoBase64('img/logo.jpg');
    
    try {
        const { data: produtos } = await _supabase.from('produtos').select('*').eq('status', true).order('nome');
        
        if (!produtos || produtos.length === 0) {
            if (typeof alertaSistema === 'function') {
                alertaSistema("Não há produtos ativos para exibir no cardápio.", "Cardápio Vazio");
            } else {
                alert("Sem produtos ativos para o cardápio.");
            }
            return;
        }
        
        if (modelo === 'classico') {
            window.gerarTemplateClassico(produtos, loja, logoBase64, mensagem);
        } else {
            window.gerarTemplateModerno(produtos, loja, logoBase64, mensagem);
        }
    } catch(e) {
        console.error("Erro ao gerar cardápio", e);
        if (typeof showToast === 'function') {
            showToast("ERRO AO GERAR CARDÁPIO", "erro");
        } else if (typeof alertaSistema === 'function') {
            alertaSistema("Ocorreu um erro ao tentar gerar o cardápio.", "Erro de Conexão");
        }
    }
}

window.gerarTemplateClassico = function(produtos, loja, logoBase64, mensagem) {
    const icons = { 'espetos': '🍢', 'cervejas': '🍺', 'bebidas': '🥤', 'refeicao': '🍽️', 'acompanhamentos': '🍚' };
    const categoriesObj = {};
    
    produtos.forEach(p => { 
        const cat = (p.categoria || 'outros').toLowerCase(); 
        if (!categoriesObj[cat]) categoriesObj[cat] = []; 
        categoriesObj[cat].push(p); 
    });
    
    const ordem = ['espetos', 'refeicao', 'acompanhamentos', 'bebidas'];
    const chaves = [...ordem.filter(c => categoriesObj[c]), ...Object.keys(categoriesObj).filter(c => !ordem.includes(c))];
    
    let html = chaves.map(key => `
        <div class="categoria-section">
            <h3 class="categoria-titulo">${icons[key] || '📦'} ${key.toUpperCase()}</h3>
            <div class="itens-grid">
                ${categoriesObj[key].map(i => `
                    <div class="item-info">
                        <span class="item-nome">${i.nome.toUpperCase()}</span>
                        <div class="linha-pontilhada"></div>
                        <span class="item-preco">R$ ${window.fmSeguro(i.preco)}</span>
                    </div>
                `).join('')}
            </div>
        </div>`).join('');
        
    // CORREÇÃO AQUI: Trocado 'message' por 'mensagem'
    window.abrirJanelaImpressao(loja, logoBase64, html, mensagem, 'classico');
}

window.gerarTemplateModerno = function(produtos, loja, logoBase64, mensagem) {
    // CORREÇÃO AQUI: Garante que categorias vazias vão para 'Outros' e unifica letras maiúsculas/minúsculas
    const categorias = [...new Set(produtos.map(p => (p.categoria || 'outros').toLowerCase()))];
    
    let html = categorias.map(cat => `
        <div class="cat-section-moderno">
            <div class="cat-titulo-moderno">${cat.toUpperCase()}</div>
            ${produtos.filter(p => (p.categoria || 'outros').toLowerCase() === cat).map(p => `
                <div class="item-moderno">
                    <span class="item-nome-moderno">${p.nome.toUpperCase()}</span>
                    <div class="item-dots-moderno"></div>
                    <span class="item-preco-moderno">R$ ${window.fmSeguro(p.preco)}</span>
                </div>
            `).join('')}
        </div>`).join('');
        
    // CORREÇÃO AQUI: Trocado 'message' por 'mensagem'
    window.abrirJanelaImpressao(loja, logoBase64, html, mensagem, 'moderno');
}

window.abrirJanelaImpressao = function(loja, logoBase64, conteudo, mensagem, estilo) {
    const win = window.open('', '_blank');
    const dataHora = new Date().toLocaleString('pt-BR');
    
    // 1. CSS Global + Regras de Impressão (O segredo para um PDF perfeito)
    const cssHeader = `
        .header-pdf { position: relative; border-bottom: 4px solid #e63946; padding-bottom: 20px; margin-bottom: 30px; min-height: 100px; }
        .header-info { padding-right: 110px; }
        .header-info h1 { font-size: 30px; font-weight: 900; font-style: italic; color: #e63946; text-transform: uppercase; margin-bottom: 5px; }
        .header-info p { font-size: 12px; font-weight: bold; color: #64748b; text-transform: uppercase; letter-spacing: 1px; }
        .header-logo { position: absolute; right: 0; top: 0; }
        .header-logo img { width: 90px; height: 90px; border-radius: 50%; object-fit: cover; border: 4px solid #f1f5f9; box-shadow: 0 4px 6px rgba(0,0,0,0.1); }
        
        /* Proteções para a hora de salvar em PDF / Imprimir */
        @media print {
            @page { margin: 15mm; size: A4; }
            body { -webkit-print-color-adjust: exact; print-color-adjust: exact; padding: 0 !important; }
            /* Evita que categorias ou itens sejam cortados no meio da página */
            .categoria-section, .cat-section-moderno, .item-info, .item-moderno { page-break-inside: avoid; break-inside: avoid; }
            /* Evita que o título fique no final da folha e os itens na outra */
            .categoria-titulo, .cat-titulo-moderno { page-break-after: avoid; break-after: avoid; }
        }
    `;

    // 2. CSS Clássico e Moderno
    const cssClassico = `@import url('https://fonts.googleapis.com/css2?family=Montserrat:wght@400;700;900&display=swap');body{font-family:'Montserrat',sans-serif;color:#1e293b;} ${cssHeader} .categoria-titulo{color:#e63946;border-bottom:2px solid #e63946;margin-bottom:15px;text-transform:uppercase;font-size:18px;margin-top:30px;}.itens-grid{display:grid;grid-template-columns:1fr 1fr;gap:15px 40px;}.item-info{display:flex;align-items:baseline;font-weight:700;font-size:13px;}.linha-pontilhada{flex-grow:1;border-bottom:1px dotted #ccc;margin:0 8px;}`;
    
    const cssModerno = `@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;700;900&display=swap');body{font-family:'Inter',sans-serif;color:#1e293b;} ${cssHeader} .cat-titulo-moderno{color:#e63946;font-weight:900;border-bottom:2px solid #f1f5f9;margin:30px 0 15px 0;text-transform:uppercase;font-size:18px;}.item-moderno{display:flex;justify-content:space-between;align-items:baseline;margin-bottom:10px;font-size:13px;font-weight:700;}.item-dots-moderno{flex:1;border-bottom:1px dotted #cbd5e1;margin:0 12px;}`;
    
    // 3. Estrutura HTML final
    const html = `<!DOCTYPE html>
    <html>
    <head>
        <title>Cardápio - ${loja}</title>
        <style>
            * { margin: 0; padding: 0; box-sizing: border-box; }
            body { background: #fff; padding: 40px; max-width: 1000px; margin: 0 auto; }
            ${estilo === 'classico' ? cssClassico : cssModerno}
            .footer { margin-top: 50px; text-align: center; padding: 20px; border-top: 2px dashed #eee; font-weight: 900; color: #e63946; font-size: 14px; page-break-inside: avoid; }
        </style>
    </head>
    <body>
        <div class="header-pdf">
            <div class="header-info">
                <h1>${loja}</h1>
                <p>Cardápio</p>
                <small style="color: #94a3b8;">Atualizado em: ${dataHora}</small>
            </div>
            <div class="header-logo">
                <img src="${logoBase64 || ''}" onerror="this.style.display='none'">
            </div>
        </div>

        <div class="content">${conteudo}</div>
        <div class="footer">${mensagem}</div>
        
        <script>
            // 1000ms garante que as fontes do Google carreguem antes do print dialog abrir
            setTimeout(() => {
                window.print();
                window.close();
            }, 1000);
        </script>
    </body>
    </html>`;
    
    win.document.write(html);
    win.document.close();
}

/* ---------------------------------------------------------------------------------
   4. IMPRESSÃO TÉRMICA DE VENDAS E DESPESAS (58MM - UNIFICADA COM PREFERÊNCIA GLOBAL)
   --------------------------------------------------------------------------------- */
/* ---------------------------------------------------------------------------------
   4. IMPRESSÃO TÉRMICA DE VENDAS E DESPESAS (58MM - UNIFICADA COM PREFERÊNCIA GLOBAL)
   --------------------------------------------------------------------------------- */

// Validador Universal de Modo Térmico/RawBT
window.isRawBTThermalMode = function() {
    const formatoGlobal = (localStorage.getItem('formatoImpressao') || '').toLowerCase();
    const modoConfigurado = (localStorage.getItem('modoImpressao') || '').toLowerCase();
    return ['direto', 'rawbt', 'termico'].includes(modoConfigurado) || 
           ['direto', 'rawbt', 'termico'].includes(formatoGlobal);
};

window.dispararImpressao = function(conteudoHtml, layout) {
    const ua = navigator.userAgent.toLowerCase();
    const isAndroid = /android/.test(ua);

    // Se por algum motivo o HTML chegou aqui e estamos no modo térmico, enviamos para o RawBT
    // NOTA: O ideal é não chegar HTML aqui, mas se chegar, o RawBT tenta renderizar como imagem
    if (window.isRawBTThermalMode() && isAndroid) {
        const htmlCompleto = `
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="utf-8">
                <style>
                    html, body { margin: 0; padding: 0; width: 58mm; background: #fff; color: #000; font-family: 'Courier New', monospace; }
                    ${getTicketCSS(layout)}
                </style>
            </head>
            <body>
                ${conteudoHtml}
            </body>
            </html>
        `;

        const base64Html = btoa(unescape(encodeURIComponent(htmlCompleto)));
        const urlRawBT = `intent:base64,${base64Html}#Intent;scheme=rawbt;package=ru.a402d.rawbtprinter;end;`;
        window.location.href = urlRawBT;
        return;
    }

    // ROTA PADRÃO (SE ESTIVER EM MODO PDF / WINDOWS / IOS)
    const w = window.open('', '_blank');
    w.document.write(`<html><head><meta charset="utf-8"><style>html,body{margin:0;padding:0;width:58mm;}@media print{.no-print{display:none!important;}}.btn-voltar{position:fixed;bottom:20px;left:50%;transform:translateX(-50%);background:#000;color:#fff;padding:10px 20px;border-radius:20px;text-decoration:none;z-index:9999;}${getTicketCSS(layout)}</style></head><body>${conteudoHtml}<a href="javascript:window.close()" class="no-print btn-voltar">FECHAR</a><script>window.onload=()=>setTimeout(()=>window.print(),300);<\/script></body></html>`);
    w.document.close();
}

window.enviarParaImpressora = function(texto) {
    const ua = navigator.userAgent.toLowerCase();
    const isAndroid = /android/.test(ua);
    const base64Texto = btoa(unescape(encodeURIComponent(texto)));
    
    if (isAndroid && window.isRawBTThermalMode()) { 
        window.location.href = "rawbt:base64," + base64Texto; 
    } else { 
        const win = window.open('', '_blank'); 
        win.document.write(`<pre style="font-family:monospace;font-size:12px;white-space:pre-wrap;padding:20px;">${texto}</pre><script>window.onload=()=>{window.print();setTimeout(()=>window.close(),500);}<\/script>`); 
        win.document.close(); 
    }
}

// FORMATO 1: Imprimir cupons (Retirar no Balcão)
window.imprimirCupom = function(venda) {
    // 1. SE FOR MODO RAWBT -> GERAR TEXTO PURO COM LAYOUT
// SE FOR MODO RAWBT -> GERAR TEXTO PURO COM LAYOUT (VERSÃO AJUSTADA)
    if (window.isRawBTThermalMode()) {
        const loja = localStorage.getItem('nomeLoja') || "ESPETINHO & CIA";
        const operador = (localStorage.getItem('userName') || 'ADMIN').toUpperCase();
        const itensArray = Array.isArray(venda.itens) ? venda.itens : JSON.parse(venda.itens || '[]');
        
        let textoRaw = '\n';

        itensArray.forEach(item => {
            if(parseFloat(item.preco) > 0) {
                for (let i = 0; i < (item.qtd || 1); i++) {
                    const pedidoId = Math.floor(Math.random()*9000)+1000;
                    
                    // --- CABEÇALHO ---
                    textoRaw += alinharCentro(loja) + '\n';
                    textoRaw += alinharCentro(new Date().toLocaleTimeString('pt-BR', {hour: '2-digit', minute:'2-digit'})) + '\n';
                    textoRaw += '================================\n';
                    
                    // --- CORPO (O "BLOCO") ---
                    // Nome e Valor
                    textoRaw += alinharCentro(item.nome.toUpperCase()) + '\n';
                    textoRaw += alinharCentro(`R$ ${window.fmSeguro(item.preco)}`) + '\n';
                    
                    // Linha de Destaque para Retirada
                    textoRaw += '--------------------------------\n';
                    textoRaw += alinharCentro('RETIRAR NO BALCAO') + '\n';
                    textoRaw += '--------------------------------\n';
                    
                    // Pedido e Operador (Ajustado para não quebrar)
                    const rodape = `PED#${pedidoId} | OP: ${operador.substring(0, 8)}`;
                    textoRaw += alinharCentro(rodape) + '\n';
                    
                    textoRaw += '\n\n\n'; // Espaço entre tickets
                }
            }
        });

        const textoCodificado = encodeURIComponent(textoRaw);
        window.location.href = `intent:${textoCodificado}#Intent;scheme=rawbt;package=ru.a402d.rawbtprinter;end;`;
        return;
    }

    // 2. SE FOR NAVEGADOR -> MANTÉM SEU CÓDIGO HTML ORIGINAL
    const loja = localStorage.getItem('nomeLoja') || "ESPETINHO & CIA";
    const layout = localStorage.getItem('ticketLayout') || 'original';
    const dataVenda = new Date(venda.data || Date.now());
    const operador = localStorage.getItem('userName') || 'Admin';
    let html = '';
    
    const itensArray = Array.isArray(venda.itens) ? venda.itens : JSON.parse(venda.itens || '[]');

    itensArray.forEach(item => {
        if(parseFloat(item.preco) > 0) {
            for (let i = 0; i < (item.qtd || 1); i++) {
                const pedidoId = Math.floor(Math.random()*9000)+1000;
                html += `<div class="ticket-wrapper"><div class="header"><div class="store-name">${loja}</div><div class="meta">${dataVenda.toLocaleDateString()} ${dataVenda.toLocaleTimeString().substring(0,5)}</div></div>`;
                if (layout === 'padrao') { html += `<div class="box-padrao text-center"><div class="item-name">${item.nome}</div><div class="item-price">VALOR: R$ ${window.fmSeguro(item.preco)}</div></div><div class="instruction-text text-center">RETIRAR NO BALCÃO</div>`; } 
                else if (layout === 'eco') { html += `<div class="unified-box"><div class="item-name">${item.nome}</div><div class="item-price">R$ ${window.fmSeguro(item.preco)}</div></div>`; } 
                else { html += `<div class="unified-box text-center"><div class="item-name">${item.nome}</div><div class="item-price">VALOR: R$ ${window.fmSeguro(item.preco)}</div>${layout === 'original' ? '<div class="separator"></div>' : ''}<div class="instruction-text">RETIRAR NO BALCÃO</div></div>`; }
                html += `<div class="footer text-center">PEDIDO #${pedidoId}<br>Op: ${operador}</div></div>`;
            }
        }
    });
    window.dispararImpressao(html, layout);
}

// FORMATO 2: Imprimir resumo completo da conta (Ticket Consolidado - Blindado p/ Texto)
window.imprimirTicketVenda = function(dadosVenda) {
    const loja = localStorage.getItem('nomeLoja') || "ESPETINHO E CIA";
    const cnpj = localStorage.getItem('empresa_cnpj') || "";
    const layout = localStorage.getItem('ticketLayout') || 'original'; 
    
    const ua = navigator.userAgent.toLowerCase();
    const isAndroid = /android/.test(ua);
    const isIOS = /iphone|ipad|ipod/.test(ua);

    // 1. AGRUPAMENTO DOS ITENS
    const itensArray = Array.isArray(dadosVenda.itens) ? dadosVenda.itens : JSON.parse(dadosVenda.itens || '[]');
    const itensAgrupados = {};

    itensArray.forEach(i => {
        if (parseFloat(i.preco) > 0) {
            const obs = i.detalhes || i.observacao || '';
            const chave = `${i.nome.trim().toUpperCase()}_${obs.trim().toUpperCase()}`;
            
            if (!itensAgrupados[chave]) {
                itensAgrupados[chave] = { ...i };
            } else {
                itensAgrupados[chave].qtd += i.qtd;
            }
        }
    });

    const dataFormatada = new Date(dadosVenda.created_at || dadosVenda.data || Date.now()).toLocaleString('pt-BR');
    const isPreConta = dadosVenda.tipo && dadosVenda.tipo.includes('PRÉ-CONTA');

    // Funções auxiliares para alinhar perfeitamente em 32 colunas (largura de 58mm)
    const alinharCentro = (texto) => {
        const str = String(texto).substring(0, 32);
        const espacos = Math.max(0, Math.floor((32 - str.length) / 2));
        return ' '.repeat(espacos) + str;
    };

    const alinharLados = (esq, dir) => {
        const strEsq = String(esq);
        const strDir = String(dir);
        const espacosLivres = 32 - strEsq.length - strDir.length;
        if (espacosLivres > 0) return strEsq + ' '.repeat(espacosLivres) + strDir;
        return strEsq.substring(0, 32 - strDir.length - 1) + ' ' + strDir;
    };

    // ====================================================================================
    // ROTA 1: IMPRESSÃO DIRETA NO ANDROID (RAWBT) - TEXTO PURO FORMATADO
    // ====================================================================================
    if (window.isRawBTThermalMode() && isAndroid) {
        let textoRaw = '\n'; 
        
        textoRaw += alinharCentro(loja) + '\n';
        if (cnpj) textoRaw += alinharCentro(`CNPJ: ${cnpj}`) + '\n';
        textoRaw += '-'.repeat(32) + '\n';
        textoRaw += alinharCentro(dadosVenda.tipo || 'VENDA') + '\n';
        textoRaw += alinharLados('DATA:', dataFormatada) + '\n';
        textoRaw += '-'.repeat(32) + '\n\n';

        Object.values(itensAgrupados).forEach(i => {
            const precoStr = window.fmSeguro ? window.fmSeguro(i.preco * i.qtd) : (i.preco * i.qtd).toFixed(2);
            textoRaw += alinharLados(`${i.qtd}x ${i.nome.toUpperCase()}`, precoStr) + '\n';
            
            if (i.detalhes || i.observacao) {
                const obsLimpa = (i.detalhes || i.observacao).replace(/<br>/g, ' | ');
                textoRaw += `  OBS: ${obsLimpa}\n`;
            }
        });

        textoRaw += '\n' + '-'.repeat(32) + '\n';
        const totalStr = window.fmSeguro ? window.fmSeguro(dadosVenda.total) : parseFloat(dadosVenda.total).toFixed(2);
        textoRaw += alinharLados('TOTAL:', `R$ ${totalStr}`) + '\n';
        textoRaw += '-'.repeat(32) + '\n';
        
        if (!isPreConta) {
            const formaPgto = (dadosVenda.forma_pagamento || dadosVenda.pagamento || 'DINHEIRO').toUpperCase();
            textoRaw += alinharLados('PAGAMENTO:', formaPgto) + '\n';
        }
        
        textoRaw += '\n' + alinharCentro('OBRIGADO PELA PREFERENCIA') + '\n\n\n\n';

        // Envia o texto puro limpo direto para o aplicativo RawBT
        const textoCodificado = encodeURIComponent(textoRaw);
        window.location.href = `intent:${textoCodificado}#Intent;scheme=rawbt;package=ru.a402d.rawbtprinter;end;`;
        return;
    }

    // ====================================================================================
    // ROTA 2: IMPRESSÃO NO WINDOWS / IOS / NAVEGADOR (HTML + CSS)
    // ====================================================================================
    let htmlItens = '';
    Object.values(itensAgrupados).forEach(i => {
        const obsHtml = (i.detalhes || i.observacao) 
            ? `<div style="font-size: 9px; font-style: italic; margin-top: 2px; text-transform: uppercase;">Obs: ${i.detalhes || i.observacao}</div>` 
            : '';

        htmlItens += `
        <div style="margin-bottom: 4px; border-bottom: 1px dashed #ccc; padding-bottom: 3px;">
            <div class="item-name">${i.qtd}x ${i.nome.toUpperCase()}</div>
            ${obsHtml}
            <div class="item-price" style="text-align: right; font-size:11px; font-weight: bold; margin-top: 2px;">
                R$ ${window.fmSeguro ? window.fmSeguro(i.preco * i.qtd) : (i.preco * i.qtd).toFixed(2)}
            </div>
        </div>`;
    });

    let pgtoHtml = !isPreConta ? `<div class="instruction-text" style="font-size:11px; margin-top:5px;">PAGAMENTO: ${(dadosVenda.forma_pagamento || dadosVenda.pagamento || 'DINHEIRO').toUpperCase()}</div>` : '';

    const htmlCompleto = `
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="utf-8">
        <style>
            * { margin: 0; padding: 0; box-sizing: border-box; }
            @page { margin: 0; size: 58mm auto; }
            html, body { font-family: 'Courier New', monospace; width: 58mm !important; max-width: 58mm !important; background-color: #fff; color: #000; font-size: 11px; line-height: 1.2; }
            .ticket-container { width: 58mm !important; max-width: 58mm !important; padding: 2mm 3mm; overflow: hidden; }
            .divisor { border-top: 1px dashed #000; margin: 6px 0; }
        </style>
    </head>
    <body>
        <div class="ticket-container">
            <div class="ticket-wrapper">
                <div class="header">
                    <div class="store-name text-center bold">${loja}</div>
                    ${cnpj ? `<div class="text-center" style="font-size:10px; margin-bottom: 2px;">CNPJ: ${cnpj}</div>` : ''}
                    <div class="text-center bold uppercase" style="font-size:12px; margin-bottom: 4px;">${dadosVenda.tipo || 'VENDA'}</div>
                    <div class="meta text-center" style="font-size:9px; margin-bottom: 6px;">DATA: ${dataFormatada}</div>
                </div>
                <div class="divisor"></div>
                <div class="unified-box">
                    ${htmlItens}
                </div>
                <div class="divisor"></div>
                <div style="display:flex; justify-content:space-between; font-size:13px; font-weight:bold; margin-top:6px;">
                    <span class="bold">TOTAL</span>
                    <span class="bold">R$ ${window.fmSeguro ? window.fmSeguro(dadosVenda.total) : parseFloat(dadosVenda.total).toFixed(2)}</span>
                </div>
                ${pgtoHtml}
                <div class="footer text-center bold" style="margin-top:12px; font-size:10px;">OBRIGADO PELA PREFERÊNCIA</div>
            </div>
        </div>
    </body>
    </html>`;

    if (localStorage.getItem('modoImpressao') === 'direto' && isIOS) { 
        window.location.href = "openlabels://print?text=" + encodeURIComponent(htmlCompleto); 
        return; 
    }
    
    const win = window.open('', '_blank', 'width=350,height=600');
    win.document.write(htmlCompleto); 
    win.document.close();
    setTimeout(() => { win.print(); win.close(); }, 500);
}


window.gerarTicketHTML = function(dados, loja) {
    const cnpj = localStorage.getItem('empresa_cnpj') || "";
    let htmlItens = '';
    
    if (dados.itens) {
        const itensAgrupadosHtml = {};
        const itensArray = Array.isArray(dados.itens) ? dados.itens : JSON.parse(dados.itens || '[]');

        itensArray.forEach(i => {
            if (parseFloat(i.preco) > 0) {
                const chave = i.nome.trim().toUpperCase();
                if (!itensAgrupadosHtml[chave]) {
                    itensAgrupadosHtml[chave] = { ...i };
                } else {
                    itensAgrupadosHtml[chave].qtd += i.qtd;
                }
            }
        });

        Object.values(itensAgrupadosHtml).forEach(i => {
            htmlItens += `
            <div style="margin-bottom: 4px; border-bottom: 1px dashed #ccc; padding-bottom: 3px;">
                <div style="font-size:11px; font-weight: bold; text-transform: uppercase; line-height: 1.1; word-wrap: break-word;">
                    ${i.qtd}x ${i.nome}
                </div>
                <div style="text-align: right; font-size:11px; font-weight: bold; margin-top: 2px;">
                    R$ ${window.fmSeguro(i.preco * i.qtd)}
                </div>
            </div>`;
        });
    }

    const isPreConta = dados.tipo && dados.tipo.includes('PRÉ-CONTA');
    
    let pgtoHtml = '';
    if (!isPreConta) {
        pgtoHtml = `<div style="font-size:11px; margin-top:5px;">PAGAMENTO: ${(dados.forma_pagamento || dados.pagamento || 'DINHEIRO').toUpperCase()}</div><div class="divisor"></div>`;
    } else {
        pgtoHtml = `<div class="divisor"></div>`;
    }
    
    const html = `
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="utf-8">
        <title>Cupom - ${loja}</title>
        <style>
            * { margin: 0; padding: 0; box-sizing: border-box; }
            @page { margin: 0; size: 58mm auto; }
            html, body { width: 58mm !important; max-width: 58mm !important; background-color: #fff; color: #000; font-family: 'Courier New', Courier, monospace; font-size: 11px; line-height: 1.2; }
            .ticket-container { width: 58mm !important; max-width: 58mm !important; padding: 2mm 3mm; overflow: hidden; }
            .text-center { text-align: center; }
            .divisor { border-top: 1px dashed #000; margin: 6px 0; }
            .bold { font-weight: bold; }
            @media print { body { width: 58mm !important; } }
        </style>
    </head>
    <body>
        <div class="ticket-container">
            <div class="text-center bold" style="font-size:14px; margin-bottom: 2px;">${loja}</div>
            ${cnpj ? `<div class="text-center" style="font-size:10px; margin-bottom: 2px;">CNPJ: ${cnpj}</div>` : ''}
            <div class="text-center bold" style="font-size:12px; margin-bottom: 6px;">${dados.tipo || 'VENDA'}</div>
            <div class="text-center" style="font-size:9px; margin-bottom: 6px;">DATA: ${new Date(dados.created_at || dados.data || Date.now()).toLocaleString('pt-BR')}</div>
            
            <div class="divisor"></div>
            ${htmlItens}
            
            <div style="display:flex; justify-content:space-between; font-size:13px; font-weight:bold; margin-top:6px;">
                <span>TOTAL</span>
                <span>R$ ${window.fmSeguro(dados.total)}</span>
            </div>
            
            ${pgtoHtml}
            
            <div class="text-center bold" style="margin-top:12px; font-size:10px;">OBRIGADO PELA PREFERÊNCIA</div>
        </div>
        <script>
            window.onload = () => { setTimeout(() => { window.print(); window.close(); }, 500); };
        </script>
    </body>
    </html>`;

    const win = window.open('', '_blank', 'width=350,height=600');
    win.document.write(html); 
    win.document.close();
}

window.imprimirComprovanteDespesa = function(id) {
    _supabase.from('despesas').select('*').eq('id', id).single().then(({ data: d }) => {
        if (!d) return;
        const html = `<html><head><style>@page { size: 58mm auto; margin: 0; } body { width: 48mm; margin: 0; padding: 4mm; font-family: 'Courier New', monospace; font-size: 11px; }</style></head>
        <body><div style="text-align:center"><b>${localStorage.getItem('nomeLoja') || 'ESPETINHO'}</b><br>COMPROVANTE DE DESPESA<br>------------------</div>
        DESC: ${d.descricao}<br>CATEG: ${d.categoria}<br>STATUS: ${d.paga ? 'PAGO' : 'EM ABERTO'}<br>
        <div style="text-align:center">------------------<br><b style="font-size:14px;">TOTAL: R$ ${window.fmSeguro(d.valor)}</b></div>
        <script>window.onload=()=>window.print();<\/script></body></html>`;
        const win = window.open('', '', 'width=300'); win.document.write(html); win.document.close();
    });
};

/* ---------------------------------------------------------------------------------
   5. MOTOR DE IMPRESSÃO A4 (RELATÓRIOS E COMPILADORES)
   --------------------------------------------------------------------------------- */

window.imprimirRelatorioAtual = async function(tipo = null) {
    console.log(">>> [IMPRESSÃO] Roteando para o gerador oficial...");

    const relatorioEstoque = document.getElementById('view-estoque');
    const relatorioFinanceiro = document.getElementById('view-financeiro');
    const relatorioProdutos = document.getElementById('view-produtos');
    
    if (tipo === 'produtos' || (relatorioProdutos && !relatorioProdutos.classList.contains('hidden'))) {
        if (typeof window.imprimirPDFProdutos === 'function') {
            await window.imprimirPDFProdutos();
        } else {
            if(typeof showToast === 'function') showToast("Função de impressão do ranking não encontrada.", "erro");
        }
        return;
    }

    if (tipo === 'estoque' || (relatorioEstoque && !relatorioEstoque.classList.contains('hidden'))) {
        if (typeof window.imprimirPDFEstoque === 'function') {
            await window.imprimirPDFEstoque();
        } else {
            console.error("Função imprimirPDFEstoque não encontrada.");
        }
        return;
    } 
    
    if (tipo === 'financeiro' || (relatorioFinanceiro && !relatorioFinanceiro.classList.contains('hidden'))) {
        if (typeof window.imprimirFluxoFinanceiro === 'function') {
            window.imprimirFluxoFinanceiro();
        } else {
            if(typeof showToast === 'function') showToast("Função de impressão financeira não encontrada.", "erro");
        }
        return;
    } 

    if (tipo === 'comandas') {
        if (typeof window.imprimirPDFComandas === 'function') {
            await window.imprimirPDFComandas();
        } else {
            console.error("Função imprimirPDFComandas não encontrada.");
        }
        return;
    }

    if (tipo === 'despesas') {
        if (typeof window.imprimirPDFDespesas === 'function') {
            await window.imprimirPDFDespesas();
        }
        return;
    }
    
    window.print(); 
};

window.imprimirPDFProdutos = async function() {
    const dIni = document.getElementById('data-inicio-rel-produtos')?.value;
    const dFim = document.getElementById('data-fim-rel-produtos')?.value;

    if (!dIni || !dFim) {
        if(typeof showToast === 'function') showToast("Selecione um período primeiro.", "aviso");
        return;
    }

    if(typeof showToast === 'function') showToast("GERANDO PDF DO RANKING...", "aviso");

    try {
        const { data: vendas, error } = await _supabase
            .from('historico_vendas')
            .select('itens')
            .gte('created_at', `${dIni}T00:00:00`)
            .lte('created_at', `${dFim}T23:59:59`)
            .neq('status', 'cancelada');

        if (error) throw error;

        const contagem = {};
        (vendas || []).forEach(v => {
            let itensArr = Array.isArray(v.itens) ? v.itens : JSON.parse(v.itens || '[]');
            itensArr.forEach(i => {
                const nome = i.nome || 'PRODUTO DESCONHECIDO';
                const precoItem = parseFloat(i.preco || 0);
                const qtdItem = parseFloat(i.qtd || i.quantidade || 1);
                if (!nome.toUpperCase().includes('PGTO') && precoItem > 0) {
                    contagem[nome] = (contagem[nome] || 0) + qtdItem;
                }
            });
        });

        const ranking = Object.entries(contagem).sort((a, b) => b[1] - a[1]);
        const logoBase64 = typeof obterLogoBase64 === 'function' ? await obterLogoBase64('img/logo.jpg') : '';
        const nomeLoja = (localStorage.getItem('nomeLoja') || 'ESPETINHO & CIA').toUpperCase();
        const dataEmissao = new Date().toLocaleString('pt-BR');
        
        const hoje = new Date();
        const nomeArquivo = `${String(hoje.getDate()).padStart(2, '0')}${String(hoje.getMonth() + 1).padStart(2, '0')}${hoje.getFullYear()}_Ranking_Produtos`;

        const estilos = `
            <style>
                * { margin: 0; padding: 0; box-sizing: border-box; }
                body { font-family: 'Helvetica', Arial, sans-serif; padding: 40px; color: #1e293b; background: #fff; line-height: 1.4; }
                .header-pdf { position: relative; border-bottom: 4px solid #e63946; padding-bottom: 20px; margin-bottom: 30px; min-height: 100px; }
                .header-info { padding-right: 110px; }
                .header-info h1 { font-size: 30px; font-weight: 900; font-style: italic; color: #e63946; text-transform: uppercase; margin-bottom: 5px; }
                .header-info p { font-size: 12px; font-weight: bold; color: #64748b; text-transform: uppercase; letter-spacing: 1px; }
                .header-logo { position: absolute; right: 0; top: 0; }
                .header-logo img { width: 90px; height: 90px; border-radius: 50%; object-fit: cover; border: 4px solid #f1f5f9; box-shadow: 0 4px 6px rgba(0,0,0,0.1); }
                
                .secao-titulo { font-size: 14px; color: #e63946; font-weight: bold; text-transform: uppercase; border-left: 5px solid #e63946; padding-left: 10px; margin: 30px 0 15px 0; }
                table { width: 100%; border-collapse: collapse; font-size: 12px; margin-bottom: 25px; }
                th { background: #f1f5f9; padding: 12px; text-align: left; text-transform: uppercase; color: #64748b; border-bottom: 1px solid #e2e8f0; }
                td { padding: 12px; border-bottom: 1px solid #f1f5f9; color: #334155; font-weight: bold; }
                .pos { width: 60px; text-align: center; font-size: 14px; }
                .qtd { width: 120px; text-align: right; color: #10b981; }
                .footer-pdf { margin-top: 50px; text-align: center; font-size: 10px; color: #cbd5e1; border-top: 1px solid #f1f5f9; padding-top: 20px; font-style: italic; }
            </style>
        `;

        const linhas = ranking.map(([nome, qtd], index) => {
            const medalhas = ['🥇', '🥈', '🥉'];
            const icone = medalhas[index] || `${index + 1}º`;
            return `
                <tr>
                    <td class="pos">${icone}</td>
                    <td>${nome}</td>
                    <td class="qtd">${qtd} UNIDADES</td>
                </tr>`;
        }).join('');

        const html = `
            <html>
            <head>
                <title>${nomeArquivo}</title>
                ${estilos}
            </head>
            <body>
                <div class="header-pdf">
                    <div class="header-info">
                        <h1>${nomeLoja}</h1>
                        <p>Ranking de Produtos Mais Vendidos</p>
                        <small style="color: #94a3b8;">Período: ${new Date(dIni + "T12:00:00").toLocaleDateString('pt-BR')} até ${new Date(dFim + "T12:00:00").toLocaleDateString('pt-BR')}</small>
                    </div>
                    <div class="header-logo"><img src="${logoBase64 || ''}" onerror="this.style.display='none'"></div>
                </div>

                <h3 class="secao-titulo">➔ Desempenho de Vendas</h3>
                <table>
                    <thead>
                        <tr>
                            <th class="pos">Pos</th>
                            <th>Descrição do Produto</th>
                            <th class="qtd">Quantidade</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${linhas}
                    </tbody>
                </table>

                <div class="footer-pdf">WebComanda - Emitido em ${dataEmissao}</div>
            </body>
            </html>
        `;

        const win = window.open('', '_blank');
        win.document.write(html);
        win.document.close();
        setTimeout(() => { win.print(); win.close(); }, 800);

    } catch (e) {
        console.error("Erro PDF Ranking:", e);
        if(typeof showToast === 'function') showToast("Erro ao gerar PDF", "erro");
    }
};

window.imprimirPDFComandas = async function() {
    let dIni = document.getElementById('data-inicio-comandas')?.value;
    let dFim = document.getElementById('data-fim-comandas')?.value;

    if (!dIni || !dFim) {
        dIni = dIni || document.getElementById('data-inicio-fin')?.value || new Date().toISOString().split('T')[0];
        dFim = dFim || document.getElementById('data-fim-fin')?.value || new Date().toISOString().split('T')[0];
    }

    if(typeof showToast === 'function') showToast("GERANDO RELATÓRIO DE VENDAS...", "aviso");

    try {
        const { data: vendas, error } = await _supabase
            .from('historico_vendas')
            .select('*')
            .gte('created_at', `${dIni}T00:00:00`)
            .lte('created_at', `${dFim}T23:59:59`)
            .neq('status', 'cancelada')
            .order('created_at', { ascending: true });

        if (error) throw error;

        let totalBruto = 0;
        const pagamentos = {};
        const itensVendidos = {};

        vendas.forEach(v => {
            totalBruto += parseFloat(v.total || 0);
            const mtd = (v.forma_pagamento || v.metodo_pagamento || 'NÃO INFORMADO').toUpperCase();
            pagamentos[mtd] = (pagamentos[mtd] || 0) + parseFloat(v.total || 0);

            let itensArr = Array.isArray(v.itens) ? v.itens : JSON.parse(v.itens || '[]');
            itensArr.forEach(i => {
                const nome = i.nome || 'PRODUTO';
                const qtd = parseFloat(i.qtd || i.quantidade || 1);
                itensVendidos[nome] = (itensVendidos[nome] || 0) + qtd;
            });
        });

        const linhasComandas = vendas.map(v => {
            const hora = new Date(v.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
            return `
                <tr>
                    <td>${hora}</td>
                    <td>${(v.mesa || 'BALCÃO').toUpperCase()}</td>
                    <td>${(v.forma_pagamento || v.metodo_pagamento || '---').toUpperCase()}</td>
                    <td class="text-right">R$ ${parseFloat(v.total || 0).toLocaleString('pt-BR', {minimumFractionDigits: 2})}</td>
                </tr>`;
        }).join('');

        const logoBase64 = typeof obterLogoBase64 === 'function' ? await obterLogoBase64('img/logo.jpg') : '';
        const nomeLoja = (localStorage.getItem('nomeLoja') || 'ESPETINHO & CIA').toUpperCase();
        const hoje = new Date();
        const nomeArquivo = `${String(hoje.getDate()).padStart(2, '0')}${String(hoje.getMonth() + 1).padStart(2, '0')}${hoje.getFullYear()}_Relatorio_Comandas`;

        const estilos = `
            <style>
                * { margin: 0; padding: 0; box-sizing: border-box; }
                body { font-family: 'Helvetica', sans-serif; padding: 40px; color: #1e293b; background: #fff; line-height: 1.4; }
                .header-pdf { position: relative; border-bottom: 4px solid #e63946; padding-bottom: 20px; margin-bottom: 30px; min-height: 100px; }
                .header-info h1 { font-size: 30px; font-weight: 900; font-style: italic; color: #e63946; text-transform: uppercase; margin-bottom: 5px; }
                .header-info p { font-size: 12px; font-weight: bold; color: #64748b; text-transform: uppercase; letter-spacing: 1px; }
                .header-logo { position: absolute; right: 0; top: 0; }
                .header-logo img { width: 90px; height: 90px; border-radius: 50%; object-fit: cover; border: 4px solid #f1f5f9; }
                
                .grid-resumo { display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin-bottom: 25px; }
                .card { background: #f8fafc; border: 1px solid #e2e8f0; padding: 15px; border-radius: 12px; border-left: 5px solid #e63946; }
                .card label { font-size: 10px; color: #64748b; text-transform: uppercase; font-weight: 900; display: block; }
                .card b { font-size: 18px; color: #1e293b; font-weight: 900; }

                .secao-titulo { font-size: 14px; color: #e63946; font-weight: bold; text-transform: uppercase; border-left: 5px solid #e63946; padding-left: 10px; margin: 30px 0 15px 0; background: #fff5f5; padding-top: 5px; padding-bottom: 5px; }
                table { width: 100%; border-collapse: collapse; font-size: 11px; margin-bottom: 25px; }
                th { background: #f1f5f9; padding: 10px; text-align: left; text-transform: uppercase; color: #64748b; border-bottom: 1px solid #e2e8f0; }
                td { padding: 10px; border-bottom: 1px solid #f1f5f9; color: #334155; font-weight: bold; }
                .text-right { text-align: right; }
                .footer-pdf { margin-top: 50px; text-align: center; font-size: 10px; color: #cbd5e1; border-top: 1px solid #f1f5f9; padding-top: 20px; font-style: italic; }
            </style>
        `;

        const html = `
            <html><head><title>${nomeArquivo}</title>${estilos}</head>
            <body>
                <div class="header-pdf">
                    <div class="header-info">
                        <h1>${nomeLoja}</h1>
                        <p>Relatório Geral de Vendas e Comandas</p>
                        <small style="color: #94a3b8;">Período: ${new Date(dIni + "T12:00:00").toLocaleDateString('pt-BR')} até ${new Date(dFim + "T12:00:00").toLocaleDateString('pt-BR')}</small>
                    </div>
                    <div class="header-logo"><img src="${logoBase64}" onerror="this.style.display='none'"></div>
                </div>

                <div class="grid-resumo">
                    <div class="card"><label>Faturamento Total</label><b>R$ ${totalBruto.toLocaleString('pt-BR', {minimumFractionDigits: 2})}</b></div>
                    <div class="card" style="border-color: #10b981;"><label>Qtd Comandas</label><b>${vendas.length} Finalizadas</b></div>
                </div>

                <h3 class="secao-titulo">➔ Resumo Financeiro</h3>
                <table>
                    <thead><tr><th>Método de Pagamento</th><th class="text-right">Total Recebido</th></tr></thead>
                    <tbody>
                        ${Object.entries(pagamentos).map(([m, v]) => `<tr><td>${m}</td><td class="text-right">R$ ${v.toLocaleString('pt-BR', {minimumFractionDigits: 2})}</td></tr>`).join('')}
                    </tbody>
                </table>

                <h3 class="secao-titulo">➔ Saída Global de Itens</h3>
                <table>
                    <thead><tr><th>Descrição do Produto</th><th class="text-right">Quantidade</th></tr></thead>
                    <tbody>
                        ${Object.entries(itensVendidos).sort((a,b)=>b[1]-a[1]).map(([n, q]) => `<tr><td>${n}</td><td class="text-right">${q} UN</td></tr>`).join('')}
                    </tbody>
                </table>

                <h3 class="secao-titulo">➔ Relação Detalhada de Comandas</h3>
                <table>
                    <thead>
                        <tr>
                            <th style="width: 60px;">Hora</th>
                            <th>Mesa/Cliente</th>
                            <th>Pagamento</th>
                            <th class="text-right">Total</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${linhasComandas}
                    </tbody>
                </table>

                <div class="footer-pdf">WebComanda - Sistema de Gestão Inteligente</div>
            </body></html>
        `;

        const win = window.open('', '_blank');
        win.document.write(html);
        win.document.close();
        setTimeout(() => { win.print(); win.close(); }, 800);

    } catch (e) {
        console.error(e);
        if(typeof showToast === 'function') showToast("Erro ao processar impressão", "erro");
    }
};

window.imprimirFluxoFinanceiro = async function() {
    const dataIni = document.getElementById('data-inicio-fin')?.value;
    const dataFim = document.getElementById('data-fim-fin')?.value;
    const resumoHTML = document.getElementById('resumo-financeiro-cards')?.innerHTML || '';
    const listaHTML = document.getElementById('conteudo-rel-financeiro')?.innerHTML || '';

    if (!resumoHTML || resumoHTML.includes("Processando")) {
        if(typeof showToast === 'function') showToast("Aguarde o carregamento dos dados antes de imprimir.", "aviso");
        return;
    }

    if(typeof showToast === 'function') showToast("GERANDO PDF FINANCEIRO...", "aviso");

    let dataStr = "PERÍODO: GERAL";
    if (dataIni && dataFim) {
        const dI = new Date(dataIni + "T12:00:00").toLocaleDateString('pt-BR');
        const dF = new Date(dataFim + "T12:00:00").toLocaleDateString('pt-BR');
        dataStr = (dI === dF) ? `DATA: ${dI}` : `PERÍODO: ${dI} ATÉ ${dF}`;
    }

    const dataEmissao = new Date().toLocaleString('pt-BR');
    const nomeLoja = (localStorage.getItem('nomeLoja') || 'ESPETINHO & CIA').toUpperCase();

    let logoBase64 = '';
    if (typeof obterLogoBase64 === 'function') {
        logoBase64 = await obterLogoBase64('img/logo.jpg');
    }

    const hoje = new Date();
    const dia = String(hoje.getDate()).padStart(2, '0');
    const mes = String(hoje.getMonth() + 1).padStart(2, '0');
    const ano = hoje.getFullYear();
    const nomeArquivo = `${dia}${mes}${ano}_Fluxo_Financeiro`;

    const estilos = `
        <style>
            * { margin: 0; padding: 0; box-sizing: border-box; }
            @page { size: A4 portrait; margin: 15mm; }
            body { font-family: 'Helvetica', Arial, sans-serif; padding: 20px; color: #1e293b; background: #fff !important; line-height: 1.4; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
            .header-pdf { position: relative; border-bottom: 4px solid #e63946; padding-bottom: 20px; margin-bottom: 30px; min-height: 100px; }
            .header-info { padding-right: 110px; }
            .header-info h1 { font-size: 30px; font-weight: 900; font-style: italic; color: #e63946; text-transform: uppercase; margin-bottom: 5px; }
            .header-info p { font-size: 12px; font-weight: bold; color: #64748b; text-transform: uppercase; letter-spacing: 1px; }
            .header-logo { position: absolute; right: 0; top: 0; }
            .header-logo img { width: 90px; height: 90px; border-radius: 50%; object-fit: cover; border: 4px solid #f1f5f9; box-shadow: 0 4px 6px rgba(0,0,0,0.1); }
            .secao-titulo { font-size: 14px; color: #e63946; font-weight: bold; text-transform: uppercase; border-left: 5px solid #e63946; padding-left: 10px; margin: 30px 0 15px 0; }
            .footer-pdf { margin-top: 50px; text-align: center; font-size: 10px; color: #cbd5e1; border-top: 1px solid #f1f5f9; padding-top: 20px; font-style: italic; }
            .shadow-sm, .shadow-lg, .shadow-2xl { box-shadow: none !important; }
            .rounded-2xl, .rounded-xl { border-radius: 8px !important; border: 1px solid #e2e8f0 !important; }
            .bg-slate-900, .bg-slate-800, .dark\\:bg-slate-900 { background-color: #f8fafc !important; }
            .dark\\:text-white, .text-white { color: #1e293b !important; }
            .border-slate-800, .dark\\:border-slate-800 { border-color: #e2e8f0 !important; }
            .text-emerald-500 { color: #10b981 !important; font-weight: 900 !important; }
            .text-red-500 { color: #ef4444 !important; font-weight: 900 !important; }
        </style>
    `;

    const cardsHTML = typeof resumoCardsLimpos === 'function' ? resumoCardsLimpos(resumoHTML) : resumoHTML;

    const htmlPrint = `
        <!DOCTYPE html>
        <html lang="pt-br">
        <head>
            <meta charset="UTF-8">
            <title>${nomeArquivo}</title>
            <script src="https://cdn.tailwindcss.com"></script>
            ${estilos}
        </head>
        <body>
            <div class="header-pdf">
                <div class="header-info">
                    <h1>${nomeLoja}</h1>
                    <p>Relatório de Fluxo de Caixa (Financeiro)</p>
                    <small style="color: #94a3b8;">Emitido em: ${dataEmissao} &nbsp;|&nbsp; ${dataStr}</small>
                </div>
                <div class="header-logo"><img src="${logoBase64 || ''}" onerror="this.style.display='none'"></div>
            </div>
            <h3 class="secao-titulo">➔ Resumo Consolidado</h3>
            <div class="grid grid-cols-3 gap-4 mb-8">
                ${cardsHTML}
            </div>
            <h3 class="secao-titulo">➔ Detalhamento dos Lançamentos</h3>
            <div class="space-y-2">
                ${listaHTML}
            </div>
            <div class="footer-pdf">WebComanda - Sistema de Gestão Inteligente</div>
            <script>
                setTimeout(() => { window.print(); window.close(); }, 1000);
            </script>
        </body>
        </html>
    `;

    const janelaImpressao = window.open('', '_blank');
    janelaImpressao.document.write(htmlPrint);
    janelaImpressao.document.close();
};

function resumoCardsLimpos(html) {
    return html.replace(/onclick="[^"]*"/g, "")
               .replace(/cursor-pointer/g, "")
               .replace(/hover:border-emerald-200/g, "")
               .replace(/hover:border-red-200/g, "")
               .replace(/dark:hover:border-emerald-900\/50/g, "")
               .replace(/dark:hover:border-red-900\/50/g, "")
               .replace(/🔍/g, "");
}

window.imprimirPDFEstoque = async function() {
    if(typeof showToast === 'function') showToast("GERANDO PDF DE ESTOQUE...", "aviso");

    try {
        const { data: produtos, error } = await _supabase
            .from('produtos')
            .select('*')
            .eq('controlar_estoque', true)
            .order('nome');

        if (error || !produtos) throw error;

        const operador = (localStorage.getItem('userName') || 'ADMIN').toUpperCase();
        const dataEmissao = new Date().toLocaleString('pt-BR');
        const nomeLoja = (localStorage.getItem('nomeLoja') || 'SISTEMA NÚCLEO PDV').toUpperCase();

        let logoBase64 = '';
        if (typeof obterLogoBase64 === 'function') {
            logoBase64 = await obterLogoBase64('img/logo.jpg');
        }

        const hoje = new Date();
        const dia = String(hoje.getDate()).padStart(2, '0');
        const mes = String(hoje.getMonth() + 1).padStart(2, '0');
        const ano = hoje.getFullYear();
        const nomeArquivo = `${dia}${mes}${ano}_Relatorio_Estoque`;

        const estilos = `
            <style>
                * { margin: 0; padding: 0; box-sizing: border-box; }
                body { font-family: 'Helvetica', Arial, sans-serif; padding: 40px; color: #1e293b; background: #fff; line-height: 1.4; }
                .header-pdf { position: relative; border-bottom: 4px solid #e63946; padding-bottom: 20px; margin-bottom: 30px; min-height: 100px; }
                .header-info { padding-right: 110px; }
                .header-info h1 { font-size: 30px; font-weight: 900; font-style: italic; color: #e63946; text-transform: uppercase; margin-bottom: 5px; }
                .header-info p { font-size: 12px; font-weight: bold; color: #64748b; text-transform: uppercase; letter-spacing: 1px; }
                .header-logo { position: absolute; right: 0; top: 0; }
                .header-logo img { width: 90px; height: 90px; border-radius: 50%; object-fit: cover; border: 4px solid #f1f5f9; box-shadow: 0 4px 6px rgba(0,0,0,0.1); }
                .secao-titulo { font-size: 14px; color: #e63946; font-weight: bold; text-transform: uppercase; border-left: 5px solid #e63946; padding-left: 10px; margin: 30px 0 15px 0; }
                table { width: 100%; border-collapse: collapse; font-size: 11px; margin-bottom: 25px; }
                th { background: #f1f5f9; padding: 12px; text-align: left; text-transform: uppercase; color: #64748b; border-bottom: 1px solid #e2e8f0; }
                td { padding: 12px; border-bottom: 1px solid #f1f5f9; color: #334155; font-weight: bold; }
                .text-right { text-align: right; }
                .text-center { text-align: center; }
                .footer-pdf { margin-top: 50px; text-align: center; font-size: 10px; color: #cbd5e1; border-top: 1px solid #f1f5f9; padding-top: 20px; font-style: italic; }
            </style>
        `;

        let linhasTabela = produtos.map(p => {
            const qtd = parseFloat(p.estoque_atual || 0);
            const alerta = qtd <= 5 ? '<span style="color:#ef4444; font-size:9px; font-weight:900; margin-left:6px;">(BAIXO)</span>' : '';
            const corQtd = qtd <= 5 ? 'color:#ef4444;' : 'color:#15803d;';
            
            return `
            <tr>
                <td class="text-center" style="font-weight: 900; ${corQtd} font-size: 13px;">${qtd}</td>
                <td>${p.nome.toUpperCase()} ${alerta}</td>
                <td>${(p.categoria || 'N/A').toUpperCase()}</td>
                <td class="text-right" style="color: #64748b;">R$ ${window.fmSeguro ? window.fmSeguro(p.preco_custo || 0) : p.preco_custo}</td>
                <td class="text-right">R$ ${window.fmSeguro ? window.fmSeguro(p.preco || 0) : p.preco}</td>
            </tr>`;
        }).join('');

        const html = `
        <!DOCTYPE html>
        <html>
        <head>
            <title>${nomeArquivo}</title>
            ${estilos}
        </head>
        <body>
            <div class="header-pdf">
                <div class="header-info">
                    <h1>${nomeLoja}</h1>
                    <p>Relatório de Posição de Estoque</p>
                    <small style="color: #94a3b8;">Emitido em: ${dataEmissao} &nbsp;|&nbsp; Operador: ${operador}</small>
                </div>
                <div class="header-logo"><img src="${logoBase64 || ''}" onerror="this.style.display='none'"></div>
            </div>
            <h3 class="secao-titulo">➔ Inventário Atual</h3>
            <table>
                <thead>
                    <tr>
                        <th style="width: 10%" class="text-center">QTD</th>
                        <th style="width: 40%">DESCRIÇÃO</th>
                        <th style="width: 20%">CATEGORIA</th>
                        <th style="width: 15%" class="text-right">PREÇO CUSTO</th>
                        <th style="width: 15%" class="text-right">PREÇO VENDA</th>
                    </tr>
                </thead>
                <tbody>
                    ${linhasTabela}
                </tbody>
            </table>
            <div class="footer-pdf">WebComanda - Sistema de Gestão Inteligente</div>
        </body>
        </html>`;

        const win = window.open('', '_blank');
        win.document.write(html);
        win.document.close();
        setTimeout(() => { win.print(); win.close(); }, 800);

    } catch (err) {
        console.error("Erro ao gerar PDF:", err);
        if(typeof showToast === 'function') showToast("ERRO AO GERAR RELATÓRIO", "erro");
    }
};

window.reimprimirComanda = async function(id) {
    try {
        const { data: m, error } = await _supabase.from('comandas').select('*').eq('id', id).single();
        if (error || !m) throw new Error("Comanda não encontrada.");

        const loja = localStorage.getItem('nomeLoja') || 'ESPETINHO E CIA';
        const cnpj = localStorage.getItem('empresa_cnpj') || '';
        const itens = typeof m.itens === 'string' ? JSON.parse(m.itens) : m.itens;
        const dataF = new Date(m.fechada_em);
        const dataFormatada = dataF.toLocaleDateString('pt-BR') + ' ' + dataF.toLocaleTimeString('pt-BR');

        const ua = navigator.userAgent.toLowerCase();
        const isAndroid = /android/.test(ua);

        // SE FOR MODO RAWBT -> GERA TEXTO PURO ALINHADO
        if (window.isRawBTThermalMode() && isAndroid) {
            const alinharCentro = (texto) => {
                const str = String(texto).substring(0, 32);
                const espacos = Math.max(0, Math.floor((32 - str.length) / 2));
                return ' '.repeat(espacos) + str;
            };

            const alinharLados = (esq, dir) => {
                const strEsq = String(esq);
                const strDir = String(dir);
                const espacosLivres = 32 - strEsq.length - strDir.length;
                if (espacosLivres > 0) return strEsq + ' '.repeat(espacosLivres) + strDir;
                return strEsq.substring(0, 32 - strDir.length - 1) + ' ' + strDir;
            };

            let textoRaw = '\n'; 
            textoRaw += alinharCentro(loja) + '\n';
            if (cnpj) textoRaw += alinharCentro(`CNPJ: ${cnpj}`) + '\n';
            textoRaw += '-'.repeat(32) + '\n';
            textoRaw += alinharCentro(`2 VIA - ${m.identificacao.toUpperCase()}`) + '\n';
            textoRaw += alinharLados('DATA:', dataFormatada) + '\n';
            textoRaw += '-'.repeat(32) + '\n\n';

            itens.forEach(item => {
                const precoStr = (parseFloat(item.preco) * item.qtd).toFixed(2).replace('.', ',');
                textoRaw += alinharLados(`${item.qtd}x ${item.nome.toUpperCase()}`, `R$ ${precoStr}`) + '\n';
                if (item.detalhes || item.observacao) {
                    const obsLimpa = (item.detalhes || item.observacao).replace(/<br>/g, ' | ');
                    textoRaw += `  OBS: ${obsLimpa}\n`;
                }
            });

            textoRaw += '\n' + '-'.repeat(32) + '\n';
            textoRaw += alinharLados('TOTAL:', `R$ ${parseFloat(m.total).toFixed(2).replace('.', ',')}`) + '\n';
            textoRaw += '-'.repeat(32) + '\n';
            textoRaw += alinharLados('PAGAMENTO:', m.forma_pagamento || 'DINHEIRO') + '\n';
            textoRaw += '\n' + alinharCentro('OBRIGADO PELA PREFERENCIA') + '\n\n\n\n';

            const textoCodificado = encodeURIComponent(textoRaw);
            window.location.href = `intent:${textoCodificado}#Intent;scheme=rawbt;package=ru.a402d.rawbtprinter;end;`;
            return;
        }

        // ROTA NAVEGADOR / PC (MANTIDA ORIGINAL)
        let html = `
            <div style="font-family: 'Courier New', Courier, monospace; width: 300px; padding: 5px; color: #000;">
                <div style="text-align: center; margin-bottom: 10px;">
                    <div style="font-size: 18px; font-weight: bold;">${loja}</div>
                    ${cnpj ? `<div style="font-size: 11px; text-align: center;">CNPJ: ${cnpj}</div>` : ''}
                    <div style="font-size: 13px; font-weight: bold; margin-top: 4px;">2ª VIA - ${m.identificacao.toUpperCase()}</div>
                    <div style="font-size: 10px; margin-top: 4px;">DATA: ${new Date(m.fechada_em).toLocaleString('pt-BR')}</div>
                </div>
                <div style="border-top: 1px dashed #000; margin: 5px 0;"></div>
                <div style="margin-top: 10px;">
                    ${itens.map(item => {
                        const obsHtml = (item.detalhes || item.observacao) 
                            ? `<div style="font-size: 11px; margin-top: 2px; padding-left: 5px; font-style: italic;">Obs: ${item.detalhes || item.observacao}</div>` 
                            : '';
                        return `
                        <div style="margin-bottom: 10px;">
                            <div style="display: flex; justify-content: space-between; font-size: 13px; font-weight: bold;">
                                <span>${item.qtd}X ${item.nome.toUpperCase()}</span>
                                <span>R$ ${(parseFloat(item.preco) * item.qtd).toFixed(2).replace('.', ',')}</span>
                            </div>
                            ${obsHtml}
                            <div style="border-top: 1px dashed #eee; margin-top: 4px;"></div>
                        </div>`;
                    }).join('')}
                </div>
                <div style="margin-top: 15px; border-top: 2px dashed #000; padding-top: 8px;">
                    <div style="display: flex; justify-content: space-between; font-size: 16px; font-weight: bold;">
                        <span>TOTAL</span>
                        <span>R$ ${parseFloat(m.total).toFixed(2).replace('.', ',')}</span>
                    </div>
                </div>
                <div style="margin-top: 10px; font-size: 10px;"><b>PAGAMENTO:</b> ${m.forma_pagamento || 'DINHEIRO'}</div>
                <div style="border-top: 1px dashed #000; margin: 15px 0 5px 0;"></div>
                <div style="text-align: center; font-size: 12px; font-weight: bold; margin-top: 10px;">OBRIGADO PELA PREFERÊNCIA</div>
            </div>`;

        if (typeof imprimirConteudoHTML === 'function') {
            imprimirConteudoHTML(html);
        } else {
            console.error("Função imprimirConteudoHTML não encontrada.");
        }
    } catch (e) {
        console.error('Erro na reimpressão:', e);
        if (typeof showToast === 'function') showToast('ERRO AO GERAR IMPRESSÃO', 'erro');
    }
};

function imprimirConteudoHTML(conteudo) {
    const frame = document.createElement('iframe');
    frame.style.display = 'none';
    document.body.appendChild(frame);
    
    const doc = frame.contentWindow.document;
    doc.open();
    doc.write(`
        <html>
            <head>
                <title>Reimpressão de Comanda</title>
                <style>
                    body { margin: 0; padding: 0; }
                    @media print { @page { margin: 0; } }
                </style>
            </head>
            <body>${conteudo}</body>
        </html>`);
    doc.close();

    setTimeout(() => {
        frame.contentWindow.focus();
        frame.contentWindow.print();
        setTimeout(() => { document.body.removeChild(frame); }, 1000);
    }, 500);
}
