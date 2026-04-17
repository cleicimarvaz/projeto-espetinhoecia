/* =============================================================
   MÓDULO: GESTÃO OPERACIONAL DE CAIXA
   Fonte única de verificarStatusCaixa — não duplicar em main.js.
   ============================================================= */

/**
 * Verifica se existe um caixa aberto.
 * - ADMIN sem caixa → abre modal de abertura (na home)
 * - Garçom sem caixa → exibe aviso
 * - Caixa encontrado → salva na sessão e oculta modal
 */
window.verificarStatusCaixa = async function() {
    if (typeof isDatabaseReady === 'function' && !isDatabaseReady()) return;

    try {
        const { data, error } = await _supabase
            .from('caixa')
            .select('*')
            .eq('status', 'aberto')
            .maybeSingle();

        // PGRST116 = sem resultado (não é erro real, significa apenas que não tem caixa aberto)
        if (error && error.code !== 'PGRST116') {
            console.error('[CAIXA] Erro ao verificar status:', error);
            return;
        }

        const modal = document.getElementById('modal-abrir-caixa');

        if (!data) {
            // Nenhum caixa aberto encontrado
            const nivel = localStorage.getItem('userNivel');
            if (nivel === 'ADMIN') {
                if (modal) {
                    modal.classList.remove('hidden');
                    modal.classList.add('flex');
                }
            } else {
                if (typeof showToast === 'function') showToast('AGUARDANDO ABERTURA DO CAIXA PELO ADMINISTRADOR', 'aviso');
            }
            // Limpa qualquer lixo de caixa anterior
            localStorage.removeItem('idCaixaAtual');
            localStorage.removeItem('dataAberturaCaixa');
            localStorage.removeItem('horaAberturaCaixa'); // NOVO: Limpa também a hora local
            
        } else {
            // Caixa aberto encontrado! Registra na memória do dispositivo.
            localStorage.setItem('idCaixaAtual', data.id);
            localStorage.setItem('dataAberturaCaixa', data.aberto_em);
            
            // Se o caixa já existe, mas o dispositivo recarregou, garante que há uma hora base.
            // Idealmente a hora de abertura deve vir do BD (data.aberto_em), mas para o cronômetro
            // visual funcionar com base na ISO String local, garantimos que ela exista.
            if (!localStorage.getItem('horaAberturaCaixa')) {
                 localStorage.setItem('horaAberturaCaixa', new Date(data.aberto_em).toISOString());
            }

            if (modal) {
                modal.classList.add('hidden');
                modal.classList.remove('flex');
            }
        }
    } catch (e) {
        console.error('[CAIXA] Erro crítico ao verificar caixa:', e);
    }
};

/**
 * Registra a abertura do caixa no banco.
 * Chamada pelo modal de abertura (home.html).
 */
window.confirmarAberturaCaixa = async function(valor) {
    if (typeof isDatabaseReady === 'function' && !isDatabaseReady()) return;

    const adminNome = localStorage.getItem('userName') || 'Admin';
    const valorInicial = parseFloat(valor) || 0;

    try {
        const { data, error } = await _supabase
            .from('caixa')
            .insert([{
                valor_inicial: valorInicial,
                status: 'aberto',
                criado_por: adminNome
            }])
            .select();

        if (error) throw error;

        const novoCaixa = Array.isArray(data) ? data[0] : data;
        localStorage.setItem('idCaixaAtual', novoCaixa.id);
        localStorage.setItem('dataAberturaCaixa', novoCaixa.aberto_em);
        
        // 👉 CORREÇÃO AQUI: Salva a hora exata da abertura para o Cronômetro do Perfil Global
        localStorage.setItem('horaAberturaCaixa', new Date().toISOString());

        // --- REGISTRO DE AUDITORIA DETALHADO ---
        if (typeof registrarLog === 'function') {
            const valorF = typeof window.formatarMoeda === 'function' 
                ? window.formatarMoeda(valorInicial) 
                : `R$ ${valorInicial.toFixed(2)}`;
            
            // Usamos 'FINANCEIRO' para alinhar com os filtros da tela de Auditoria
            await registrarLog('FINANCEIRO', `ABERTURA DE CAIXA: TURNO INICIADO COM SALDO DE ${valorF} (OP: ${adminNome})`);
        }

        if (typeof showToast === 'function') showToast('CAIXA ABERTO COM SUCESSO!', 'sucesso');
        
        const modal = document.getElementById('modal-abrir-caixa');
        if (modal) {
            modal.classList.add('hidden');
            modal.classList.remove('flex');
        }

        // Atualiza as estatísticas do perfil assim que o caixa abre
        if (typeof window.carregarEstatisticasPerfil === 'function') {
            window.carregarEstatisticasPerfil();
        }

        // Recarrega o dashboard caso esteja na home
        if (typeof carregarDashboardAdmin === 'function') {
            carregarDashboardAdmin();
        }

    } catch (e) {
        console.error('[CAIXA] Erro ao abrir:', e);
        if (typeof showToast === 'function') showToast('ERRO AO ABRIR CAIXA', 'erro');
    }
};

