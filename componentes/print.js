/* =================================================================================
   MÓDULO: MOTOR DE IMPRESSÃO UNIVERSAL ADAPTÁVEL (58MM / 80MM)
   ================================================================================= */

/* ---------------------------------------------------------------------------------
   0. CONFIGURAÇÃO E CONFIGURADOR CENTRAL DE HARDWARE LOCAL
   --------------------------------------------------------------------------------- */
function obterConfiguracoesImpressora() {
  const tamanho = localStorage.getItem("tamanhoImpressora") || "80";

  if (tamanho === "58") {
    return {
      tamanho: "58",
      pageWidth: "58mm",
      bodyWidth: "52mm", // Margem de respiro para não comer bordas
      fontSizeBase: "11px",
      fontSizeTitulo: "14px",
      maxChars: 32, // Limite de colunas para modo Texto Puro (58mm)
      espacoGuilhotina: "6mm", // Recuo leve para corte manual ou guilhotina curta
    };
  } else {
    return {
      tamanho: "80",
      pageWidth: "80mm",
      bodyWidth: "74mm", // Área útil ideal de impressão em bobinas de 80mm
      fontSizeBase: "13px", // Fonte maior e mais legível
      fontSizeTitulo: "17px",
      maxChars: 48, // Limite expandido de colunas para modo Texto Puro (80mm)
      espacoGuilhotina: "15mm", // Avanço ideal para a lâmina cortar no vazio
    };
  }
}

/* ---------------------------------------------------------------------------------
   1. MOTOR CENTRAL DE RENDERIZAÇÃO (IFRAME OCULTO)
   --------------------------------------------------------------------------------- */
window.imprimirConteudoIframe = function (htmlContent, tituloPDF = null) {
  let tituloOriginal = document.title;

  if (tituloPDF) document.title = tituloPDF;

  let iframeAntigo = document.getElementById("iframe-impressao-universal");
  if (iframeAntigo) iframeAntigo.remove();

  let iframe = document.createElement("iframe");
  iframe.id = "iframe-impressao-universal";
  iframe.style.position = "absolute";
  iframe.style.width = "0px";
  iframe.style.height = "0px";
  iframe.style.border = "none";
  document.body.appendChild(iframe);

  const htmlLimpo = htmlContent.replace(
    /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
    "",
  );

  const doc = iframe.contentWindow.document;
  doc.open();
  doc.write(htmlLimpo);
  doc.close();

  setTimeout(() => {
    iframe.contentWindow.focus();
    iframe.contentWindow.print();

    if (tituloPDF) {
      setTimeout(() => {
        document.title = tituloOriginal;
      }, 1000);
    }
  }, 1200);
};

/* ---------------------------------------------------------------------------------
   2. AUXILIARES E FORMATADORES INTERNOS
   --------------------------------------------------------------------------------- */
window.fmSeguro = (val) =>
  parseFloat(val || 0).toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

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

