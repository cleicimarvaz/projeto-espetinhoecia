// ==========================================
// MÓDULO ADMINISTRATIVO: GESTÃO DE EVENTOS
// ==========================================
// 1. Variáveis globais de controle para memória
window.listaReservasLocal = []; 
window.filtroStatusAtual = 'todas';
window.eventoIdAtivo = null;


document.addEventListener('DOMContentLoaded', () => {
    carregarEventosAdmin();
});

// ==========================================
// 1. CARREGAMENTO E LISTAGEM
// ==========================================
window.carregarEventosAdmin = async function() {
    try {
        const { data: eventos, error } = await _supabase
            .from('eventos')
            .select('*')
            .order('data_evento', { ascending: true });

        if (error) throw error;

        // Salva na variável global para o filtro usar depois
        window.listaEventosCompleta = eventos || [];

        // Chama o filtro para renderizar pela primeira vez
        window.filtrarEventos();

    } catch (error) {
        console.error("Erro ao carregar eventos:", error);
    }
};

window.filtrarEventos = function() {
    const apenasAtivos = document.getElementById('filtro-ativos').checked;
    
    if (!window.listaEventosCompleta) return;

    const eventosFiltrados = apenasAtivos 
        ? window.listaEventosCompleta.filter(ev => ev.status === 'ativo')
        : window.listaEventosCompleta;

    // Renderiza usando a nova função unificada
    window.renderizarCardsEventos(eventosFiltrados);
};