/**
 * Registra uma Sangria ou Suprimento no caixa ativo.
 * (Agora adaptado para a tela cheia de Movimentações no Admin)
 */
window.registrarMovimentacaoCaixa = async function(tipo) {
    if (typeof isDatabaseReady === 'function' && !isDatabaseReady()) return;

    const valorInput = document.getElementById('mov-valor');
    const motivoInput = document.getElementById('mov-motivo');
    
    let valor = 0;
    if (typeof window.convMoedaFloat === 'function' && valorInput) {
        valor = window.convMoedaFloat(valorInput.value);
    } else if (valorInput) {
        valor = parseFloat(valorInput.value.replace(/\D/g, '')) / 100 || 0;
    }
    
    const motivo = motivoInput ? motivoInput.value.toUpperCase().trim() : '';
    const idCaixa = localStorage.getItem('idCaixaAtual');

    if (valor <= 0 || !motivo) {
        if (typeof showToast === 'function') showToast('PREENCHA VALOR E MOTIVO', 'erro');
        return;
    }
    
    if (!idCaixa) {
        if (typeof showToast === 'function') showToast('NENHUM CAIXA ATIVO', 'erro');
        return;
    }

    try {
        const btnConfirmar = document.querySelector('button[onclick="registrarMovimentacaoBotao()"]');
        if (btnConfirmar) {
            btnConfirmar.disabled = true;
            btnConfirmar.innerText = "REGISTRANDO...";
            btnConfirmar.classList.add('opacity-50');
        }

        const payload = {
            id_caixa: parseInt(idCaixa),
            tipo: tipo, // SANGRIA ou SUPRIMENTO
            valor: valor,
            motivo: motivo,
            usuario: localStorage.getItem('userName') || 'SISTEMA'
        };

        const { error } = await _supabase.from('movimentacoes_caixa').insert([payload]);
        if (error) throw error;

        // --- REGISTRO DE AUDITORIA DETALHADO ---
        if (typeof registrarLog === 'function') {
            const valorF = typeof formatarMoeda === 'function' ? formatarMoeda(valor) : `R$ ${valor.toFixed(2)}`;
            await registrarLog('FINANCEIRO', `${tipo}: ${valorF} | MOTIVO: ${motivo}`);
        }
        
        if (typeof showToast === 'function') showToast(`${tipo} REGISTRADA COM SUCESSO!`, 'sucesso');

        if (valorInput) valorInput.value = '';
        if (motivoInput) motivoInput.value = '';
        
        if (typeof voltarAoMenuAdmin === 'function') {
            setTimeout(() => {
                voltarAoMenuAdmin();
            }, 1000);
        }

    } catch (e) {
        console.error('[CAIXA] Erro na movimentação:', e);
        if (typeof showToast === 'function') showToast('ERRO AO REGISTRAR', 'erro');
    } finally {
        const btnConfirmar = document.querySelector('button[onclick="registrarMovimentacaoBotao()"]');
        if (btnConfirmar) {
            btnConfirmar.disabled = false;
            btnConfirmar.innerText = "Confirmar Movimentação";
            btnConfirmar.classList.remove('opacity-50');
        }
    }
};


/* =================================================================================
   ENCERRAMENTO DE TURNO / CAIXA
   ================================================================================= */

// 1. Abre o modal de confirmação
// --- 1. ENCERRAMENTO DE TURNO (Ação do botão vermelho no Painel) ---
/* =================================================================================
   ENCERRAMENTO DE TURNO (TROCA DE OPERADOR)
   ================================================================================= */

// 1. Abre o modal vermelho
window.encerrarTurnoParcial = function() {
    const modal = document.getElementById('modal-encerrar-turno');
    if (modal) {
        modal.classList.remove('hidden');
        modal.classList.add('flex');
    }
};

// 2. Fecha o modal vermelho
window.fecharModalEncerramentoTurno = function() {
    const modal = document.getElementById('modal-encerrar-turno');
    if (modal) {
        modal.classList.add('hidden');
        modal.classList.remove('flex');
    }
};