function getTicketCSS(layout, cfg) {
  let css = `
        @media print { 
            @page { margin: 0; size: ${cfg.pageWidth} auto; } 
            body { margin: 0; padding: 0; } 
        }
        html, body { 
            width: ${cfg.pageWidth}; 
            margin: 0 auto; 
            padding: 0; 
            background-color: #fff; 
            font-family: sans-serif; 
            color: #000 !important; 
        }
        * { box-sizing: border-box; }
        
        .ticket-wrapper { 
            width: ${cfg.bodyWidth}; 
            margin: 0 auto; 
            position: relative; 
            padding-bottom: ${cfg.espacoGuilhotina}; 
            border-bottom: 2px dashed #000; 
            page-break-after: always; /* Mantém o corte por ticket */
            break-after: page;
            text-align: center;
        }
        .ticket-wrapper:last-child { border-bottom: none; page-break-after: avoid; }
        
        .text-center { text-align: center; } 
        .bold { font-weight: 900; } 
        .uppercase { text-transform: uppercase; }
        .item-name { display: block; line-height: 1.1; margin-bottom: 4px; font-weight: 900; color: #000 !important; }
        .item-price { display: block; margin-bottom: 4px; color: #000 !important; }
        .instruction-text { display: block; font-weight: 900; margin-top: 5px; color: #000 !important; } 
        .footer { font-size: 10px; margin-top: 5px; color: #000 !important; line-height: 1.2; }
    `;

  if (layout === "padrao") {
    css += `
            .ticket-wrapper { padding: 10px 0; text-align: center; } 
            .header { margin-bottom: 8px; border-bottom: 1px dashed #000; padding-bottom: 5px; } 
            .store-name { font-size: ${cfg.tamanho === "58" ? "13px" : "16px"}; font-weight: 900; text-transform: uppercase; } 
            .meta { font-size: 9px; margin-top: 2px; } 
            .box-padrao { border: 3px solid #000; border-radius: 10px; padding: 10px 2px; margin: 5px 0; width: 100%; display: block; } 
            .item-name { font-size: ${cfg.tamanho === "58" ? "14px" : "18px"}; font-weight: 900; text-transform: uppercase; } 
            .item-price { font-size: 12px; } 
            .instruction-text { font-size: 11px; margin-top: 8px; text-transform: uppercase; display: inline-block; border-bottom: 2px solid #000; }
        `;
  } else if (layout === "eco") {
    css += `
            body { font-size: ${cfg.fontSizeBase}; font-family: Arial, sans-serif; } 
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
  } else if (layout === "gigante") {
    css += `
            /* Layout Gigante Corrigido */
            .ticket-wrapper { 
                padding: 5px 0; 
                border-bottom: 2px dashed #000; /* Linha inferior tracejada */
                text-align: center; 
                width: ${cfg.bodyWidth}; 
                margin: 0 auto !important; 
            } 
            .header { border-bottom: 3px solid #000; padding-bottom: 5px; margin-bottom: 5px; } 
            .store-name { font-size: 10px; text-transform: uppercase; font-weight: 900; color: #000 !important; } 
            .meta { font-size: 10px; display: block; font-weight: 900; margin-top: 2px; color: #000 !important; } 
            .unified-box { border: 5px solid #000; padding: 5px; margin: 5px auto; width: 95%; } 
            .item-name { 
                font-size: ${cfg.tamanho === "58" ? "20px" : "28px"}; 
                font-weight: 900; 
                line-height: 1; 
                margin-bottom: 5px; 
                word-break: break-word; 
                text-transform: uppercase; 
                color: #000 !important; 
            } 
            .item-price { font-size: 18px; font-weight: 900; display: block; margin-bottom: 5px; color: #000 !important; } 
            .instruction-text { 
                font-size: 14px; 
                background: #000 !important; 
                color: #fff !important; 
                display: inline-block; 
                padding: 6px 12px; 
                -webkit-print-color-adjust: exact !important; 
                print-color-adjust: exact !important; 
                text-transform: uppercase; 
                font-weight: 900; 
            } 
            .footer { 
                display: block; 
                font-weight: 900; 
                font-size: 12px; 
                margin-top: 5px; 
                border-top: 1px dashed #000; /* Linha superior do rodapé tracejada */
                padding-top: 5px; 
                color: #000 !important;
            }
        `;
  } else if (layout === "escuro") {
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
  } else if (layout === "minimalista") {
    css += `
            /* Design Limpo e Editorial */
            .ticket-wrapper { border-bottom: 1px solid #ccc; padding: 10px 0; text-align: left; } 
            .header { border-bottom: none; margin-bottom: 8px; } 
            .store-name { font-size: ${cfg.tamanho === "58" ? "12px" : "15px"}; font-weight: 900; letter-spacing: 1px; } 
            .meta { font-size: 10px; color: #555; } 
            .unified-box { border: none; padding: 4px 0; margin: 4px 0; border-bottom: 1px dotted #aaa; } 
            .item-name { font-size: ${cfg.tamanho === "58" ? "14px" : "17px"}; font-weight: bold; letter-spacing: -0.5px; display: block; } 
            .item-price { font-size: 11px; font-weight: normal; margin-top: 2px; } 
            .instruction-text { border: 1px solid #000; border-radius: 4px; padding: 4px; font-size: 10px; text-align: center; margin-top: 8px; display: block; }
        `;
  } else if (layout === "producao") {
    css += `
            /* Alto Contraste para a Cozinha enxergar de longe */
            .ticket-wrapper { padding: 5px 0; border-bottom: 3px dashed #000; text-align: center; } 
            .header { margin-bottom: 5px; } 
            .store-name { font-size: 11px; font-weight: bold; } 
            .unified-box { border: 2px solid #000; padding: 0; margin: 8px 0; background: #fff; } 
            .item-name { background: #000; color: #fff; padding: 6px 2px; font-size: ${cfg.tamanho === "58" ? "16px" : "20px"}; font-weight: 900; text-transform: uppercase; -webkit-print-color-adjust: exact; print-color-adjust: exact; } 
            .item-price { font-size: 12px; font-weight: bold; padding: 4px; } 
            .instruction-text { font-size: 13px; font-weight: 900; text-transform: uppercase; margin-top: 5px; }
        `;
  } else if (layout === "fiscal") {
    css += `
            /* Estilo Clássico de Supermercado */
            .ticket-wrapper { padding: 5px 0; border-bottom: 1px dotted #000; text-align: left; font-family: monospace; } 
            .header { border-bottom: 1px dashed #000; padding-bottom: 5px; margin-bottom: 5px; text-align: center; } 
            .store-name { font-size: ${cfg.tamanho === "58" ? "12px" : "14px"}; font-weight: normal; text-transform: uppercase; } 
            .unified-box { border: none; padding: 2px 0; margin: 0; display: flex; flex-direction: column; } 
            .item-name { font-size: ${cfg.tamanho === "58" ? "11px" : "13px"}; font-weight: bold; text-transform: uppercase; } 
            .item-price { font-size: 11px; text-align: right; margin-bottom: 4px; } 
            .instruction-text { font-size: 11px; border-top: 1px dashed #000; padding-top: 4px; text-align: center; margin-top: 4px; }
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
   3. RELATÓRIO DE FECHAMENTO (A4 DASHBOARD PDF)
   --------------------------------------------------------------------------------- */
window.gerarPDFConsolidado = async function (resumo) {
  if (!resumo) return;
  if (typeof showToast === "function") showToast("GERANDO PDF...", "aviso");

  const dataHora = new Date().toLocaleString("pt-BR");
  const logoBase64 = await obterLogoBase64("img/logo.jpg");

  const hoje = new Date();
  const dia = String(hoje.getDate()).padStart(2, "0");
  const mes = String(hoje.getMonth() + 1).padStart(2, "0");
  const ano = hoje.getFullYear();

  const nomeArquivo = `${dia}${mes}${ano}_Fechamento_Turno`;
  const sangriasList = (resumo.movsRaw || []).filter(
    (m) => m.tipo === "SANGRIA",
  );
  let htmlSaidas = "";

  if (sangriasList.length === 0) {
    htmlSaidas = `<tr><td colspan="2" class="text-center" style="color: #94a3b8; font-style: italic;">Nenhuma saída ou sangria registrada neste turno.</td></tr>`;
  } else {
    htmlSaidas = sangriasList
      .map(
        (m) => `
            <tr>
                <td>${(m.motivo || "SANGRIA / RETIRADA").toUpperCase()}</td>
                <td class="text-right" style="color:#ef4444;">- R$ ${window.fmSeguro(m.valor)}</td>
            </tr>
        `,
      )
      .join("");
  }

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
                <div class="header-logo"><img src="${logoBase64 || ""}" onerror="this.style.display='none'"></div>
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
                ${Object.entries(resumo.metodos)
                  .sort((a, b) => b[1] - a[1])
                  .map(
                    ([m, t]) => `
                    <div class="card"><label>${m}</label><b style="color:#0284c7">R$ ${window.fmSeguro(t)}</b></div>
                `,
                  )
                  .join("")}
            </div>

            <h3 class="secao-titulo">➔ Saídas e Sangrias (Detalhamento)</h3>
            <table>
                <thead>
                    <tr>
                        <th>Motivo / Descrição</th>
                        <th class="text-right">Valor</th>
                    </tr>
                </thead>
                <tbody>
                    ${htmlSaidas}
                </tbody>
            </table>

            <h3 class="secao-titulo">➔ Saída de Estoque (Produtos)</h3>
            <table>
                <thead><tr><th>Item / Produto</th><th class="text-right">Quantidade</th></tr></thead>
                <tbody>
                    ${Object.entries(resumo.itensVendidos)
                      .sort((a, b) => b[1] - a[1])
                      .map(
                        ([n, q]) => `
                        <tr><td>${n}</td><td class="text-center" style="color:#e63946; font-size: 13px;">${q}x</td></tr>
                    `,
                      )
                      .join("")}
                </tbody>
            </table>

            <h3 class="secao-titulo">➔ Produção por Atendente</h3>
            <table>
                <thead><tr><th>Colaborador</th><th class="text-right">Total Produzido</th></tr></thead>
                <tbody>
                    ${Object.entries(resumo.vendasPorVendedor)
                      .sort((a, b) => b[1] - a[1])
                      .map(
                        ([v, t]) => `
                        <tr><td>${v.toUpperCase()}</td><td class="text-right">R$ ${window.fmSeguro(t)}</td></tr>
                    `,
                      )
                      .join("")}
                </tbody>
            </table>
            
            <div class="footer-pdf">WebComanda - Sistema de Gestão Inteligente</div>
        </body></html>
    `;

  window.imprimirConteudoIframe(html, nomeArquivo);
};

window.exportarFechamentoPDF = function (res) {
  window.gerarPDFConsolidado(res);
};

/* ---------------------------------------------------------------------------------
   4. GERAÇÃO DE CARDÁPIO (A4 PORTRAIT)
   --------------------------------------------------------------------------------- */
window.gerarCardapioPDF = function () {
  const modal = document.getElementById("modal-gerar-cardapio");
  if (modal) {
    modal.classList.remove("hidden");
    modal.classList.add("flex");
    document.getElementById("input-msg-cardapio")?.focus();
  }
};

window.fecharModalCardapio = function () {
  const modal = document.getElementById("modal-gerar-cardapio");
  if (modal) modal.classList.add("hidden");
};

window.processarImpressaoCardapio = async function () {
  const radio = document.querySelector('input[name="modelo-cardapio"]:checked');
  const modelo = radio ? radio.value : "classico";
  const mensagem =
    document.getElementById("input-msg-cardapio")?.value.toUpperCase() ||
    "AGRADECEMOS A PREFERÊNCIA!";

  window.fecharModalCardapio();

  if (typeof isDatabaseReady === "function" && !isDatabaseReady()) return;
  if (typeof showToast === "function") showToast("GERANDO CARDÁPIO...");

  const loja = localStorage.getItem("nomeLoja") || "ESPETINHO & CIA";
  const logoBase64 = await obterLogoBase64("img/logo.jpg");

  try {
    const { data: produtos } = await _supabase
      .from("produtos")
      .select("*")
      .eq("status", true)
      .order("nome");

    if (!produtos || produtos.length === 0) {
      if (typeof alertaSistema === "function")
        alertaSistema("Não há produtos ativos.", "Cardápio Vazio");
      return;
    }

    if (modelo === "classico") {
      window.gerarTemplateClassico(produtos, loja, logoBase64, mensagem);
    } else {
      // CORRIGIDO: alterado de 'message' para 'mensagem'
      window.gerarTemplateModerno(produtos, loja, logoBase64, mensagem);
    }
  } catch (e) {
    console.error("Erro ao gerar cardápio", e);
    if (typeof showToast === "function")
      showToast("ERRO AO GERAR CARDÁPIO", "erro");
  }
};

window.gerarTemplateClassico = function (produtos, loja, logoBase64, mensagem) {
  const icons = {
    espetos: "🍢",
    cervejas: "🍺",
    bebidas: "🥤",
    refeicao: "🍽️",
    acompanhamentos: "🍚",
    combos: "🍻",
  };
  const categoriesObj = {};

  produtos.forEach((p) => {
    const cat = (p.categoria || "outros").toLowerCase();
    if (!categoriesObj[cat]) categoriesObj[cat] = [];
    categoriesObj[cat].push(p);
  });

  const ordem = ["espetos", "refeicao", "acompanhamentos", "bebidas"];
  const chaves = [
    ...ordem.filter((c) => categoriesObj[c]),
    ...Object.keys(categoriesObj).filter((c) => !ordem.includes(c)),
  ];

  let html = chaves
    .map(
      (key) => `
        <div class="categoria-section">
            <h3 class="categoria-titulo">${icons[key] || "📦"} ${key.toUpperCase()}</h3>
            <div class="itens-grid">
                ${categoriesObj[key]
                  .map(
                    (i) => `
                    <div style="display: flex; flex-direction: column; margin-bottom: 4px; page-break-inside: avoid;">
                        <div class="item-info" style="margin-bottom: 1px;">
                            <span class="item-nome">${i.nome.toUpperCase()}</span>
                            <div class="linha-pontilhada"></div>
                            <span class="item-preco">R$ ${window.fmSeguro(i.preco)}</span>
                        </div>
                        ${i.observacao ? `<div style="font-size: 9px; font-weight: 600; color: #64748b; font-style: italic; line-height: 1.1; text-transform: uppercase;">${i.observacao}</div>` : ""}
                    </div>
                `,
                  )
                  .join("")}
            </div>
        </div>`,
    )
    .join("");

  window.abrirJanelaImpressao(loja, logoBase64, html, mensagem, "classico");
};

window.gerarTemplateModerno = function (produtos = [], loja = "Loja", logoBase64 = "", mensagem = "") {
    // 1. BLINDAGEM: Garante que os produtos existam e sejam um array
    if (!Array.isArray(produtos) || produtos.length === 0) {
        console.warn("Nenhum produto recebido para gerar o cardápio.");
        if (typeof window.showToast === 'function') window.showToast("Nenhum produto encontrado.", "erro");
        return;
    }

    try {
        const categorias = [
            ...new Set(produtos.map((p) => (p.categoria || "outros").toLowerCase())),
        ];

        let html = categorias
            .map(
                (cat) => `
                <div class="cat-section-moderno">
                    <div class="cat-titulo-moderno">${cat.toUpperCase()}</div>
                    ${produtos
                        .filter((p) => (p.categoria || "outros").toLowerCase() === cat)
                        .map(
                            (p) => {
                                // 2. BLINDAGEM: Evita quebra se o nome for nulo ou undefined
                                const nomeProduto = (p.nome || "Item sem nome").toUpperCase();
                                
                                // 3. BLINDAGEM: Garante que o preço seja formatado mesmo se a fmSeguro falhar
                                let precoFormatado = "0,00";
                                if (typeof window.fmSeguro === 'function') {
                                    precoFormatado = window.fmSeguro(p.preco);
                                } else {
                                    precoFormatado = Number(p.preco || 0).toFixed(2).replace('.', ',');
                                }

                                return `
                                <div style="margin-bottom: 6px; page-break-inside: avoid; break-inside: avoid;">
                                    <div class="item-moderno" style="margin-bottom: 1px;">
                                        <span class="item-nome-moderno">${nomeProduto}</span>
                                        <div class="item-dots-moderno"></div>
                                        <span class="item-preco-moderno">R$ ${precoFormatado}</span>
                                    </div>
                                    ${p.observacao ? `<div style="font-size: 9px; color: #64748b; font-weight: 600; font-style: italic; line-height: 1.1; text-transform: uppercase; margin-top: -1px;">${p.observacao}</div>` : ""}
                                </div>
                                `;
                            }
                        )
                        .join("")}
                </div>`
            )
            .join("");

        // 4. BLINDAGEM: Verifica se a função de impressão final existe
        if (typeof window.abrirJanelaImpressao === 'function') {
            window.abrirJanelaImpressao(loja, logoBase64, html, mensagem, "moderno");
        } else {
            console.error("Erro: A função window.abrirJanelaImpressao não foi encontrada.");
        }

    } catch (error) {
        console.error("Erro crítico ao montar o template moderno:", error);
    }
};

window.abrirJanelaImpressao = function (
  loja,
  logoBase64,
  conteudo,
  mensagem,
  estilo,
) {
  const dataHora = new Date().toLocaleString("pt-BR");
  const nomePdf = `Cardapio_${loja.replace(/\s+/g, "_")}`;

  const cssHeader = `
        .header-pdf { display: flex; justify-content: space-between; align-items: center; border-bottom: 3px solid #e63946; padding-bottom: 10px; margin-bottom: 15px; }
        .header-info h1 { font-size: 22px; font-weight: 900; font-style: italic; color: #e63946; text-transform: uppercase; margin-bottom: 2px; line-height: 1; }
        .header-info p { font-size: 10px; font-weight: bold; color: #64748b; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 2px; }
        .header-logo img { width: 55px; height: 55px; border-radius: 50%; object-fit: cover; border: 2px solid #f1f5f9; }
        @media print {
            @page { margin: 8mm; size: A4 portrait; }
            body { -webkit-print-color-adjust: exact; print-color-adjust: exact; padding: 0 !important; }
            .categoria-section, .cat-section-moderno { page-break-inside: avoid; break-inside: avoid; }
            html { zoom: 0.95; } 
        }
    `;

  const cssClassico = `@import url('https://fonts.googleapis.com/css2?family=Montserrat:wght@400;700;900&display=swap');
    body{font-family:'Montserrat',sans-serif;color:#1e293b;} 
    ${cssHeader} 
    .categoria-titulo{color:#e63946;border-bottom:2px solid #e63946;margin-bottom:8px;text-transform:uppercase;font-size:13px;margin-top:12px; font-weight: 900;}
    .itens-grid{display:grid;grid-template-columns:1fr 1fr;gap:6px 20px;}
    .item-info{display:flex;align-items:baseline;font-weight:700;font-size:11px;}
    .linha-pontilhada{flex-grow:1;border-bottom:1px dotted #ccc;margin:0 6px;}`;

  const cssModerno = `@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;700;900&display=swap');
    body{font-family:'Inter',sans-serif;color:#1e293b;} 
    ${cssHeader} 
    .content { column-count: 2; column-gap: 25px; }
    .cat-titulo-moderno{color:#e63946;font-weight:900;border-bottom:2px solid #f1f5f9;margin:0 0 8px 0; padding-top: 10px; text-transform:uppercase;font-size:13px; break-after: avoid; page-break-after: avoid;}
    .cat-section-moderno { break-inside: avoid; page-break-inside: avoid; margin-bottom: 8px; }
    .item-moderno{display:flex;justify-content:space-between;align-items:baseline;margin-bottom:2px;font-size:11px;font-weight:700;}
    .item-dots-moderno{flex:1;border-bottom:1px dotted #cbd5e1;margin:0 8px;}`;

  const html = `<!DOCTYPE html>
    <html>
    <head>
        <title>Cardápio - ${loja}</title>
        <style>
            * { margin: 0; padding: 0; box-sizing: border-box; }
            body { background: #fff; padding: 15px; width: 100%; margin: 0 auto; }
            ${estilo === "classico" ? cssClassico : cssModerno}
            .footer { margin-top: 15px; text-align: center; padding: 10px; border-top: 2px dashed #eee; font-weight: 900; color: #e63946; font-size: 11px; page-break-inside: avoid; }
        </style>
    </head>
    <body>
        <div class="header-pdf">
            <div class="header-info">
                <h1>${loja}</h1>
                <p>Cardápio de Produtos</p>
                <small style="color: #94a3b8; font-size: 8px;">Atualizado em: ${dataHora}</small>
            </div>
            <div class="header-logo">
                <img src="${logoBase64 || ""}" onerror="this.style.display='none'">
            </div>
        </div>
        <div class="content">${conteudo}</div>
        <div class="footer">${mensagem}</div>
    </body>
    </html>`;

  window.imprimirConteudoIframe(html, nomePdf);
};

/* ---------------------------------------------------------------------------------
   5. IMPRESSÃO TÉRMICA DINÂMICA (58MM / 80MM AUTODETECTÁVEL)
   --------------------------------------------------------------------------------- */
window.isRawBTThermalMode = function () {
  const formatoGlobal = (
    localStorage.getItem("formatoImpressao") || ""
  ).toLowerCase();
  const modoConfigurado = (
    localStorage.getItem("modoImpressao") || ""
  ).toLowerCase();
  return (
    ["direto", "rawbt", "termico"].includes(modoConfigurado) ||
    ["direto", "rawbt", "termico"].includes(formatoGlobal)
  );
};

window.dispararImpressao = function (conteudoHtml, layout) {
  const cfg = obterConfiguracoesImpressora();
  const ua = navigator.userAgent.toLowerCase();
  const isAndroid = /android/.test(ua);

  if (window.isRawBTThermalMode() && isAndroid) {
    const htmlCompleto = `
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="utf-8">
                <style>
                    html, body { margin: 0; padding: 0; width: ${cfg.pageWidth}; background: #fff; color: #000; font-family: 'Courier New', monospace; }
                    ${getTicketCSS(layout, cfg)}
                </style>
            </head>
            <body>
                ${conteudoHtml}
                <div style="height: ${cfg.espacoGuilhotina};">.</div>
            </body>
            </html>
        `;

    const base64Html = btoa(unescape(encodeURIComponent(htmlCompleto)));
    const urlRawBT = `intent:base64,${base64Html}#Intent;scheme=rawbt;package=ru.a402d.rawbtprinter;end;`;
    window.location.href = urlRawBT;
    return;
  }

  const htmlIframe = `<html><head><meta charset="utf-8"><style>html,body{margin:0;padding:0;width:${cfg.pageWidth};}@media print{.no-print{display:none!important;}}${getTicketCSS(layout, cfg)}</style></head><body>${conteudoHtml}<div style="height: ${cfg.espacoGuilhotina};">.</div></body></html>`;
  window.imprimirConteudoIframe(htmlIframe, "Cupom_Impressao");
};

window.enviarParaImpressora = function (texto) {
  const cfg = obterConfiguracoesImpressora();
  const ua = navigator.userAgent.toLowerCase();
  const isAndroid = /android/.test(ua);
  const base64Texto = btoa(unescape(encodeURIComponent(texto)));

  if (isAndroid && window.isRawBTThermalMode()) {
    window.location.href = "rawbt:base64," + base64Texto;
  } else {
    const html = `<pre style="font-family:monospace;font-size:${cfg.fontSizeBase};white-space:pre-wrap;padding:10px;width:${cfg.bodyWidth};">${texto}</pre><div style="height: ${cfg.espacoGuilhotina};">.</div>`;
    window.imprimirConteudoIframe(html, "Ticket_Texto");
  }
};

// FORMATO 1: Fichas Individuais (Retirar no Balcão)
window.imprimirCupom = function (venda) {
  const cfg = typeof obterConfiguracoesImpressora === 'function' ? obterConfiguracoesImpressora() : { maxChars: 32, tamanho: '80', bodyWidth: '72mm' };
  const loja = localStorage.getItem("nomeLoja") || "ESPETINHO & CIA";
  const operador = (localStorage.getItem("userName") || "ADMIN").toUpperCase();
  const layout = localStorage.getItem("ticketLayout") || "original";
  const dataVenda = new Date(venda.data || Date.now());
  let itensArray = Array.isArray(venda.itens)
    ? venda.itens
    : JSON.parse(venda.itens || "[]");

  // --- 1. MOTOR DE ORDENAÇÃO DE 3 NÍVEIS ---
  const getPesoOrdenacao = (item) => {
    const cat = (item.categoria || "").toLowerCase().trim();
    if (['refeição', 'refeicao', 'acompanhamento', 'porção', 'porcao'].some(c => cat.includes(c))) return 2;
    if (cat.includes('combo')) return 1;
    return 0; 
  };

  itensArray.sort((a, b) => getPesoOrdenacao(a) - getPesoOrdenacao(b));

  const temBar = itensArray.some(item => getPesoOrdenacao(item) < 2 && parseFloat(item.preco) > 0);
  const temCozinha = itensArray.some(item => getPesoOrdenacao(item) === 2 && parseFloat(item.preco) > 0);
  const precisaLinhaCorte = temBar && temCozinha;
  let linhaCorteInserida = false;

  // --- 2. SE FOR MODO RAWBT ANDROID (TEXTO PURO EXPANSÍVEL) ---
  if (
    window.isRawBTThermalMode && window.isRawBTThermalMode() &&
    /android/.test(navigator.userAgent.toLowerCase())
  ) {
    let textoRaw = "\n";

    const alinharCentro = (texto) => {
      const str = String(texto).substring(0, cfg.maxChars);
      return (
        " ".repeat(Math.max(0, Math.floor((cfg.maxChars - str.length) / 2))) + str
      );
    };

    itensArray.forEach((item) => {
      if (parseFloat(item.preco) > 0) {
        
        // ✂️ GATILHO DA TESOURA RAWBT (Corte visual das categorias)
        if (getPesoOrdenacao(item) === 2 && precisaLinhaCorte && !linhaCorteInserida) {
          textoRaw += "\n" + alinharCentro("- - ✂ - CORTE AQUI - ✂ - -") + "\n\n";
          linhaCorteInserida = true;
        }

        for (let i = 0; i < (item.qtd || 1); i++) {
          const pedidoId = Math.floor(Math.random() * 9000) + 1000;

          textoRaw += alinharCentro(loja) + "\n";
          textoRaw +=
            alinharCentro(
              new Date().toLocaleTimeString("pt-BR", {
                hour: "2-digit",
                minute: "2-digit",
              }),
            ) + "\n";
          textoRaw += "=".repeat(cfg.maxChars) + "\n";

          textoRaw += alinharCentro(item.nome.toUpperCase()) + "\n";
          textoRaw += alinharCentro(`R$ ${typeof window.fmSeguro === 'function' ? window.fmSeguro(item.preco) : Number(item.preco).toFixed(2).replace('.', ',')}`) + "\n";

          textoRaw += "-".repeat(cfg.maxChars) + "\n";
          textoRaw += alinharCentro("RETIRAR NO BALCAO") + "\n";
          textoRaw += "-".repeat(cfg.maxChars) + "\n";

          const rodape = `PED#${pedidoId} | OP: ${operador.substring(0, 12)}`;
          textoRaw += alinharCentro(rodape) + "\n";
          
          // ESPAÇAMENTO DA GUILHOTINA DINÂMICO (3 linhas para 58mm, 5 linhas para 80mm)
          textoRaw += "\n".repeat(cfg.tamanho === "58" ? 3 : 5); 
          
          // COMANDO MÁGICO DE CORTE (O RawBT vai ler isso e acionar a lâmina física aqui!)
          textoRaw += "[cut]\n"; 
        }
      }
    });

    const textoCodificado = encodeURIComponent(textoRaw);
    window.location.href = `intent:${textoCodificado}#Intent;scheme=rawbt;package=ru.a402d.rawbtprinter;end;`;
    return;
  }

  // --- 3. SE FOR ROTA WEB NAVEGADOR ---
  let html = `<div style="width: 100%; display: flex; flex-direction: column; align-items: center;">`;
  linhaCorteInserida = false;

  itensArray.forEach((item) => {
    if (parseFloat(item.preco) > 0) {

      if (getPesoOrdenacao(item) === 2 && precisaLinhaCorte && !linhaCorteInserida) {
        html += `<div style="width: ${cfg.bodyWidth}; max-width: 100%; margin: 25px 0; text-align: center; border-top: 2px dashed #000; padding-top: 15px; font-weight: 900; font-size: 14px; letter-spacing: 2px; color: #000 !important; -webkit-print-color-adjust: exact; print-color-adjust: exact;">✂ CORTE AQUI ✂</div>`;
        linhaCorteInserida = true;
      }

      for (let i = 0; i < (item.qtd || 1); i++) {
        const pedidoId = Math.floor(Math.random() * 9000) + 1000;

        // Adicionado break-after para forçar navegadores de PC a cortarem as páginas
        html += `<div class="ticket-wrapper" style="width: ${cfg.bodyWidth}; max-width: 100%; margin-bottom: ${cfg.espacoGuilhotina || '15px'}; page-break-after: always; break-after: page;"><div class="header"><div class="store-name">${loja}</div><div class="meta">${dataVenda.toLocaleDateString()} ${dataVenda.toLocaleTimeString().substring(0, 5)}</div></div>`;

        if (layout === "padrao") {
          html += `<div class="box-padrao text-center"><div class="item-name">${item.nome}</div><div class="item-price">VALOR: R$ ${typeof window.fmSeguro === 'function' ? window.fmSeguro(item.preco) : Number(item.preco).toFixed(2).replace('.', ',')}</div></div><div class="instruction-text text-center">RETIRAR NO BALCÃO</div>`;
        } else if (layout === "eco") {
          html += `<div class="unified-box"><div class="item-name">${item.nome}</div><div class="item-price">R$ ${typeof window.fmSeguro === 'function' ? window.fmSeguro(item.preco) : Number(item.preco).toFixed(2).replace('.', ',')}</div></div>`;
        } else {
          html += `<div class="unified-box text-center"><div class="item-name">${item.nome}</div><div class="item-price">VALOR: R$ ${typeof window.fmSeguro === 'function' ? window.fmSeguro(item.preco) : Number(item.preco).toFixed(2).replace('.', ',')}</div>${layout === "original" ? '<div class="separator"></div>' : ""}<div class="instruction-text">RETIRAR NO BALCÃO</div></div>`;
        }
        html += `<div class="footer text-center">PEDIDO #${pedidoId}<br>Op: ${operador}</div></div>`;
      }
    }
  });
  
  html += `</div>`;

  if (typeof window.dispararImpressao === 'function') {
      window.dispararImpressao(html, layout);
  } else {
      console.error("[IMPRESSÃO] Função dispararImpressao não encontrada.");
  }
};

// FORMATO 2: Resumo Completo da Venda / Pré-Conta Consolidada
window.imprimirTicketVenda = function (dadosVenda) {
  const cfg = obterConfiguracoesImpressora();
  const loja = localStorage.getItem("nomeLoja") || "ESPETINHO E CIA";
  const cnpj = localStorage.getItem("empresa_cnpj") || "";

  const ua = navigator.userAgent.toLowerCase();
  const isAndroid = /android/.test(ua);
  const isIOS = /iphone|ipad|ipod/.test(ua);

  const itensArray = Array.isArray(dadosVenda.itens)
    ? dadosVenda.itens
    : JSON.parse(dadosVenda.itens || "[]");
  const itensAgrupados = {};

  itensArray.forEach((i) => {
    if (parseFloat(i.preco) > 0) {
      const obs = i.detalhes || i.observacao || "";
      const chave = `${i.nome.trim().toUpperCase()}_${obs.trim().toUpperCase()}`;
      if (!itensAgrupados[chave]) {
        itensAgrupados[chave] = { ...i };
      } else {
        itensAgrupados[chave].qtd += i.qtd;
      }
    }
  });

  const dataFormatada = new Date(
    dadosVenda.created_at || dadosVenda.data || Date.now(),
  ).toLocaleString("pt-BR");
  const isPreConta = dadosVenda.tipo && dadosVenda.tipo.includes("PRÉ-CONTA");

  // --- ROTA TEXTO RAWBT ANDROID COMPATÍVEL ---
  if (
    typeof window.isRawBTThermalMode === "function" &&
    window.isRawBTThermalMode() &&
    isAndroid
  ) {
    const alinharCentro = (texto) => {
      const str = String(texto).substring(0, cfg.maxChars);
      return (
        " ".repeat(Math.max(0, Math.floor((cfg.maxChars - str.length) / 2))) +
        str
      );
    };
    const alinharLados = (esq, dir) => {
      const strEsq = String(esq);
      const strDir = String(dir);
      const espacosLivres = cfg.maxChars - strEsq.length - strDir.length;
      if (espacosLivres > 0) return strEsq + " ".repeat(espacosLivres) + strDir;
      return (
        strEsq.substring(0, cfg.maxChars - strDir.length - 1) + " " + strDir
      );
    };

    let textoRaw = "\n";
    textoRaw += alinharCentro(loja) + "\n";
    if (cnpj) textoRaw += alinharCentro(`CNPJ: ${cnpj}`) + "\n";
    textoRaw += "-".repeat(cfg.maxChars) + "\n";
    textoRaw += alinharCentro(dadosVenda.tipo || "VENDA") + "\n";
    textoRaw += alinharLados("DATA:", dataFormatada) + "\n";
    textoRaw += "-".repeat(cfg.maxChars) + "\n\n";

    Object.values(itensAgrupados).forEach((i) => {
      const precoStr = window.fmSeguro
        ? window.fmSeguro(i.preco * i.qtd)
        : (i.preco * i.qtd).toFixed(2);
      textoRaw +=
        alinharLados(`${i.qtd}x ${i.nome.toUpperCase()}`, precoStr) + "\n";
    });

    textoRaw += "\n" + "-".repeat(cfg.maxChars) + "\n";
    const totalStr = window.fmSeguro
      ? window.fmSeguro(dadosVenda.total)
      : parseFloat(dadosVenda.total).toFixed(2);
    textoRaw += alinharLados("TOTAL:", `R$ ${totalStr}`) + "\n";

    if (dadosVenda.troco > 0) {
      const recStr = window.fmSeguro
        ? window.fmSeguro(dadosVenda.recebido)
        : parseFloat(dadosVenda.recebido).toFixed(2);
      const trcStr = window.fmSeguro
        ? window.fmSeguro(dadosVenda.troco)
        : parseFloat(dadosVenda.troco).toFixed(2);
      textoRaw += alinharLados("RECEBIDO:", `R$ ${recStr}`) + "\n";
      textoRaw += alinharLados("TROCO:", `R$ ${trcStr}`) + "\n";
    }

    textoRaw += "-".repeat(cfg.maxChars) + "\n";
    if (!isPreConta) {
      const formaPgto = (
        dadosVenda.forma_pagamento ||
        dadosVenda.pagamento ||
        "DINHEIRO"
      ).toUpperCase();
      textoRaw += alinharLados("PAGAMENTO:", formaPgto) + "\n";
    }

    textoRaw +=
      "\n" +
      alinharCentro("OBRIGADO PELA PREFERENCIA") +
      "\n".repeat(cfg.tamanho === "58" ? 4 : 6);
    const textoCodificado = encodeURIComponent(textoRaw);
    window.location.href = `intent:${textoCodificado}#Intent;scheme=rawbt;package=ru.a402d.rawbtprinter;end;`;
    return;
  }

  // --- ROTA NAVEGADOR WEB (COMPUTADORES / IOS VIA OPENLABELS) ---
  let htmlItens = "";
  Object.values(itensAgrupados).forEach((i) => {
    const precoFormatado = window.fmSeguro
      ? window.fmSeguro(i.preco * i.qtd)
      : (i.preco * i.qtd).toFixed(2);
    htmlItens += `
        <div class="item-row-container">
            <div class="item-row">
                <div class="item-name">${i.qtd}x ${i.nome.toUpperCase()}</div>
                <div class="item-price">R$ ${precoFormatado}</div>
            </div>
        </div>`;
  });

  let pgtoHtml = !isPreConta
    ? `<div class="pgto-box">PAGAMENTO: ${(dadosVenda.forma_pagamento || dadosVenda.pagamento || "DINHEIRO").toUpperCase()}</div>`
    : "";
  let trocoHtml = "";

  if (dadosVenda.troco > 0) {
    const recFormat = window.fmSeguro
      ? window.fmSeguro(dadosVenda.recebido)
      : parseFloat(dadosVenda.recebido).toFixed(2);
    const trocoFormat = window.fmSeguro
      ? window.fmSeguro(dadosVenda.troco)
      : parseFloat(dadosVenda.troco).toFixed(2);

    trocoHtml = `
        <div style="display: flex; justify-content: space-between; font-size: 11px; margin-top: 4px; width: 100%;">
            <span class="bold">RECEBIDO</span>
            <span class="bold">R$ ${recFormat}</span>
        </div>
        <div style="display: flex; justify-content: space-between; font-size: 13px; font-weight: 900; margin-top: 2px; width: 100%;">
            <span>TROCO</span>
            <span>R$ ${trocoFormat}</span>
        </div>`;
  }

  const htmlCompleto = `
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="utf-8">
        <style>
            @page { margin: 0; size: ${cfg.pageWidth} auto; }
            * { margin: 0; padding: 0; box-sizing: border-box; }
            body { 
                font-family: 'Courier New', Courier, monospace; 
                width: ${cfg.bodyWidth} !important; 
                max-width: ${cfg.bodyWidth} !important; 
                margin: 0 auto; 
                padding: 0; 
                background: #fff; 
                color: #000 !important; 
                font-size: ${cfg.fontSizeBase}; 
                line-height: 1.2;
                overflow-x: hidden;
                -webkit-print-color-adjust: exact;
                print-color-adjust: exact;
            }
            .text-center { text-align: center; }
            .bold { font-weight: 900 !important; color: #000 !important; }
            .uppercase { text-transform: uppercase; }
            .divisor { border-top: 1px dashed #000; margin: 6px 0; width: 100%; }
            .store-name { font-size: ${cfg.fontSizeTitulo}; font-weight: 900; margin-bottom: 2px; }
            .meta { font-size: 10px; margin-bottom: 6px; }
            .item-row-container { margin-bottom: 4px; padding-bottom: 2px; width: 100%; }
            .item-row { display: flex; justify-content: space-between; align-items: flex-start; width: 100%; }
            .item-name { font-weight: 900; flex: 1; padding-right: 4px; word-wrap: break-word; overflow-wrap: break-word; word-break: break-word; }
            .item-price { font-weight: 900; white-space: nowrap; text-align: right; }
            .total-row { display: flex; justify-content: space-between; font-size: 15px; font-weight: 900; margin-top: 6px; width: 100%; }
            .pgto-box { font-size: 11px; font-weight: 900; margin-top: 5px; }
            .footer { margin-top: 12px; font-size: 11px; }
        </style>
    </head>
    <body>
        <div class="text-center">
            <div class="store-name">${loja}</div>
            ${cnpj ? `<div class="bold" style="font-size:11px; margin-bottom: 2px;">CNPJ: ${cnpj}</div>` : ""}
            <div class="bold uppercase" style="font-size:12px; margin-bottom: 4px;">${dadosVenda.tipo || "VENDA"}</div>
            <div class="meta bold">DATA: ${dataFormatada}</div>
        </div>
        <div class="divisor"></div>
        <div>${htmlItens}</div>
        <div class="divisor"></div>
        <div class="total-row">
            <span>TOTAL</span>
            <span>R$ ${window.fmSeguro ? window.fmSeguro(dadosVenda.total) : parseFloat(dadosVenda.total).toFixed(2)}</span>
        </div>
        ${trocoHtml}
        ${pgtoHtml}
        <div class="divisor"></div>
        <div class="footer text-center bold">OBRIGADO PELA PREFERÊNCIA</div>
        <div style="height: ${cfg.espacoGuilhotina};">.</div>
    </body>
    </html>`;

  if (localStorage.getItem("modoImpressao") === "direto" && isIOS) {
    window.location.href =
      "openlabels://print?text=" + encodeURIComponent(htmlCompleto);
    return;
  }

  window.imprimirConteudoIframe(
    htmlCompleto,
    `Ticket_${dadosVenda.id || "Conta"}`,
  );
};

window.gerarTicketHTML = function (dados, loja) {
  const cfg = obterConfiguracoesImpressora();
  const cnpj = localStorage.getItem("empresa_cnpj") || "";
  let htmlItens = "";

  if (dados.itens) {
    const itensAgrupadosHtml = {};
    const itensArray = Array.isArray(dados.itens)
      ? dados.itens
      : JSON.parse(dados.itens || "[]");

    itensArray.forEach((i) => {
      if (parseFloat(i.preco) > 0) {
        const chave = i.nome.trim().toUpperCase();
        if (!itensAgrupadosHtml[chave]) {
          itensAgrupadosHtml[chave] = { ...i };
        } else {
          itensAgrupadosHtml[chave].qtd += i.qtd;
        }
      }
    });

    Object.values(itensAgrupadosHtml).forEach((i) => {
      htmlItens += `
            <div style="margin-bottom: 4px; border-bottom: 1px dashed #ccc; padding-bottom: 3px;">
                <div style="font-size:${cfg.fontSizeBase}; font-weight: bold; text-transform: uppercase; line-height: 1.1; word-wrap: break-word;">
                    ${i.qtd}x ${i.nome}
                </div>
                <div style="text-align: right; font-size:${cfg.fontSizeBase}; font-weight: bold; margin-top: 2px;">
                    R$ ${window.fmSeguro(i.preco * i.qtd)}
                </div>
            </div>`;
    });
  }

  const isPreConta = dados.tipo && dados.tipo.includes("PRÉ-CONTA");
  let pgtoHtml = !isPreConta
    ? `<div style="font-size:11px; margin-top:5px;">PAGAMENTO: ${(dados.forma_pagamento || dados.pagamento || "DINHEIRO").toUpperCase()}</div><div class="divisor"></div>`
    : `<div class="divisor"></div>`;

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="utf-8">
        <style>
            * { margin: 0; padding: 0; box-sizing: border-box; }
            @page { margin: 0; size: ${cfg.pageWidth} auto; }
            /* MÁGICA AQUI: margin: 0 auto; para centralizar o body no papel */
            html, body { width: ${cfg.bodyWidth} !important; max-width: ${cfg.bodyWidth} !important; margin: 0 auto; background-color: #fff; color: #000; font-family: 'Courier New', Courier, monospace; font-size: ${cfg.fontSizeBase}; line-height: 1.2; }
            .text-center { text-align: center; }
            .divisor { border-top: 1px dashed #000; margin: 6px 0; }
            .bold { font-weight: bold; }
        </style>
    </head>
    <body>
        <div style="padding: 1mm 0;">
            <div class="text-center bold" style="font-size:${cfg.fontSizeTitulo}; margin-bottom: 2px;">${loja}</div>
            ${cnpj ? `<div class="text-center" style="font-size:10px; margin-bottom: 2px;">CNPJ: ${cnpj}</div>` : ""}
            <div class="text-center bold" style="font-size:12px; margin-bottom: 6px;">${dados.tipo || "VENDA"}</div>
            <div class="text-center" style="font-size:9px; margin-bottom: 6px;">DATA: ${new Date(dados.created_at || dados.data || Date.now()).toLocaleString("pt-BR")}</div>
            <div class="divisor"></div>
            ${htmlItens}
            <div style="display:flex; justify-content:space-between; font-size:14px; font-weight:bold; margin-top:6px;">
                <span>TOTAL</span>
                <span>R$ ${window.fmSeguro(dados.total)}</span>
            </div>
            ${pgtoHtml}
            <div class="text-center bold" style="margin-top:12px; font-size:11px;">OBRIGADO PELA PREFERÊNCIA</div>
            <div style="height: ${cfg.espacoGuilhotina};">.</div>
        </div>
    </body>
    </html>`;

  window.imprimirConteudoIframe(html, `Cupom_${loja}`);
};

window.imprimirComprovanteModal = function () {
  if (window.dadosComprovanteAtual) {
    window.imprimirTicketVenda(window.dadosComprovanteAtual);
    window.fecharModalImpressaoComprovante();
  } else {
    if (typeof showToast === "function")
      showToast("Dados da venda não encontrados.", "erro");
  }
};

window.fecharModalImpressaoComprovante = function () {
  const modal = document.getElementById("modal-confirmacao-impressao");
  if (modal) {
    modal.classList.add("hidden");
    modal.classList.remove("flex");
  }
};

window.imprimirComprovanteDespesa = function (id) {
  const cfg = obterConfiguracoesImpressora();
  _supabase
    .from("despesas")
    .select("*")
    .eq("id", id)
    .single()
    .then(({ data: d }) => {
      if (!d) return;
      const html = `<html><head><style>@page { size: ${cfg.pageWidth} auto; margin: 0; } body { width: ${cfg.bodyWidth}; margin: 0 auto; padding: 2mm 0; font-family: 'Courier New', monospace; font-size: ${cfg.fontSizeBase}; }</style></head>
        <body><div style="text-align:center"><b>${localStorage.getItem("nomeLoja") || "ESPETINHO"}</b><br>COMPROVANTE DE DESPESA<br>------------------</div>
        DESC: ${d.descricao}<br>CATEG: ${d.categoria}<br>STATUS: ${d.paga ? "PAGO" : "EM ABERTO"}<br>
        <div style="text-align:center">------------------<br><b style="font-size:15px;">TOTAL: R$ ${window.fmSeguro(d.valor)}</b></div>
        <div style="height: ${cfg.espacoGuilhotina};">.</div>
        </body></html>`;

      window.imprimirConteudoIframe(html, `Despesa_${id}`);
    });
};

// =========================================================================
// VARIÁVEIS E FUNÇÕES INTERCEPTADORAS DO MODAL DE IMPRESSÃO
// =========================================================================

// Variável global para segurar a venda enquanto o modal está aberto
window.vendaPendenteImpressao = null;

// Função chamada pelo botão da lista de vendas
window.abrirModalImpressao = function(venda) {
    window.vendaPendenteImpressao = venda; // Salva a venda atual
    const inputNome = document.getElementById('input-nome-cliente-avulso');
    
    // Limpa o campo caso tenha resquício da última impressão
    if (inputNome) inputNome.value = ""; 
    
    // Abre o modal
    const modal = document.getElementById('modal-nome-cliente');
    if (modal) modal.classList.remove('hidden');
    
    // Dá foco automático no input para agilizar a digitação
    setTimeout(() => { if (inputNome) inputNome.focus(); }, 100); 
};

window.fecharModalImpressao = function() {
    const modal = document.getElementById('modal-nome-cliente');
    if (modal) modal.classList.add('hidden');
    window.vendaPendenteImpressao = null;
};

// Função que os botões dentro do modal vão chamar
window.confirmarImpressao = function(comNome) {
    if (!window.vendaPendenteImpressao) return;

    if (comNome) {
        const inputNome = document.getElementById('input-nome-cliente-avulso');
        const nomeDigitado = inputNome ? inputNome.value.trim() : "";
        // Se clicar em "Com Nome" mas deixar em branco, não imprime nome
        window.vendaPendenteImpressao.cliente_nome = nomeDigitado || ""; 
    } else {
        // Se clicar em "Sem nome", garante que a propriedade vá vazia
        window.vendaPendenteImpressao.cliente_nome = ""; 
    }

    // Chama a função principal que desenha o ticket com a venda já atualizada
    if (typeof window.imprimirComprovante === 'function') {
        window.imprimirComprovante(window.vendaPendenteImpressao);
    }
    
    // Esconde o modal
    window.fecharModalImpressao();
};

// =========================================================================
// FUNÇÃO PRINCIPAL: IMPRIMIR COMPROVANTE DETALHADO
// =========================================================================
window.imprimirComprovante = function (venda) {
  const cfg = typeof obterConfiguracoesImpressora === 'function' ? obterConfiguracoesImpressora() : { maxChars: 32, tamanho: '80', bodyWidth: '72mm' };
  
  // 1. DADOS CONFIGURÁVEIS (Lendo do localStorage sincronizado com o Banco)
  const loja = localStorage.getItem("nomeLoja") || "ESPETINHO & CIA";
  const cnpj = localStorage.getItem("cnpjLoja") || "";
  const telefone = localStorage.getItem("telefoneLoja") || "";
  const endereco = localStorage.getItem("enderecoLoja") || "";
  const nomeCliente = venda.cliente_nome || ""; // Nome do cliente capturado na venda
  
  const operador = (localStorage.getItem("userName") || "ADMIN").toUpperCase();
  const dataVenda = new Date(venda.data || venda.dataFinalizacao || venda.criado_em || Date.now());
  
  let itensArray = Array.isArray(venda.itens) ? venda.itens : JSON.parse(venda.itens || "[]");
  let qtdTotal = 0;
  itensArray.forEach(i => qtdTotal += Number(i.qtd || 1));

  const formataDinheiro = (v) => typeof window.fmSeguro === 'function' ? window.fmSeguro(v) : Number(v).toFixed(2).replace('.', ',');

  // MODO RAWBT ANDROID (Texto Puro)
  if (window.isRawBTThermalMode && window.isRawBTThermalMode() && /android/.test(navigator.userAgent.toLowerCase())) {
      const alinharCentro = (texto) => {
          const str = String(texto).substring(0, cfg.maxChars);
          return " ".repeat(Math.max(0, Math.floor((cfg.maxChars - str.length) / 2))) + str;
      };
      
      const preencherLinha = (esq, dir) => {
          const espaco = cfg.maxChars - String(esq).length - String(dir).length;
          return String(esq) + (espaco > 0 ? " ".repeat(espaco) : " ") + String(dir);
      };

      let txt = "\n" + (loja ? alinharCentro(loja.toUpperCase()) + "\n" : "");
      if(endereco) txt += alinharCentro(endereco.substring(0, cfg.maxChars)) + "\n";
      if(telefone) txt += alinharCentro("TEL: " + telefone) + "\n";
      if(cnpj) txt += alinharCentro("CNPJ: " + cnpj) + "\n";
      txt += "-".repeat(cfg.maxChars) + "\n";
      if(nomeCliente) txt += "CLIENTE: " + nomeCliente.toUpperCase().substring(0, 20) + "\n";
      txt += "QTD DESC         V.UN   TOTAL\n" + "-".repeat(cfg.maxChars) + "\n";

      itensArray.forEach(item => {
          txt += `${String(item.qtd || 1).padEnd(3, ' ')} ${String(item.nome).substring(0, 12).padEnd(12, ' ')} ${formataDinheiro(item.preco).padStart(6, ' ')} ${formataDinheiro(item.preco * (item.qtd || 1)).padStart(8, ' ')}\n`;
      });
      
      txt += "-".repeat(cfg.maxChars) + "\n";
      txt += preencherLinha("Total Itens", qtdTotal) + "\n";
      txt += "-".repeat(cfg.maxChars) + "\n";
      txt += preencherLinha("VALOR A PAGAR", "R$ " + formataDinheiro(venda.total)) + "\n";
      txt += preencherLinha("PAGAMENTO", (venda.forma_pagamento || "DINHEIRO").toUpperCase()) + "\n";
      txt += "-".repeat(cfg.maxChars) + "\n";
      txt += alinharCentro("- SEM VALOR FISCAL -") + "\n";
      txt += alinharCentro(`PEDIDO: ${venda.id} | OP: ${operador}`) + "\n";
      txt += alinharCentro(`${dataVenda.toLocaleDateString('pt-BR')} ${dataVenda.toLocaleTimeString('pt-BR')}`) + "\n";
      txt += "\n".repeat(cfg.tamanho === "58" ? 3 : 5);

      const textoCodificado = encodeURIComponent(txt);
      window.location.href = `intent:${textoCodificado}#Intent;scheme=rawbt;package=ru.a402d.rawbtprinter;end;`;
      return;
  }

  // MODO WEB HTML (Visual elegante em tabela monoespaçada)
  let html = `
  <div style="width: ${cfg.bodyWidth}; margin: 0 auto; font-family: 'Courier New', Courier, monospace; font-size: 11px; color: #000; line-height: 1.3;">
      <div style="text-align: center; margin-bottom: 8px;">
          ${loja ? `<b style="font-size: 14px;">${loja.toUpperCase()}</b><br>` : ''}
          ${endereco ? endereco.toUpperCase() + '<br>' : ''}
          ${telefone ? 'TEL: ' + telefone + '<br>' : ''}
          ${cnpj ? 'CNPJ: ' + cnpj + '<br>' : ''}
      </div>
      
      <div style="border-top: 1px dashed #000; border-bottom: 1px dashed #000; padding: 4px 0; text-align: center; font-weight: bold; margin-bottom: 5px;">
          COMPROVANTE DE VENDA
      </div>

      ${nomeCliente ? `<div style="margin-bottom: 5px;"><b>CLIENTE:</b> ${nomeCliente.toUpperCase()}</div>` : ''}
      
      <div style="border-bottom: 1px dashed #000; padding-bottom: 4px; margin-bottom: 5px;">
          <div style="display: flex; font-weight: bold;">
              <div style="width: 12%;">QTD</div>
              <div style="width: 48%;">DESCRIÇÃO</div>
              <div style="width: 20%; text-align: right;">V.UN</div>
              <div style="width: 20%; text-align: right;">TOTAL</div>
          </div>
      </div>`;

  itensArray.forEach(item => {
      const totalItem = parseFloat(item.preco) * (item.qtd || 1);
      html += `
          <div style="display: flex; margin-bottom: 2px;">
              <div style="width: 12%;">${item.qtd || 1}</div>
              <div style="width: 48%; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${item.nome.toUpperCase()}</div>
              <div style="width: 20%; text-align: right;">${formataDinheiro(item.preco)}</div>
              <div style="width: 20%; text-align: right;">${formataDinheiro(totalItem)}</div>
          </div>`;
  });

  html += `
      <div style="border-top: 1px dashed #000; margin-top: 5px; padding-top: 5px;">
          <div style="display: flex; justify-content: space-between;">
              <span>Total Itens</span>
              <span>${qtdTotal}</span>
          </div>
          <div style="display: flex; justify-content: space-between; font-size: 13px; font-weight: bold; margin-top: 4px;">
              <span>VALOR A PAGAR</span>
              <span>R$ ${formataDinheiro(venda.total)}</span>
          </div>
          <div style="display: flex; justify-content: space-between; margin-top: 2px;">
              <span>PAGAMENTO</span>
              <span>${(venda.forma_pagamento || 'DINHEIRO').toUpperCase()}</span>
          </div>
      </div>
      <div style="border-top: 1px dashed #000; margin-top: 8px; padding-top: 8px; text-align: center; font-size: 9px;">
          PEDIDO: ${venda.id} | OP: ${operador}<br>
          ${dataVenda.toLocaleDateString('pt-BR')} ${dataVenda.toLocaleTimeString('pt-BR')}<br>
          - SEM VALOR FISCAL -
      </div>
  </div>`;

  if (typeof window.dispararImpressao === 'function') {
      window.dispararImpressao(html, 'original');
  } else {
      console.error("[IMPRESSÃO] Função dispararImpressao não encontrada.");
  }
};

/* ---------------------------------------------------------------------------------
   6. MOTOR DE IMPRESSÃO A4 (RANKINGS E FLUXOS DE ESTOQUE)
   --------------------------------------------------------------------------------- */
window.imprimirRelatorioAtual = async function (tipo = null) {
  const relatorioEstoque = document.getElementById("view-estoque");
  const relatorioFinanceiro = document.getElementById("view-financeiro");
  const relatorioProdutos = document.getElementById("view-produtos");

  if (
    tipo === "produtos" ||
    (relatorioProdutos && !relatorioProdutos.classList.contains("hidden"))
  ) {
    if (typeof window.imprimirPDFProdutos === "function")
      await window.imprimirPDFProdutos();
    return;
  }
  if (
    tipo === "estoque" ||
    (relatorioEstoque && !relatorioEstoque.classList.contains("hidden"))
  ) {
    if (typeof window.imprimirPDFEstoque === "function")
      await window.imprimirPDFEstoque();
    return;
  }
  if (
    tipo === "financeiro" ||
    (relatorioFinanceiro && !relatorioFinanceiro.classList.contains("hidden"))
  ) {
    if (typeof window.imprimirFluxoFinanceiro === "function")
      window.imprimirFluxoFinanceiro();
    return;
  }
  if (tipo === "comandas") {
    if (typeof window.imprimirPDFComandas === "function")
      await window.imprimirPDFComandas();
    return;
  }
  if (tipo === "despesas") {
    if (typeof window.imprimirPDFDespesas === "function")
      await window.imprimirPDFDespesas();
    return;
  }
  window.print();
};

window.imprimirPDFProdutos = async function () {
  const dIni = document.getElementById("data-inicio-rel-produtos")?.value;
  const dFim = document.getElementById("data-fim-rel-produtos")?.value;

  if (!dIni || !dFim) {
    if (typeof showToast === "function")
      showToast("Selecione um período primeiro.", "aviso");
    return;
  }

  if (typeof showToast === "function")
    showToast("GERANDO PDF DO RANKING...", "aviso");

  try {
    const { data: vendas, error } = await _supabase
      .from("historico_vendas")
      .select("itens")
      .gte("created_at", `${dIni}T00:00:00`)
      .lte("created_at", `${dFim}T23:59:59`)
      .neq("status", "cancelada");

    if (error) throw error;

    const contagem = {};
    (vendas || []).forEach((v) => {
      let itensArr = Array.isArray(v.itens)
        ? v.itens
        : JSON.parse(v.itens || "[]");
      itensArr.forEach((i) => {
        const nome = i.nome || "PRODUTO DESCONHECIDO";
        const precoItem = parseFloat(i.preco || 0);
        const qtdItem = parseFloat(i.qtd || i.quantidade || 1);
        if (!nome.toUpperCase().includes("PGTO") && precoItem > 0) {
          contagem[nome] = (contagem[nome] || 0) + qtdItem;
        }
      });
    });

    const ranking = Object.entries(contagem).sort((a, b) => b[1] - a[1]);
    const logoBase64 =
      typeof obterLogoBase64 === "function"
        ? await obterLogoBase64("img/logo.jpg")
        : "";
    const nomeLoja = (
      localStorage.getItem("nomeLoja") || "ESPETINHO & CIA"
    ).toUpperCase();
    const dataEmissao = new Date().toLocaleString("pt-BR");

    const hoje = new Date();
    const nomeArquivo = `${String(hoje.getDate()).padStart(2, "0")}${String(hoje.getMonth() + 1).padStart(2, "0")}${hoje.getFullYear()}_Ranking_Produtos`;

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

    const linhas = ranking
      .map(([nome, qtd], index) => {
        const medalhas = ["🥇", "🥈", "🥉"];
        const icone = medalhas[index] || `${index + 1}º`;
        return `<tr><td class="pos">${icone}</td><td>${nome}</td><td class="qtd">${qtd} UNIDADES</td></tr>`;
      })
      .join("");

    const html = `
            <html>
            <head><title>${nomeArquivo}</title>${estilos}</head>
            <body>
                <div class="header-pdf">
                    <div class="header-info">
                        <h1>${nomeLoja}</h1>
                        <p>Ranking de Produtos Mais Vendidos</p>
                        <small style="color: #94a3b8;">Período: ${new Date(dIni + "T12:00:00").toLocaleDateString("pt-BR")} até ${new Date(dFim + "T12:00:00").toLocaleDateString("pt-BR")}</small>
                    </div>
                    <div class="header-logo"><img src="${logoBase64 || ""}" onerror="this.style.display='none'"></div>
                </div>
                <h3 class="secao-titulo">➔ Desempenho de Vendas</h3>
                <table>
                    <thead><tr><th class="pos">Pos</th><th>Descrição do Produto</th><th class="qtd">Quantidade</th></tr></thead>
                    <tbody>${linhas}</tbody>
                </table>
                <div class="footer-pdf">WebComanda - Emitido em ${dataEmissao}</div>
            </body></html>`;

    window.imprimirConteudoIframe(html, nomeArquivo);
  } catch (e) {
    console.error("Erro PDF Ranking:", e);
  }
};

window.imprimirPDFComandas = async function () {
  let dIni = document.getElementById("data-inicio-comandas")?.value;
  let dFim = document.getElementById("data-fim-comandas")?.value;

  if (!dIni || !dFim) {
    dIni =
      dIni ||
      document.getElementById("data-inicio-fin")?.value ||
      new Date().toISOString().split("T")[0];
    dFim =
      dFim ||
      document.getElementById("data-fim-fin")?.value ||
      new Date().toISOString().split("T")[0];
  }

  if (typeof showToast === "function")
    showToast("GERANDO RELATÓRIO DE VENDAS...", "aviso");

  try {
    const { data: vendas, error } = await _supabase
      .from("historico_vendas")
      .select("*")
      .gte("created_at", `${dIni}T00:00:00`)
      .lte("created_at", `${dFim}T23:59:59`)
      .neq("status", "cancelada")
      .order("created_at", { ascending: true });

    if (error) throw error;

    let totalBruto = 0;
    const pagamentos = {};
    const itensVendidos = {};

    vendas.forEach((v) => {
      totalBruto += parseFloat(v.total || 0);
      const mtd = (
        v.forma_pagamento ||
        v.metodo_pagamento ||
        "NÃO INFORMADO"
      ).toUpperCase();
      pagamentos[mtd] = (pagamentos[mtd] || 0) + parseFloat(v.total || 0);

      let itensArr = Array.isArray(v.itens)
        ? v.itens
        : JSON.parse(v.itens || "[]");
      itensArr.forEach((i) => {
        const nome = i.nome || "PRODUTO";
        const qtd = parseFloat(i.qtd || i.quantidade || 1);
        itensVendidos[nome] = (itensVendidos[nome] || 0) + qtd;
      });
    });

    const linhasComandas = vendas
      .map((v) => {
        const hora = new Date(v.created_at).toLocaleTimeString("pt-BR", {
          hour: "2-digit",
          minute: "2-digit",
        });
        return `<tr><td>${hora}</td><td>${(v.mesa || "BALCÃO").toUpperCase()}</td><td>${(v.forma_pagamento || v.metodo_pagamento || "---").toUpperCase()}</td><td class="text-right">R$ ${parseFloat(v.total || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</td></tr>`;
      })
      .join("");

    const logoBase64 =
      typeof obterLogoBase64 === "function"
        ? await obterLogoBase64("img/logo.jpg")
        : "";
    const nomeLoja = (
      localStorage.getItem("nomeLoja") || "ESPETINHO & CIA"
    ).toUpperCase();
    const hoje = new Date();
    const nomeArquivo = `${String(hoje.getDate()).padStart(2, "0")}${String(hoje.getMonth() + 1).padStart(2, "0")}${hoje.getFullYear()}_Relatorio_Comandas`;

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
                        <small style="color: #94a3b8;">Período: ${new Date(dIni + "T12:00:00").toLocaleDateString("pt-BR")} até ${new Date(dFim + "T12:00:00").toLocaleDateString("pt-BR")}</small>
                    </div>
                    <div class="header-logo"><img src="${logoBase64}" onerror="this.style.display='none'"></div>
                </div>
                <div class="grid-resumo">
                    <div class="card"><label>Faturamento Total</label><b>R$ ${totalBruto.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</b></div>
                    <div class="card" style="border-color: #10b981;"><label>Qtd Comandas</label><b>${vendas.length} Finalizadas</b></div>
                </div>
                <h3 class="secao-titulo">➔ Resumo Financeiro</h3>
                <table><thead><tr><th>Método de Pagamento</th><th class="text-right">Total Recebido</th></tr></thead><tbody>
                    ${Object.entries(pagamentos)
                      .map(
                        ([m, v]) =>
                          `<tr><td>${m}</td><td class="text-right">R$ ${v.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</td></tr>`,
                      )
                      .join("")}
                </tbody></table>
                <h3 class="secao-titulo">➔ Saída Global de Itens</h3>
                <table><thead><tr><th>Descrição do Produto</th><th class="text-right">Quantidade</th></tr></thead><tbody>
                    ${Object.entries(itensVendidos)
                      .sort((a, b) => b[1] - a[1])
                      .map(
                        ([n, q]) =>
                          `<tr><td>${n}</td><td class="text-right">${q} UN</td></tr>`,
                      )
                      .join("")}
                </tbody></table>
                <h3 class="secao-titulo">➔ Relação Detalhada de Comandas</h3>
                <table><thead><tr><th style="width: 60px;">Hora</th><th>Mesa/Cliente</th><th>Pagamento</th><th class="text-right">Total</th></tr></thead><tbody>
                    ${linhasComandas}
                </tbody></table>
                <div class="footer-pdf">WebComanda - Sistema de Gestão Inteligente</div>
            </body></html>`;

    window.imprimirConteudoIframe(html, nomeArquivo);
  } catch (e) {
    console.error(e);
  }
};

window.imprimirFluxoFinanceiro = async function () {
  const dataIni = document.getElementById("data-inicio-fin")?.value;
  const dataFim = document.getElementById("data-fim-fin")?.value;
  const resumoHTML =
    document.getElementById("resumo-financeiro-cards")?.innerHTML || "";
  const listaHTML =
    document.getElementById("conteudo-rel-financeiro")?.innerHTML || "";

  if (!resumoHTML || resumoHTML.includes("Processando")) {
    if (typeof showToast === "function")
      showToast("Aguarde o carregamento dos dados.", "aviso");
    return;
  }

  if (typeof showToast === "function")
    showToast("GERANDO PDF FINANCEIRO...", "aviso");

  let dataStr = "PERÍODO: GERAL";
  if (dataIni && dataFim) {
    const dI = new Date(dataIni + "T12:00:00").toLocaleDateString("pt-BR");
    const dF = new Date(dataFim + "T12:00:00").toLocaleDateString("pt-BR");
    dataStr = dI === dF ? `DATA: ${dI}` : `PERÍODO: ${dI} ATÉ ${dF}`;
  }

  const dataEmissao = new Date().toLocaleString("pt-BR");
  const nomeLoja = (
    localStorage.getItem("nomeLoja") || "ESPETINHO & CIA"
  ).toUpperCase();
  let logoBase64 =
    typeof obterLogoBase64 === "function"
      ? await obterLogoBase64("img/logo.jpg")
      : "";

  const hoje = new Date();
  const nomeArquivo = `${String(hoje.getDate()).padStart(2, "0")}${String(hoje.getMonth() + 1).padStart(2, "0")}${hoje.getFullYear()}_Fluxo_Financeiro`;

  const estilos = `
        <style>
            * { margin: 0; padding: 0; box-sizing: border-box; }
            @page { size: A4 portrait; margin: 15mm; }
            body { font-family: 'Helvetica', Arial, sans-serif; padding: 20px; color: #1e293b; background: #fff !important; line-height: 1.4; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
            .header-pdf { position: relative; border-bottom: 4px solid #e63946; padding-bottom: 20px; margin-bottom: 30px; min-height: 100px; }
            .header-info { padding-right: 110px; }
            .header-info h1 { font-size: 30px; font-weight: 900; font-style: italic; color: #e63946; text-transform: uppercase; margin-bottom: 5px; }
            .header-logo { position: absolute; right: 0; top: 0; }
            .header-logo img { width: 90px; height: 90px; border-radius: 50%; object-fit: cover; border: 4px solid #f1f5f9; }
            .secao-titulo { font-size: 14px; color: #e63946; font-weight: bold; text-transform: uppercase; border-left: 5px solid #e63946; padding-left: 10px; margin: 30px 0 15px 0; }
            .footer-pdf { margin-top: 50px; text-align: center; font-size: 10px; color: #cbd5e1; border-top: 1px solid #f1f5f9; padding-top: 20px; font-style: italic; }
            .shadow-sm, .shadow-lg, .shadow-2xl { box-shadow: none !important; }
            .rounded-2xl, .rounded-xl { border-radius: 8px !important; border: 1px solid #e2e8f0 !important; }
            .bg-slate-900, .bg-slate-800, .dark\\:bg-slate-900 { background-color: #f8fafc !important; }
            .dark\\:text-white, .text-white { color: #1e293b !important; }
            .text-emerald-500 { color: #10b981 !important; font-weight: 900 !important; }
            .text-red-500 { color: #ef4444 !important; font-weight: 900 !important; }
        </style>
    `;

  const cardsHTML =
    typeof resumoCardsLimpos === "function"
      ? resumoCardsLimpos(resumoHTML)
      : resumoHTML;

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
                <div class="header-logo"><img src="${logoBase64 || ""}" onerror="this.style.display='none'"></div>
            </div>
            <h3 class="secao-titulo">➔ Resumo Consolidado</h3>
            <div class="grid grid-cols-3 gap-4 mb-8">${cardsHTML}</div>
            <h3 class="secao-titulo">➔ Detalhamento dos Lançamentos</h3>
            <div class="space-y-2">${listaHTML}</div>
            <div class="footer-pdf">WebComanda - Sistema de Gestão Inteligente</div>
        </body></html>`;

  window.imprimirConteudoIframe(htmlPrint, nomeArquivo);
};

function resumoCardsLimpos(html) {
  return html
    .replace(/onclick="[^"]*"/g, "")
    .replace(/cursor-pointer/g, "")
    .replace(/hover:border-emerald-200/g, "")
    .replace(/hover:border-red-200/g, "");
}

window.imprimirPDFEstoque = async function () {
  if (typeof showToast === "function")
    showToast("GERANDO PDF DE ESTOQUE...", "aviso");

  try {
    const { data: produtos, error } = await _supabase
      .from("produtos")
      .select("*")
      .eq("controlar_estoque", true)
      .order("nome");

    if (error || !produtos) throw error;

    const operador = (
      localStorage.getItem("userName") || "ADMIN"
    ).toUpperCase();
    const dataEmissao = new Date().toLocaleString("pt-BR");
    const nomeLoja = (
      localStorage.getItem("nomeLoja") || "ESPETINHO & CIA"
    ).toUpperCase();
    let logoBase64 =
      typeof obterLogoBase64 === "function"
        ? await obterLogoBase64("img/logo.jpg")
        : "";

    const hoje = new Date();
    const nomeArquivo = `${String(hoje.getDate()).padStart(2, "0")}${String(hoje.getMonth() + 1).padStart(2, "0")}${hoje.getFullYear()}_Relatorio_Estoque`;

    const estilos = `
            <style>
                * { margin: 0; padding: 0; box-sizing: border-box; }
                body { font-family: 'Helvetica', Arial, sans-serif; padding: 40px; color: #1e293b; background: #fff; line-height: 1.4; }
                .header-pdf { position: relative; border-bottom: 4px solid #e63946; padding-bottom: 20px; margin-bottom: 30px; min-height: 100px; }
                .header-info h1 { font-size: 30px; font-weight: 900; font-style: italic; color: #e63946; text-transform: uppercase; margin-bottom: 5px; }
                .header-logo { position: absolute; right: 0; top: 0; }
                .header-logo img { width: 90px; height: 90px; border-radius: 50%; object-fit: cover; border: 4px solid #f1f5f9; }
                .secao-titulo { font-size: 14px; color: #e63946; font-weight: bold; text-transform: uppercase; border-left: 5px solid #e63946; padding-left: 10px; margin: 30px 0 15px 0; }
                table { width: 100%; border-collapse: collapse; font-size: 11px; margin-bottom: 25px; }
                th { background: #f1f5f9; padding: 12px; text-align: left; text-transform: uppercase; color: #64748b; border-bottom: 1px solid #e2e8f0; }
                td { padding: 12px; border-bottom: 1px solid #f1f5f9; color: #334155; font-weight: bold; }
                .text-right { text-align: right; }
                .text-center { text-align: center; }
                .footer-pdf { margin-top: 50px; text-align: center; font-size: 10px; color: #cbd5e1; border-top: 1px solid #f1f5f9; padding-top: 20px; font-style: italic; }
            </style>
        `;

    let linhasTabela = produtos
      .map((p) => {
        const qtd = parseFloat(p.estoque_atual || 0);
        const alerta =
          qtd <= 5
            ? '<span style="color:#ef4444; font-size:9px; font-weight:900; margin-left:6px;">(BAIXO)</span>'
            : "";
        const corQtd = qtd <= 5 ? "color:#ef4444;" : "color:#15803d;";

        return `<tr><td class="text-center" style="font-weight: 900; ${corQtd} font-size: 13px;">${qtd}</td><td>${p.nome.toUpperCase()} ${alerta}</td><td>${(p.categoria || "N/A").toUpperCase()}</td><td class="text-right" style="color: #64748b;">R$ ${window.fmSeguro(p.preco_custo || 0)}</td><td class="text-right">R$ ${window.fmSeguro(p.preco || 0)}</td></tr>`;
      })
      .join("");

    const html = `
        <!DOCTYPE html>
        <html>
        <head><title>${nomeArquivo}</title>${estilos}</head>
        <body>
            <div class="header-pdf">
                <div class="header-info">
                    <h1>${nomeLoja}</h1>
                    <p>Relatório de Posição de Estoque</p>
                    <small style="color: #94a3b8;">Emitido em: ${dataEmissao} &nbsp;|&nbsp; Operador: ${operador}</small>
                </div>
                <div class="header-logo"><img src="${logoBase64 || ""}" onerror="this.style.display='none'"></div>
            </div>
            <h3 class="secao-titulo">➔ Inventário Atual</h3>
            <table><thead><tr><th style="width: 10%" class="text-center">QTD</th><th style="width: 40%">DESCRIÇÃO</th><th style="width: 20%">CATEGORIA</th><th style="width: 15%" class="text-right">PREÇO CUSTO</th><th style="width: 15%" class="text-right">PREÇO VENDA</th></tr></thead><tbody>${linhasTabela}</tbody></table>
            <div class="footer-pdf">WebComanda - Sistema de Gestão Inteligente</div>
        </body></html>`;

    window.imprimirConteudoIframe(html, nomeArquivo);
  } catch (err) {
    console.error("Erro ao gerar PDF:", err);
  }
};

// FORMATO 3: Reimpressão de Comandas Antigas (Histórico)
window.reimprimirComanda = async function (id) {
  const cfg = obterConfiguracoesImpressora();
  try {
    const { data: m, error } = await _supabase
      .from("comandas")
      .select("*")
      .eq("id", id)
      .single();
    if (error || !m) throw new Error("Comanda não encontrada.");

    const loja = localStorage.getItem("nomeLoja") || "ESPETINHO E CIA";
    const cnpj = localStorage.getItem("empresa_cnpj") || "";
    const itens = typeof m.itens === "string" ? JSON.parse(m.itens) : m.itens;
    const dataF = new Date(m.fechada_em);
    const dataFormatada =
      dataF.toLocaleDateString("pt-BR") +
      " " +
      dataF.toLocaleTimeString("pt-BR");

    // --- ROTA TEXTO RAWBT ANDROID (REIMPRESSÃO ADAPTÁVEL) ---
    if (
      window.isRawBTThermalMode() &&
      /android/.test(navigator.userAgent.toLowerCase())
    ) {
      const alinharCentro = (texto) => {
        const str = String(texto).substring(0, cfg.maxChars);
        return (
          " ".repeat(Math.max(0, Math.floor((cfg.maxChars - str.length) / 2))) +
          str
        );
      };
      const alinharLados = (esq, dir) => {
        const strEsq = String(esq);
        const strDir = String(dir);
        const espacosLivres = cfg.maxChars - strEsq.length - strDir.length;
        if (espacosLivres > 0)
          return strEsq + " ".repeat(espacosLivres) + strDir;
        return (
          strEsq.substring(0, cfg.maxChars - strDir.length - 1) + " " + strDir
        );
      };

      let textoRaw = "\n";
      textoRaw += alinharCentro(loja) + "\n";
      if (cnpj) textoRaw += alinharCentro(`CNPJ: ${cnpj}`) + "\n";
      textoRaw += "-".repeat(cfg.maxChars) + "\n";
      textoRaw +=
        alinharCentro(`2 VIA - ${m.identificacao.toUpperCase()}`) + "\n";
      textoRaw += alinharLados("DATA:", dataFormatada) + "\n";
      textoRaw += "-".repeat(cfg.maxChars) + "\n\n";

      itens.forEach((item) => {
        const precoStr = (parseFloat(item.preco) * item.qtd)
          .toFixed(2)
          .replace(".", ",");
        textoRaw +=
          alinharLados(
            `${item.qtd}x ${item.nome.toUpperCase()}`,
            `R$ ${precoStr}`,
          ) + "\n";
        if (item.detalhes || item.observacao) {
          const obsLimpa = (item.detalhes || item.observacao).replace(
            /<br>/g,
            " | ",
          );
          textoRaw += `   OBS: ${obsLimpa}\n`;
        }
      });

      textoRaw += "\n" + "-".repeat(cfg.maxChars) + "\n";
      textoRaw +=
        alinharLados(
          "TOTAL:",
          `R$ ${parseFloat(m.total).toFixed(2).replace(".", ",")}`,
        ) + "\n";
      textoRaw += "-".repeat(cfg.maxChars) + "\n";
      textoRaw +=
        alinharLados("PAGAMENTO:", m.forma_pagamento || "DINHEIRO") + "\n";
      textoRaw +=
        "\n" +
        alinharCentro("OBRIGADO PELA PREFERENCIA") +
        "\n".repeat(cfg.tamanho === "58" ? 4 : 6);

      const textoCodificado = encodeURIComponent(textoRaw);
      window.location.href = `intent:${textoCodificado}#Intent;scheme=rawbt;package=ru.a402d.rawbtprinter;end;`;
      return;
    }

    // --- ROTA NAVEGADOR WEB (REIMPRESSÃO ADAPTÁVEL) ---
    let html = `
            <div style="font-family: 'Courier New', Courier, monospace; width: ${cfg.bodyWidth}; padding: 0; color: #000; margin: 0 auto;">
                <div style="text-align: center; margin-bottom: 10px;">
                    <div style="font-size: ${cfg.fontSizeTitulo}; font-weight: bold;">${loja}</div>
                    ${cnpj ? `<div style="font-size: 11px; text-align: center;">CNPJ: ${cnpj}</div>` : ""}
                    <div style="font-size: 13px; font-weight: bold; margin-top: 4px;">2ª VIA - ${m.identificacao.toUpperCase()}</div>
                    <div style="font-size: 10px; margin-top: 4px;">DATA: ${dataFormatada}</div>
                </div>
                <div style="border-top: 1px dashed #000; margin: 5px 0;"></div>
                <div style="margin-top: 10px;">
                    ${itens
                      .map((item) => {
                        const obsHtml =
                          item.detalhes || item.observacao
                            ? `<div style="font-size: 11px; margin-top: 2px; padding-left: 5px; font-style: italic;">Obs: ${item.detalhes || item.observacao}</div>`
                            : "";
                        return `
                        <div style="margin-bottom: 8px;">
                            <div style="display: flex; justify-content: space-between; font-size: 13px; font-weight: bold;">
                                <span>${item.qtd}X ${item.nome.toUpperCase()}</span>
                                <span>R$ ${(parseFloat(item.preco) * item.qtd).toFixed(2).replace(".", ",")}</span>
                            </div>
                            ${obsHtml}
                            <div style="border-top: 1px dashed #eee; margin-top: 4px;"></div>
                        </div>`;
                      })
                      .join("")}
                </div>
                <div style="margin-top: 15px; border-top: 2px dashed #000; padding-top: 8px;">
                    <div style="display: flex; justify-content: space-between; font-size: 16px; font-weight: bold;">
                        <span>TOTAL</span>
                        <span>R$ ${parseFloat(m.total).toFixed(2).replace(".", ",")}</span>
                    </div>
                </div>
                <div style="margin-top: 10px; font-size: 11px;"><b>PAGAMENTO:</b> ${m.forma_pagamento || "DINHEIRO"}</div>
                <div style="border-top: 1px dashed #000; margin: 15px 0 5px 0;"></div>
                <div style="text-align: center; font-size: 12px; font-weight: bold; margin-top: 10px;">OBRIGADO PELA PREFERÊNCIA</div>
                <div style="height: ${cfg.espacoGuilhotina};">.</div>
            </div>`;

    window.imprimirConteudoIframe(html, `Reimpressao_Comanda_${id}`);
  } catch (e) {
    console.error("Erro na reimpressão:", e);
  }
};

function imprimirConteudoHTML(conteudo) {
  window.imprimirConteudoIframe(conteudo, "Reimpressao_Comanda");
}
