// ==========================================
// MÓDULO ADMINISTRATIVO: GESTÃO DE EVENTOS
// ==========================================
// 1. Variáveis globais de controle para memória
window.listaReservasLocal = [];
window.filtroStatusAtual = "todas";
window.eventoIdAtivo = null;

document.addEventListener("DOMContentLoaded", () => {
  carregarEventosAdmin();
});

// ==========================================
// 1. CARREGAMENTO E LISTAGEM
// ==========================================
window.carregarEventosAdmin = async function () {
  try {
    const { data: eventos, error } = await _supabase
      .from("eventos")
      .select("*")
      .order("data_evento", { ascending: true });

    if (error) throw error;

    // Salva na variável global para o filtro usar depois
    window.listaEventosCompleta = eventos || [];

    // Chama o filtro para renderizar pela primeira vez
    window.filtrarEventos();
  } catch (error) {
    console.error("Erro ao carregar eventos:", error);
  }
};

// ==========================================
// FILTRO DE EVENTOS ATIVOS / TODOS
// ==========================================
window.filtrarEventos = function () {
  const checkboxAtivos = document.getElementById("filtro-ativos");
  const apenasAtivos = checkboxAtivos ? checkboxAtivos.checked : true;

  if (!window.listaEventosCompleta) return;

  // Filtra a lista baseada no status
  const eventosFiltrados = apenasAtivos
    ? window.listaEventosCompleta.filter((ev) => ev.status === "ativo")
    : window.listaEventosCompleta;

  // Envia a lista filtrada para o motor que desenha os cards na tela
  if (typeof window.renderizarCardsEventos === 'function') {
      window.renderizarCardsEventos(eventosFiltrados);
  } else {
      console.error("Função renderizarCardsEventos não encontrada!");
  }
};