// Este é o "motor" que desenha os cards na tela.
// Coloque esta função no seu eventos.js
window.renderizarCardsEventos = function(eventos) {
    const container = document.getElementById('lista-eventos-admin');
    if (!container) {
        console.error("Elemento 'lista-eventos-admin' não encontrado no HTML!");
        return;
    }

    // Limpa o conteúdo atual
    container.innerHTML = '';

    if (!eventos || eventos.length === 0) {
        container.innerHTML = '<div class="col-span-full p-8 text-center text-slate-400 font-bold bg-white dark:bg-slate-900 rounded-[2rem] border border-dashed border-slate-300 dark:border-slate-700">Nenhum evento encontrado.</div>';
        return;
    }

    // Renderiza os novos cards
    container.innerHTML = eventos.map(ev => {
        const dataFormatada = new Date(ev.data_evento).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
        const valorFormatado = parseFloat(ev.valor_mesa).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
        const nomeEscapado = ev.nome.replace(/'/g, "\\'");
        
        return `
            <div class="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-[2rem] p-6 shadow-sm flex flex-col justify-between">
                <div>
                    <div class="flex justify-between items-start mb-2">
                        <h4 class="font-black text-lg text-slate-800 dark:text-white uppercase tracking-tighter leading-tight">${ev.nome}</h4>
                        <span class="text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-full ${ev.status === 'ativo' ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}">
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
    }).join('');

    // Dispara a atualização dos badges após renderizar
    if (typeof window.atualizarTodosOsBadges === 'function') {
        window.atualizarTodosOsBadges();
    }
};

window.filtrarEventos = function() {
    const apenasAtivos = document.getElementById('filtro-ativos').checked;
    
    if (!window.listaEventosCompleta) return;

    // Filtra os eventos
    const eventosFiltrados = apenasAtivos 
        ? window.listaEventosCompleta.filter(ev => {
            // Ajuste aqui a sua lógica: Exemplo, coluna 'status' igual a 'ativo'
            // Ou se preferir por data: new Date(ev.data_evento) >= new Date()
            return ev.status === 'ativo'; 
        })
        : window.listaEventosCompleta;

    // Chama a sua função original de renderização
    renderizarCardsEventos(eventosFiltrados); 
};

// Quando carregar a página inicialmente:
// 1. Busque do Supabase
// 2. Salve: window.listaEventosCompleta = dadosDoSupabase;
// 3. Chame: window.filtrarEventos();

// 2. Função para atualizar os cards do Dashboard Financeiro
window.atualizarDashboardFinanceiro = async function(eventoId) {
    try {
        // Busca os detalhes do evento para saber o valor da mesa e capacidade
        const { data: evento } = await _supabase.from('eventos').select('quantidade_mesas, valor_mesa').eq('id', eventoId).single();
        if (!evento) return;

        const valorMesa = parseFloat(evento.valor_mesa) || 0;
        const capacidade = parseInt(evento.quantidade_mesas) || 0;

        let mesasOcupadas = 0;
        let receitaGarantida = 0;
        let receitaPendente = 0;

        // Percorre as reservas na memória para calcular
        window.listaReservasLocal.forEach(res => {
            // Conta quantas mesas tem nessa reserva
            let qtdMesas = 0;
            if (Array.isArray(res.mesas)) qtdMesas = res.mesas.length;
            else if (res.mesas) qtdMesas = 1; // Se for um número único
            
            // Ignora o valor financeiro se for CORTESIA ou BLOQUEIO técnico
            const isCortesia = res.tipo === 'CORTESIA' || res.tipo === 'BLOQUEIO';

            if (res.status === 'confirmada') {
                mesasOcupadas += qtdMesas;
                if (!isCortesia) receitaGarantida += (qtdMesas * valorMesa);
            } else if (res.status === 'pendente') {
                if (!isCortesia) receitaPendente += (qtdMesas * valorMesa);
            }
        });

        // Injeta os valores na tela
        document.getElementById('dash-capacidade').innerText = `${mesasOcupadas} / ${capacidade}`;
        document.getElementById('dash-receita').innerText = receitaGarantida.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
        document.getElementById('dash-pendente').innerText = receitaPendente.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

    } catch (err) {
        console.error("Erro ao gerar dashboard:", err);
    }
};

// ==========================================
// FILTROS E BUSCA EM TEMPO REAL
// ==========================================

window.filtrarReservas = function(status) {
    // Atualiza a variável global que guarda o filtro clicado
    window.filtroStatusAtual = status;
    window.aplicarFiltrosEBusca();
};

window.aplicarFiltrosEBusca = function() {
    // 1. Pega o texto digitado de forma segura
    const inputBusca = document.getElementById('input-busca-reserva');
    const termoBusca = inputBusca ? inputBusca.value.toLowerCase().trim() : '';

    // 2. Filtra a lista que está na memória local
    const reservasFiltradas = window.listaReservasLocal.filter(res => {
        
        // --- Regra 1: Filtro de Botões (Todas / Pendentes / Confirmadas) ---
        // Força tudo para minúsculo para garantir que vai achar, independente de como está no banco
        const statusReserva = String(res.status || '').toLowerCase();
        const passaStatus = window.filtroStatusAtual === 'todas' || statusReserva === window.filtroStatusAtual;

        // --- Regra 2: Filtro de Busca por Texto ---
        // Usa o cliente_nome corretamente
        const nomeCliente = String(res.cliente_nome || res.nome || '').toLowerCase();
        const mesaStr = Array.isArray(res.mesas) ? res.mesas.join(', ') : String(res.mesas || '');
        
        // Verifica se o texto digitado bate com o nome ou com o número da mesa
        const passaBusca = termoBusca === '' || nomeCliente.includes(termoBusca) || mesaStr.includes(termoBusca);

        // A reserva só aparece na tela se passar nas duas regras
        return passaStatus && passaBusca;
    });

    // 3. Manda a lista já filtrada para desenhar na tela
    window.desenharCardsReservas(reservasFiltradas);
};

window.copiarLinkEvento = function(id) {
    // 1. Pega o caminho atual da URL (ex: /projeto-espetinhoecia/painel.html)
    const pathParts = window.location.pathname.split('/');
    
    // 2. Remove o nome do arquivo atual para ficar apenas com a pasta
    pathParts.pop(); 
    
    // 3. Reconstrói o caminho completo da base + o arquivo correto
    const baseUrl = window.location.origin + pathParts.join('/') + '/reserva.html';
    
    const link = `${baseUrl}?e=${id}`;

    // 4. Copia para o clipboard
    navigator.clipboard.writeText(link).then(() => {
        if(window.showToast) window.showToast("Link copiado para a área de transferência!", "sucesso");
        else alert("Link copiado!");
    });
};

window.atualizarTodosOsBadges = async function() {
    try {
        // Busca todas as reservas pendentes de todos os eventos de uma vez
        const { data: reservas, error } = await _supabase
            .from('reservas_evento')
            .select('evento_id, status')
            .eq('status', 'pendente');

        if (error) throw error;

        // Limpa todos os contadores primeiro (esconde todos)
        document.querySelectorAll('[id^="badge-pendencia-"]').forEach(el => el.classList.add('hidden'));

        // Preenche apenas os que possuem pendências
        reservas.forEach(res => {
            const badge = document.getElementById(`badge-pendencia-${res.evento_id}`);
            if (badge) {
                // Incrementa o contador
                let atual = parseInt(badge.innerText) || 0;
                badge.innerText = atual + 1;
                badge.classList.remove('hidden');
            }
        });
    } catch (err) {
        console.error("Erro ao atualizar badges:", err);
    }
};

// ==========================================
// 2. CRIAÇÃO DE NOVO EVENTO E CONTROLE DO MODAL
// ==========================================

window.abrirModalNovoEvento = function() {
    document.getElementById('modal-novo-evento').classList.remove('hidden');
};

window.fecharModalNovoEvento = function() {
    document.getElementById('modal-novo-evento').classList.add('hidden');
    document.getElementById('form-novo-evento').reset();
};

window.salvarNovoEvento = async function(e) {
    e.preventDefault();
    const btn = document.getElementById('btn-salvar-evento');
    btn.disabled = true;
    btn.innerText = "CRIANDO...";

    try {
        const valorTexto = document.getElementById('ev-valor').value;
        const valorNumerico = parseFloat(valorTexto.replace('R$', '').replace(/\./g, '').replace(',', '.').trim());

        if (isNaN(valorNumerico)) throw new Error("Valor da mesa inválido.");

        let mapaUrl = null;
        const fileInput = document.getElementById('ev-mapa');
        
        if (fileInput.files.length > 0) {
            const file = fileInput.files[0];
            const path = `mapas/${Date.now()}_${file.name}`;
            const { error: uploadError } = await _supabase.storage.from('eventos').upload(path, file);
            if (uploadError) throw uploadError;
            
            const { data } = _supabase.storage.from('eventos').getPublicUrl(path);
            mapaUrl = data.publicUrl;
        }

        const novoEvento = {
            nome: document.getElementById('ev-nome').value,
            data_evento: document.getElementById('ev-data').value,
            valor_mesa: valorNumerico,
            quantidade_mesas: parseInt(document.getElementById('ev-qtd-mesas').value),
            mapa_url: mapaUrl,
            status: 'ativo'
        };

        const { error } = await _supabase.from('eventos').insert([novoEvento]);
        if (error) throw error;

        if(window.showToast) window.showToast("Evento criado com sucesso!", "sucesso");
        
        document.getElementById('form-novo-evento').reset();
        window.fecharModalNovoEvento();
        window.carregarEventosAdmin();

    } catch (error) {
        console.error("Erro ao criar evento:", error);
        if(window.showToast) window.showToast("Erro: " + error.message, "erro");
    } finally {
        btn.disabled = false;
        btn.innerText = "CRIAR EVENTO";
    }
};

// ==========================================
// 3. GESTÃO DE RESERVAS (APROVAÇÃO E LISTAGEM)
// ==========================================
window.abrirGestaoReservas = function(id, nome) {
    window.eventoIdAtivo = id;
    document.getElementById('modal-reserva-evento-nome').innerText = `RESERVAS: ${nome}`;
    document.getElementById('modal-gestao-reservas').classList.remove('hidden');
    window.atualizarListaSolicitacoes();
};

window.fecharModalReservas = function() {
    window.eventoIdAtivo = null;
    document.getElementById('modal-gestao-reservas').classList.add('hidden');
};

// 1. A função que busca no Supabase e alimenta o sistema
window.atualizarListaSolicitacoes = async function() {
    const container = document.getElementById('lista-solicitacoes-reservas');
    if (container) {
        container.innerHTML = '<div class="text-center text-sm font-bold py-8 text-slate-400 italic animate-pulse">Carregando solicitações...</div>';
    }

    try {
        // Busca todas as reservas deste evento no banco
        const { data: reservas, error } = await _supabase
            .from('reservas_evento')
            .select('*')
            .eq('evento_id', window.eventoIdAtivo)
            .order('created_at', { ascending: false });

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
            container.innerHTML = '<div class="text-center text-red-500 font-bold py-8">Erro ao carregar reservas.</div>';
        }
    }
};

// 2. A função que desenha os cards na tela (chamada pela busca)
window.desenharCardsReservas = function(reservas) {
    const container = document.getElementById('lista-solicitacoes-reservas');
    if (!container) return;

    if (!reservas || reservas.length === 0) {
        container.innerHTML = '<div class="text-center text-sm font-bold py-8 text-slate-400 italic">Nenhuma reserva encontrada para este filtro.</div>';
        return;
    }

    container.innerHTML = reservas.map(res => {
        const isConfirmada = res.status === 'confirmada';
        
        // Cores fixas (sem dark:) para garantir modo claro sempre
        const statusClass = isConfirmada 
            ? 'bg-emerald-100 text-emerald-700' 
            : 'bg-amber-100 text-amber-700';
            
        const mesaStr = Array.isArray(res.mesas) ? res.mesas.join(', ') : String(res.mesas || '');
        
        const nomeCliente = res.cliente_nome || 'SEM NOME';
        const telefoneCliente = res.cliente_telefone || '';
        const telefoneInfo = telefoneCliente ? `<p class="text-[9px] md:text-[10px] font-bold text-slate-400 uppercase mt-1 truncate">WPP: ${telefoneCliente}</p>` : '';
        
        const botaoAprovar = !isConfirmada ? `
            <button onclick="window.aprovarReserva('${res.id}')" class="flex-1 sm:flex-none w-full bg-emerald-500 hover:bg-emerald-600 text-white font-black text-[9px] uppercase tracking-widest py-2.5 sm:py-2 px-1 rounded-lg shadow-sm transition-all active:scale-95 text-center">
                Aprovar
            </button>
        ` : '';

        const botaoCancelar = `
            <button onclick="window.excluirReserva('${res.id}')" class="flex-1 sm:flex-none w-full bg-red-500 hover:bg-red-600 text-white font-black text-[9px] uppercase tracking-widest py-2.5 sm:py-2 px-1 rounded-lg shadow-sm transition-all active:scale-95 text-center">
                Cancelar
            </button>
        `;

        const botaoComprovante = res.comprovante_url ? `
            <button onclick="window.verComprovante('${res.comprovante_url}')" class="flex-1 sm:flex-none w-full bg-slate-100 text-slate-600 hover:bg-slate-200 font-black text-[9px] uppercase tracking-widest py-2.5 sm:py-2 px-1 rounded-lg transition-all text-center">
                Ver PIX
            </button>
        ` : '';

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
                ${res.tipo ? `<p class="text-[8px] md:text-[9px] font-black text-indigo-500 uppercase mt-2 tracking-wider">${res.tipo}</p>` : ''}
            </div>
            
            <div class="flex flex-row sm:flex-col gap-2 w-full sm:w-[90px] border-t sm:border-t-0 sm:border-l border-slate-100 pt-3 sm:pt-0 sm:pl-3 mt-2 sm:mt-0 shrink-0">
                ${botaoAprovar}
                ${botaoCancelar}
                ${botaoComprovante}
            </div>
            
        </div>`;
    }).join('');
};

window.abrirComprovante = function(url) {
    document.getElementById('img-comprovante-preview').src = url;
    document.getElementById('modal-ver-comprovante').classList.remove('hidden');
};

window.fecharModalComprovante = function() {
    document.getElementById('modal-ver-comprovante').classList.add('hidden');
    document.getElementById('img-comprovante-preview').src = '';
};

window.processarStatusReserva = async function(reservaId, status) {
    try {
        // 1. Atualiza o banco
        const { data: reserva, error } = await _supabase
            .from('reservas_evento')
            .update({ status: status })
            .eq('id', reservaId)
            .select('cliente_nome, cliente_telefone, mesas') // Busca dados para enviar a msg
            .single();

        if (error) throw error;
        
        if(window.showToast) window.showToast("Reserva aprovada com sucesso!", "sucesso");
        
        // 2. DISPARA MENSAGEM PARA O CLIENTE
        if (status === 'confirmada' && reserva.cliente_telefone) {
            const numeroCliente = reserva.cliente_telefone.replace(/\D/g, '');
            const msg = `Olá, *${reserva.cliente_nome}*! Sua reserva para as mesas *${reserva.mesas.join(', ')}* foi CONFIRMADA com sucesso pelo Espetinho & Cia. Nos vemos lá!`;
            const link = `https://wa.me/55${numeroCliente}?text=${encodeURIComponent(msg)}`;
            window.open(link, '_blank');
        }

        window.atualizarListaSolicitacoes();
    } catch (err) {
        console.error(err);
        if(window.showToast) window.showToast("Erro ao aprovar reserva.", "erro");
    }
};

window.imprimirListaReservas = async function() {
    if (!window.eventoIdAtivo) return;

    try {
        const nomeEvento = document.getElementById('modal-reserva-evento-nome').innerText.replace('RESERVAS: ', '');
        
        const { data: reservas, error } = await _supabase
            .from('reservas_evento')
            .select('*')
            .eq('evento_id', String(window.eventoIdAtivo))
            .order('mesas', { ascending: true });

        if (error) throw error;

        let listaDetalhada = [];
        reservas.forEach(res => {
            if (Array.isArray(res.mesas)) {
                res.mesas.forEach(mesa => {
                    listaDetalhada.push({
                        mesa: mesa,
                        cliente: res.cliente_nome,
                        telefone: res.cliente_telefone,
                        status: res.status
                    });
                });
            }
        });
        listaDetalhada.sort((a, b) => a.mesa - b.mesa);

        // --- CSS MODERNO ADAPTADO ---
        const cssModerno = `
            .header-pdf { display: flex; justify-content: space-between; align-items: center; margin-bottom: 30px; border-bottom: 2px solid #f1f5f9; padding-bottom: 20px; }
            .header-info h1 { font-size: 22px; color: #1e293b; text-transform: uppercase; }
            .header-info p { color: #64748b; font-size: 14px; }
            .header-logo img { width: 80px; height: 80px; object-fit: cover; border-radius: 12px; }
            table { width: 100%; border-collapse: collapse; margin-top: 10px; }
            th { background: #f8fafc; color: #64748b; text-transform: uppercase; font-size: 11px; padding: 12px; text-align: left; }
            td { border-bottom: 1px solid #f1f5f9; padding: 12px; font-size: 14px; }
            .status-confirmada { color: #059669; font-weight: 700; }
            .status-pendente { color: #d97706; font-weight: 700; }
        `;

        // Se você tiver uma logo guardada ou caminho fixo, coloque no src abaixo:
        const html = `<!DOCTYPE html>
        <html>
        <head>
            <title>Reservas - ${nomeEvento}</title>
            <style>
                * { margin: 0; padding: 0; box-sizing: border-box; }
                body { background: #fff; padding: 40px; max-width: 900px; margin: 0 auto; font-family: sans-serif; }
                ${cssModerno}
            </style>
        </head>
        <body>
            <div class="header-pdf">
                <div class="header-info">
                    <h1>${nomeEvento}</h1>
                    <p>Relatório de Reservas</p>
                    <small style="color: #94a3b8;">Gerado em: ${new Date().toLocaleDateString('pt-BR')}</small>
                </div>
                <div class="header-logo">
                    <img src="img/logo.jpg?v=2" onerror="this.style.display='none'">
                </div>
            </div>

            <table>
                <thead>
                    <tr><th>Mesa</th><th>Cliente</th><th>Telefone</th><th>Status</th></tr>
                </thead>
                <tbody>
                    ${listaDetalhada.map(item => `
                        <tr>
                            <td style="font-weight: 900;">${String(item.mesa).padStart(2, '0')}</td>
                            <td>${item.cliente.toUpperCase()}</td>
                            <td>${item.telefone || '-'}</td>
                            <td class="status-${item.status}">${item.status.toUpperCase()}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>

            <script>
                setTimeout(() => { window.print(); window.close(); }, 1000);
            </script>
        </body>
        </html>`;

        const janelaPrint = window.open('', '_blank');
        janelaPrint.document.write(html);
        janelaPrint.document.close();

    } catch (error) {
        console.error(error);
        if(window.showToast) window.showToast("Erro ao gerar impressão.", "erro");
    }
};

// ==========================================
// 4. GERENCIAMENTO DO EVENTO E RESERVA MANUAL
// ==========================================
window.abrirGerenciamentoEvento = async function(id, nome) {
    window.eventoIdAtivo = id;
    document.getElementById('gerenciar-nome-evento').innerText = `GERENCIAR: ${nome}`;
    
    // Busca a capacidade atual E o whatsapp no banco de uma vez só
    const { data: evento, error } = await _supabase
        .from('eventos')
        .select('quantidade_mesas, whatsapp_notificacao')
        .eq('id', id)
        .single();

    if (!error && evento) {
        // Preenche a capacidade
        document.getElementById('input-capacidade-mesas').value = evento.quantidade_mesas || 0;
        
        // Preenche o WhatsApp (se existir)
const inputWpp = document.getElementById('input-editar-whatsapp');
if (inputWpp) {
    // Agora o "55" será tratado corretamente e a máscara mostrará apenas o DDD e o Número
    inputWpp.value = window.formatarTelefone(evento.whatsapp_notificacao || "");
}
        
        // Atualiza a global caso outras funções dependam dela
        window.whatsappNotificacaoAtivo = evento.whatsapp_notificacao || "";
    }

    document.getElementById('modal-gerenciar-evento').classList.remove('hidden');
};

window.salvarNovaCapacidade = async function() {
    const novoTotal = parseInt(document.getElementById('input-capacidade-mesas').value);
    const eventoId = window.eventoIdAtivo;

    if (isNaN(novoTotal) || novoTotal < 0) {
        if(window.showToast) window.showToast("Digite uma quantidade válida.", "erro");
        return;
    }

    try {
        // Trava de Segurança: Verifica qual a maior mesa reservada atualmente
        const { data: reservas, error: errRes } = await _supabase
            .from('reservas_evento')
            .select('mesas')
            .eq('evento_id', eventoId);

        if (errRes) throw errRes;

        let mesasOcupadas = [];
        reservas.forEach(r => {
            if (Array.isArray(r.mesas)) mesasOcupadas.push(...r.mesas);
            else if (r.mesas) mesasOcupadas.push(parseInt(r.mesas));
        });

        const maiorMesaOcupada = mesasOcupadas.length > 0 ? Math.max(...mesasOcupadas) : 0;
        
        if (novoTotal < maiorMesaOcupada) {
            alert(`Atenção: Você já tem reservas até a mesa ${maiorMesaOcupada}. Não é possível reduzir para ${novoTotal} mesas.`);
            return;
        }

        // Atualiza no banco
        const { error } = await _supabase
            .from('eventos')
            .update({ quantidade_mesas: novoTotal })
            .eq('id', eventoId);

        if (error) throw error;

        if(window.showToast) window.showToast("Capacidade atualizada!", "sucesso");

    } catch (err) {
        console.error(err);
        if(window.showToast) window.showToast("Erro ao salvar.", "erro");
    }
};

window.fecharGerenciamentoEvento = function() {
    window.eventoIdAtivo = null;
    document.getElementById('modal-gerenciar-evento').classList.add('hidden');
};

window.salvarReservaManual = async function(e) {
    e.preventDefault();
    if (!window.eventoIdAtivo) return;

    const btn = document.getElementById('btn-salvar-rm');
    btn.disabled = true;
    btn.innerText = "RESERVANDO...";

    try {
        // 1. Pega a string do input e converte para um array de números [10, 11, 12]
        const inputMesas = document.getElementById('rm-mesa').value;
        const listaMesas = inputMesas.split(',').map(m => parseInt(m.trim())).filter(m => !isNaN(m));
        
        const nome = document.getElementById('rm-nome').value;
        const tipo = document.getElementById('rm-tipo').value;

        if (listaMesas.length === 0) throw new Error("Selecione pelo menos uma mesa no mapa.");

        // 2. Validação: Verifica se alguma das mesas selecionadas já está ocupada
        // O Supabase .overlaps verifica se há qualquer intersecção entre arrays
        const { data: ocupadas, error: errBusca } = await _supabase
            .from('reservas_evento')
            .select('mesas')
            .eq('evento_id', String(window.eventoIdAtivo))
            .overlaps('mesas', listaMesas);

        if (errBusca) throw errBusca;
        if (ocupadas && ocupadas.length > 0) {
            throw new Error(`Uma ou mais mesas selecionadas já estão reservadas!`);
        }

        // 3. Monta a nova reserva com o array completo
        const novaReserva = {
            evento_id: String(window.eventoIdAtivo),
            mesas: listaMesas, // Supabase salvará como um array [10, 11, 12]
            cliente_nome: `${nome} (${tipo})`,
            cliente_telefone: 'MANUAL - ADMIN',
            status: 'confirmada'
        };

        const { error } = await _supabase.from('reservas_evento').insert([novaReserva]);
        if (error) throw error;

        if(window.showToast) window.showToast(`Reservas efetuadas com sucesso!`, "sucesso");
        
        // 4. Limpa tudo
        document.getElementById('form-reserva-manual').reset();
        if(window.limparSelecao) window.limparSelecao(); // Limpa as cores do mapa

    } catch (error) {
        console.error(error);
        if(window.showToast) window.showToast(error.message, "erro");
    } finally {
        btn.disabled = false;
        btn.innerText = "RESERVAR MESA";
    }
};

window.alterarStatusEvento = async function(novoStatus) {
    if (!window.eventoIdAtivo) return;
    
    const confirmado = await window.mostrarConfirmacaoCustom(
        "Alterar Status", 
        `Deseja alterar o status do evento para ${novoStatus.toUpperCase()}?`
    );
    
    if (!confirmado) return;

    try {
        const { error } = await _supabase.from('eventos').update({ status: novoStatus }).eq('id', window.eventoIdAtivo);
        if (error) throw error;

        if(window.showToast) window.showToast(`Evento atualizado para ${novoStatus}!`, "sucesso");
        window.carregarEventosAdmin();
        window.fecharGerenciamentoEvento();
    } catch (err) {
        console.error(err);
        if(window.showToast) window.showToast("Erro ao alterar status.", "erro");
    }
};

window.atualizarMapaEvento = async function() {
    if (!window.eventoIdAtivo) return;

    const fileInput = document.getElementById('ev-update-mapa');
    if (fileInput.files.length === 0) {
        if(window.showToast) window.showToast("Selecione uma imagem primeiro.", "aviso");
        return;
    }

    try {
        const file = fileInput.files[0];
        const path = `mapas/${Date.now()}_${file.name}`;
        
        const { error: uploadError } = await _supabase.storage.from('eventos').upload(path, file);
        if (uploadError) throw uploadError;
        
        const { data } = _supabase.storage.from('eventos').getPublicUrl(path);
        
        const { error: dbError } = await _supabase.from('eventos').update({ mapa_url: data.publicUrl }).eq('id', window.eventoIdAtivo);
        if (dbError) throw dbError;

        if(window.showToast) window.showToast("Mapa atualizado com sucesso!", "sucesso");
        fileInput.value = ""; 
    } catch (err) {
        console.error(err);
        if(window.showToast) window.showToast("Erro ao atualizar o mapa.", "erro");
    }
};

window.excluirEvento = async function() {
    if (!window.eventoIdAtivo) return;

    // Aciona a nova função de Prompt Customizado
    const confirmado = await window.mostrarPromptCustom(
        "Excluir Evento", 
        "Esta ação apagará o evento e todas as reservas vinculadas. Digite EXCLUIR abaixo para confirmar.",
        "EXCLUIR"
    );
    
    if (!confirmado) {
        if(window.showToast) window.showToast("Exclusão cancelada.", "aviso");
        return;
    }

    try {
        await _supabase.from('reservas_evento').delete().eq('evento_id', window.eventoIdAtivo);
        
        const { error } = await _supabase.from('eventos').delete().eq('id', window.eventoIdAtivo);
        if (error) throw error;

        if(window.showToast) window.showToast("Evento excluído permanentemente.", "sucesso");
        window.carregarEventosAdmin();
        window.fecharGerenciamentoEvento();
    } catch (err) {
        console.error(err);
        if(window.showToast) window.showToast("Erro ao excluir o evento.", "erro");
    }
};

// ==========================================
// FUNÇÕES UTILITÁRIAS DE MODAIS CUSTOMIZADOS
// ==========================================

window.mostrarConfirmacaoCustom = function(titulo, mensagem) {
    return new Promise((resolve) => {
        const modal = document.getElementById('modal-confirmacao-custom');
        const txtTitulo = document.getElementById('confirm-titulo');
        const txtMensagem = document.getElementById('confirm-mensagem');
        const btnSim = document.getElementById('btn-confirm-sim');
        const btnCancelar = document.getElementById('btn-confirm-cancelar');

        txtTitulo.innerText = titulo.toUpperCase();
        txtMensagem.innerText = mensagem;

        modal.classList.remove('hidden');

        btnSim.onclick = () => {
            modal.classList.add('hidden');
            resolve(true);
        };

        btnCancelar.onclick = () => {
            modal.classList.add('hidden');
            resolve(false);
        };
    });
};

window.mostrarPromptCustom = function(titulo, mensagem, palavraChave) {
    return new Promise((resolve) => {
        const modal = document.getElementById('modal-prompt-custom');
        const txtTitulo = document.getElementById('prompt-titulo');
        const txtMensagem = document.getElementById('prompt-mensagem');
        const input = document.getElementById('prompt-input');
        const btnSim = document.getElementById('btn-prompt-sim');
        const btnCancelar = document.getElementById('btn-prompt-cancelar');

        txtTitulo.innerText = titulo.toUpperCase();
        txtMensagem.innerText = mensagem;
        input.value = '';
        input.placeholder = `Digite ${palavraChave}`;

        modal.classList.remove('hidden');
        input.focus();

        btnSim.onclick = () => {
            if (input.value === palavraChave) {
                modal.classList.add('hidden');
                resolve(true);
            } else {
                if(window.showToast) window.showToast(`Digite ${palavraChave} exatamente como solicitado.`, "erro");
            }
        };

        btnCancelar.onclick = () => {
            modal.classList.add('hidden');
            resolve(false);
        };
    });
};

window.cancelarReserva = async function(reservaId) {
    // Confirmação customizada para evitar erros
    const confirmado = await window.mostrarConfirmacaoCustom(
        "Cancelar Reserva", 
        "Tem certeza que deseja cancelar esta reserva? A mesa voltará a ficar disponível para outros clientes."
    );
    
    if (!confirmado) return;

    try {
        const { error } = await _supabase.from('reservas_evento').delete().eq('id', reservaId);
        if (error) throw error;
        
        if(window.showToast) window.showToast("Reserva cancelada com sucesso!", "sucesso");
        window.atualizarListaSolicitacoes(); // Recarrega a lista
    } catch (err) {
        console.error(err);
        if(window.showToast) window.showToast("Erro ao cancelar reserva.", "erro");
    }
};

window.exportarParaCSV = function() {
    // Busca todos os elementos de reserva na tela (ou você pode buscar do Supabase novamente)
    // Aqui usaremos os dados que já estão na sua lista se ela estiver populada
    const reservasParaExportar = window.listaReservasAtuais || []; 

    if (reservasParaExportar.length === 0) {
        if(window.showToast) window.showToast("Nenhuma reserva para exportar.", "aviso");
        return;
    }

    let csvContent = "data:text/csv;charset=utf-8,";
    csvContent += "MESA,CLIENTE,TELEFONE,STATUS\n"; // Cabeçalho

    reservasParaExportar.forEach(res => {
        const mesas = Array.isArray(res.mesas) ? res.mesas.join(';') : res.mesas;
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
window.exportarParaExcel = function() {
    const dados = window.listaReservasAtuais;
    if (!dados || dados.length === 0) {
        if(window.showToast) window.showToast("Nada para exportar.", "aviso");
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

    dados.forEach(r => {
        const mesas = Array.isArray(r.mesas) ? r.mesas.join(', ') : r.mesas;
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
    const blob = new Blob([html], { type: 'application/vnd.ms-excel' });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = "lista_reservas.xls";
    link.click();
};;

window.verificarPendencias = function(reservas, eventoId = null) {
    // 1. Filtra as reservas que estão com status 'pendente'
    // Se um eventoId for fornecido, filtra apenas as pendências daquele evento
    const pendentes = eventoId 
        ? reservas.filter(r => r.status === 'pendente' && String(r.evento_id) === String(eventoId))
        : reservas.filter(r => r.status === 'pendente');

    // 2. Define o ID do badge no HTML:
    // Se for um card de evento, o ID será 'badge-pendencia-ID_DO_EVENTO'
    // Se for um badge geral no menu, o ID será apenas 'badge-pendencia'
    const badgeId = eventoId ? `badge-pendencia-${eventoId}` : 'badge-pendencia';
    const badge = document.getElementById(badgeId);

    // 3. Atualiza o elemento visual
    if (badge) {
        badge.innerText = pendentes.length;
        
        // Se houver pendências, remove a classe 'hidden' para exibir o número
        // Se o contador for 0, adiciona 'hidden' para esconder o badge
        badge.classList.toggle('hidden', pendentes.length === 0);
    }
};

window.mesasSelecionadasMap = []; // Memória global das mesas selecionadas

window.abrirMapaOcupacao = async function() {
    const eventoId = window.eventoIdAtivo;
    if (!eventoId) return;

    // 1. Lê as mesas que já estão no input (para manter a seleção se a pessoa abrir o mapa de novo)
    const inputMesa = document.getElementById('rm-mesa');
    window.mesasSelecionadasMap = inputMesa && inputMesa.value 
        ? inputMesa.value.split(',').map(m => parseInt(m.trim())).filter(m => !isNaN(m)) 
        : [];

    try {
        const [ { data: evento }, { data: reservas } ] = await Promise.all([
            _supabase.from('eventos').select('quantidade_mesas').eq('id', eventoId).single(),
            _supabase.from('reservas_evento').select('mesas, status').eq('evento_id', String(eventoId))
        ]);

        const capacidade = evento ? (parseInt(evento.quantidade_mesas) || 0) : 0;
        if (capacidade === 0) {
            if(window.showToast) window.showToast("Defina a capacidade de mesas no menu 'Gerenciar' primeiro.", "erro");
            return;
        }

        const statusMesas = {}; 
        
        if (reservas) {
            reservas.forEach(res => {
                const arrMesas = Array.isArray(res.mesas) ? res.mesas : (typeof res.mesas === 'string' ? res.mesas.split(',') : [res.mesas]);
                arrMesas.forEach(num => {
                    const n = parseInt(num);
                    if (n) {
                        if (res.status === 'confirmada' || statusMesas[n] !== 'confirmada') {
                            statusMesas[n] = res.status;
                        }
                    }
                });
            });
        }

        const grid = document.getElementById('grid-mapa-mesas');
        let html = '';
        
        for (let i = 1; i <= capacidade; i++) {
            let corClasses = '';
            let statusAtual = 'livre'; 
            let isSelecionada = window.mesasSelecionadasMap.includes(i); // Verifica se já está selecionada
            
            if (statusMesas[i] === 'confirmada') {
                corClasses = 'bg-emerald-500 text-white opacity-90 cursor-not-allowed';
                statusAtual = 'ocupada';
            } else if (statusMesas[i] === 'pendente') {
                corClasses = 'bg-amber-400 text-white opacity-90 cursor-not-allowed';
                statusAtual = 'pendente';
            } else {
                statusAtual = 'livre';
                // Se estiver na lista de selecionadas, fica azul (indigo). Se não, fica branca/cinza.
                if (isSelecionada) {
                    corClasses = 'bg-indigo-600 text-white font-black cursor-pointer shadow-lg transform scale-105 ring-2 ring-indigo-300';
                } else {
                    corClasses = 'bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 cursor-pointer hover:bg-indigo-50 dark:hover:bg-indigo-900/30 hover:scale-105 transition-all font-bold shadow-sm';
                }
            }

            let acaoClique = `onclick="window.toggleMesaMapaAcumulativo(${i}, '${statusAtual}', this)"`;

            html += `<div ${acaoClique} class="aspect-square rounded-xl flex items-center justify-center text-sm transition-all duration-200 ${corClasses}" title="Mesa ${i}">${i}</div>`;
        }

        grid.innerHTML = html;
        document.getElementById('modal-mapa-ocupacao').classList.remove('hidden');
        window.atualizarBotaoConfirmarMapa(); // Exibe o botão se já tiver mesa na memória

    } catch (err) {
        console.error("Erro ao gerar mapa:", err);
    }
};

// ==========================================
// FUNÇÕES DO MAPA ACUMULATIVO
// ==========================================
window.toggleMesaMapaAcumulativo = function(numero, status, elemento) {
    if (status === 'ocupada') {
        if(window.showToast) window.showToast(`Mesa ${numero} já ocupada!`, "erro");
        return;
    }
    if (status === 'pendente') {
        if(window.showToast) window.showToast(`Mesa ${numero} em análise.`, "aviso");
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

window.atualizarBotaoConfirmarMapa = function() {
    const container = document.getElementById('container-confirmar-mapa');
    const spanQtd = document.getElementById('qtd-mesas-selecionadas');
    if (!container) return;

    if (window.mesasSelecionadasMap.length > 0) {
        container.classList.remove('hidden');
        container.classList.add('flex');
        spanQtd.innerText = window.mesasSelecionadasMap.length;
    } else {
        container.classList.add('hidden');
        container.classList.remove('flex');
    }
};

window.confirmarSelecaoMapa = function() {
    const inputMesa = document.getElementById('rm-mesa');
    if (inputMesa) {
        inputMesa.value = window.mesasSelecionadasMap.join(', ');
    }
    
    // Esconde o mapa e a gestão de reservas
    document.getElementById('modal-mapa-ocupacao').classList.add('hidden');
    document.getElementById('modal-gestao-reservas').classList.add('hidden');
    document.getElementById('modal-gestao-reservas').classList.remove('flex');

    // Mostra a tela de formulário
    document.getElementById('modal-gerenciar-evento').classList.remove('hidden');
    document.getElementById('modal-gerenciar-evento').classList.add('flex');
    
    setTimeout(() => {
        document.getElementById('rm-nome').focus();
    }, 400); 
};

// ==========================================
// NOVA FUNÇÃO: Gerencia o clique na mesa
// ==========================================
window.selecionarMesaPeloMapa = function(numeroMesa, status) {
    // Se estiver ocupada ou pendente, apenas avisa e bloqueia o clique
    if (status === 'ocupada') {
        if(window.showToast) window.showToast(`A Mesa ${numeroMesa} já está ocupada!`, "erro");
        return;
    }
    if (status === 'pendente') {
        if(window.showToast) window.showToast(`A Mesa ${numeroMesa} possui um pagamento em análise.`, "aviso");
        return;
    }

    // Se estiver livre, executa o fluxo de reserva manual:
    
    // 1. Oculta o modal do mapa
    document.getElementById('modal-mapa-ocupacao').classList.add('hidden');
    
    // 2. Oculta o modal de Gestão de Reservas (se estiver aberto por trás)
    document.getElementById('modal-gestao-reservas').classList.add('hidden');
    document.getElementById('modal-gestao-reservas').classList.remove('flex');

    // 3. Abre o modal de Gerenciar Evento (onde fica o formulário)
    document.getElementById('modal-gerenciar-evento').classList.remove('hidden');
    document.getElementById('modal-gerenciar-evento').classList.add('flex');
    
    // 4. Preenche o input do número da mesa automaticamente
    document.getElementById('rm-mesa').value = numeroMesa;
    
    // 5. Dá um feedback visual e foca no campo Nome para agilizar a digitação
    if(window.showToast) window.showToast(`Mesa ${numeroMesa} selecionada!`, "sucesso");
    
    setTimeout(() => {
        document.getElementById('rm-nome').focus();
    }, 400); 
};

window.toggleSelecaoMesa = function(numero, elemento) {
    if (!window.mesasSelecionadas) window.mesasSelecionadas = [];
    
    const index = window.mesasSelecionadas.indexOf(numero);
    
    if (index > -1) {
        // Se já está na lista, remove
        window.mesasSelecionadas.splice(index, 1);
        // Remove o estilo de selecionado
        elemento.classList.remove('bg-indigo-600', 'text-white');
        elemento.classList.add('bg-slate-50', 'text-slate-400');
    } else {
        // Se não está, adiciona
        window.mesasSelecionadas.push(numero);
        // Aplica o estilo de selecionado
        elemento.classList.add('bg-indigo-600', 'text-white');
        elemento.classList.remove('bg-slate-50', 'text-slate-400');
    }

    // Atualiza o input no seu formulário (rm-mesa)
    const input = document.getElementById('rm-mesa');
    if (input) {
        input.value = window.mesasSelecionadas.sort((a, b) => a - b).join(', ');
    }
};

window.bloquearMesaRapido = async function(numeroMesa) {
    // Agora passamos 'true' no último parâmetro para ativar o campo de input
    const nomeCliente = await window.confirmarAcaoCustom(
        `Bloquear Mesa ${numeroMesa}`, 
        'Insira o nome do cliente para confirmar a reserva:', 
        false, 
        true 
    );
    
    // Se clicou em cancelar, nomeCliente será null
    if (nomeCliente === null || nomeCliente.trim() === '') return; 

    try {
        const { error } = await _supabase
            .from('reservas_evento')
            .insert([{
                evento_id: window.eventoIdAtivo,
                cliente_nome: nomeCliente.trim(),
                mesas: [numeroMesa.toString()],
                status: 'confirmada',
                tipo: 'PRESENCIAL'
            }]);

        if (error) throw error;

        if (window.showToast) window.showToast(`Mesa ${numeroMesa} garantida!`, 'sucesso');

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
window.confirmarAcaoCustom = function(titulo, mensagem, isPerigo = false, solicitarNome = false) {
    return new Promise((resolve) => {
        const modal = document.getElementById('modal-confirmacao-custom');
        const tituloEl = document.getElementById('confirm-titulo');
        const mensagemEl = document.getElementById('confirm-mensagem');
        const inputNome = document.getElementById('input-confirm-nome'); // O novo campo que adicionamos no HTML
        const btnSim = document.getElementById('btn-confirm-sim');
        const btnNao = document.getElementById('btn-confirm-cancelar');

        // Preenche os textos
        tituloEl.innerText = titulo;
        mensagemEl.innerText = mensagem;

        // Gerencia o campo de input
        if (solicitarNome) {
            inputNome.classList.remove('hidden');
            inputNome.value = ''; // Limpa qualquer texto anterior
        } else {
            inputNome.classList.add('hidden');
        }

        // Muda a cor do botão de confirmação
        if (isPerigo) {
            btnSim.className = "w-2/3 bg-red-500 hover:bg-red-600 text-white font-black py-3 rounded-xl text-[10px] uppercase tracking-widest shadow-lg shadow-red-500/30 transition-all active:scale-95";
        } else {
            btnSim.className = "w-2/3 bg-emerald-500 hover:bg-emerald-600 text-white font-black py-3 rounded-xl text-[10px] uppercase tracking-widest shadow-lg shadow-emerald-500/30 transition-all active:scale-95";
        }

        // Mostra o modal
        modal.classList.remove('hidden');

        // Função para limpar e resolver
        const fecharEResolver = (resultado) => {
            const valorRetorno = (resultado && solicitarNome) ? inputNome.value : resultado;
            
            btnSim.onclick = null;
            btnNao.onclick = null;
            modal.classList.add('hidden');
            resolve(valorRetorno);
        };

        btnSim.onclick = () => fecharEResolver(true);
        btnNao.onclick = () => fecharEResolver(false);
    });
};

// ==========================================
// AÇÕES DA RESERVA (APROVAR E CANCELAR)
// ==========================================

window.aprovarReserva = async function(reservaId) {
    const confirmado = await window.confirmarAcaoCustom(
        'Aprovar Reserva', 
        'Deseja aprovar o pagamento e confirmar esta reserva?', 
        false
    );
    if (!confirmado) return;

    try {
        // Atualiza no banco
        const { error } = await _supabase
            .from('reservas_evento')
            .update({ status: 'confirmada' })
            .eq('id', reservaId);

        if (error) throw error;

        if (window.showToast) window.showToast("Reserva aprovada com sucesso!", "sucesso");

        // ==========================================
        // LÓGICA DE ENVIO DO WHATSAPP
        // ==========================================
        // Procura os dados do cliente na memória local
        const reserva = window.listaReservasLocal.find(r => r.id === reservaId);
        
        if (reserva && reserva.cliente_telefone) {
            // Limpa o número (deixa só os números)
            let telefonePuro = String(reserva.cliente_telefone).replace(/\D/g, '');
            
            // Se o número tiver 10 ou 11 dígitos, adiciona o DDI do Brasil (55)
            if (telefonePuro.length === 10 || telefonePuro.length === 11) {
                telefonePuro = '55' + telefonePuro;
            }

            const nomeCliente = reserva.cliente_nome || 'Cliente';
            const mesaStr = Array.isArray(reserva.mesas) ? reserva.mesas.join(', ') : reserva.mesas;
            
            // Monta a mensagem
            const mensagem = `Olá, *${nomeCliente}*! 🎉\n\nO seu pagamento foi recebido e a sua reserva para a(s) mesa(s) *${mesaStr}* foi *confirmada* com sucesso!\n\nAgradecemos a preferência e aguardamos você.`;
            
            // Abre o WhatsApp numa nova aba
            const urlWhatsapp = `https://wa.me/${telefonePuro}?text=${encodeURIComponent(mensagem)}`;
            window.open(urlWhatsapp, '_blank');
        } else {
            if (window.showToast) window.showToast("Sem número de WhatsApp cadastrado.", "aviso");
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

window.excluirReserva = async function(reservaId) {
    // Chama o modal customizado (isPerigo = true, para ficar vermelho)
    const confirmado = await window.confirmarAcaoCustom(
        'Cancelar Reserva', 
        'Deseja realmente cancelar e excluir esta reserva? As mesas serão liberadas.', 
        true
    );
    if (!confirmado) return;

    try {
        const { error } = await _supabase
            .from('reservas_evento')
            .delete()
            .eq('id', reservaId);

        if (error) throw error;

        if (window.showToast) window.showToast("Reserva cancelada e mesas liberadas!", "sucesso");

        if (window.atualizarListaSolicitacoes) {
            window.atualizarListaSolicitacoes();
        }

    } catch (err) {
        console.error("Erro ao cancelar:", err);
        if (window.showToast) window.showToast("Erro ao cancelar reserva.", "erro");
    }
};


// Controle do Modal
window.abrirModalImpressaoPlacas = function() {
    document.getElementById('modal-imprimir-placas').classList.remove('hidden');
    document.getElementById('modal-imprimir-placas').classList.add('flex');
}

window.fecharModalImpressaoPlacas = function() {
    document.getElementById('modal-imprimir-placas').classList.add('hidden');
    document.getElementById('modal-imprimir-placas').classList.remove('flex');
}

// Lógica de Impressão
window.gerarPlacasA5 = async function(tipo, formatoSaida) {
    if (!window.eventoIdAtivo) return;

    const totalMesasInput = document.getElementById('input-total-mesas-imprimir').value;
    const totalMesas = parseInt(totalMesasInput) || 0;

    if ((tipo === 'disponiveis' || tipo === 'todas') && totalMesas <= 0) {
        if(window.showToast) window.showToast("Informe o total de mesas do evento.", "aviso");
        return;
    }

    // Fecha o modal visualmente
    if (typeof window.fecharModalImpressaoPlacas === 'function') {
        window.fecharModalImpressaoPlacas();
    }

    try {
        if (window.showToast) window.showToast("Buscando dados e gerando placas...", "aviso");

        const { data: reservas, error } = await _supabase
            .from('reservas_evento')
            .select('*')
            .eq('evento_id', String(window.eventoIdAtivo));

        if (error) throw error;

        let mesasReservadas = [];
        reservas.forEach(res => {
            if (Array.isArray(res.mesas)) {
                let nomeLimpo = res.cliente_nome ? res.cliente_nome.replace(/\s*\(.*?\)/g, '').trim() : '';
                res.mesas.forEach(mesa => {
                    mesasReservadas.push({
                        mesa: parseInt(mesa),
                        cliente: nomeLimpo,
                        reservado: true
                    });
                });
            }
        });

        let listaFinal = [];
        if (tipo === 'reservadas') {
            listaFinal = mesasReservadas.sort((a, b) => a.mesa - b.mesa);
        } else if (tipo === 'disponiveis') {
            for (let i = 1; i <= totalMesas; i++) {
                let estaReservada = mesasReservadas.find(r => r.mesa === i);
                if (!estaReservada) {
                    listaFinal.push({ mesa: i, cliente: "", reservado: false });
                }
            }
        } else if (tipo === 'todas') {
            for (let i = 1; i <= totalMesas; i++) {
                let estaReservada = mesasReservadas.find(r => r.mesa === i);
                if (estaReservada) {
                    listaFinal.push(estaReservada);
                } else {
                    listaFinal.push({ mesa: i, cliente: "", reservado: false });
                }
            }
        }

        if (listaFinal.length === 0) {
            if(window.showToast) window.showToast("Nenhuma mesa encontrada para esta opção.", "erro");
            return;
        }

        // Define o nome dinâmico para o PDF
        const dataHoje = new Date().toLocaleDateString('pt-BR').replace(/\//g, '-');
        let sufixoNome = 'Todas';
        if (tipo === 'reservadas') sufixoNome = 'Reservadas';
        if (tipo === 'disponiveis') sufixoNome = 'Livres';

        // Aqui está o truque para manter o nome do PDF no Iframe
        const nomeDoArquivo = formatoSaida === 'pdf' ? `Placas_${sufixoNome}_${dataHoje}` : 'Impressao_Placas';
        const tituloOriginal = document.title;
        document.title = nomeDoArquivo;

        // Limpa iframe anterior se existir
        let iframeAntigo = document.getElementById('iframe-impressao-placas');
        if (iframeAntigo) iframeAntigo.remove();

        // Cria o iframe invisível
        let iframe = document.createElement('iframe');
        iframe.id = 'iframe-impressao-placas';
        iframe.style.position = 'absolute';
        iframe.style.width = '0px';
        iframe.style.height = '0px';
        iframe.style.border = 'none';
        document.body.appendChild(iframe);

        const baseUrl = window.location.origin + window.location.pathname.substring(0, window.location.pathname.lastIndexOf('/') + 1);
        
        let htmlStr = `<!DOCTYPE html>
            <html>
            <head>
                <meta charset="UTF-8">
                <base href="${baseUrl}">
                <style>
                    @page { size: A4 portrait; margin: 0; }
                    body {
                        font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
                        margin: 0; padding: 0; background-color: #fff; color: #1e293b; width: 210mm; 
                    }
                    .folha-a4 {
                        width: 210mm; height: 296mm; padding: 10mm; box-sizing: border-box;
                        display: grid; grid-template-columns: 1fr 1fr; grid-template-rows: 1fr 1fr; gap: 15px;
                        page-break-after: always; margin: 0 auto;
                    }
                    .folha-a4:last-child { page-break-after: auto; }
                    .card {
                        border: 4px solid #1e293b; border-radius: 16px; display: flex; flex-direction: column;
                        justify-content: center; align-items: center; text-align: center; position: relative;
                        box-sizing: border-box; padding: 20px 20px 85px 20px; overflow: hidden; 
                    }
                    .badge {
                        background-color: #1e293b; color: #fff; padding: 6px 20px; border-radius: 50px;
                        font-size: 12px; font-weight: 900; text-transform: uppercase; letter-spacing: 4px;
                        position: absolute; top: 20px; -webkit-print-color-adjust: exact; print-color-adjust: exact;
                    }
                    .mesa { font-size: 70px; font-weight: 900; margin: 30px 0 0 0; line-height: 1; color: #0f172a; white-space: nowrap; }
                    .cliente-label { font-size: 12px; color: #64748b; text-transform: uppercase; letter-spacing: 2px; margin-top: 20px; font-weight: bold; }
                    .cliente-nome { font-size: 24px; font-weight: 900; color: #0f172a; margin-top: 5px; text-transform: uppercase; word-break: break-word; max-width: 90%; }
                    .logo-rodape { position: absolute; bottom: 15px; left: 50%; transform: translateX(-50%); display: flex; flex-direction: column; align-items: center; gap: 4px; width: 100%; }
                    .logo-rodape img { height: 45px; width: 45px; object-fit: cover; border-radius: 50%; border: 2px solid #f8fafc; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
                    .logo-texto { font-size: 11px; font-weight: 900; color: #0f172a; text-transform: uppercase; letter-spacing: 1px; }
                </style>
            </head>
            <body>
        `;

        for (let i = 0; i < listaFinal.length; i += 4) {
            const grupo4Mesas = listaFinal.slice(i, i + 4);
            htmlStr += `<div class="folha-a4">`;
            grupo4Mesas.forEach(item => {
                const badgeHtml = item.reservado ? `<div class="badge">Reservado</div>` : '';
                const clienteHtml = item.reservado ? `
                    <div class="cliente-label">Responsável</div>
                    <div class="cliente-nome">${item.cliente.toUpperCase()}</div>
                ` : '';

                htmlStr += `
                    <div class="card">
                        ${badgeHtml}
                        <div class="mesa">MESA ${String(item.mesa).padStart(2, '0')}</div>
                        ${clienteHtml}
                        <div class="logo-rodape">
                            <img src="img/logo.jpg?v=2" onerror="this.style.display='none'">
                            <span class="logo-texto">Espetinho & CIA</span>
                        </div>
                    </div>
                `;
            });
            htmlStr += `</div>`;
        }

        htmlStr += `</body></html>`;

        // Escreve o HTML no iframe
        const doc = iframe.contentWindow.document;
        doc.open();
        doc.write(htmlStr);
        doc.close();

        // Aguarda 1.5s para garantir que as logos (imagens) foram carregadas antes de chamar a tela de impressão
        setTimeout(() => {
            iframe.contentWindow.focus();
            iframe.contentWindow.print();
            
            // Devolve o título original para a sua página principal não ficar com nome estranho na aba
            setTimeout(() => { document.title = tituloOriginal; }, 1000);
            
            if (window.showToast) window.showToast("Opções de impressão abertas!", "sucesso");
        }, 1500);

    } catch (error) {
        console.error(error);
        if(window.showToast) window.showToast("Erro ao gerar placas.", "erro");
    }
};

window.salvarWhatsAppNotificacaoEdicao = async function() {
    if (!window.eventoIdAtivo) return;

    const input = document.getElementById('input-editar-whatsapp');
    let numeroLimpo = input.value.replace(/\D/g, "");

    // Se o usuário digitou sem o 55, a lógica abaixo garante que salve certo
    // Se o número tiver 11 ou 12 dígitos, ele assume que é um celular com DDD
    if (numeroLimpo.length >= 10 && numeroLimpo.length <= 11) {
        numeroLimpo = "55" + numeroLimpo;
    }

    try {
        const { error } = await _supabase
            .from('eventos')
            .update({ whatsapp_notificacao: numeroLimpo })
            .eq('id', String(window.eventoIdAtivo));

        if (error) throw error;
        
        window.whatsappNotificacaoAtivo = numeroLimpo;
        if(window.showToast) window.showToast("WhatsApp atualizado!", "sucesso");
    } catch (error) {
        if(window.showToast) window.showToast("Erro ao salvar.", "erro");
    }
};

window.mascaraTelefone = function(input) {
    let valor = input.value.replace(/\D/g, '');
    valor = valor.replace(/^(\d{2})(\d)/g, '($1) $2');
    valor = valor.replace(/(\d{5})(\d)/, '$1-$2');
    input.value = valor.substring(0, 15);
};

window.formatarTelefone = function(value) {
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

window.carregarWhatsAppNoModal = async function() {
    if (!window.eventoIdAtivo) return;

    try {
        const { data: evento, error } = await _supabase
            .from('eventos')
            .select('whatsapp_notificacao')
            .eq('id', String(window.eventoIdAtivo))
            .single();

        if (error) throw error;

        // Preenche o input se o dado existir
        const input = document.getElementById('input-editar-whatsapp');
        if (input && evento && evento.whatsapp_notificacao) {
            // Removemos o '55' apenas para exibir formatado no input (se desejar)
            // ou deixamos o número completo.
            input.value = evento.whatsapp_notificacao;
        }
    } catch (error) {
        console.error("Erro ao carregar WhatsApp para edição:", error);
    }
};