// 3. Executa a limpeza apenas local (O caixa continua aberto no Supabase)
// 3. Executa a limpeza apenas local (O caixa continua aberto no Supabase)
window.confirmarEncerramentoTurno = async function(imprimirResumo = false) {
    
    // Se o usuário clicou em "Imprimir e Sair", puxa a função do caixa-reports.js
    if (imprimirResumo && typeof window.executarEncerramentoParcial === 'function') {
        await window.executarEncerramentoParcial();
    }

    // 1. Apaga os dados da sessão atual da memória do navegador (O relógio para!)
    localStorage.removeItem('idCaixaAtual');
    localStorage.removeItem('horaAberturaCaixa');
    localStorage.removeItem('dataAberturaCaixa');

    // 2. Fecha o modal
    window.fecharModalEncerramentoTurno();

    if (typeof showToast === 'function') {
        showToast('Turno local encerrado com sucesso.', 'sucesso');
    }
    
    // Atualiza o perfil para mostrar que não há turno ativo nesta máquina
    if (typeof window.carregarEstatisticasPerfil === 'function') {
        window.carregarEstatisticasPerfil();
    }

    // 3. Redireciona para a Home
    // Colocamos um tempo de espera um pouco maior se for imprimir, para dar tempo da impressora puxar os dados
    const tempoDeEspera = imprimirResumo ? 3000 : 1000;
    
    setTimeout(() => {
        window.location.href = 'home.html'; 
    }, tempoDeEspera);
};

window.fecharModalEncerramentoTurno = function() {
    const modal = document.getElementById('modal-encerrar-turno');
    if (modal) modal.classList.add('hidden');
};

// Esta é a função que o botão "Encerrar" do modal vermelho chama
window.confirmarEncerramentoTurno = function() {
    // 1. Limpa apenas a memória local do turno
    // Isso faz o perfil (👤) mostrar "FECHADO" e parar o relógio
    localStorage.removeItem('idCaixaAtual');
    localStorage.removeItem('horaAberturaCaixa');
    localStorage.removeItem('dataAberturaCaixa');

    // 2. Feedback e redirecionamento
    if (typeof showToast === 'function') showToast('TURNO ENCERRADO COM SUCESSO', 'sucesso');
    
    setTimeout(() => {
        // Redireciona para a Home ou Login para o próximo operador entrar
        window.location.href = 'home.html'; 
    }, 1000);
};

// 2. Fecha o modal de confirmação (botão cancelar)
window.fecharModalEncerramentoTurno = function() {
    const modal = document.getElementById('modal-encerrar-turno');
    if (modal) {
        modal.classList.add('hidden');
        modal.classList.remove('flex');
    }
};

// 3. Executa o fechamento real do turno
window.confirmarEncerramentoTurno = async function() {
    const idCaixa = localStorage.getItem('idCaixaAtual');
    const adminNome = localStorage.getItem('userName') || 'Admin';

    if (!idCaixa) {
        if (typeof showToast === 'function') showToast('NENHUM CAIXA ATIVO', 'erro');
        window.fecharModalEncerramentoTurno();
        return;
    }

    try {
        // Atualiza o status no banco de dados para FECHADO
        const { error } = await _supabase
            .from('caixa')
            .update({ 
                status: 'fechado',
                fechado_em: new Date().toISOString()
            })
            .eq('id', idCaixa);

        if (error) throw error;

        // Registro de Auditoria
        if (typeof registrarLog === 'function') {
            await registrarLog('FINANCEIRO', `FECHAMENTO DE CAIXA: TURNO ENCERRADO (OP: ${adminNome})`);
        }

        // LIMPEZA DA MEMÓRIA (Resolve o bug do Tempo de Turno!)
        localStorage.removeItem('idCaixaAtual');
        localStorage.removeItem('dataAberturaCaixa');
        localStorage.removeItem('horaAberturaCaixa');

        // Fecha o modal
        window.fecharModalEncerramentoTurno();

        if (typeof showToast === 'function') showToast('TURNO ENCERRADO COM SUCESSO', 'sucesso');
        
        // Atualiza o perfil global para refletir que o caixa fechou
        if (typeof window.carregarEstatisticasPerfil === 'function') {
            window.carregarEstatisticasPerfil();
        }

        // Voltar para a tela inicial
        setTimeout(() => {
            window.location.href = 'home.html'; 
        }, 1500);

    } catch (e) {
        console.error('[CAIXA] Erro ao encerrar turno:', e);
        if (typeof showToast === 'function') showToast('ERRO AO ENCERRAR TURNO', 'erro');
    }
};

/* --- Pontes para o HTML --- */

/**
 * Função conectada ao botão de Confirmar Movimentação na tela cheia.
 */
window.registrarMovimentacaoBotao = function() {
    const tipoSelect = document.getElementById('mov-tipo');
    const tipo = tipoSelect ? tipoSelect.value : 'SANGRIA';
    window.registrarMovimentacaoCaixa(tipo);
};