// Este é o "motor" que desenha os cards na tela.
window.renderizarCardsEventos = function (eventos) {
  const container = document.getElementById("lista-eventos-admin");
  if (!container) {
    console.error("Elemento 'lista-eventos-admin' não encontrado no HTML!");
    return;
  }

  // Limpa o conteúdo atual
  container.innerHTML = "";

  if (!eventos || eventos.length === 0) {
    container.innerHTML =
      '<div class="col-span-full p-8 text-center text-slate-400 font-bold bg-white dark:bg-slate-900 rounded-[2rem] border border-dashed border-slate-300 dark:border-slate-700">Nenhum evento encontrado.</div>';
    return;
  }

  // Renderiza os novos cards
  container.innerHTML = eventos
    .map((ev) => {
      const dataFormatada = new Date(ev.data_evento).toLocaleString("pt-BR", {
        dateStyle: "short",
        timeStyle: "short",
      });
      const valorFormatado = parseFloat(ev.valor_mesa).toLocaleString("pt-BR", {
        style: "currency",
        currency: "BRL",
      });
      const nomeEscapado = ev.nome.replace(/'/g, "\\'");

      return `
            <div class="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-[2rem] p-6 shadow-sm flex flex-col justify-between">
                <div>
                    <div class="flex justify-between items-start mb-2">
                        <h4 class="font-black text-lg text-slate-800 dark:text-white uppercase tracking-tighter leading-tight">${ev.nome}</h4>
                        <span class="text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-full ${ev.status === "ativo" ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700"}">
                            ${ev.status}
                        </span>
                    </div>
                    <p class="text-xs font-bold text-slate-500 mb-1">📅 ${dataFormatada}</p>
                    <p class="text-xs font-bold text-slate-500 mb-4">💰 ${valorFormatado} / Mesa</p>
                </div>
                
                <div class="flex gap-2 mt-4 pt-4 border-t border-slate-100 dark:border-slate-800">
                    <button onclick="window.abrirGestaoReservas('${ev.id}', '${nomeEscapado}')" class="btn-success relative flex-1">
                        Reservas
                        <span id="badge-pendencia-${ev.id}" class="hidden absolute -top-2 -right-2 bg-red-500 text-white text-[9px] font-black px-1.5 py-0.5 rounded-full animate-bounce">0</span>
                    </button>
                    <button onclick="window.abrirGerenciamentoEvento('${ev.id}', '${nomeEscapado}')" class="btn-neutral flex-1">⚙️ Gerenciar</button>
                </div>
                <div class="mt-3">
                    <button onclick="window.copiarLinkEvento('${ev.id}')" class="btn-info w-full">🔗 Copiar Link Público</button>
                </div>
            </div>`;
    })
    .join("");

  // Dispara a atualização dos badges após renderizar
  if (typeof window.atualizarTodosOsBadges === "function") {
    window.atualizarTodosOsBadges();
  }
};


// Quando carregar a página inicialmente:
// 1. Busque do Supabase
// 2. Salve: window.listaEventosCompleta = dadosDoSupabase;
// 3. Chame: window.filtrarEventos();

// 2. Função para atualizar os cards do Dashboard Financeiro
window.atualizarDashboardFinanceiro = async function (eventoId) {
  try {
    // Busca os detalhes do evento para saber o valor da mesa e capacidade
    const { data: evento } = await _supabase
      .from("eventos")
      .select("quantidade_mesas, valor_mesa")
      .eq("id", eventoId)
      .single();
    if (!evento) return;

    const valorMesa = parseFloat(evento.valor_mesa) || 0;
    const capacidade = parseInt(evento.quantidade_mesas) || 0;

    let mesasOcupadas = 0;
    let receitaGarantida = 0;
    let receitaPendente = 0;

    // Percorre as reservas na memória para calcular
    window.listaReservasLocal.forEach((res) => {
      // Conta quantas mesas tem nessa reserva
      let qtdMesas = 0;
      if (Array.isArray(res.mesas)) qtdMesas = res.mesas.length;
      else if (res.mesas) qtdMesas = 1; // Se for um número único

      // Ignora o valor financeiro se for CORTESIA ou BLOQUEIO técnico
      const isCortesia = res.tipo === "CORTESIA" || res.tipo === "BLOQUEIO";

      if (res.status === "confirmada") {
        mesasOcupadas += qtdMesas;
        if (!isCortesia) receitaGarantida += qtdMesas * valorMesa;
      } else if (res.status === "pendente") {
        if (!isCortesia) receitaPendente += qtdMesas * valorMesa;
      }
    });

    // Injeta os valores na tela
    document.getElementById("dash-capacidade").innerText =
      `${mesasOcupadas} / ${capacidade}`;
    document.getElementById("dash-receita").innerText =
      receitaGarantida.toLocaleString("pt-BR", {
        style: "currency",
        currency: "BRL",
      });
    document.getElementById("dash-pendente").innerText =
      receitaPendente.toLocaleString("pt-BR", {
        style: "currency",
        currency: "BRL",
      });
  } catch (err) {
    console.error("Erro ao gerar dashboard:", err);
  }
};

// ==========================================
// FILTROS E BUSCA EM TEMPO REAL
// ==========================================

window.filtrarReservas = function (status) {
  // Atualiza a variável global que guarda o filtro clicado
  window.filtroStatusAtual = status;
  window.aplicarFiltrosEBusca();
};

window.aplicarFiltrosEBusca = function () {
  // 1. Pega o texto digitado de forma segura
  const inputBusca = document.getElementById("input-busca-reserva");
  const termoBusca = inputBusca ? inputBusca.value.toLowerCase().trim() : "";

  // 2. Filtra a lista que está na memória local
  const reservasFiltradas = window.listaReservasLocal.filter((res) => {
    // --- Regra 1: Filtro de Botões (Todas / Pendentes / Confirmadas) ---
    // Força tudo para minúsculo para garantir que vai achar, independente de como está no banco
    const statusReserva = String(res.status || "").toLowerCase();
    const passaStatus =
      window.filtroStatusAtual === "todas" ||
      statusReserva === window.filtroStatusAtual;

    // --- Regra 2: Filtro de Busca por Texto ---
    // Usa o cliente_nome corretamente
    const nomeCliente = String(
      res.cliente_nome || res.nome || "",
    ).toLowerCase();
    const mesaStr = Array.isArray(res.mesas)
      ? res.mesas.join(", ")
      : String(res.mesas || "");

    // Verifica se o texto digitado bate com o nome ou com o número da mesa
    const passaBusca =
      termoBusca === "" ||
      nomeCliente.includes(termoBusca) ||
      mesaStr.includes(termoBusca);

    // A reserva só aparece na tela se passar nas duas regras
    return passaStatus && passaBusca;
  });

  // 3. Manda a lista já filtrada para desenhar na tela
  window.desenharCardsReservas(reservasFiltradas);
};

window.copiarLinkEvento = function (id) {
  // 1. Pega o caminho atual da URL (ex: /projeto-espetinhoecia/painel.html)
  const pathParts = window.location.pathname.split("/");

  // 2. Remove o nome do arquivo atual para ficar apenas com a pasta
  pathParts.pop();

  // 3. Reconstrói o caminho completo da base + o arquivo correto
  const baseUrl =
    window.location.origin + pathParts.join("/") + "/reserva.html";

  const link = `${baseUrl}?e=${id}`;

  // 4. Copia para o clipboard
  navigator.clipboard.writeText(link).then(() => {
    if (window.showToast)
      window.showToast("Link copiado para a área de transferência!", "sucesso");
    else alert("Link copiado!");
  });
};

window.atualizarTodosOsBadges = async function () {
  try {
    // Busca todas as reservas pendentes de todos os eventos de uma vez
    const { data: reservas, error } = await _supabase
      .from("reservas_evento")
      .select("evento_id, status")
      .eq("status", "pendente");

    if (error) throw error;

    // Limpa todos os contadores primeiro (esconde todos)
    document
      .querySelectorAll('[id^="badge-pendencia-"]')
      .forEach((el) => el.classList.add("hidden"));

    // Preenche apenas os que possuem pendências
    reservas.forEach((res) => {
      const badge = document.getElementById(`badge-pendencia-${res.evento_id}`);
      if (badge) {
        // Incrementa o contador
        let atual = parseInt(badge.innerText) || 0;
        badge.innerText = atual + 1;
        badge.classList.remove("hidden");
      }
    });
  } catch (err) {
    console.error("Erro ao atualizar badges:", err);
  }
};

// ==========================================
// 2. CRIAÇÃO DE NOVO EVENTO E CONTROLE DO MODAL
// ==========================================

window.abrirModalNovoEvento = function () {
  document.getElementById("modal-novo-evento").classList.remove("hidden");
};

window.fecharModalNovoEvento = function () {
  document.getElementById("modal-novo-evento").classList.add("hidden");
  document.getElementById("form-novo-evento").reset();
};

window.salvarNovoEvento = async function (e) {
  e.preventDefault();
  const btn = document.getElementById("btn-salvar-evento");
  btn.disabled = true;
  btn.innerText = "CRIANDO...";

  try {
    const valorTexto = document.getElementById("ev-valor").value;
    const valorNumerico = parseFloat(
      valorTexto.replace("R$", "").replace(/\./g, "").replace(",", ".").trim(),
    );

    if (isNaN(valorNumerico)) throw new Error("Valor da mesa inválido.");

    let mapaUrl = null;
    const fileInput = document.getElementById("ev-mapa");

    if (fileInput.files.length > 0) {
      const file = fileInput.files[0];
      const path = `mapas/${Date.now()}_${file.name}`;
      const { error: uploadError } = await _supabase.storage
        .from("eventos")
        .upload(path, file);
      if (uploadError) throw uploadError;

      const { data } = _supabase.storage.from("eventos").getPublicUrl(path);
      mapaUrl = data.publicUrl;
    }

    const novoEvento = {
      nome: document.getElementById("ev-nome").value,
      data_evento: document.getElementById("ev-data").value,
      valor_mesa: valorNumerico,
      quantidade_mesas: parseInt(document.getElementById("ev-qtd-mesas").value),
      mapa_url: mapaUrl,
      status: "ativo",
    };

    const { error } = await _supabase.from("eventos").insert([novoEvento]);
    if (error) throw error;

    if (window.showToast)
      window.showToast("Evento criado com sucesso!", "sucesso");

    document.getElementById("form-novo-evento").reset();
    window.fecharModalNovoEvento();
    window.carregarEventosAdmin();
  } catch (error) {
    console.error("Erro ao criar evento:", error);
    if (window.showToast) window.showToast("Erro: " + error.message, "erro");
  } finally {
    btn.disabled = false;
    btn.innerText = "CRIAR EVENTO";
  }
};

// ==========================================
// 3. GESTÃO DE RESERVAS (APROVAÇÃO E LISTAGEM)
// ==========================================
window.abrirGestaoReservas = function (id, nome) {
  window.eventoIdAtivo = id;
  document.getElementById("modal-reserva-evento-nome").innerText =
    `RESERVAS: ${nome}`;
  document.getElementById("modal-gestao-reservas").classList.remove("hidden");
  window.atualizarListaSolicitacoes();
};

window.fecharModalReservas = function () {
  window.eventoIdAtivo = null;
  document.getElementById("modal-gestao-reservas").classList.add("hidden");
};

// 1. A função que busca no Supabase e alimenta o sistema
window.atualizarListaSolicitacoes = async function () {
  const container = document.getElementById("lista-solicitacoes-reservas");
  if (container) {
    container.innerHTML =
      '<div class="text-center text-sm font-bold py-8 text-slate-400 italic animate-pulse">Carregando solicitações...</div>';
  }

  try {
    // Busca todas as reservas deste evento no banco
    const { data: reservas, error } = await _supabase
      .from("reservas_evento")
      .select("*")
      .eq("evento_id", window.eventoIdAtivo)
      .order("created_at", { ascending: false });

    if (error) throw error;

    // Guarda os dados na memória global para a busca ser instantânea
    window.listaReservasLocal = reservas || [];

    // Atualiza os valores de dinheiro e ocupação lá em cima
    if (window.atualizarDashboardFinanceiro) {
      window.atualizarDashboardFinanceiro(window.eventoIdAtivo);
    }

    // Aplica os filtros (que por padrão vai mostrar todas) e desenha na tela
    if (window.aplicarFiltrosEBusca) {
      window.aplicarFiltrosEBusca();
    }
  } catch (err) {
    console.error("Erro ao carregar reservas:", err);
    if (container) {
      container.innerHTML =
        '<div class="text-center text-red-500 font-bold py-8">Erro ao carregar reservas.</div>';
    }
  }
};

// 2. A função que desenha os cards na tela (chamada pela busca)
window.desenharCardsReservas = function (reservas) {
  const container = document.getElementById("lista-solicitacoes-reservas");
  if (!container) return;

  if (!reservas || reservas.length === 0) {
    container.innerHTML =
      '<div class="text-center text-sm font-bold py-8 text-slate-400 italic">Nenhuma reserva encontrada para este filtro.</div>';
    return;
  }

  container.innerHTML = reservas
    .map((res) => {
      const isConfirmada = res.status === "confirmada";

      // Cores fixas (sem dark:) para garantir modo claro sempre
      const statusClass = isConfirmada
        ? "bg-emerald-100 text-emerald-700"
        : "bg-amber-100 text-amber-700";

      const mesaStr = Array.isArray(res.mesas)
        ? res.mesas.join(", ")
        : String(res.mesas || "");

      const nomeCliente = res.cliente_nome || "SEM NOME";
      const telefoneCliente = res.cliente_telefone || "";
      const telefoneInfo = telefoneCliente
        ? `<p class="text-[9px] md:text-[10px] font-bold text-slate-400 uppercase mt-1 truncate">WPP: ${telefoneCliente}</p>`
        : "";

      // --- AJUSTE APLICADO AQUI: Prepara os dados para o Modal ---
      const nomeEscapado = nomeCliente.replace(/'/g, "\\'");
      const arrayStringMap = JSON.stringify(res.mesas || []).replace(/"/g, "'");

      const botaoAprovar = !isConfirmada
        ? `
            <button onclick="window.abrirModalAcaoPendente('${res.id}', '${nomeEscapado}', ${arrayStringMap})" class="flex-1 sm:flex-none w-full bg-emerald-500 hover:bg-emerald-600 text-white font-black text-[9px] uppercase tracking-widest py-2.5 sm:py-2 px-1 rounded-lg shadow-sm transition-all active:scale-95 text-center">
                Aprovar
            </button>
        `
        : "";
      // -----------------------------------------------------------

      const botaoCancelar = `
            <button onclick="window.excluirReserva('${res.id}')" class="flex-1 sm:flex-none w-full bg-red-500 hover:bg-red-600 text-white font-black text-[9px] uppercase tracking-widest py-2.5 sm:py-2 px-1 rounded-lg shadow-sm transition-all active:scale-95 text-center">
                Cancelar
            </button>
        `;

      const botaoComprovante = res.comprovante_url
        ? `
            <button onclick="window.verComprovante('${res.comprovante_url}')" class="flex-1 sm:flex-none w-full bg-slate-100 text-slate-600 hover:bg-slate-200 font-black text-[9px] uppercase tracking-widest py-2.5 sm:py-2 px-1 rounded-lg transition-all text-center">
                Ver PIX
            </button>
        `
        : "";

      return `
        <div class="bg-white p-4 rounded-xl md:rounded-2xl border border-slate-200 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 md:gap-4 animate-fade-in shadow-sm hover:shadow-md transition-shadow">
            
            <div class="flex-1 min-w-0 w-full">
                <div class="flex items-center justify-between sm:justify-start gap-2 mb-1 flex-wrap">
                    <h5 class="font-black text-sm md:text-base text-slate-800 uppercase tracking-tight leading-none truncate" title="${nomeCliente}">${nomeCliente}</h5>
                    <span class="text-[8px] md:text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md ${statusClass} shrink-0">
                        ${res.status}
                    </span>
                </div>
                ${telefoneInfo}
                <div class="mt-2 md:mt-3 bg-slate-50 inline-block px-3 py-1.5 rounded-lg border border-slate-100">
                    <p class="text-[10px] md:text-xs font-bold text-slate-500 uppercase tracking-wide">Mesa(s): <span class="text-emerald-600 font-black text-sm md:text-base ml-1">${mesaStr}</span></p>
                </div>
                ${res.tipo ? `<p class="text-[8px] md:text-[9px] font-black text-indigo-500 uppercase mt-2 tracking-wider">${res.tipo}</p>` : ""}
            </div>
            
            <div class="flex flex-row sm:flex-col gap-2 w-full sm:w-[90px] border-t sm:border-t-0 sm:border-l border-slate-100 pt-3 sm:pt-0 sm:pl-3 mt-2 sm:mt-0 shrink-0">
                ${botaoAprovar}
                ${botaoCancelar}
                ${botaoComprovante}
            </div>
            
        </div>`;
    })
    .join("");
};

window.abrirComprovante = function (url) {
  document.getElementById("img-comprovante-preview").src = url;
  document.getElementById("modal-ver-comprovante").classList.remove("hidden");
};

window.fecharModalComprovante = function () {
  document.getElementById("modal-ver-comprovante").classList.add("hidden");
  document.getElementById("img-comprovante-preview").src = "";
};

window.processarStatusReserva = async function (reservaId, status) {
  try {
    // 1. Atualiza o banco
    const { data: reserva, error } = await _supabase
      .from("reservas_evento")
      .update({ status: status })
      .eq("id", reservaId)
      .select("cliente_nome, cliente_telefone, mesas") // Busca dados para enviar a msg
      .single();

    if (error) throw error;

    if (window.showToast)
      window.showToast("Reserva aprovada com sucesso!", "sucesso");

    // 2. DISPARA MENSAGEM PARA O CLIENTE
    if (status === "confirmada" && reserva.cliente_telefone) {
      const numeroCliente = reserva.cliente_telefone.replace(/\D/g, "");
      const msg = `Olá, *${reserva.cliente_nome}*! Sua reserva para as mesas *${reserva.mesas.join(", ")}* foi CONFIRMADA com sucesso pelo Espetinho & Cia. Nos vemos lá!`;
      const link = `https://wa.me/55${numeroCliente}?text=${encodeURIComponent(msg)}`;
      window.open(link, "_blank");
    }

    window.atualizarListaSolicitacoes();
  } catch (err) {
    console.error(err);
    if (window.showToast) window.showToast("Erro ao aprovar reserva.", "erro");
  }
};

window.imprimirListaReservas = async function () {
  if (!window.eventoIdAtivo) return;

  if (window.showToast)
    window.showToast("Gerando lista de impressão...", "aviso");

  try {
    // Pega o nome do evento que está na tela
    const nomeEvento = document
      .getElementById("modal-reserva-evento-nome")
      .innerText.replace("RESERVAS: ", "");

    // Busca as reservas E a quantidade de mesas do evento ao mesmo tempo
    const [{ data: evento }, { data: reservas, error }] = await Promise.all([
      _supabase
        .from("eventos")
        .select("quantidade_mesas")
        .eq("id", String(window.eventoIdAtivo))
        .single(),
      _supabase
        .from("reservas_evento")
        .select("*")
        .eq("evento_id", String(window.eventoIdAtivo)),
    ]);

    if (error) throw error;

    // Descobre quantas mesas o evento tem (se falhar, pega pelo menos até a maior mesa reservada)
    let totalMesas =
      evento && evento.quantidade_mesas ? parseInt(evento.quantidade_mesas) : 0;

    // Mapeia as reservas para organizar por número da mesa
    let mapaReservas = {};
    let maiorMesaReservada = 0;

    if (reservas) {
      reservas.forEach((res) => {
        // MELHORIA 2: Limpa o nome removendo tudo que estiver entre parênteses (ex: " (DIRETA)")
        let nomeLimpo = res.cliente_nome
          ? res.cliente_nome.replace(/\s*\(.*?\)/g, "").trim()
          : "";

        // MELHORIA 3: Limpa o telefone falso de admin
        let telefoneLimpo = res.cliente_telefone || "";
        if (
          telefoneLimpo.toUpperCase() === "MANUAL - ADMIN" ||
          telefoneLimpo === "N/A"
        ) {
          telefoneLimpo = ""; // Fica em branco
        }

        if (Array.isArray(res.mesas)) {
          res.mesas.forEach((mesa) => {
            let num = parseInt(mesa);
            if (!isNaN(num)) {
              if (num > maiorMesaReservada) maiorMesaReservada = num;

              // Adiciona no mapa (se já tiver, só sobrescreve se for 'confirmada')
              if (!mapaReservas[num] || res.status === "confirmada") {
                mapaReservas[num] = {
                  cliente: nomeLimpo,
                  telefone: telefoneLimpo,
                  status: res.status,
                };
              }
            }
          });
        }
      });
    }

    // Se por acaso a capacidade não foi configurada, imprime pelo menos até a última mesa ocupada
    if (totalMesas === 0) totalMesas = maiorMesaReservada;

    // MELHORIA 1 e 4: Constrói a tabela organizando as linhas vazias e ocupadas
    let linhasTabela = "";
    for (let i = 1; i <= totalMesas; i++) {
      const numStr = String(i).padStart(2, "0");

      if (mapaReservas[i]) {
        const item = mapaReservas[i];
        linhasTabela += `
                    <tr>
                        <td style="font-weight: 900; text-align: center; font-size: 16px; color: #000;">${numStr}</td>
                        <td style="font-weight: bold; color: #1e293b;">${item.cliente.toUpperCase()}</td>
                        <td style="font-weight: bold; color: #475569;">${item.telefone || "-"}</td>
                        <td class="status-${item.status}">${item.status.toUpperCase()}</td>
                    </tr>
                `;
      } else {
        // Mesa Livre (Fica em branco com fundo levemente cinza)
        linhasTabela += `
                    <tr style="background-color: #f8fafc;">
                        <td style="font-weight: 900; text-align: center; font-size: 16px; color: #94a3b8;">${numStr}</td>
                        <td></td>
                        <td></td>
                        <td style="color: #cbd5e1; font-weight: bold; font-style: italic;">LIVRE</td>
                    </tr>
                `;
      }
    }

    // Preparação para Impressão Segura (Iframe invisível)
    const dataHoje = new Date().toLocaleDateString("pt-BR");
    const tituloOriginal = document.title;
    document.title = `Lista_${nomeEvento.replace(/\s+/g, "_")}_${dataHoje.replace(/\//g, "-")}`;

    let iframeAntigo = document.getElementById("iframe-impressao-lista");
    if (iframeAntigo) iframeAntigo.remove();

    let iframe = document.createElement("iframe");
    iframe.id = "iframe-impressao-lista";
    iframe.style.position = "absolute";
    iframe.style.width = "0px";
    iframe.style.height = "0px";
    iframe.style.border = "none";
    document.body.appendChild(iframe);

    const baseUrl =
      window.location.origin +
      window.location.pathname.substring(
        0,
        window.location.pathname.lastIndexOf("/") + 1,
      );

    const cssModerno = `
            @page { size: A4 portrait; margin: 15mm; }
            * { margin: 0; padding: 0; box-sizing: border-box; }
            body { background: #fff; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; color: #1e293b; }
            .header-pdf { display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; border-bottom: 2px solid #f1f5f9; padding-bottom: 15px; }
            .header-info h1 { font-size: 22px; color: #1e293b; text-transform: uppercase; margin-bottom: 5px; font-weight: 900; }
            .header-info p { color: #64748b; font-size: 12px; font-weight: bold; text-transform: uppercase; }
            .header-logo img { width: 70px; height: 70px; object-fit: cover; border-radius: 12px; }
            
            table { width: 100%; border-collapse: collapse; margin-top: 10px; }
            th { background: #fff; color: #1e293b; text-transform: uppercase; font-size: 11px; padding: 12px 8px; text-align: left; border-bottom: 2px solid #e2e8f0; font-weight: 900; letter-spacing: 1px; }
            td { border-bottom: 1px solid #f1f5f9; padding: 12px 8px; font-size: 13px; text-transform: uppercase; }
            
            .status-confirmada { color: #059669; font-weight: 900; }
            .status-pendente { color: #d97706; font-weight: 900; }
        `;

    const html = `<!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
            <base href="${baseUrl}">
            <style>${cssModerno}</style>
        </head>
        <body>
            <div class="header-pdf">
                <div class="header-info">
                    <h1>${nomeEvento}</h1>
                    <p>Controle Geral de Mesas</p>
                    <small style="color: #94a3b8; font-size: 10px;">Emitido em: ${new Date().toLocaleString("pt-BR")}</small>
                </div>
                <div class="header-logo">
                    <img src="img/logo.jpg?v=2" onerror="this.style.display='none'">
                </div>
            </div>

            <table>
                <thead>
                    <tr>
                        <th style="width: 10%; text-align: center;">Mesa</th>
                        <th style="width: 45%;">Cliente</th>
                        <th style="width: 25%;">Telefone</th>
                        <th style="width: 20%;">Status</th>
                    </tr>
                </thead>
                <tbody>
                    ${linhasTabela}
                </tbody>
            </table>
        </body>
        </html>`;

    const doc = iframe.contentWindow.document;
    doc.open();
    doc.write(html);
    doc.close();

    // Dispara a impressão aguardando a logo carregar
    setTimeout(() => {
      iframe.contentWindow.focus();
      iframe.contentWindow.print();
      setTimeout(() => {
        document.title = tituloOriginal;
      }, 1000);
    }, 1000);
  } catch (error) {
    console.error(error);
    if (window.showToast)
      window.showToast("Erro ao gerar impressão da lista.", "erro");
  }
};
// ==========================================
// 4. GERENCIAMENTO DO EVENTO E RESERVA MANUAL
// ==========================================
window.abrirGerenciamentoEvento = async function (id, nome) {
  window.eventoIdAtivo = id;
  window.nomeEventoAtivo = nome;

  // --- CORREÇÃO: INJETA O ID NO CAMPO OCULTO DO MODAL ---
  const inputId = document.getElementById("rm-evento-id");
  if (inputId) inputId.value = id;

  document.getElementById("gerenciar-nome-evento").innerText =
    `GERENCIAR: ${nome}`;

  const { data: evento, error } = await _supabase
    .from("eventos")
    .select("quantidade_mesas, whatsapp_notificacao, patrocinadores")
    .eq("id", id)
    .single();

  if (!error && evento) {
    document.getElementById("input-capacidade-mesas").value =
      evento.quantidade_mesas || 0;
    
    const inputWhats = document.getElementById("input-editar-whatsapp");
    if(inputWhats) inputWhats.value = evento.whatsapp_notificacao || '';

    const patInput = document.getElementById("lista-patrocinadores-input");
    if (patInput) {
      let valor = evento.patrocinadores || "";

      // Se o dado for um JSON (iniciado com '['), tenta converter para texto legível
      if (valor.startsWith("[")) {
        try {
          const lista = JSON.parse(valor);
          // Transforma array de objetos [{nome: 'A'}, {nome: 'B'}] em texto simples 'A\nB'
          valor = lista.map((item) => item.nome).join("\n");
        } catch (e) {
          console.error("Erro ao converter JSON", e);
        }
      }
      patInput.value = valor;
      window.patrocinadoresEventoAtivo = valor
        .split("\n")
        .filter((n) => n.trim() !== "")
        .map((n) => ({ nome: n }));
    }
  }
  document.getElementById("modal-gerenciar-evento").classList.remove("hidden");
};

// =========================================================================
// FUNÇÃO QUE GERA A PLACA DO EVENTO ATUAL (A4 PAISAGEM)
// =========================================================================
window.imprimirPlacaDoEvento = function (layoutOpcao = 'a4_4', qtdImpressoes = 1) {
    const nomeEvento = window.nomeEventoAtivo || "NOSSO EVENTO";

    // Busca os patrocinadores
    let listaPatroc = window.patrocinadoresEventoAtivo;
    if (typeof listaPatroc === "string") {
        try {
            listaPatroc = JSON.parse(listaPatroc);
        } catch (e) {
            listaPatroc = null;
        }
    }

    const patrocinadores = listaPatroc || [
        { nome: "Supermercado Central", cota: "Ouro" },
        { nome: "Distribuidora de Bebidas", cota: "Ouro" },
        { nome: "Gráfica Rápida", cota: "Prata" },
        { nome: "Açougue do Bairro", cota: "Apoio" },
    ];

    // Monta o HTML dos patrocinadores (flexível para os 3 layouts)
    let htmlPatrocinadores = patrocinadores.map(p => `
        <div class="patrocinador-card">
            <div class="patrocinador-nome">${p.nome.toUpperCase()}</div>
            <div class="patrocinador-cota">COTA ${p.cota.toUpperCase()}</div>
        </div>
    `).join("");

    // Configuração da Térmica (caso seja selecionada)
    const cfg = typeof obterConfiguracoesImpressora === 'function' 
        ? obterConfiguracoesImpressora() 
        : { pageWidth: '80mm', bodyWidth: '72mm', espacoGuilhotina: '15mm', tamanho: '80' };

    let htmlStr = `
    <!DOCTYPE html>
    <html lang="pt-BR">
    <head>
        <meta charset="UTF-8">
        <title>Patrocinadores - ${nomeEvento}</title>
        <style>
            @import url('https://fonts.googleapis.com/css2?family=Montserrat:wght@400;700;900&display=swap');
            * { box-sizing: border-box; margin: 0; padding: 0; }
            body { font-family: 'Montserrat', sans-serif; background-color: #fff; color: #1e293b; width: 100%; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    `;

    // --- 1. LAYOUT: 4 POR PÁGINA (A4 Retrato) ---
    if (layoutOpcao === 'a4_4') {
        htmlStr += `
            @media print { @page { size: A4 portrait; margin: 10mm; } }
            .placa-wrapper { width: 48%; height: 135mm; float: left; margin: 1%; border: 3px dashed #cbd5e1; padding: 10mm 5mm; display: flex; flex-direction: column; justify-content: center; align-items: center; text-align: center; page-break-inside: avoid; border-radius: 15px;}
            .agradecimento { font-size: 12px; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: 2px; margin-bottom: 5px; }
            .titulo { font-size: 26px; font-weight: 900; color: #e63946; text-transform: uppercase; line-height: 1; margin-bottom: 15px; }
            .evento-nome { font-size: 12px; font-weight: 900; background-color: #1e293b; color: #fff; padding: 6px 20px; border-radius: 50px; text-transform: uppercase; margin-bottom: 20px; }
            .grid-patrocinadores { display: flex; flex-wrap: wrap; justify-content: center; gap: 10px; width: 100%; }
            .patrocinador-card { background: #f8fafc; border: 2px solid #f1f5f9; border-radius: 10px; padding: 10px; min-width: 45%; flex: 1; }
            .patrocinador-nome { font-size: 14px; font-weight: 900; color: #0f172a; margin-bottom: 5px; }
            .patrocinador-cota { font-size: 10px; font-weight: 900; color: #e63946; text-transform: uppercase; border-top: 1px solid #e2e8f0; padding-top: 5px; }
        `;
    } 
    // --- 2. LAYOUT: 2 POR PÁGINA (A4 Retrato) ---
    else if (layoutOpcao === 'a4_2') {
        htmlStr += `
            @media print { @page { size: A4 portrait; margin: 15mm; } }
            .placa-wrapper { width: 100%; height: 130mm; border: 4px solid #1e293b; border-radius: 20px; padding: 15mm 10mm; display: flex; flex-direction: column; justify-content: center; align-items: center; text-align: center; margin-bottom: 10mm; page-break-inside: avoid; }
            .placa-wrapper:nth-child(2n) { page-break-after: always; }
            .agradecimento { font-size: 16px; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: 3px; margin-bottom: 8px; }
            .titulo { font-size: 40px; font-weight: 900; color: #e63946; text-transform: uppercase; line-height: 1; margin-bottom: 15px; }
            .evento-nome { font-size: 16px; font-weight: 900; background-color: #1e293b; color: #fff; padding: 8px 30px; border-radius: 50px; text-transform: uppercase; margin-bottom: 25px; }
            .grid-patrocinadores { display: flex; flex-wrap: wrap; justify-content: center; gap: 15px; width: 100%; }
            .patrocinador-card { background: #f8fafc; border: 3px solid #f1f5f9; border-radius: 15px; padding: 15px; min-width: 45%; flex: 1; }
            .patrocinador-nome { font-size: 18px; font-weight: 900; color: #0f172a; margin-bottom: 5px; }
            .patrocinador-cota { font-size: 12px; font-weight: 900; color: #e63946; text-transform: uppercase; border-top: 2px solid #e2e8f0; padding-top: 5px; }
        `;
    } 
    // --- 3. LAYOUT: TÉRMICA 80MM ---
    else if (layoutOpcao === 'termica_80') {
        htmlStr += `
            @media print { @page { margin: 0; size: ${cfg.pageWidth} auto; } }
            body { width: ${cfg.bodyWidth}; margin: 0 auto; color: #000 !important; font-family: 'Courier New', Courier, monospace; }
            .placa-wrapper { width: 100%; text-align: center; padding: 10mm 2mm; border-bottom: 2px dashed #000; page-break-after: always; break-after: page; }
            .placa-wrapper:last-child { border-bottom: none; page-break-after: avoid; }
            .agradecimento { font-size: 11px; font-weight: 900; text-transform: uppercase; margin-bottom: 3px; color: #000 !important; }
            .titulo { font-size: 22px; font-weight: 900; text-transform: uppercase; line-height: 1; margin-bottom: 10px; color: #000 !important; }
            .evento-nome { font-size: 14px; font-weight: 900; border: 3px solid #000; padding: 5px 10px; text-transform: uppercase; margin-bottom: 15px; display: inline-block; color: #000 !important; }
            .grid-patrocinadores { display: flex; flex-direction: column; width: 100%; gap: 5px; }
            .patrocinador-card { border: 2px solid #000; border-radius: 8px; padding: 8px 2px; width: 100%; }
            .patrocinador-nome { font-size: 16px; font-weight: 900; color: #000 !important; margin-bottom: 3px; line-height: 1.1; }
            .patrocinador-cota { font-size: 11px; font-weight: 900; text-transform: uppercase; border-top: 1px dashed #000; padding-top: 3px; color: #000 !important; }
        `;
    }

    htmlStr += `
        </style>
    </head>
    <body>
    `;

    // Gera a quantidade de placas solicitada pelo usuário
    for (let i = 0; i < qtdImpressoes; i++) {
        htmlStr += `
        <div class="placa-wrapper">
            <div class="agradecimento">Nosso muito obrigado aos</div>
            <div class="titulo">Patrocinadores</div>
            <div class="evento-nome">${nomeEvento}</div>
            
            <div class="grid-patrocinadores">
                ${htmlPatrocinadores}
            </div>
            
            ${layoutOpcao === 'termica_80' ? `<div style="font-size: 16px; line-height: 1.5; color: #fff;">&nbsp;<br>&nbsp;<br>&nbsp;</div>` : ''}
        </div>`;
    }

    htmlStr += `</body></html>`;

    // Dispara para o Motor Universal
    if (typeof window.imprimirConteudoIframe === "function") {
        window.imprimirConteudoIframe(htmlStr, `Patrocinadores_${nomeEvento}`);
    } else {
        const win = window.open("", "_blank");
        win.document.write(htmlStr);
        win.document.close();
        setTimeout(() => {
            win.print();
            win.close();
        }, 800);
    }
};

window.salvarNovaCapacidade = async function () {
  const novoTotal = parseInt(
    document.getElementById("input-capacidade-mesas").value,
  );
  const eventoId = window.eventoIdAtivo;

  if (isNaN(novoTotal) || novoTotal < 0) {
    if (window.showToast)
      window.showToast("Digite uma quantidade válida.", "erro");
    return;
  }

  try {
    // Trava de Segurança: Verifica qual a maior mesa reservada atualmente
    const { data: reservas, error: errRes } = await _supabase
      .from("reservas_evento")
      .select("mesas")
      .eq("evento_id", eventoId);

    if (errRes) throw errRes;

    let mesasOcupadas = [];
    reservas.forEach((r) => {
      if (Array.isArray(r.mesas)) mesasOcupadas.push(...r.mesas);
      else if (r.mesas) mesasOcupadas.push(parseInt(r.mesas));
    });

    const maiorMesaOcupada =
      mesasOcupadas.length > 0 ? Math.max(...mesasOcupadas) : 0;

    if (novoTotal < maiorMesaOcupada) {
      alert(
        `Atenção: Você já tem reservas até a mesa ${maiorMesaOcupada}. Não é possível reduzir para ${novoTotal} mesas.`,
      );
      return;
    }

    // Atualiza no banco
    const { error } = await _supabase
      .from("eventos")
      .update({ quantidade_mesas: novoTotal })
      .eq("id", eventoId);

    if (error) throw error;

    if (window.showToast) window.showToast("Capacidade atualizada!", "sucesso");
  } catch (err) {
    console.error(err);
    if (window.showToast) window.showToast("Erro ao salvar.", "erro");
  }
};

window.fecharGerenciamentoEvento = function () {
  window.eventoIdAtivo = null;
  document.getElementById("modal-gerenciar-evento").classList.add("hidden");
};

// ==========================================
// 1. ATUALIZAÇÃO: SALVAR RESERVA MANUAL
// ==========================================
window.salvarReservaManual = async function (e) {
  e.preventDefault();
  if (!window.eventoIdAtivo) return;

  // Como o clique pode vir de dois botões diferentes, nós pegamos o botão exato que disparou o evento
  const btnClicado = e.target.closest ? e.target.closest('button') : null;
  const textoOriginal = btnClicado ? btnClicado.innerHTML : "Aguarde...";
  
  if (btnClicado) {
    btnClicado.disabled = true;
    btnClicado.innerHTML = "⏳ PROCESSANDO...";
  }

  try {
    // 1. Pega a string do input e converte para array
    const inputMesas = document.getElementById("rm-mesa").value;
    const listaMesas = inputMesas
      .split(",")
      .map((m) => parseInt(m.trim()))
      .filter((m) => !isNaN(m));

    const nome = document.getElementById("rm-nome").value;
    const tipo = document.getElementById("rm-tipo").value;
    
    // 🔍 A MÁGICA AQUI: Lê o status do campo oculto que o HTML preencheu
    const campoStatus = document.getElementById("rm-status");
    const statusDesejado = campoStatus ? campoStatus.value : "confirmada";

    if (listaMesas.length === 0)
      throw new Error("Selecione pelo menos uma mesa no mapa.");

    // 2. Validação de Intersecção (Mesas Ocupadas)
    const { data: ocupadas, error: errBusca } = await _supabase
      .from("reservas_evento")
      .select("mesas")
      .eq("evento_id", String(window.eventoIdAtivo))
      .overlaps("mesas", listaMesas);

    if (errBusca) throw errBusca;
    if (ocupadas && ocupadas.length > 0) {
      throw new Error(`Uma ou mais mesas selecionadas já estão reservadas!`);
    }

    // 3. Monta a nova reserva com o status correto
    const novaReserva = {
      evento_id: String(window.eventoIdAtivo),
      mesas: listaMesas,
      cliente_nome: `${nome} (${tipo})`,
      cliente_telefone: "MANUAL - ADMIN",
      status: statusDesejado, // <-- Salva como pendente ou confirmada
    };

    const { error } = await _supabase
      .from("reservas_evento")
      .insert([novaReserva]);
      
    if (error) throw error;

    if (window.showToast)
      window.showToast(`Reserva (${statusDesejado.toUpperCase()}) efetuada!`, "sucesso");

    // 4. Limpa o formulário e o mapa
    document.getElementById("form-reserva-manual").reset();
    if (window.limparSelecao) window.limparSelecao();
    
    // 5. Opcional: Atualiza a lista na tela e o mapa instantaneamente se essas funções existirem no seu código
    if (typeof window.carregarReservasAdmin === 'function') window.carregarReservasAdmin();
    if (typeof window.carregarMapaEventos === 'function') window.carregarMapaEventos();

  } catch (error) {
    console.error(error);
    if (window.showToast) window.showToast(error.message, "erro");
  } finally {
    if (btnClicado) {
      btnClicado.disabled = false;
      btnClicado.innerHTML = textoOriginal;
    }
  }
};


// ==========================================
// 2. NOVAS FUNÇÕES: GERENCIAR PENDÊNCIAS
// ==========================================

// Função para abrir a telinha de aprovação com os dados corretos
window.abrirModalAcaoPendente = function(idReserva, nomeCliente, arrayMesas) {
    document.getElementById('acao-pendente-id').value = idReserva;
    document.getElementById('acao-pendente-nome').innerText = nomeCliente;
    
    // Formata o array visualmente: [10, 11] vira "10, 11"
    const stringMesas = Array.isArray(arrayMesas) ? arrayMesas.join(', ') : arrayMesas;
    document.getElementById('acao-pendente-mesas').innerText = `Mesas: ${stringMesas}`;
    
    document.getElementById('modal-acao-pendente').classList.remove('hidden');
};

// Disparada pelo botão Verde
// Disparada pelo botão Verde do novo modal
window.confirmarReservaPendente = async function() {
    const id = document.getElementById('acao-pendente-id').value;
    if(!id) return;
    
    try {
        const { error } = await _supabase
            .from('reservas_evento')
            .update({ status: 'confirmada' })
            .eq('id', id);
            
        if (error) throw error;
        
        if(window.showToast) window.showToast("Pagamento confirmado com sucesso!", "sucesso");
        document.getElementById('modal-acao-pendente').classList.add('hidden');
        
        // ==========================================
        // LÓGICA DE ENVIO DO WHATSAPP (MIGRADA)
        // ==========================================
        const reserva = window.listaReservasLocal.find((r) => r.id === id);
        if (reserva && reserva.cliente_telefone && reserva.cliente_telefone !== "MANUAL - ADMIN") {
            let telefonePuro = String(reserva.cliente_telefone).replace(/\D/g, "");
            if (telefonePuro.length === 10 || telefonePuro.length === 11) {
                telefonePuro = "55" + telefonePuro;
            }
            const nomeCliente = reserva.cliente_nome || "Cliente";
            const mesaStr = Array.isArray(reserva.mesas) ? reserva.mesas.join(", ") : reserva.mesas;
            const mensagem = `Olá, *${nomeCliente}*! 🎉\n\nO seu pagamento foi recebido e a sua reserva para a(s) mesa(s) *${mesaStr}* foi *confirmada* com sucesso!\n\nAgradecemos a preferência e aguardamos você.`;
            
            const urlWhatsapp = `https://wa.me/${telefonePuro}?text=${encodeURIComponent(mensagem)}`;
            window.open(urlWhatsapp, "_blank");
        }
        // ==========================================
        
        // Recarrega os dados visuais
        if (typeof window.carregarReservasAdmin === 'function') window.carregarReservasAdmin();
        if (typeof window.carregarMapaEventos === 'function') window.carregarMapaEventos();
        if (typeof window.atualizarListaSolicitacoes === 'function') window.atualizarListaSolicitacoes();
        
    } catch(error) {
        console.error(error);
        if(window.showToast) window.showToast("Erro ao confirmar pagamento", "erro");
    }
};

// Disparada pelo botão Vermelho
// Disparada pelo botão Vermelho
window.liberarReservaPendente = async function() {
    const id = document.getElementById('acao-pendente-id').value;
    if(!id) return;
    
    // Chamando o seu modal customizado no lugar do confirm() nativo
    const confirmado = await window.confirmarAcaoCustom(
        "Liberar Mesa",
        "Tem certeza que deseja cancelar essa reserva e liberar a mesa para venda?",
        true // Esse 'true' diz para o modal que é uma ação de perigo (botão vermelho)
    );
    
    // Se o usuário clicou em "Não", a função para aqui
    if(!confirmado) return;
    
    try {
        // Exclui a reserva do banco, liberando as mesas imediatamente
        const { error } = await _supabase
            .from('reservas_evento')
            .delete()
            .eq('id', id);
            
        if (error) throw error;
        
        if(window.showToast) window.showToast("Reserva cancelada. Mesa livre!", "sucesso");
        document.getElementById('modal-acao-pendente').classList.add('hidden');
        
        // Recarrega os dados visuais
        if (typeof window.carregarReservasAdmin === 'function') window.carregarReservasAdmin();
        if (typeof window.carregarMapaEventos === 'function') window.carregarMapaEventos();
        if (typeof window.atualizarListaSolicitacoes === 'function') window.atualizarListaSolicitacoes();
        
    } catch(error) {
        console.error(error);
        if(window.showToast) window.showToast("Erro ao liberar mesa", "erro");
    }
};

window.alterarStatusEvento = async function (novoStatus) {
  if (!window.eventoIdAtivo) return;

  const confirmado = await window.mostrarConfirmacaoCustom(
    "Alterar Status",
    `Deseja alterar o status do evento para ${novoStatus.toUpperCase()}?`,
  );

  if (!confirmado) return;

  try {
    const { error } = await _supabase
      .from("eventos")
      .update({ status: novoStatus })
      .eq("id", window.eventoIdAtivo);
    if (error) throw error;

    if (window.showToast)
      window.showToast(`Evento atualizado para ${novoStatus}!`, "sucesso");
    window.carregarEventosAdmin();
    window.fecharGerenciamentoEvento();
  } catch (err) {
    console.error(err);
    if (window.showToast) window.showToast("Erro ao alterar status.", "erro");
  }
};

window.atualizarMapaEvento = async function () {
  if (!window.eventoIdAtivo) return;

  const fileInput = document.getElementById("ev-update-mapa");
  if (fileInput.files.length === 0) {
    if (window.showToast)
      window.showToast("Selecione uma imagem primeiro.", "aviso");
    return;
  }

  try {
    const file = fileInput.files[0];
    const path = `mapas/${Date.now()}_${file.name}`;

    const { error: uploadError } = await _supabase.storage
      .from("eventos")
      .upload(path, file);
    if (uploadError) throw uploadError;

    const { data } = _supabase.storage.from("eventos").getPublicUrl(path);

    const { error: dbError } = await _supabase
      .from("eventos")
      .update({ mapa_url: data.publicUrl })
      .eq("id", window.eventoIdAtivo);
    if (dbError) throw dbError;

    if (window.showToast)
      window.showToast("Mapa atualizado com sucesso!", "sucesso");
    fileInput.value = "";
  } catch (err) {
    console.error(err);
    if (window.showToast) window.showToast("Erro ao atualizar o mapa.", "erro");
  }
};

window.excluirEvento = async function () {
  if (!window.eventoIdAtivo) return;

  // Aciona a nova função de Prompt Customizado
  const confirmado = await window.mostrarPromptCustom(
    "Excluir Evento",
    "Esta ação apagará o evento e todas as reservas vinculadas. Digite EXCLUIR abaixo para confirmar.",
    "EXCLUIR",
  );

  if (!confirmado) {
    if (window.showToast) window.showToast("Exclusão cancelada.", "aviso");
    return;
  }

  try {
    await _supabase
      .from("reservas_evento")
      .delete()
      .eq("evento_id", window.eventoIdAtivo);

    const { error } = await _supabase
      .from("eventos")
      .delete()
      .eq("id", window.eventoIdAtivo);
    if (error) throw error;

    if (window.showToast)
      window.showToast("Evento excluído permanentemente.", "sucesso");
    window.carregarEventosAdmin();
    window.fecharGerenciamentoEvento();
  } catch (err) {
    console.error(err);
    if (window.showToast) window.showToast("Erro ao excluir o evento.", "erro");
  }
};

// ==========================================
// FUNÇÕES UTILITÁRIAS DE MODAIS CUSTOMIZADOS
// ==========================================

window.mostrarConfirmacaoCustom = function (titulo, mensagem) {
  return new Promise((resolve) => {
    const modal = document.getElementById("modal-confirmacao-custom");
    const txtTitulo = document.getElementById("confirm-titulo");
    const txtMensagem = document.getElementById("confirm-mensagem");
    const btnSim = document.getElementById("btn-confirm-sim");
    const btnCancelar = document.getElementById("btn-confirm-cancelar");

    txtTitulo.innerText = titulo.toUpperCase();
    txtMensagem.innerText = mensagem;

    modal.classList.remove("hidden");

    btnSim.onclick = () => {
      modal.classList.add("hidden");
      resolve(true);
    };

    btnCancelar.onclick = () => {
      modal.classList.add("hidden");
      resolve(false);
    };
  });
};

window.mostrarPromptCustom = function (titulo, mensagem, palavraChave) {
  return new Promise((resolve) => {
    const modal = document.getElementById("modal-prompt-custom");
    const txtTitulo = document.getElementById("prompt-titulo");
    const txtMensagem = document.getElementById("prompt-mensagem");
    const input = document.getElementById("prompt-input");
    const btnSim = document.getElementById("btn-prompt-sim");
    const btnCancelar = document.getElementById("btn-prompt-cancelar");

    txtTitulo.innerText = titulo.toUpperCase();
    txtMensagem.innerText = mensagem;
    input.value = "";
    input.placeholder = `Digite ${palavraChave}`;

    modal.classList.remove("hidden");
    input.focus();

    btnSim.onclick = () => {
      if (input.value === palavraChave) {
        modal.classList.add("hidden");
        resolve(true);
      } else {
        if (window.showToast)
          window.showToast(
            `Digite ${palavraChave} exatamente como solicitado.`,
            "erro",
          );
      }
    };

    btnCancelar.onclick = () => {
      modal.classList.add("hidden");
      resolve(false);
    };
  });
};

window.cancelarReserva = async function (reservaId) {
  // Confirmação customizada para evitar erros
  const confirmado = await window.mostrarConfirmacaoCustom(
    "Cancelar Reserva",
    "Tem certeza que deseja cancelar esta reserva? A mesa voltará a ficar disponível para outros clientes.",
  );

  if (!confirmado) return;

  try {
    const { error } = await _supabase
      .from("reservas_evento")
      .delete()
      .eq("id", reservaId);
    if (error) throw error;

    if (window.showToast)
      window.showToast("Reserva cancelada com sucesso!", "sucesso");
    window.atualizarListaSolicitacoes(); // Recarrega a lista
  } catch (err) {
    console.error(err);
    if (window.showToast) window.showToast("Erro ao cancelar reserva.", "erro");
  }
};

window.exportarParaCSV = function () {
  // Busca todos os elementos de reserva na tela (ou você pode buscar do Supabase novamente)
  // Aqui usaremos os dados que já estão na sua lista se ela estiver populada
  const reservasParaExportar = window.listaReservasAtuais || [];

  if (reservasParaExportar.length === 0) {
    if (window.showToast)
      window.showToast("Nenhuma reserva para exportar.", "aviso");
    return;
  }

  let csvContent = "data:text/csv;charset=utf-8,";
  csvContent += "MESA,CLIENTE,TELEFONE,STATUS\n"; // Cabeçalho

  reservasParaExportar.forEach((res) => {
    const mesas = Array.isArray(res.mesas) ? res.mesas.join(";") : res.mesas;
    const linha = `${mesas},${res.cliente_nome},${res.cliente_telefone},${res.status}`;
    csvContent += linha + "\n";
  });

  const encodedUri = encodeURI(csvContent);
  const link = document.createElement("a");
  link.setAttribute("href", encodedUri);
  link.setAttribute("download", "reservas_evento.csv");
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

// Função para exportar
window.exportarParaExcel = function () {
  const dados = window.listaReservasAtuais;
  if (!dados || dados.length === 0) {
    if (window.showToast) window.showToast("Nada para exportar.", "aviso");
    return;
  }

  // Criamos uma tabela HTML simples que o Excel interpreta como Planilha
  let html = `
        <table border="1">
            <tr style="background-color: #059669; color: #ffffff; font-weight: bold;">
                <th>MESA</th>
                <th>CLIENTE</th>
                <th>TELEFONE</th>
                <th>STATUS</th>
            </tr>`;

  dados.forEach((r) => {
    const mesas = Array.isArray(r.mesas) ? r.mesas.join(", ") : r.mesas;
    html += `
            <tr>
                <td>${mesas}</td>
                <td>${r.cliente_nome}</td>
                <td>${r.cliente_telefone}</td>
                <td>${r.status.toUpperCase()}</td>
            </tr>`;
  });

  html += `</table>`;

  // Cria o arquivo com extensão .xls
  const blob = new Blob([html], { type: "application/vnd.ms-excel" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = "lista_reservas.xls";
  link.click();
};

window.verificarPendencias = function (reservas, eventoId = null) {
  // 1. Filtra as reservas que estão com status 'pendente'
  // Se um eventoId for fornecido, filtra apenas as pendências daquele evento
  const pendentes = eventoId
    ? reservas.filter(
        (r) =>
          r.status === "pendente" && String(r.evento_id) === String(eventoId),
      )
    : reservas.filter((r) => r.status === "pendente");

  // 2. Define o ID do badge no HTML:
  // Se for um card de evento, o ID será 'badge-pendencia-ID_DO_EVENTO'
  // Se for um badge geral no menu, o ID será apenas 'badge-pendencia'
  const badgeId = eventoId ? `badge-pendencia-${eventoId}` : "badge-pendencia";
  const badge = document.getElementById(badgeId);

  // 3. Atualiza o elemento visual
  if (badge) {
    badge.innerText = pendentes.length;

    // Se houver pendências, remove a classe 'hidden' para exibir o número
    // Se o contador for 0, adiciona 'hidden' para esconder o badge
    badge.classList.toggle("hidden", pendentes.length === 0);
  }
};

window.mesasSelecionadasMap = []; // Memória global das mesas selecionadas

window.abrirMapaOcupacao = async function () {
  const eventoId = window.eventoIdAtivo;
  if (!eventoId) return;

  const inputMesa = document.getElementById("rm-mesa");
  window.mesasSelecionadasMap = inputMesa && inputMesa.value
      ? inputMesa.value.split(",").map((m) => parseInt(m.trim())).filter((m) => !isNaN(m))
      : [];

  try {
    const [{ data: evento }, { data: reservas }] = await Promise.all([
      _supabase.from("eventos").select("quantidade_mesas").eq("id", eventoId).single(),
      _supabase.from("reservas_evento").select("id, mesas, status, cliente_nome").eq("evento_id", String(eventoId)),
    ]);

    const capacidade = evento ? parseInt(evento.quantidade_mesas) || 0 : 0;
    if (capacidade === 0) {
      if (window.showToast) window.showToast("Defina a capacidade de mesas no menu 'Gerenciar' primeiro.", "erro");
      return;
    }

    const dadosMesas = {};

    if (reservas) {
      reservas.forEach((res) => {
        const arrMesas = Array.isArray(res.mesas) ? res.mesas : typeof res.mesas === "string" ? res.mesas.split(",") : [res.mesas];
        arrMesas.forEach((num) => {
          const n = parseInt(num);
          if (n) {
            if (res.status === "confirmada" || !dadosMesas[n] || dadosMesas[n].status !== "confirmada") {
              dadosMesas[n] = {
                status: res.status,
                id: res.id,
                nome: res.cliente_nome || "SEM NOME",
                arrayMesasStr: JSON.stringify(arrMesas)
              };
            }
          }
        });
      });
    }

    const grid = document.getElementById("grid-mapa-mesas");
    let html = "";

    for (let i = 1; i <= capacidade; i++) {
      let corClasses = "";
      let statusAtual = "livre";
      let isSelecionada = window.mesasSelecionadasMap.includes(i);
      let acaoClique = `onclick="window.toggleMesaMapaAcumulativo(${i}, 'livre', this)"`;

      if (dadosMesas[i]) {
        // ==================================================
        // A MÁGICA DA LIMPEZA AQUI:
        // Remove tudo que estiver entre parênteses e espaços extras!
        // ==================================================
        const nomeLimpo = dadosMesas[i].nome.replace(/\s*\(.*?\)/g, "").trim();
        const nomeEscapado = nomeLimpo.replace(/'/g, "\\'");

        if (dadosMesas[i].status === "confirmada") {
          corClasses = "bg-emerald-500 text-white opacity-90 cursor-pointer hover:bg-emerald-600 shadow-md transform hover:scale-105 transition-all";
          statusAtual = "ocupada";
          acaoClique = `onclick="window.abrirModalMesaOcupada('${dadosMesas[i].id}', '${nomeEscapado}', ${dadosMesas[i].arrayMesasStr.replace(/"/g, "'")})"`;
          
        } else if (dadosMesas[i].status === "pendente") {
          corClasses = "bg-amber-400 text-white opacity-90 cursor-pointer hover:bg-amber-500 shadow-md transform hover:scale-105 transition-all";
          statusAtual = "pendente";
          acaoClique = `onclick="window.abrirModalAcaoPendente('${dadosMesas[i].id}', '${nomeEscapado}', ${dadosMesas[i].arrayMesasStr.replace(/"/g, "'")})"`;
        }
      } else {
        statusAtual = "livre";
        if (isSelecionada) {
          corClasses = "bg-indigo-600 text-white font-black cursor-pointer shadow-lg transform scale-105 ring-2 ring-indigo-300";
        } else {
          corClasses = "bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 cursor-pointer hover:bg-indigo-50 dark:hover:bg-indigo-900/30 hover:scale-105 transition-all font-bold shadow-sm";
        }
      }

      html += `<div ${acaoClique} class="aspect-square rounded-xl flex items-center justify-center text-sm transition-all duration-200 ${corClasses}" title="Mesa ${i}">${i}</div>`;
    }

    grid.innerHTML = html;
    document.getElementById("modal-mapa-ocupacao").classList.remove("hidden");
    window.atualizarBotaoConfirmarMapa(); 
  } catch (err) {
    console.error("Erro ao gerar mapa:", err);
  }
};

// ==========================================
// FUNÇÕES DO MAPA ACUMULATIVO
// ==========================================
window.toggleMesaMapaAcumulativo = function (numero, status, elemento) {
  if (status === "ocupada") {
    if (window.showToast)
      window.showToast(`Mesa ${numero} já ocupada!`, "erro");
    return;
  }
  if (status === "pendente") {
    if (window.showToast)
      window.showToast(`Mesa ${numero} em análise.`, "aviso");
    return;
  }

  const index = window.mesasSelecionadasMap.indexOf(numero);

  if (index > -1) {
    // REMOVER MESA: Tira do array e volta a cor original
    window.mesasSelecionadasMap.splice(index, 1);
    elemento.className = `aspect-square rounded-xl flex items-center justify-center text-sm transition-all duration-200 bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 cursor-pointer hover:bg-indigo-50 dark:hover:bg-indigo-900/30 hover:scale-105 font-bold shadow-sm`;
  } else {
    // ADICIONAR MESA: Coloca no array e pinta de azul (indigo)
    window.mesasSelecionadasMap.push(numero);
    elemento.className = `aspect-square rounded-xl flex items-center justify-center text-sm transition-all duration-200 bg-indigo-600 text-white font-black cursor-pointer shadow-lg transform scale-105 ring-2 ring-indigo-300`;
  }

  // Ordena do menor para o maior (ex: 1, 2, 10)
  window.mesasSelecionadasMap.sort((a, b) => a - b);
  window.atualizarBotaoConfirmarMapa();
};

window.atualizarBotaoConfirmarMapa = function () {
  const container = document.getElementById("container-confirmar-mapa");
  const spanQtd = document.getElementById("qtd-mesas-selecionadas");
  if (!container) return;

  if (window.mesasSelecionadasMap.length > 0) {
    container.classList.remove("hidden");
    container.classList.add("flex");
    spanQtd.innerText = window.mesasSelecionadasMap.length;
  } else {
    container.classList.add("hidden");
    container.classList.remove("flex");
  }
};

window.confirmarSelecaoMapa = function () {
  const inputMesa = document.getElementById("rm-mesa");
  if (inputMesa) {
    inputMesa.value = window.mesasSelecionadasMap.join(", ");
  }

  // Esconde o mapa e a gestão de reservas
  document.getElementById("modal-mapa-ocupacao").classList.add("hidden");
  document.getElementById("modal-gestao-reservas").classList.add("hidden");
  document.getElementById("modal-gestao-reservas").classList.remove("flex");

  // Mostra a tela de formulário
  document.getElementById("modal-gerenciar-evento").classList.remove("hidden");
  document.getElementById("modal-gerenciar-evento").classList.add("flex");

  setTimeout(() => {
    document.getElementById("rm-nome").focus();
  }, 400);
};

// ==========================================
// NOVA FUNÇÃO: Gerencia o clique na mesa
// ==========================================
window.selecionarMesaPeloMapa = function (numeroMesa, status) {
  // Se estiver ocupada ou pendente, apenas avisa e bloqueia o clique
  if (status === "ocupada") {
    if (window.showToast)
      window.showToast(`A Mesa ${numeroMesa} já está ocupada!`, "erro");
    return;
  }
  if (status === "pendente") {
    if (window.showToast)
      window.showToast(
        `A Mesa ${numeroMesa} possui um pagamento em análise.`,
        "aviso",
      );
    return;
  }

  // Se estiver livre, executa o fluxo de reserva manual:

  // 1. Oculta o modal do mapa
  document.getElementById("modal-mapa-ocupacao").classList.add("hidden");

  // 2. Oculta o modal de Gestão de Reservas (se estiver aberto por trás)
  document.getElementById("modal-gestao-reservas").classList.add("hidden");
  document.getElementById("modal-gestao-reservas").classList.remove("flex");

  // 3. Abre o modal de Gerenciar Evento (onde fica o formulário)
  document.getElementById("modal-gerenciar-evento").classList.remove("hidden");
  document.getElementById("modal-gerenciar-evento").classList.add("flex");

  // 4. Preenche o input do número da mesa automaticamente
  document.getElementById("rm-mesa").value = numeroMesa;

  // 5. Dá um feedback visual e foca no campo Nome para agilizar a digitação
  if (window.showToast)
    window.showToast(`Mesa ${numeroMesa} selecionada!`, "sucesso");

  setTimeout(() => {
    document.getElementById("rm-nome").focus();
  }, 400);
};

window.toggleSelecaoMesa = function (numero, elemento) {
  if (!window.mesasSelecionadas) window.mesasSelecionadas = [];

  const index = window.mesasSelecionadas.indexOf(numero);

  if (index > -1) {
    // Se já está na lista, remove
    window.mesasSelecionadas.splice(index, 1);
    // Remove o estilo de selecionado
    elemento.classList.remove("bg-indigo-600", "text-white");
    elemento.classList.add("bg-slate-50", "text-slate-400");
  } else {
    // Se não está, adiciona
    window.mesasSelecionadas.push(numero);
    // Aplica o estilo de selecionado
    elemento.classList.add("bg-indigo-600", "text-white");
    elemento.classList.remove("bg-slate-50", "text-slate-400");
  }

  // Atualiza o input no seu formulário (rm-mesa)
  const input = document.getElementById("rm-mesa");
  if (input) {
    input.value = window.mesasSelecionadas.sort((a, b) => a - b).join(", ");
  }
};

window.bloquearMesaRapido = async function (numeroMesa) {
  // Agora passamos 'true' no último parâmetro para ativar o campo de input
  const nomeCliente = await window.confirmarAcaoCustom(
    `Bloquear Mesa ${numeroMesa}`,
    "Insira o nome do cliente para confirmar a reserva:",
    false,
    true,
  );

  // Se clicou em cancelar, nomeCliente será null
  if (nomeCliente === null || nomeCliente.trim() === "") return;

  try {
    const { error } = await _supabase.from("reservas_evento").insert([
      {
        evento_id: window.eventoIdAtivo,
        cliente_nome: nomeCliente.trim(),
        mesas: [numeroMesa.toString()],
        status: "confirmada",
        tipo: "PRESENCIAL",
      },
    ]);

    if (error) throw error;

    if (window.showToast)
      window.showToast(`Mesa ${numeroMesa} garantida!`, "sucesso");

    if (window.atualizarListaSolicitacoes) {
      await window.atualizarListaSolicitacoes();
      window.abrirMapaOcupacao();
    }
  } catch (err) {
    console.error("Erro:", err);
  }
};

// ==========================================
// FUNÇÃO DO MODAL DE CONFIRMAÇÃO CUSTOMIZADO
// ==========================================
window.confirmarAcaoCustom = function (
  titulo,
  mensagem,
  isPerigo = false,
  solicitarNome = false,
) {
  return new Promise((resolve) => {
    const modal = document.getElementById("modal-confirmacao-custom");
    const tituloEl = document.getElementById("confirm-titulo");
    const mensagemEl = document.getElementById("confirm-mensagem");
    const inputNome = document.getElementById("input-confirm-nome"); // O novo campo que adicionamos no HTML
    const btnSim = document.getElementById("btn-confirm-sim");
    const btnNao = document.getElementById("btn-confirm-cancelar");

    // Preenche os textos
    tituloEl.innerText = titulo;
    mensagemEl.innerText = mensagem;

    // Gerencia o campo de input
    if (solicitarNome) {
      inputNome.classList.remove("hidden");
      inputNome.value = ""; // Limpa qualquer texto anterior
    } else {
      inputNome.classList.add("hidden");
    }

    // Muda a cor do botão de confirmação
    if (isPerigo) {
      btnSim.className =
        "w-2/3 bg-red-500 hover:bg-red-600 text-white font-black py-3 rounded-xl text-[10px] uppercase tracking-widest shadow-lg shadow-red-500/30 transition-all active:scale-95";
    } else {
      btnSim.className =
        "w-2/3 bg-emerald-500 hover:bg-emerald-600 text-white font-black py-3 rounded-xl text-[10px] uppercase tracking-widest shadow-lg shadow-emerald-500/30 transition-all active:scale-95";
    }

    // Mostra o modal
    modal.classList.remove("hidden");

    // Função para limpar e resolver
    const fecharEResolver = (resultado) => {
      const valorRetorno =
        resultado && solicitarNome ? inputNome.value : resultado;

      btnSim.onclick = null;
      btnNao.onclick = null;
      modal.classList.add("hidden");
      resolve(valorRetorno);
    };

    btnSim.onclick = () => fecharEResolver(true);
    btnNao.onclick = () => fecharEResolver(false);
  });
};

// ==========================================
// AÇÕES DA RESERVA (APROVAR E CANCELAR)
// ==========================================

window.aprovarReserva = async function (reservaId) {
  const confirmado = await window.confirmarAcaoCustom(
    "Aprovar Reserva",
    "Deseja aprovar o pagamento e confirmar esta reserva?",
    false,
  );
  if (!confirmado) return;

  try {
    // Atualiza no banco
    const { error } = await _supabase
      .from("reservas_evento")
      .update({ status: "confirmada" })
      .eq("id", reservaId);

    if (error) throw error;

    if (window.showToast)
      window.showToast("Reserva aprovada com sucesso!", "sucesso");

    // ==========================================
    // LÓGICA DE ENVIO DO WHATSAPP
    // ==========================================
    // Procura os dados do cliente na memória local
    const reserva = window.listaReservasLocal.find((r) => r.id === reservaId);

    if (reserva && reserva.cliente_telefone) {
      // Limpa o número (deixa só os números)
      let telefonePuro = String(reserva.cliente_telefone).replace(/\D/g, "");

      // Se o número tiver 10 ou 11 dígitos, adiciona o DDI do Brasil (55)
      if (telefonePuro.length === 10 || telefonePuro.length === 11) {
        telefonePuro = "55" + telefonePuro;
      }

      const nomeCliente = reserva.cliente_nome || "Cliente";
      const mesaStr = Array.isArray(reserva.mesas)
        ? reserva.mesas.join(", ")
        : reserva.mesas;

      // Monta a mensagem
      const mensagem = `Olá, *${nomeCliente}*! 🎉\n\nO seu pagamento foi recebido e a sua reserva para a(s) mesa(s) *${mesaStr}* foi *confirmada* com sucesso!\n\nAgradecemos a preferência e aguardamos você.`;

      // Abre o WhatsApp numa nova aba
      const urlWhatsapp = `https://wa.me/${telefonePuro}?text=${encodeURIComponent(mensagem)}`;
      window.open(urlWhatsapp, "_blank");
    } else {
      if (window.showToast)
        window.showToast("Sem número de WhatsApp cadastrado.", "aviso");
    }
    // ==========================================

    // Recarrega a tela
    if (window.atualizarListaSolicitacoes) {
      window.atualizarListaSolicitacoes();
    }
  } catch (err) {
    console.error("Erro ao aprovar:", err);
    if (window.showToast) window.showToast("Erro ao aprovar reserva.", "erro");
  }
};

window.excluirReserva = async function (reservaId) {
  // Chama o modal customizado (isPerigo = true, para ficar vermelho)
  const confirmado = await window.confirmarAcaoCustom(
    "Cancelar Reserva",
    "Deseja realmente cancelar e excluir esta reserva? As mesas serão liberadas.",
    true,
  );
  if (!confirmado) return;

  try {
    const { error } = await _supabase
      .from("reservas_evento")
      .delete()
      .eq("id", reservaId);

    if (error) throw error;

    if (window.showToast)
      window.showToast("Reserva cancelada e mesas liberadas!", "sucesso");

    if (window.atualizarListaSolicitacoes) {
      window.atualizarListaSolicitacoes();
    }
  } catch (err) {
    console.error("Erro ao cancelar:", err);
    if (window.showToast) window.showToast("Erro ao cancelar reserva.", "erro");
  }
};

// Controle do Modal
window.abrirModalImpressaoPlacas = function () {
  document.getElementById("modal-imprimir-placas").classList.remove("hidden");
  document.getElementById("modal-imprimir-placas").classList.add("flex");
};

window.fecharModalImpressaoPlacas = function () {
  document.getElementById("modal-imprimir-placas").classList.add("hidden");
  document.getElementById("modal-imprimir-placas").classList.remove("flex");
};

// Lógica de Impressão
window.gerarPlacasA5 = async function (tipo, formatoSaida, layoutOpcao = 'a4_4') {
  if (!window.eventoIdAtivo) return;

  if (typeof window.fecharModalImpressaoPlacas === "function") {
    window.fecharModalImpressaoPlacas();
  }

  try {
    if (window.showToast) window.showToast("Buscando dados...", "aviso");

    const [{ data: evento, error: errEv }, { data: reservas, error: errRes }] =
      await Promise.all([
        _supabase.from("eventos").select("quantidade_mesas").eq("id", window.eventoIdAtivo).single(),
        _supabase.from("reservas_evento").select("*").eq("evento_id", String(window.eventoIdAtivo)),
      ]);

    if (errEv) throw errEv;
    if (errRes) throw errRes;

    const totalMesas = evento ? parseInt(evento.quantidade_mesas) || 0 : 0;

    if ((tipo === "disponiveis" || tipo === "todas") && totalMesas <= 0) {
      if (window.showToast) window.showToast("Defina a capacidade primeiro.", "erro");
      return;
    }

    let mesasReservadas = [];
    reservas.forEach((res) => {
      if (Array.isArray(res.mesas)) {
        let nomeLimpo = res.cliente_nome ? res.cliente_nome.replace(/\s*\(.*?\)/g, "").trim() : "";
        res.mesas.forEach((mesa) => {
          mesasReservadas.push({ mesa: parseInt(mesa), cliente: nomeLimpo, reservado: true });
        });
      }
    });

    let listaFinal = [];
    if (tipo === "reservadas") {
      listaFinal = mesasReservadas.sort((a, b) => a.mesa - b.mesa);
    } else if (tipo === "disponiveis") {
      for (let i = 1; i <= totalMesas; i++) {
        let estaReservada = mesasReservadas.find((r) => r.mesa === i);
        if (!estaReservada) listaFinal.push({ mesa: i, cliente: "", reservado: false });
      }
    } else if (tipo === "todas") {
      for (let i = 1; i <= totalMesas; i++) {
        let estaReservada = mesasReservadas.find((r) => r.mesa === i);
        listaFinal.push(estaReservada ? estaReservada : { mesa: i, cliente: "", reservado: false });
      }
    }

    if (listaFinal.length === 0) {
      if (window.showToast) window.showToast("Nenhuma mesa encontrada.", "erro");
      return;
    }

    const dataHoje = new Date().toLocaleDateString("pt-BR").replace(/\//g, "-");
    const nomeDoArquivo = formatoSaida === "pdf" ? `Placas_${tipo}_${dataHoje}` : "Impressao_Placas";
    const tituloOriginal = document.title;
    document.title = nomeDoArquivo;

    let iframeAntigo = document.getElementById("iframe-impressao-placas");
    if (iframeAntigo) iframeAntigo.remove();

    let iframe = document.createElement("iframe");
    iframe.id = "iframe-impressao-placas";
    iframe.style.position = "absolute";
    iframe.style.width = "0px";
    iframe.style.height = "0px";
    iframe.style.border = "none";
    document.body.appendChild(iframe);

    const baseUrl = window.location.origin + window.location.pathname.substring(0, window.location.pathname.lastIndexOf("/") + 1);
    const cfg = typeof obterConfiguracoesImpressora === 'function' ? obterConfiguracoesImpressora() : { pageWidth: '80mm', bodyWidth: '72mm' };

    let htmlStr = `<!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
            <base href="${baseUrl}">
            <style>
                * { box-sizing: border-box; margin: 0; padding: 0; }
                body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #fff; color: #000; }
    `;

    if (layoutOpcao === 'a4_4') {
        htmlStr += `
            @page { size: A4 portrait; margin: 0; }
            body { width: 210mm; }
            .folha-a4 { width: 210mm; height: 296mm; padding: 10mm; display: grid; grid-template-columns: 1fr 1fr; grid-template-rows: 1fr 1fr; gap: 15px; page-break-after: always; margin: 0 auto; }
            .folha-a4:last-child { page-break-after: auto; }
            
            .card { border: 5px solid #000; border-radius: 16px; display: flex; flex-direction: column; justify-content: space-between; align-items: center; text-align: center; padding: 25px 20px; overflow: hidden; background: #fff; box-sizing: border-box; }
            
            .badge { background-color: #000; color: #fff; padding: 8px 25px; border-radius: 50px; font-size: 13px; font-weight: 900; text-transform: uppercase; letter-spacing: 4px; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
            
            .meio-container { flex: 1; display: flex; flex-direction: column; justify-content: center; align-items: center; width: 100%; padding: 0 5px; }
            
            /* Margem aumentada de 15px para 35px para criar a "quebra de linha" visual */
            .mesa { font-size: 48px; font-weight: 900; line-height: 1; color: #000; white-space: nowrap; margin-bottom: 35px; }
            .cliente-label { font-size: 13px; color: #000; text-transform: uppercase; letter-spacing: 3px; margin-bottom: 8px; font-weight: bold; opacity: 0.8; }
            
            .cliente-nome { font-weight: 900; color: #000; text-transform: uppercase; word-break: keep-all; overflow-wrap: normal; max-width: 100%; line-height: 1.05; }
            
            .logo-rodape { display: flex; flex-direction: column; align-items: center; gap: 6px; width: 100%; }
            .logo-rodape img { height: 65px; width: 65px; object-fit: cover; border-radius: 50%; border: 3px solid #000; }
            .logo-texto { font-size: 12px; font-weight: 900; color: #000; text-transform: uppercase; letter-spacing: 2px; }
        `;
    } else if (layoutOpcao === 'a4_2') {
        htmlStr += `
            @page { size: A4 portrait; margin: 0; }
            body { width: 210mm; }
            .folha-a4 { width: 210mm; height: 296mm; padding: 15mm; display: grid; grid-template-columns: 1fr; grid-template-rows: 1fr 1fr; gap: 20px; page-break-after: always; margin: 0 auto; }
            .folha-a4:last-child { page-break-after: auto; }
            
            .card { border: 6px solid #000; border-radius: 20px; display: flex; flex-direction: column; justify-content: space-between; align-items: center; text-align: center; padding: 45px 30px; overflow: hidden; background: #fff; box-sizing: border-box; }
            
            .badge { background-color: #000; color: #fff; padding: 10px 35px; border-radius: 50px; font-size: 16px; font-weight: 900; text-transform: uppercase; letter-spacing: 5px; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
            
            .meio-container { flex: 1; display: flex; flex-direction: column; justify-content: center; align-items: center; width: 100%; padding: 0 10px; }
            
            /* Margem aumentada de 25px para 55px */
            .mesa { font-size: 65px; font-weight: 900; line-height: 1; color: #000; white-space: nowrap; margin-bottom: 55px; }
            .cliente-label { font-size: 16px; color: #000; text-transform: uppercase; letter-spacing: 4px; margin-bottom: 12px; font-weight: bold; opacity: 0.8; }
            
            .cliente-nome { font-weight: 900; color: #000; text-transform: uppercase; word-break: keep-all; overflow-wrap: normal; max-width: 100%; line-height: 1.05; }
            
            .logo-rodape { display: flex; flex-direction: column; align-items: center; gap: 8px; width: 100%; }
            .logo-rodape img { height: 90px; width: 90px; object-fit: cover; border-radius: 50%; border: 4px solid #000; }
            .logo-texto { font-size: 14px; font-weight: 900; color: #000; text-transform: uppercase; letter-spacing: 2px; }
        `;
    } else if (layoutOpcao === 'termica_80') {
        htmlStr += `
            @media print { @page { margin: 0; size: ${cfg.pageWidth} auto; } }
            body { width: ${cfg.bodyWidth}; margin: 0 auto; color: #000 !important; background: #fff; }
            .wrapper-termico { width: 100%; padding: 6mm 0; page-break-after: always; break-after: page; box-sizing: border-box; }
            .wrapper-termico:last-child { page-break-after: avoid; }
            
            .card { border: 4px solid #000; border-radius: 16px; display: block; text-align: center; padding: 25px 15px; width: 96%; margin: 0 auto; box-sizing: border-box; }
            .badge { background-color: #000; color: #fff !important; padding: 6px 20px; border-radius: 50px; font-size: 11px; font-weight: 900; text-transform: uppercase; letter-spacing: 3px; display: inline-block; margin-bottom: 15px; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
            
            .meio-container { margin: 10px 0 20px 0; }
            
            /* Margem aumentada de 10px para 22px na térmica */
            .mesa { font-size: 28px; font-weight: 900; margin-bottom: 22px; line-height: 1; color: #000 !important; white-space: nowrap; }
            .cliente-label { font-size: 11px; color: #000 !important; text-transform: uppercase; letter-spacing: 2px; margin-bottom: 6px; font-weight: bold; display: block; opacity: 0.8; }
            
            .cliente-nome { font-weight: 900; color: #000 !important; text-transform: uppercase; word-break: keep-all; overflow-wrap: normal; max-width: 95%; margin: 0 auto; display: block; line-height: 1.1; }
            
            .logo-rodape { text-align: center; width: 100%; display: block; margin-top: 15px; }
            .logo-rodape img { height: 42px; width: 42px; object-fit: cover; border-radius: 50%; border: 2px solid #000; display: block; margin: 0 auto 5px auto; }
            .logo-texto { font-size: 11px; font-weight: 900; color: #000 !important; text-transform: uppercase; letter-spacing: 1px; display: block; }
        `;
    }

    htmlStr += `</style></head><body>`;

    const calcularTamanhoFonte = (texto, layout) => {
        if (layout === 'termica_80') return '24px'; 

        const palavras = texto.split(' ');
        const maiorPalavra = Math.max(...palavras.map(p => p.length));
        const totalLetras = texto.length;
        
        if (layout === 'a4_4') {
            if (maiorPalavra >= 12) return '30px'; 
            if (maiorPalavra >= 8) return '38px';
            if (totalLetras <= 12) return '46px'; 
            return '34px'; 
        }
        
        if (layout === 'a4_2') {
            if (maiorPalavra >= 12) return '50px';
            if (maiorPalavra >= 8) return '60px';
            if (totalLetras <= 12) return '75px'; 
            return '55px';
        }
    };

    let passoIncremento = layoutOpcao === 'a4_4' ? 4 : (layoutOpcao === 'a4_2' ? 2 : 1);

    for (let i = 0; i < listaFinal.length; i += passoIncremento) {
      const grupoMesas = listaFinal.slice(i, i + passoIncremento);
      if (layoutOpcao !== 'termica_80') htmlStr += `<div class="folha-a4">`;

      grupoMesas.forEach((item) => {
        const nomeResp = item.cliente.toUpperCase();
        const tamFonte = calcularTamanhoFonte(nomeResp, layoutOpcao);

        const badgeHtml = item.reservado 
            ? `<div class="badge">RESERVADO</div>` 
            : `<div class="badge" style="opacity: 0;">LIVRE</div>`;

        const clienteHtml = item.reservado ? `
            <div class="cliente-label">Responsável</div>
            <div class="cliente-nome" style="font-size: ${tamFonte} !important;">${nomeResp}</div>
        ` : "";

        if (layoutOpcao === 'termica_80') {
            htmlStr += `
                <div class="wrapper-termico">
                    <div class="card">
                        ${badgeHtml}
                        <div class="meio-container">
                            <div class="mesa">MESA ${String(item.mesa).padStart(2, "0")}</div>
                            ${clienteHtml}
                        </div>
                        <div class="logo-rodape">
                            <img src="img/logo.jpg?v=2" onerror="this.style.display='none'">
                            <span class="logo-texto">ESPETINHO & CIA</span>
                        </div>
                    </div>
                    <div style="font-size: 16px; line-height: 1.5; color: #fff;">&nbsp;<br>&nbsp;<br>&nbsp;</div>
                </div>
            `;
        } else {
            htmlStr += `
                <div class="card">
                    ${badgeHtml}
                    <div class="meio-container">
                        <div class="mesa">MESA ${String(item.mesa).padStart(2, "0")}</div>
                        ${clienteHtml}
                    </div>
                    <div class="logo-rodape">
                        <img src="img/logo.jpg?v=2" onerror="this.style.display='none'">
                        <span class="logo-texto">ESPETINHO & CIA</span>
                    </div>
                </div>
            `;
        }
      });

      if (layoutOpcao !== 'termica_80') htmlStr += `</div>`;
    }

    htmlStr += `</body></html>`;

    const doc = iframe.contentWindow.document;
    doc.open();
    doc.write(htmlStr);
    doc.close();

    setTimeout(() => {
      iframe.contentWindow.focus();
      iframe.contentWindow.print();
      setTimeout(() => { document.title = tituloOriginal; }, 1000);
      if (window.showToast) window.showToast("Lote de placas gerado com sucesso!", "sucesso");
    }, 1500);
  } catch (error) {
    console.error(error);
    if (window.showToast) window.showToast("Erro ao processar a base de dados.", "erro");
  }
};

window.salvarWhatsAppNotificacaoEdicao = async function () {
  if (!window.eventoIdAtivo) return;

  const input = document.getElementById("input-editar-whatsapp");
  let numeroLimpo = input.value.replace(/\D/g, "");

  // Se o usuário digitou sem o 55, a lógica abaixo garante que salve certo
  // Se o número tiver 11 ou 12 dígitos, ele assume que é um celular com DDD
  if (numeroLimpo.length >= 10 && numeroLimpo.length <= 11) {
    numeroLimpo = "55" + numeroLimpo;
  }

  try {
    const { error } = await _supabase
      .from("eventos")
      .update({ whatsapp_notificacao: numeroLimpo })
      .eq("id", String(window.eventoIdAtivo));

    if (error) throw error;

    window.whatsappNotificacaoAtivo = numeroLimpo;
    if (window.showToast) window.showToast("WhatsApp atualizado!", "sucesso");
  } catch (error) {
    if (window.showToast) window.showToast("Erro ao salvar.", "erro");
  }
};

window.mascaraTelefone = function (input) {
  let valor = input.value.replace(/\D/g, "");
  valor = valor.replace(/^(\d{2})(\d)/g, "($1) $2");
  valor = valor.replace(/(\d{5})(\d)/, "$1-$2");
  input.value = valor.substring(0, 15);
};

window.formatarTelefone = function (value) {
  if (!value) return "";
  let v = value.replace(/\D/g, "");

  // Se começar com 55, removemos para formatar apenas o número nacional
  if (v.startsWith("55")) {
    v = v.substring(2);
  }

  if (v.length > 9) {
    return `(${v.substring(0, 2)}) ${v.substring(2, 7)}-${v.substring(7)}`;
  } else if (v.length > 2) {
    return `(${v.substring(0, 2)}) ${v.substring(2)}`;
  } else if (v.length > 0) {
    return `(${v}`;
  }
  return v;
};

window.carregarWhatsAppNoModal = async function () {
  if (!window.eventoIdAtivo) return;

  try {
    const { data: evento, error } = await _supabase
      .from("eventos")
      .select("whatsapp_notificacao")
      .eq("id", String(window.eventoIdAtivo))
      .single();

    if (error) throw error;

    // Preenche o input se o dado existir
    const input = document.getElementById("input-editar-whatsapp");
    if (input && evento && evento.whatsapp_notificacao) {
      // Removemos o '55' apenas para exibir formatado no input (se desejar)
      // ou deixamos o número completo.
      input.value = evento.whatsapp_notificacao;
    }
  } catch (error) {
    console.error("Erro ao carregar WhatsApp para edição:", error);
  }
};

window.imprimirPlacaPatrocinadores = function (listaSelecionada = null, layoutOpcao = 'a4_4') {
    const nomes = listaSelecionada || window.patrocinadoresEventoAtivo || [];
    if (nomes.length === 0) return alert("Nenhum patrocinador para imprimir!");

    const nomeEvento = window.nomeEventoAtivo || "ESPETINHO & CIA";
    const baseUrl = window.location.origin + window.location.pathname.substring(0, window.location.pathname.lastIndexOf("/") + 1);

    const cfg = typeof obterConfiguracoesImpressora === 'function' ? obterConfiguracoesImpressora() : { pageWidth: '80mm', bodyWidth: '72mm' };

    let htmlStr = `<!DOCTYPE html>
    <html>
    <head>
        <meta charset="UTF-8">
        <base href="${baseUrl}">
        <style>
            * { box-sizing: border-box; margin: 0; padding: 0; }
            body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #fff; color: #000; }
    `;

    if (layoutOpcao === 'a4_4') {
        htmlStr += `
            @page { size: A4 portrait; margin: 0; }
            body { width: 210mm; }
            .folha-a4 { width: 210mm; height: 296mm; padding: 10mm; display: grid; grid-template-columns: 1fr 1fr; grid-template-rows: 1fr 1fr; gap: 15px; page-break-after: always; margin: 0 auto; box-sizing: border-box; }
            .folha-a4:last-child { page-break-after: auto; }
            
            .card { border: 5px solid #000; border-radius: 16px; display: flex; flex-direction: column; justify-content: space-between; align-items: center; text-align: center; padding: 30px 20px; overflow: hidden; background: #fff; box-sizing: border-box; }
            
            .badge { background-color: #000; color: #fff; padding: 8px 25px; border-radius: 50px; font-size: 13px; font-weight: 900; text-transform: uppercase; letter-spacing: 4px; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
            
            .meio-container { flex: 1; display: flex; flex-direction: column; justify-content: center; align-items: center; width: 100%; padding: 0 5px; }
            
            /* TRAVA ANTI-QUEBRA DE PALAVRA APLICADA AQUI */
            .patrocinador-nome { font-weight: 900; color: #000; text-transform: uppercase; word-break: keep-all; overflow-wrap: normal; max-width: 100%; line-height: 1.1; }
            
            .cota-badge { border: 2px solid #000; color: #000; padding: 6px 18px; border-radius: 8px; font-size: 13px; font-weight: 900; letter-spacing: 2px; margin-top: 15px; text-transform: uppercase; }
            
            .logo-rodape { display: flex; flex-direction: column; align-items: center; gap: 6px; width: 100%; }
            .logo-rodape img { height: 75px; width: 75px; object-fit: cover; border-radius: 50%; border: 3px solid #000; }
            .logo-texto { font-size: 12px; font-weight: 900; color: #000; text-transform: uppercase; letter-spacing: 2px; }
        `;
    } else if (layoutOpcao === 'a4_2') {
        htmlStr += `
            @page { size: A4 portrait; margin: 0; }
            body { width: 210mm; }
            .folha-a4 { width: 210mm; height: 296mm; padding: 15mm; display: grid; grid-template-columns: 1fr; grid-template-rows: 1fr 1fr; gap: 20px; page-break-after: always; margin: 0 auto; box-sizing: border-box; }
            .folha-a4:last-child { page-break-after: auto; }
            
            .card { border: 6px solid #000; border-radius: 20px; display: flex; flex-direction: column; justify-content: space-between; align-items: center; text-align: center; padding: 50px 30px; overflow: hidden; background: #fff; box-sizing: border-box; }
            
            .badge { background-color: #000; color: #fff; padding: 10px 35px; border-radius: 50px; font-size: 16px; font-weight: 900; text-transform: uppercase; letter-spacing: 5px; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
            
            .meio-container { flex: 1; display: flex; flex-direction: column; justify-content: center; align-items: center; width: 100%; padding: 0 10px; }
            
            /* TRAVA ANTI-QUEBRA DE PALAVRA APLICADA AQUI */
            .patrocinador-nome { font-weight: 900; color: #000; text-transform: uppercase; word-break: keep-all; overflow-wrap: normal; max-width: 100%; line-height: 1.1; }
            
            .cota-badge { border: 3px solid #000; color: #000; padding: 8px 24px; border-radius: 10px; font-size: 18px; font-weight: 900; letter-spacing: 3px; margin-top: 25px; text-transform: uppercase; }
            
            .logo-rodape { display: flex; flex-direction: column; align-items: center; gap: 8px; width: 100%; }
            .logo-rodape img { height: 110px; width: 110px; object-fit: cover; border-radius: 50%; border: 4px solid #000; }
            .logo-texto { font-size: 15px; font-weight: 900; color: #000; text-transform: uppercase; letter-spacing: 2px; }
        `;
    } else if (layoutOpcao === 'termica_80') {
        htmlStr += `
            @media print { @page { margin: 0; size: ${cfg.pageWidth} auto; } }
            body { width: ${cfg.bodyWidth}; margin: 0 auto; color: #000 !important; background: #fff; }
            .wrapper-termico { width: 100%; padding: 6mm 0; page-break-after: always; break-after: page; box-sizing: border-box; }
            .wrapper-termico:last-child { page-break-after: avoid; }
            
            .card { border: 4px solid #000; border-radius: 16px; display: block; text-align: center; padding: 25px 15px; width: 96%; margin: 0 auto; box-sizing: border-box; }
            .badge { background-color: #000; color: #fff !important; padding: 6px 20px; border-radius: 50px; font-size: 11px; font-weight: 900; text-transform: uppercase; letter-spacing: 3px; display: inline-block; margin-bottom: 20px; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
            
            .meio-container { margin: 10px 0 25px 0; }
            /* TRAVA ANTI-QUEBRA DE PALAVRA APLICADA AQUI */
            .patrocinador-nome { font-weight: 900; color: #000 !important; text-transform: uppercase; word-break: keep-all; overflow-wrap: normal; line-height: 1.1; }
            
            .cota-badge { border-top: 2px dashed #000; padding-top: 8px; margin-top: 10px; font-size: 12px; font-weight: 900; letter-spacing: 2px; text-transform: uppercase; display: inline-block; color: #000 !important; }
            
            .logo-rodape { text-align: center; width: 100%; display: block; margin-top: 15px; }
            .logo-rodape img { height: 42px; width: 42px; object-fit: cover; border-radius: 50%; border: 2px solid #000; display: block; margin: 0 auto 5px auto; }
            .logo-texto { font-size: 11px; font-weight: 900; color: #000 !important; text-transform: uppercase; letter-spacing: 1px; display: block; }
        `;
    }

    htmlStr += `</style></head><body>`;

    // MOTOR INTELIGENTE: Mede a maior palavra e o tamanho total para estourar a fonte com segurança
    const calcularTamanhoFontePatroc = (texto, layout) => {
        if (layout === 'termica_80') return '26px';

        // Separa o nome em palavras para descobrir o tamanho do maior bloco indivisível
        const palavras = texto.split(' ');
        const maiorPalavra = Math.max(...palavras.map(p => p.length));
        const totalLetras = texto.length;
        
        if (layout === 'a4_4') {
            // Se tiver uma palavra monstruosa tipo "SOBRANCELHAS" (12 letras)
            if (maiorPalavra >= 12) return '35px';
            // Palavras médias ("MARCINHA", "SAMUEL")
            if (maiorPalavra >= 8) return '45px';
            // Frases curtas e nomes pequenos explodem de tamanho
            if (totalLetras <= 12) return '60px'; 
            return '40px'; 
        }
        
        if (layout === 'a4_2') {
            if (maiorPalavra >= 12) return '62px';
            if (maiorPalavra >= 8) return '75px';
            if (totalLetras <= 12) return '95px';
            return '68px';
        }
    };

    let passoIncremento = layoutOpcao === 'a4_4' ? 4 : (layoutOpcao === 'a4_2' ? 2 : 1);

    for (let i = 0; i < nomes.length; i += passoIncremento) {
        const grupo = nomes.slice(i, i + passoIncremento);
        if (layoutOpcao !== 'termica_80') htmlStr += `<div class="folha-a4">`;

        grupo.forEach((nome) => {
            const nomeFormatado = typeof nome === "object" ? nome.nome : nome;
            const nomeUpper = nomeFormatado.toUpperCase().trim();
            
            const tamFonte = calcularTamanhoFontePatroc(nomeUpper, layoutOpcao);
            
            const cotaExtra = typeof nome === "object" && nome.cota 
                ? `<div class="cota-badge">COTA ${nome.cota.toUpperCase()}</div>` 
                : '';
            
            if (layoutOpcao === 'termica_80') {
                htmlStr += `
                    <div class="wrapper-termico">
                        <div class="card">
                            <div class="badge">Patrocinador</div>
                            <div class="meio-container">
                                <div class="patrocinador-nome" style="font-size: ${tamFonte} !important;">
                                    ${nomeUpper}
                                </div>
                                ${cotaExtra}
                            </div>
                            <div class="logo-rodape">
                                <img src="img/logo.jpg?v=2" onerror="this.style.display='none'">
                                <span class="logo-texto">ESPETINHO & CIA</span>
                            </div>
                        </div>
                        <div style="font-size: 16px; line-height: 1.5; color: #fff;">&nbsp;<br>&nbsp;<br>&nbsp;</div>
                    </div>
                `;
            } else {
                htmlStr += `
                    <div class="card">
                        <div class="badge">Patrocinador</div>
                        <div class="meio-container">
                            <div class="patrocinador-nome" style="font-size: ${tamFonte} !important;">
                                ${nomeUpper}
                            </div>
                            ${cotaExtra}
                        </div>
                        <div class="logo-rodape">
                            <img src="img/logo.jpg?v=2" onerror="this.style.display='none'">
                            <span class="logo-texto">ESPETINHO & CIA</span>
                        </div>
                    </div>
                `;
            }
        });

        if (layoutOpcao !== 'termica_80') htmlStr += `</div>`;
    }

    htmlStr += `</body></html>`;

    if (typeof window.imprimirConteudoIframe === "function") {
        window.imprimirConteudoIframe(htmlStr, "Placas_Patrocinadores");
    } else {
        const win = window.open("", "_blank");
        win.document.write(htmlStr);
        win.document.close();
        setTimeout(() => { win.print(); win.close(); }, 800);
    }
};

/**
 * GERENCIADOR DE PATROCINADORES - MÓDULO CONSOLIDADO
 */

// 1. Abertura do Modal Centralizado
window.abrirModalAdminPatrocinadores = async function () {
  await window.carregarPatrocinadores();
  document
    .getElementById("modal-admin-patrocinadores")
    .classList.remove("hidden");
  window.renderizarListaPatrocinadores();
};

// Adicione isso à sua função de fechar
window.fecharModalAdminPatrocinadores = function () {
  document.getElementById("modal-admin-patrocinadores").classList.add("hidden");
  // Reseta o formulário
  document.getElementById("novo-patrocinador-nome").value = "";
  document.querySelector(
    '#modal-admin-patrocinadores form button[type="submit"]',
  ).innerText = "+";
  document.querySelector("#modal-admin-patrocinadores form label").innerText =
    "Adicionar Patrocinador";
  window.modoEdicaoIndex = null;
};

// 2. Carregamento dos dados do Supabase (Tratativa JSON)
window.carregarPatrocinadores = async function () {
  try {
    const { data, error } = await _supabase
      .from("eventos")
      .select("patrocinadores")
      .eq("id", window.eventoIdAtivo)
      .single();

    if (error) throw error;

    if (data && data.patrocinadores) {
      window.patrocinadoresEventoAtivo =
        typeof data.patrocinadores === "string"
          ? JSON.parse(data.patrocinadores)
          : data.patrocinadores;
    } else {
      window.patrocinadoresEventoAtivo = [];
    }
    return window.patrocinadoresEventoAtivo;
  } catch (err) {
    console.error("Erro ao carregar patrocinadores:", err);
    return [];
  }
};

// 3. Renderização da Lista no Modal
window.renderizarListaPatrocinadores = function () {
  const container = document.getElementById("lista-admin-patrocinadores");
  const lista = window.patrocinadoresEventoAtivo || [];

  container.innerHTML =
    lista.length > 0
      ? lista
          .map(
            (p, index) => `
            <div class="flex justify-between items-center bg-white dark:bg-slate-900 p-3 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm hover:shadow-md transition-all">
                <span class="text-xs font-black text-slate-700 dark:text-slate-200 uppercase tracking-wide">${p.nome}</span>
                <div class="flex items-center gap-2">
                    <button onclick="window.editarPatrocinador(${index})" class="bg-blue-50 border border-blue-100 text-blue-600 w-9 h-9 flex items-center justify-center rounded-lg hover:bg-blue-100 transition-all">
                        ✏️
                    </button>
                    <button onclick="window.removerPatrocinador(${index})" class="bg-red-50 border border-red-100 text-red-600 w-9 h-9 flex items-center justify-center rounded-lg hover:bg-red-100 transition-all">
                        🗑️
                    </button>
                </div>
            </div>
        `,
          )
          .join("")
      : '<p class="text-xs text-slate-400 italic px-2">Nenhum cadastrado ainda.</p>';
};

// 4. Ações de CRUD (Salvar, Editar, Remover)
// 1. Variável global para controle (coloque no topo do seu script)
window.modoEdicaoIndex = null;

// 2. Função de Salvar (Ajustada)
window.salvarNovoPatrocinador = async function (event) {
  if (event) event.preventDefault();

  const input = document.getElementById("novo-patrocinador-nome");
  const nome = input.value.trim();
  if (!nome) return;

  let lista = window.patrocinadoresEventoAtivo || [];

  // LÓGICA DE EDIÇÃO: Verifica se o índice é um número válido
  if (window.modoEdicaoIndex !== null && window.modoEdicaoIndex !== undefined) {
    lista[window.modoEdicaoIndex].nome = nome;
    window.modoEdicaoIndex = null; // Reseta após salvar a edição
  } else {
    // LÓGICA DE ADIÇÃO
    lista.push({ nome });
  }

  const { error } = await _supabase
    .from("eventos")
    .update({ patrocinadores: JSON.stringify(lista) })
    .eq("id", window.eventoIdAtivo);

  if (!error) {
    window.patrocinadoresEventoAtivo = lista;
    input.value = "";

    // Reset visual do botão e label
    document.querySelector(
      '#modal-admin-patrocinadores form button[type="submit"]',
    ).innerText = "+";
    document.querySelector("#modal-admin-patrocinadores form label").innerText =
      "Adicionar Patrocinador";

    window.renderizarListaPatrocinadores();
  } else {
    alert("Erro ao salvar no banco!");
  }
};

// 3. Função de Editar (Ajustada para garantir que o índice seja gravado)
window.editarPatrocinador = function (index) {
  const lista = window.patrocinadoresEventoAtivo || [];
  const patrocinador = lista[index];

  // Armazena o índice do que estamos editando
  window.modoEdicaoIndex = index;

  // Preenche o input
  const input = document.getElementById("novo-patrocinador-nome");
  input.value = patrocinador.nome;
  input.focus();

  // Muda o visual para indicar modo edição
  document.querySelector(
    '#modal-admin-patrocinadores form button[type="submit"]',
  ).innerText = "🔄";
  document.querySelector("#modal-admin-patrocinadores form label").innerText =
    "Editando Patrocinador";
};

window.removerPatrocinador = async function (index) {
  let lista = window.patrocinadoresEventoAtivo || [];
  lista.splice(index, 1);

  await _supabase
    .from("eventos")
    .update({ patrocinadores: JSON.stringify(lista) })
    .eq("id", window.eventoIdAtivo);

  window.patrocinadoresEventoAtivo = lista;
  window.renderizarListaPatrocinadores();
};


// =========================================================================
// COMPRESSOR DE IMAGEM PARA O MAPA DO EVENTO
// =========================================================================
window.comprimirImagemMapa = function(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        
        reader.onload = (event) => {
            const img = new Image();
            img.src = event.target.result;
            
            img.onload = () => {
                const canvas = document.createElement('canvas');
                // Trava o tamanho máximo para 1200px (excelente para mapas, leve para o banco)
                const MAX_WIDTH = 1200;
                const MAX_HEIGHT = 1200;
                let width = img.width;
                let height = img.height;

                if (width > height) {
                    if (width > MAX_WIDTH) { height *= MAX_WIDTH / width; width = MAX_WIDTH; }
                } else {
                    if (height > MAX_HEIGHT) { width *= MAX_HEIGHT / height; height = MAX_HEIGHT; }
                }

                canvas.width = width;
                canvas.height = height;
                
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, width, height);
                
                // Qualidade de 70% em JPEG
                const dataUrl = canvas.toDataURL('image/jpeg', 0.7);
                resolve(dataUrl);
            };
            img.onerror = error => reject(error);
        };
        reader.onerror = error => reject(error);
    });
};

window.salvarEvento = async function(event) {
    if (event) event.preventDefault();

    // Captura os dados do HTML (verifique se os IDs batem com seu formulário)
    // Aqui assumi ev-id para edição, e ev-nome para o título. Ajuste se necessário!
    const idInput = document.getElementById('ev-id');
    const idEvento = idInput ? idInput.value : null; 
    
    const inputNome = document.getElementById('ev-nome');
    const nome = inputNome ? inputNome.value.trim().toUpperCase() : 'NOVO EVENTO';

    if (!nome) {
        if (typeof showToast === 'function') showToast("Dê um nome ao evento!", "erro");
        return;
    }

    // Trava o botão para não enviar duas vezes
    const btnSalvar = document.getElementById('btn-salvar-evento');
    if (btnSalvar) btnSalvar.disabled = true;

    try {
        // --- MÁGICA DA IMAGEM ---
        const inputMapa = document.getElementById('ev-mapa');
        let mapaBase64 = null;
        
        if (inputMapa && inputMapa.files.length > 0) {
            if (typeof showToast === 'function') showToast("Processando imagem do mapa...", "info");
            mapaBase64 = await window.comprimirImagemMapa(inputMapa.files[0]);
        }

        // Monta os dados para o Supabase
        const dadosEvento = {
            nome: nome,
            // (Adicione aqui outros campos do seu evento: data, status, etc)
            // ex: data: document.getElementById('ev-data').value
        };

        // Só atualiza a imagem no banco se o usuário tiver feito upload de uma nova
        if (mapaBase64) {
            dadosEvento.mapa_url = mapaBase64;
        }

        // Envia pro Banco
        if (idEvento) {
            // Se tem ID, é Edição (Update)
            const { error } = await _supabase.from('eventos').update(dadosEvento).eq('id', idEvento);
            if (error) throw error;
        } else {
            // Se não tem ID, é Novo Evento (Insert)
            const { error } = await _supabase.from('eventos').insert([dadosEvento]);
            if (error) throw error;
        }

        if (typeof showToast === 'function') showToast("Evento salvo com sucesso!", "sucesso");
        
        // Limpa o formulário e atualiza a tela
        if (inputMapa) inputMapa.value = '';
        if (typeof fecharModalFormEvento === 'function') fecharModalFormEvento();
        if (typeof carregarEventos === 'function') carregarEventos(); // Recarrega a lista

    } catch (e) {
        console.error("Erro ao salvar evento:", e);
        if (typeof showToast === 'function') showToast("Erro de conexão ao salvar.", "erro");
    } finally {
        // Libera o botão
        if (btnSalvar) btnSalvar.disabled = false;
    }
};

window.salvarNovoMapa = async function() {
    const input = document.getElementById('input-atualizar-mapa');
    const idEvento = document.getElementById('rm-evento-id').value; // Usamos o ID que já está oculto no modal

    if (!idEvento) {
        if (typeof showToast === 'function') showToast("Erro: ID do evento não encontrado.", "erro");
        return;
    }

    if (!input.files || input.files.length === 0) {
        if (typeof showToast === 'function') showToast("Por favor, selecione uma imagem do seu dispositivo.", "erro");
        return;
    }

    const btn = document.getElementById('btn-salvar-mapa');
    const textoOriginal = btn.innerText;
    btn.innerText = "COMPRIMINDO...";
    btn.disabled = true;

    try {
        // 1. Usa o compressor para diminuir o tamanho da foto
        const mapaBase64 = await window.comprimirImagemMapa(input.files[0]);

        btn.innerText = "SALVANDO NO BANCO...";

        // 2. Salva a string Base64 direto na coluna mapa_url do evento específico
        const { error } = await _supabase
            .from('eventos')
            .update({ mapa_url: mapaBase64 })
            .eq('id', idEvento);

        if (error) throw error;

        if (typeof showToast === 'function') showToast("Mapa atualizado com sucesso!", "sucesso");
        
        // 3. Limpa o input após o sucesso
        input.value = '';

        // 4. Se a tela de eventos estiver aberta no fundo, recarrega os dados
        if (typeof carregarEventos === 'function') {
            carregarEventos();
        }

    } catch (error) {
        console.error("Erro ao salvar novo mapa:", error);
        if (typeof showToast === 'function') {
            showToast("Erro ao processar imagem.", "erro");
        }
    } finally {
        // Volta o botão ao normal
        btn.innerText = textoOriginal;
        btn.disabled = false;
    }
};

// ==========================================
// GERENCIAMENTO DE MESAS OCUPADAS PELO MAPA
// ==========================================

window.abrirModalMesaOcupada = function(idReserva, nomeCliente, arrayMesas) {
    document.getElementById('mesa-ocupada-id').value = idReserva;
    document.getElementById('mesa-ocupada-nome').value = nomeCliente;

    const stringMesas = Array.isArray(arrayMesas) ? arrayMesas.join(', ') : arrayMesas;
    document.getElementById('mesa-ocupada-numeros').innerText = `Mesa(s): ${stringMesas}`;

    document.getElementById('modal-mesa-ocupada').classList.remove('hidden');
};

window.fecharModalMesaOcupada = function() {
    document.getElementById('modal-mesa-ocupada').classList.add('hidden');
};

window.salvarNomeMesaOcupada = async function() {
    const id = document.getElementById('mesa-ocupada-id').value;
    const novoNome = document.getElementById('mesa-ocupada-nome').value.trim();

    if (!id || !novoNome) {
        if(window.showToast) window.showToast("O nome não pode ficar vazio.", "aviso");
        return;
    }

    try {
        const { error } = await _supabase
            .from('reservas_evento')
            .update({ cliente_nome: novoNome })
            .eq('id', id);

        if (error) throw error;

        if(window.showToast) window.showToast("Nome atualizado com sucesso!", "sucesso");
        window.fecharModalMesaOcupada();

        // Atualiza a tela de listagem por trás e recarrega o mapa
        if (typeof window.atualizarListaSolicitacoes === 'function') window.atualizarListaSolicitacoes();
        window.abrirMapaOcupacao();

    } catch (error) {
        console.error(error);
        if(window.showToast) window.showToast("Erro ao atualizar o nome.", "erro");
    }
};

window.cancelarMesaOcupada = async function() {
    const id = document.getElementById('mesa-ocupada-id').value;
    if(!id) return;

    // Usa a sua trava de segurança impecável
    const confirmado = await window.confirmarAcaoCustom(
        "Cancelar Reserva",
        "Tem certeza que deseja cancelar e liberar esta mesa permanentemente?",
        true
    );

    if (!confirmado) return;

    try {
        const { error } = await _supabase
            .from('reservas_evento')
            .delete()
            .eq('id', id);

        if (error) throw error;

        if(window.showToast) window.showToast("Reserva cancelada e mesa liberada!", "sucesso");
        window.fecharModalMesaOcupada();

        // Atualiza a tela de listagem por trás e recarrega o mapa visualmente livre
        if (typeof window.atualizarListaSolicitacoes === 'function') window.atualizarListaSolicitacoes();
        window.abrirMapaOcupacao();

    } catch(error) {
        console.error(error);
        if(window.showToast) window.showToast("Erro ao liberar mesa.", "erro");
    }
};