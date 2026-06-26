/* =================================================================================
   NÚCLEO DE OPERAÇÕES (MAIN) - VERSÃO ATUALIZADA COM LOGS 3.0
   ================================================================================= */

var acaoAdminPendente = null;

const SECOES_ADMIN = ['produtos', 'relatorios', 'despesas', 'movimentacoes', 'estorno', 'configuracoes'];

// =================================================================================
// 1. INICIALIZAÇÃO DO SISTEMA
// =================================================================================
document.addEventListener('DOMContentLoaded', async () => {
    verificarAuth();
    aplicarPermissoesUI();
    
    const path = window.location.pathname.toLowerCase();
    const isLoginPage = path.includes('index.html') || path === '/' || path.endsWith('/');
    
    if (!isLoginPage) {
        if (localStorage.getItem('userNivel') === 'ADMIN') {
            if (typeof verificarStatusCaixa === 'function') {
                await verificarStatusCaixa();
            }
        }

        if (path.includes('historico-caixas.html')) {
            if (typeof carregarHistoricoCaixas === 'function') await carregarHistoricoCaixas();
        }

        if (path.includes('configuracoes.html')) {
            if (typeof carregarFiltroUsuarios === 'function') carregarFiltroUsuarios();
        }

        if (typeof preencherDatasPadrao === 'function') preencherDatasPadrao();
        
        initSistema();
        iniciarMonitoramento();
        
        setInterval(verificarAuth, 60000);
        configurarBotaoVoltar();
    }
});

// =================================================================================
// 2. ROTEADOR E GESTÃO DE ACESSO
// =================================================================================
function initSistema() {
    const path = window.location.pathname.toLowerCase();
    console.log('>>> [MAIN] Sistema iniciado na rota:', path);

    if (path.includes('venda.html')) {
        if (typeof renderizarVenda === 'function') renderizarVenda();
        if (typeof atualizarFAB === 'function') atualizarFAB();
    }
    else if (path.includes('configuracoes.html') || path.includes('admin.html')) {
        if (typeof renderizarCatalogo === 'function') renderizarCatalogo();
        if (typeof carregarAuditoria === 'function') carregarAuditoria();
        if (typeof carregarListaUsuarios === 'function') carregarListaUsuarios();
        if (typeof carregarPreferenciasTicket === 'function') carregarPreferenciasTicket();
    }
    else if (path.includes('comandas.html')) {
        if (typeof carregarComandas === 'function') carregarComandas();
    }
    else if (path.includes('divisao.html')) {
        if (typeof initPaginaDivisao === 'function') initPaginaDivisao();
    }
    else if (path.includes('estorno.html')) {
        if (typeof carregarVendasEstorno === 'function') carregarVendasEstorno();
    }
    else if (path.includes('home.html')) {
        if (typeof carregarResumoHome === 'function') carregarResumoHome();
    }
}

function verificarAuth() {
    const usuarioLogado = localStorage.getItem('userName');
    const path = window.location.pathname.toLowerCase();
    const isLoginPage = path.includes('index.html') || path === '/' || path.endsWith('/');

    if (!usuarioLogado && !isLoginPage) {
        window.location.href = 'index.html';
        return;
    }
    
    if (usuarioLogado && !isLoginPage) {
        const ultimo = parseInt(localStorage.getItem('ultimoAcesso') || Date.now());
        const limiteInatividade = typeof TEMPO_LIMITE_INATIVIDADE !== 'undefined' ? TEMPO_LIMITE_INATIVIDADE : 1200000;
        
        if (Date.now() - ultimo > limiteInatividade) {
            
            // ----------------------------------------------------
            // SUBSTITUIÇÃO DO ALERT DE INATIVIDADE
            // ----------------------------------------------------
            if (typeof alertaSistema === 'function') {
                alertaSistema('Sessão expirada por inatividade. Redirecionando...', 'Aviso de Segurança');
                // Atrasamos o logout em 3 segundos para dar tempo de ler o modal
                setTimeout(() => {
                    logout();
                }, 3000);
            } else {
                alert('Sessão expirada por inatividade.');
                logout();
            }
            return;
        }
        
        // ----------------------------------------------------
        // LIBERA A PORTA: Se chegou até aqui, o usuário é válido!
        // Remove o display:none do HTML e mostra a página
        // ----------------------------------------------------
        document.body.style.display = 'block'; 
        
        const headerNome = document.getElementById('header-usuario');
        if (headerNome) headerNome.innerText = `OLÁ, ${usuarioLogado.toUpperCase()}`;
    }
}

function aplicarPermissoesUI() {
    const nivelUsuario = localStorage.getItem('userNivel') || 'GARCOM';
    
    if (nivelUsuario.toUpperCase() === 'GARCOM') {
        ['nav-admin', 'card-faturamento', 'btn-home-admin'].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.style.display = 'none';
        });

        const path = window.location.pathname.toLowerCase();
        if (path.includes('admin.html') || path.includes('configuracoes.html')) {
            window.location.href = 'home.html';
        }
    }
}

function logout() {
    localStorage.clear();
    window.location.href = 'index.html';
}
window.logout = logout;

// =================================================================================
// 3. SEGURANÇA (CONFIRMAÇÃO COM SENHA ADMIN)
// =================================================================================
window.solicitarSenhaAdmin = function(acao, payload) {
    console.log('>>> [MAIN] Solicitando senha para:', acao);
    window.acaoAdminPendente = { acao, payload };
    
    const modal = document.getElementById('modal-auth-admin');
    const inputSenha = document.getElementById('input-auth-senha');

    if (modal) {
        if (inputSenha) inputSenha.value = '';
        modal.classList.remove('hidden');
        modal.classList.add('flex');
        setTimeout(() => inputSenha?.focus(), 100);
    } else {
        // ----------------------------------------------------
        // SUBSTITUIÇÃO DO ALERT DE ERRO CRÍTICO
        // ----------------------------------------------------
        if (typeof alertaSistema === 'function') {
            alertaSistema('O modal de autenticação de administrador não foi encontrado no sistema.', 'Erro Crítico de Interface');
        } else {
            alert('ERRO CRÍTICO: Modal de senha não existe no HTML.');
        }
    }
}

window.confirmarAuth = async function() {
    const input = document.getElementById('input-auth-senha');
    const senhaDigitada = input?.value;

    if (!senhaDigitada) return showToast("DIGITE A SENHA", "erro");

    try {
        const { data: admin, error: adminError } = await _supabase
            .from('usuarios')
            .select('senha')
            .eq('usuario', 'admin')
            .maybeSingle();

        if (adminError || !admin) {
            console.error("Erro ao buscar admin:", adminError);
            return showToast("ERRO: USUÁRIO ADMIN NÃO ENCONTRADO", "erro");
        }

        // Comparação de senha (Base64)
        if (btoa(senhaDigitada) === admin.senha || senhaDigitada === admin.senha) {
            
            // --- REGISTRO DE AUDITORIA (PADRÃO 3 ARGUMENTOS) ---
            if (typeof registrarLog === 'function') {
                const acaoDesc = window.acaoAdminPendente?.acao || "AÇÃO RESTRITA";
                await registrarLog(
                    'SEGURANÇA', 
                    'AUTORIZAÇÃO MESTRE CONCEDIDA', 
                    `SENHA DO ADMIN UTILIZADA PARA: ${acaoDesc.toUpperCase()}`
                );
            }

            // Executa a ação (Agora usando o callback se existir, ou o switch antigo)
            if (window.acaoAdminPendente?.callback) {
                await window.acaoAdminPendente.callback();
            } else if (window.acaoAdminPendente) {
                confirmarAcaoComSenha(window.acaoAdminPendente.acao, window.acaoAdminPendente.payload);
            }

            window.acaoAdminPendente = null;
            if (input) input.value = '';
            fecharModalAuth(); 

        } else {
            // --- REGISTRO DE AUDITORIA (FALHA) ---
            if (typeof registrarLog === 'function') {
                await registrarLog(
                    'SEGURANÇA', 
                    'FALHA DE AUTORIZAÇÃO', 
                    '🚨 TENTATIVA DE ACESSO COM SENHA ADMINISTRATIVA INCORRETA'
                );
            }
            showToast("SENHA INCORRETA!", "erro");
        }

    } catch (e) {
        console.error("❌ [AUTH] Erro fatal:", e);
        showToast("ERRO AO PROCESSAR AUTORIZAÇÃO", "erro");
    }
};

window.fecharModalAuth = function() {
    const modal = document.getElementById('modal-auth-admin');
    if (modal) modal.classList.add('hidden');
    const input = document.getElementById('input-auth-senha');
    if (input) input.value = '';
    window.acaoAdminPendente = null;
};

function confirmarAcaoComSenha(acao, payload) {
    console.log(`[SEGURANÇA] Disparando: ${acao} | ID: ${payload}`);
    switch (acao) {
        case 'USER_EDIT':   if (typeof window.prepararEdicaoUsuario === 'function') window.prepararEdicaoUsuario(payload); break;
        case 'USER_TOGGLE': if (typeof window.executarToggleUsuario === 'function') window.executarToggleUsuario(payload); break;
        case 'EDITAR':      if (typeof abrirModalTrocaPagamento === 'function') abrirModalTrocaPagamento(payload); break;
        case 'ESTORNO':     if (typeof executarExclusaoFisica === 'function') executarExclusaoFisica(payload); break;
        case 'BACKUP':      if (typeof executarBackupReal === 'function') executarBackupReal(); break;
        default: if (typeof showToast === 'function') showToast('AÇÃO DESCONHECIDA', 'erro');
    }
}

function iniciarMonitoramento() {
    ['click', 'mousemove', 'keypress', 'touchstart', 'scroll'].forEach(e =>
        document.addEventListener(e, () => {
            if (localStorage.getItem('userName')) {
                localStorage.setItem('ultimoAcesso', Date.now().toString());
            }
        }, { passive: true })
    );
}

// =================================================================================
// 4. GESTÃO DE CAIXA E HOME
// =================================================================================

window.executarAberturaCaixa = async function() {
    const input = document.getElementById('valor-inicial-caixa');
    if (!input) return;

    const valorLimpo = input.value.replace(/\D/g, '');
    const valorFinal = parseFloat(valorLimpo) / 100;

    if (isNaN(valorFinal) || valorFinal < 0) {
        if (typeof showToast === 'function') return showToast('INFORME UM VALOR VÁLIDO', 'erro');
        return;
    }

    const adminNome = localStorage.getItem('userName') || 'Admin';
    const btn = document.querySelector('#modal-abrir-caixa button');

    if (btn) { btn.innerText = 'ABRINDO...'; btn.disabled = true; }

    try {
        const { data, error } = await _supabase
            .from('caixa')
            .insert([{ valor_inicial: valorFinal, status: 'aberto', criado_por: adminNome }])
            .select();

        if (error) throw error;

        localStorage.setItem('idCaixaAtual', data[0].id);

        const modal = document.getElementById('modal-abrir-caixa');
        if (modal) { modal.classList.add('hidden'); modal.classList.remove('flex'); }

        if (typeof showToast === 'function') showToast('CAIXA ABERTO COM SUCESSO!', 'sucesso');

        // --- REGISTRO DE AUDITORIA (CORRIGIDO: PADRÃO 3 ARGUMENTOS) ---
        if (typeof registrarLog === 'function') {
            const valF = typeof formatarMoeda === 'function' ? formatarMoeda(valorFinal) : valorFinal.toFixed(2);
            await registrarLog(
                'FINANCEIRO', 
                'ABERTURA DE CAIXA', 
                `CAIXA INICIADO POR ${adminNome.toUpperCase()} COM SALDO DE R$ ${valF}`
            );
        }

        if (typeof carregarResumoHome === 'function') carregarResumoHome();

    } catch (err) {
        console.error(err);
        if (typeof showToast === 'function') showToast('ERRO AO ABRIR CAIXA', 'erro');
        if (btn) { btn.innerText = 'Confirmar Abertura'; btn.disabled = false; }
    }
}

window.carregarResumoHome = async function() {
    if (typeof _supabase === 'undefined') return;

    const idCaixaAtual = localStorage.getItem('idCaixaAtual');
    const cardFaturamento = document.getElementById('faturamento-hoje');
    const badgeComandas = document.getElementById('badge-comandas');

    if (!idCaixaAtual || !cardFaturamento) {
        if (cardFaturamento) cardFaturamento.innerText = 'R$ 0,00';
        return;
    }

    try {
        const [{ data: vendas, error }, { data: comandas }] = await Promise.all([
            _supabase.from('historico_vendas').select('total').eq('id_caixa', idCaixaAtual),
            _supabase.from('comandas').select('id').eq('status', 'aberta')
        ]);

        if (error) throw error;

        const totalFaturamento = (vendas || []).reduce((acc, v) => acc + (parseFloat(v.total) || 0), 0);
        cardFaturamento.innerText = `R$ ${typeof formatarMoeda === 'function' ? formatarMoeda(totalFaturamento) : totalFaturamento.toFixed(2)}`;

        if (badgeComandas && comandas) {
            if (comandas.length > 0) {
                badgeComandas.classList.remove('hidden');
                badgeComandas.innerText = comandas.length;
            } else {
                badgeComandas.classList.add('hidden');
            }
        }

    } catch (e) {
        console.error('Erro ao carregar faturamento:', e);
        if (cardFaturamento) cardFaturamento.innerText = 'R$ --,--';
    }
}

// =================================================================================
// 5. NAVEGAÇÃO DE INTERFACE DINÂMICA
// =================================================================================
window.abrirSubSecao = function(s) {
    document.getElementById('admin-menu-principal')?.classList.add('hidden');
    SECOES_ADMIN.forEach(secao => {
        document.getElementById(`secao-${secao}`)?.classList.add('hidden');
    });
    
    if (s === 'despesas') {
        document.getElementById('view-form-despesa')?.classList.add('hidden');
        document.getElementById('view-lista-despesas')?.classList.remove('hidden');
    }
    if (s === 'produtos') {
        if (typeof alternarAbasAdminProdutos === 'function') alternarAbasAdminProdutos('lista');
    }
    if (s === 'configuracoes') {
        window.voltarMenuConfig();
    }
    if (s === 'relatorios') {
        window.voltarMenuRelatorios();
    }

    const secaoAtiva = document.getElementById(`secao-${s}`);
    if (secaoAtiva) secaoAtiva.classList.remove('hidden');

    if (s === 'produtos' && typeof renderizarCatalogo === 'function') renderizarCatalogo();
    if (s === 'estorno' && typeof carregarVendasEstorno === 'function') carregarVendasEstorno();
    if (s === 'despesas' && typeof carregarDespesas === 'function') {
        carregarDespesas();
        if (typeof verificarVencimentos === 'function') verificarVencimentos();
    }
}

window.voltarAoMenuAdmin = function() {
    SECOES_ADMIN.forEach(secao => {
        document.getElementById(`secao-${secao}`)?.classList.add('hidden');
    });
    document.getElementById('admin-menu-principal')?.classList.remove('hidden');
}

window.abrirConfigEspecifica = function(t) {
    document.getElementById('menu-config-cards')?.classList.add('hidden');
    document.getElementById(`view-cfg-${t}`)?.classList.remove('hidden');
    if (t === 'auditoria' && typeof carregarAuditoria === 'function') carregarAuditoria();
}

window.voltarMenuConfig = function() {
    ['view-cfg-ticket', 'view-cfg-auditoria', 'view-cfg-usuarios', 'view-cfg-backup', 'view-cfg-perigo'].forEach(i =>
        document.getElementById(i)?.classList.add('hidden')
    );
    document.getElementById('menu-config-cards')?.classList.remove('hidden');
}

window.abrirRelatorioEspecifico = function(tipo) {
    // Esconde o menu de cards
    document.getElementById('menu-relatorios-cards').classList.add('hidden');
    
    // Esconde todas as views primeiro
    ['view-dashboard', 'view-financeiro', 'view-produtos', 'view-comandas', 'view-estoque'].forEach(id => {
        const el = document.getElementById(id);
        if(el) el.classList.add('hidden');
    });

    // Mostra a view escolhida
    const viewAtiva = document.getElementById(`view-${tipo}`);
    if(viewAtiva) viewAtiva.classList.remove('hidden');

    // SE FOR FINANCEIRO, CHAMA O FILTRO DE HOJE AUTOMATICAMENTE
    if (tipo === 'financeiro') {
        window.mudarFiltroFinanceiro(0); // 0 = Hoje
    }
    
    // Se for dashboard, chama o dashboard
    if (tipo === 'dashboard') {
        window.gerarDashboard(0);
    }

    // =====================================================================
    // 🚀 O NOSSO NOVO GATILHO PARA O ESTOQUE ENTRA AQUI!
    // =====================================================================
    if (tipo === 'estoque') {
        if (typeof gerarRelatorioEstoque === 'function') {
            gerarRelatorioEstoque();
        }
    }

    if (tipo === 'produtos') {
        // Clica no filtro "HOJE" automaticamente quando abre a tela
        if (typeof mudarFiltroProdutos === 'function') mudarFiltroProdutos(0);
    }

    if (tipo === 'comandas') {
        // Aciona o filtro de "Hoje" assim que abre a tela
        if (typeof mudarFiltroComandas === 'function') {
            mudarFiltroComandas(0); 
        }
    }
};

window.voltarMenuRelatorios = function() {
    ['view-financeiro', 'view-produtos', 'view-comandas', 'view-dashboard', 'view-estoque'].forEach(i =>
        document.getElementById(i)?.classList.add('hidden')
    );
    document.getElementById('menu-relatorios-cards')?.classList.remove('hidden');
}

// =================================================================================
// 6. RELATÓRIO DE ESTOQUE
// =================================================================================
window.gerarRelatorioEstoque = async function() {
    const container = document.getElementById('conteudo-rel-estoque');
    
    // Se o HTML não tiver o container com esse ID, ele avisa no console para te ajudar a debugar
    if (!container) {
        console.error("Aviso: Container 'conteudo-rel-estoque' não encontrado na tela.");
        return;
    }

    if (typeof _supabase === 'undefined') return;

    // 1. Efeito visual de carregamento enquanto busca no banco
    container.innerHTML = '<p class="text-center text-xs text-slate-400 py-6 font-bold uppercase animate-pulse">Carregando dados do estoque...</p>';

    try {
        // 2. Busca os dados reais
        const { data: pds, error } = await _supabase
            .from('produtos')
            .select('*')
            .eq('controlar_estoque', true)
            .order('estoque_atual', { ascending: true });

        if (error) throw error;

        // 3. Verifica se a lista está vazia
        if (!pds || pds.length === 0) {
            container.innerHTML = '<p class="text-center text-xs text-slate-400 py-6 font-bold uppercase">Nenhum produto controla estoque.</p>';
            return;
        }

        // 4. Monta a tabela em HTML
        let totalItens = 0;
        let valorPotencialVenda = 0;
        let html = '<div class="space-y-2">';

        pds.forEach(p => {
            const qtd = parseFloat(p.estoque_atual || 0);
            totalItens += qtd;
            valorPotencialVenda += qtd * parseFloat(p.preco || 0);

            const corQtd = qtd <= 5 ? 'text-red-500 dark:text-red-400' : 'text-emerald-500 dark:text-emerald-400';
            const alerta = qtd <= 5
                ? '<span class="text-[8px] bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 px-1 py-0.5 rounded uppercase font-black ml-2">BAIXO</span>'
                : '';

            html += `
            <div class="flex justify-between items-center border-b border-slate-50 dark:border-slate-800 py-2 last:border-0">
                <div class="flex-1">
                    <span class="font-bold text-[10px] text-slate-600 dark:text-slate-300 uppercase">${p.nome} ${alerta}</span>
                </div>
                <span class="font-black ${corQtd} bg-slate-50 dark:bg-slate-800 px-2 rounded-lg text-xs border border-slate-100 dark:border-slate-700">${qtd} UN</span>
            </div>`;
        });

        html += `</div>
        <div class="mt-4 pt-4 border-t border-slate-100 dark:border-slate-700 flex justify-between items-center">
            <span class="text-[9px] font-black text-slate-400 uppercase">Total: ${totalItens} UN</span>
            <span class="text-[9px] font-black text-slate-400 uppercase">Potencial Venda: ${typeof window.fmSeguro === 'function' ? 'R$ ' + window.fmSeguro(valorPotencialVenda) : 'R$ ' + valorPotencialVenda.toFixed(2)}</span>
        </div>`;

        // 5. Injeta o resultado final na tela
        container.innerHTML = html;

    } catch (err) {
        console.error("Erro ao gerar relatório de estoque:", err);
        container.innerHTML = '<p class="text-center text-xs text-red-500 py-6 font-bold uppercase">Erro ao carregar o estoque. Tente novamente.</p>';
    }
}

// =================================================================================
// 7. MOTOR DE ESTOQUE: BAIXA AUTOMÁTICA
// =================================================================================
window.processarBaixaEstoqueAutomatica = async function(itensVendidos, motivoStr = 'VENDA DIRETA') {
    if (typeof _supabase === 'undefined' || !itensVendidos || itensVendidos.length === 0) return;

    try {
        const ids = [...new Set(itensVendidos.map(i => i.id))];

        const { data: produtosBanco, error } = await _supabase
            .from('produtos')
            .select('id, controlar_estoque, estoque_atual, nome')
            .in('id', ids)
            .eq('controlar_estoque', true);

        if (error || !produtosBanco || produtosBanco.length === 0) return;

        const usuarioAcao = localStorage.getItem('userName') || 'SISTEMA';

        for (const prodBanco of produtosBanco) {
            const qtdVendida = itensVendidos
                .filter(i => i.id === prodBanco.id)
                .reduce((acc, curr) => acc + (parseFloat(curr.qtd) || 1), 0);

            const novoEstoque = parseFloat(prodBanco.estoque_atual || 0) - qtdVendida;

            await _supabase.from('produtos').update({ estoque_atual: novoEstoque }).eq('id', prodBanco.id);

            await _supabase.from('estoque_movimentacoes').insert([{
                produto_id: prodBanco.id,
                tipo: 'saida',
                quantidade: qtdVendida,
                motivo: motivoStr,
                usuario: usuarioAcao
            }]);

            // --- REGISTRO DE AUDITORIA (NOVO) ---
            if (typeof registrarLog === 'function') {
                await registrarLog(
                    'ESTOQUE', 
                    'BAIXA AUTOMÁTICA', 
                    `PRODUTO: ${prodBanco.nome.toUpperCase()} | QTD: ${qtdVendida} | MOTIVO: ${motivoStr.toUpperCase()}`
                );
            }
        }

    } catch (err) {
        console.error('>>> [ESTOQUE] Erro crítico na baixa automática:', err);
    }
}

// =================================================================================
// 8. UTILITÁRIOS E PERFIL GLOBAL
// =================================================================================
function configurarBotaoVoltar() {
    document.querySelectorAll('header button').forEach(btn => {
        if (btn.innerText.includes('←') || btn.innerHTML.includes('←')) {
            btn.onclick = (e) => {
                e.preventDefault();
                if (window.location.pathname.includes('configuracoes.html')) {
                    const menu = document.getElementById('admin-menu-principal');
                    if (menu && menu.classList.contains('hidden')) {
                        window.voltarAoMenuAdmin();
                        return;
                    }
                }
                if (document.referrer && document.referrer.includes(window.location.host)) {
                    window.history.back();
                } else {
                    window.location.href = 'home.html';
                }
            };
        }
    });
}

// =================================================================
// SISTEMA DE NOTIFICAÇÕES (CONTAS VENCIDAS) - CONSOLIDADO
// =================================================================

/**
 * 1. FUNÇÃO CENTRAL (FONTE DA VERDADE)
 * Ambas as funções (verificar/abrir) perguntam a essa função para garantir
 * que a bolinha e a lista usem os mesmos dados e os mesmos critérios.
 */
window._buscarContasVencidas = async function() {
    const hojeObj = new Date();
    const ano = hojeObj.getFullYear();
    const mes = String(hojeObj.getMonth() + 1).padStart(2, '0');
    const dia = String(hojeObj.getDate()).padStart(2, '0');
    const hojeString = `${ano}-${mes}-${dia}`;

    // Busca apenas contas que NÃO foram pagas e cujo vencimento é menor que hoje
    const { data: contas, error } = await _supabase
        .from('despesas')
        .select('id, descricao, valor, vencimento')
        .eq('paga', false) 
        .lt('vencimento', hojeString) 
        .order('vencimento', { ascending: true });

    if (error) throw error;
    
    return { contas: contas || [], hojeObj };
};

window.verificarNotificacoesGlobais = async function() {
    if (typeof _supabase === 'undefined') return;
    try {
        const userId = localStorage.getItem('userId');
        if (!userId) return;

        // Checa se o usuário atual tem permissão para receber notificações
        const { data: usuarioAtual } = await _supabase
            .from('usuarios')
            .select('recebe_notificacoes')
            .eq('id', userId)
            .single();

        const badge = document.getElementById('badge-notificacoes');
        if (usuarioAtual && usuarioAtual.recebe_notificacoes === false) {
            if (badge) {
                badge.classList.add('hidden');
                badge.classList.remove('flex');
            }
            return; 
        }

        // Pede os dados para a fonte da verdade
        const { contas } = await window._buscarContasVencidas();

        if (badge) {
            if (contas && contas.length > 0) {
                badge.innerText = contas.length > 99 ? '99+' : contas.length;
                badge.classList.remove('hidden');
                badge.classList.add('flex');
            } else {
                badge.classList.add('hidden');
                badge.classList.remove('flex');
            }
        }
    } catch (erro) {
        console.error('Erro ao buscar notificações:', erro);
    }
};

window.abrirNotificacoes = async function() {
    const modal = document.getElementById('modal-notificacoes');
    const container = document.getElementById('lista-contas-vencidas');
    
    if (!modal || !container) return;
    
    container.innerHTML = '<div class="text-center p-6 text-slate-500 font-bold animate-pulse">Buscando contas... ⏳</div>';
    modal.classList.remove('hidden');
    modal.classList.add('flex');
    
    try {
        // Pede os mesmos dados exatos para a fonte da verdade
        const { contas, hojeObj } = await window._buscarContasVencidas();
        
        if (!contas || contas.length === 0) {
            container.innerHTML = `
                <div class="flex flex-col items-center justify-center p-8 text-green-500">
                    <span class="text-5xl mb-3">🎉</span>
                    <span class="font-black text-xl text-center">TUDO EM DIA!</span>
                    <span class="text-sm text-slate-500 text-center mt-1">Nenhuma conta vencida encontrada. Excelente gestão!</span>
                </div>`;
            
            // Se abriu a lista vazia, garante que a bolinha suma
            const badge = document.getElementById('badge-notificacoes');
            if(badge) { badge.classList.add('hidden'); badge.classList.remove('flex'); }
            
            return;
        }
        
        let html = '';
        contas.forEach(c => {
            const dataVenc = new Date(c.vencimento + 'T12:00:00'); 
            const diffTempo = Math.abs(hojeObj - dataVenc);
            const diasAtraso = Math.ceil(diffTempo / (1000 * 60 * 60 * 24));
            
            const valorF = typeof window.fmSeguro === 'function' ? window.fmSeguro(c.valor) : parseFloat(c.valor).toFixed(2);
            const nomeConta = c.descricao || 'CONTA SEM NOME';
            
            html += `
            <div class="bg-red-50 dark:bg-red-900/20 border-l-4 border-red-500 p-3 rounded-r-lg shadow-sm mb-3 last:mb-0">
                <div class="flex justify-between items-start mb-1">
                    <span class="font-bold text-slate-800 dark:text-slate-200 text-sm uppercase pr-2">${nomeConta}</span>
                    <span class="font-black text-red-600 text-sm whitespace-nowrap">R$ ${valorF}</span>
                </div>
                <div class="flex justify-between items-center mt-3">
                    <span class="text-[10px] font-bold text-slate-500 bg-white dark:bg-slate-800 px-2 py-1 rounded shadow-sm border border-slate-100 dark:border-slate-700">Venceu: ${dataVenc.toLocaleDateString('pt-BR')}</span>
                    <span class="text-[11px] font-black text-red-500 animate-pulse">⏳ ${diasAtraso} dias de atraso</span>
                </div>
            </div>`;
        });
        
        container.innerHTML = html;
        
        // Atualiza a bolinha com o número exato dos itens da lista
        const badge = document.getElementById('badge-notificacoes');
        if (badge) {
            badge.innerText = contas.length > 99 ? '99+' : contas.length;
            badge.classList.remove('hidden');
            badge.classList.add('flex');
        }
        
    } catch (e) {
        console.error("❌ Erro ao buscar notificações:", e);
        container.innerHTML = '<div class="text-center p-6 text-red-500 font-bold">Erro ao carregar as informações do banco de dados.</div>';
    }
};

window.fecharModalNotificacoes = function() {
    const modal = document.getElementById('modal-notificacoes');
    if (modal) {
        modal.classList.add('hidden');
        modal.classList.remove('flex');
    }
};

// 4. AUTO-INICIALIZAÇÃO: 
document.addEventListener('DOMContentLoaded', () => {
    // 1. O JavaScript desenha o modal invisível na página
    window.injetarModalNotificacoes();

    // 2. Busca os dados no Supabase para colocar o número na bolinha vermelha
    setTimeout(() => {
        if (typeof window.verificarNotificacoesGlobais === 'function') {
            window.verificarNotificacoesGlobais();
        }
    }, 1000);
    
    setInterval(window.verificarNotificacoesGlobais, 300000);
});

// =================================================================================
// 9. MOTOR DE AUDITORIA (FONTE ÚNICA)
// =================================================================================
window.registrarLog = async function(arg1, arg2, arg3) {
    let tipo, action, description;

    if (arg3 === undefined) {
        action = arg1 || 'AÇÃO NÃO IDENTIFICADA';
        description = arg2 || action;
        
        const textoBusca = action.toUpperCase();
        if (textoBusca.includes('VENDA') || textoBusca.includes('MESA') || textoBusca.includes('COMANDA')) {
            tipo = 'VENDA';
        } else if (textoBusca.includes('CAIXA') || textoBusca.includes('SANGRIA') || textoBusca.includes('MOVIMENTAÇÃO')) {
            tipo = 'FINANCEIRO';
        } else if (textoBusca.includes('PRODUTO') || textoBusca.includes('ESTOQUE')) {
            tipo = 'ESTOQUE';
        } else if (textoBusca.includes('LOGIN') || textoBusca.includes('SEGURANÇA')) {
            tipo = 'SEGURANÇA';
        } else {
            tipo = 'SISTEMA';
        }
    } else {
        tipo = arg1;
        action = arg2;
        description = arg3;
    }

    try {
        const usuarioLogado = localStorage.getItem('userName') || 'SISTEMA';
        await _supabase.from('auditoria').insert([{
            usuario: usuarioLogado.toUpperCase(),
            tipo: tipo.toUpperCase(),
            action: action.toUpperCase(),
            description: description.toUpperCase()
        }]);
    } catch (e) {
        console.error('Erro na Auditoria:', e);
    }
};

/* =================================================================================
   CONFIGURAÇÕES DE HARDWARE (LOCAL) - TAMANHO DA BOBINA
   ================================================================================= */

// 1. Inicializa a tela com as configurações salvas
window.carregarConfiguracoesImpressao = function() {
    // Carrega o Select de Conexão (Modo)
    const selectModo = document.getElementById('cfg-modo-impressao');
    if (selectModo) {
        selectModo.value = localStorage.getItem('modoImpressao') || 'direto'; 
    }

    // Carrega os botões de Tamanho (assume 80mm como padrão para desktops)
    const tamanhoSalvo = localStorage.getItem('tamanhoImpressora') || '80';
    window.atualizarBotoesImpressora(tamanhoSalvo);
};

// 2. Salva o tamanho do papel SOMENTE no aparelho físico atual
window.salvarTamanhoImpressora = function(tamanho) {
    try {
        localStorage.setItem('tamanhoImpressora', tamanho);
        
        // Atualiza a interface imediatamente
        window.atualizarBotoesImpressora(tamanho);
        
        if(typeof showToast === 'function') {
            showToast(`BOBINA DE ${tamanho}MM SALVA NESTE APARELHO!`, 'sucesso');
        }
    } catch (e) {
        console.error("Erro crítico ao salvar tamanho da impressora no storage local:", e);
        if(typeof showToast === 'function') {
            showToast("ERRO AO SALVAR TAMANHO (MEMÓRIA CHEIA/BLOQUEADA)", "erro");
        }
    }
};

// 3. Gerencia o visual dos botões (Pinta o selecionado)
window.atualizarBotoesImpressora = function(tamanhoSelecionado) {
    const btn58 = document.getElementById('btn-imp-58');
    const btn80 = document.getElementById('btn-imp-80');
    
    // Classes de Design (Ativo = Amarelo WebComanda | Inativo = Cinza)
    const classesAtivas = ['border-yellow-400', 'bg-yellow-50', 'dark:bg-yellow-900/20', 'text-yellow-600', 'dark:text-yellow-500'];
    const classesInativas = ['border-slate-200', 'dark:border-slate-700', 'bg-white', 'dark:bg-slate-800', 'text-slate-400', 'dark:text-slate-500'];

    if (btn58 && btn80) {
        // Remove os estados ativos de ambos
        btn58.classList.remove(...classesAtivas); 
        btn58.classList.add(...classesInativas);
        btn80.classList.remove(...classesAtivas); 
        btn80.classList.add(...classesInativas);
        
        // Aplica o estado ativo apenas no escolhido
        if (tamanhoSelecionado === '58') {
            btn58.classList.remove(...classesInativas);
            btn58.classList.add(...classesAtivas);
        } else {
            btn80.classList.remove(...classesInativas);
            btn80.classList.add(...classesAtivas);
        }
    }
};

// 4. Gatilho de inicialização
document.addEventListener('DOMContentLoaded', () => {
    // Valida se estamos na página correta antes de disparar a função
    if (window.location.pathname.includes('configuracoes.html') || window.location.pathname.includes('admin.html')) {
        window.carregarConfiguracoesImpressao();
    }
});

// Exemplo: Dentro da função que abre a tela de configurações
const selectImpressao = document.getElementById('select-modo-impressao');
if (selectImpressao) {
    selectImpressao.value = localStorage.getItem('modoImpressao') || 'navegador';
}

// =================================================================
// SISTEMA DE NOTIFICAÇÕES (CONTAS VENCIDAS - TABELA 'despesas')
// =================================================================

window.abrirModalNotificacoes = async function() {
    const modal = document.getElementById('modal-notificacoes');
    const container = document.getElementById('lista-contas-vencidas');
    
    if (!modal || !container) return;
    
    // Mostra o modal com tela de carregamento
    container.innerHTML = '<div class="text-center p-6 text-slate-500 font-bold animate-pulse">Buscando contas... ⏳</div>';
    modal.classList.remove('hidden');
    modal.classList.add('flex');
    
    try {
        // Pega a data de hoje no formato exato que o banco de dados entende (YYYY-MM-DD)
        const hojeObj = new Date();
        const ano = hojeObj.getFullYear();
        const mes = String(hojeObj.getMonth() + 1).padStart(2, '0');
        const dia = String(hojeObj.getDate()).padStart(2, '0');
        const hojeString = `${ano}-${mes}-${dia}`;
        
        // Busca na sua tabela 'despesas'
        const { data: contas, error } = await _supabase
            .from('despesas')
            .select('id, descricao, valor, data_vencimento')
            .eq('status', 'pendente') // Filtra só o que ainda não foi pago
            .lt('data_vencimento', hojeString) // Filtra datas de vencimento menores (anteriores) que hoje
            .order('data_vencimento', { ascending: true }); // A mais antiga aparece primeiro
            
        if (error) throw error;
        
        // Se não tiver nada atrasado, mostra a tela de sucesso!
        if (!contas || contas.length === 0) {
            container.innerHTML = `
                <div class="flex flex-col items-center justify-center p-8 text-green-500">
                    <span class="text-5xl mb-3">🎉</span>
                    <span class="font-black text-xl text-center">TUDO EM DIA!</span>
                    <span class="text-sm text-slate-500 text-center mt-1">Nenhuma conta vencida encontrada. Excelente gestão!</span>
                </div>`;
            return;
        }
        
        // Renderiza a lista de contas atrasadas
        let html = '';
        contas.forEach(c => {
            // Calcula os dias de atraso (Ajustando o fuso horário com 'T12:00:00' para não dar diferença de 1 dia)
            const dataVenc = new Date(c.data_vencimento + 'T12:00:00'); 
            const diffTempo = Math.abs(hojeObj - dataVenc);
            const diasAtraso = Math.ceil(diffTempo / (1000 * 60 * 60 * 24));
            
            // Formata o valor
            const valorF = typeof window.fmSeguro === 'function' ? window.fmSeguro(c.valor) : parseFloat(c.valor).toFixed(2);
            const nomeConta = c.descricao || 'CONTA SEM NOME';
            
            html += `
            <div class="bg-red-50 dark:bg-red-900/20 border-l-4 border-red-500 p-3 rounded-r-lg shadow-sm mb-3 last:mb-0">
                <div class="flex justify-between items-start mb-1">
                    <span class="font-bold text-slate-800 dark:text-slate-200 text-sm uppercase pr-2">${nomeConta}</span>
                    <span class="font-black text-red-600 text-sm whitespace-nowrap">R$ ${valorF}</span>
                </div>
                <div class="flex justify-between items-center mt-3">
                    <span class="text-[10px] font-bold text-slate-500 bg-white dark:bg-slate-800 px-2 py-1 rounded shadow-sm border border-slate-100 dark:border-slate-700">Venceu: ${dataVenc.toLocaleDateString('pt-BR')}</span>
                    <span class="text-[11px] font-black text-red-500 animate-pulse">⏳ ${diasAtraso} dias de atraso</span>
                </div>
            </div>`;
        });
        
        container.innerHTML = html;
        
    } catch (e) {
        console.error("❌ Erro ao buscar notificações:", e);
        container.innerHTML = '<div class="text-center p-6 text-red-500 font-bold">Erro ao carregar as informações do banco de dados.</div>';
    }
};

window.fecharModalNotificacoes = function() {
    const modal = document.getElementById('modal-notificacoes');
    if (modal) {
        modal.classList.add('hidden');
        modal.classList.remove('flex');
    }
};

// 5. INJETOR DE MODAL AUTOMÁTICO
window.injetarModalNotificacoes = function() {
    // Verifica se o modal já existe na página para não duplicar
    if (document.getElementById('modal-notificacoes')) return;

    // Cria o HTML do modal
    const htmlModal = `
    <div id="modal-notificacoes" class="hidden fixed inset-0 z-[500] items-center justify-center p-4 bg-slate-900/80 backdrop-blur-sm transition-opacity">
        <div class="bg-white dark:bg-slate-900 w-full max-w-md rounded-[2rem] shadow-2xl border border-slate-100 dark:border-slate-800 overflow-hidden flex flex-col max-h-[85vh]">
            
            <div class="p-5 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50 dark:bg-slate-800/50">
                <div class="flex items-center gap-3">
                    <div class="bg-red-100 dark:bg-red-900/30 p-2 rounded-xl text-red-500">🔔</div>
                    <h3 class="font-black text-slate-800 dark:text-white uppercase tracking-wider text-sm">Contas Vencidas</h3>
                </div>
                <button onclick="window.fecharModalNotificacoes()" class="text-slate-400 hover:text-red-500 transition-colors p-2 rounded-xl hover:bg-red-50 dark:hover:bg-red-900/20 active:scale-95">
                    <span class="font-black text-lg px-1">X</span>
                </button>
            </div>
            
            <div id="lista-contas-vencidas" class="p-5 overflow-y-auto flex-1 bg-slate-50/50 dark:bg-slate-900 custom-scrollbar">
                </div>
            
        </div>
    </div>
    `;

    // Cria uma div temporária para converter a string de texto em elementos HTML de verdade
    const divWrapper = document.createElement('div');
    divWrapper.innerHTML = htmlModal;

    // Anexa o modal no final da tag <body> da página
    document.body.appendChild(divWrapper.firstElementChild);
};

// =================================================================
// TRAVA DE SEGURANÇA: ZONA DE PERIGO
// =================================================================

window.acaoAposSenha = null; // Guarda o que o sistema deve fazer após validar

// 1. Função que abre o modal e guarda a ação que o usuário quer fazer
window.solicitarSenhaPerigo = function(funcaoDestino) {
    window.acaoAposSenha = funcaoDestino; // Salva a função na memória
    
    document.getElementById('input-senha-perigo').value = '';
    const modal = document.getElementById('modal-senha-perigo');
    modal.classList.remove('hidden');
    modal.classList.add('flex');
    
    // Foca no input automaticamente após abrir
    setTimeout(() => document.getElementById('input-senha-perigo').focus(), 100);
};

window.fecharModalSenhaPerigo = function() {
    const modal = document.getElementById('modal-senha-perigo');
    modal.classList.add('hidden');
    modal.classList.remove('flex');
    window.acaoAposSenha = null; // Limpa a memória por segurança
};

// 2. Vai no Supabase confirmar a senha do usuário logado
window.verificarSenhaPerigo = async function() {
    const senhaInput = document.getElementById('input-senha-perigo').value;
    const btn = document.getElementById('btn-confirmar-perigo');
    const userId = localStorage.getItem('userId');

    if (!senhaInput) {
        if (typeof mostrarPilula === 'function') mostrarPilula("Digite a senha!", "erro");
        return;
    }

    if (!userId) {
        if (typeof mostrarPilula === 'function') mostrarPilula("Erro: Faça login novamente.", "erro");
        return;
    }

    try {
        btn.disabled = true;
        btn.innerHTML = "⏳";

        const { data, error } = await _supabase
            .from('usuarios')
            .select('id')
            .eq('id', userId)
            .eq('senha', senhaInput)
            .single();

        if (error || !data) {
            if (typeof mostrarPilula === 'function') mostrarPilula("Senha incorreta!", "erro");
            document.getElementById('input-senha-perigo').value = ''; 
            btn.disabled = false;
            btn.innerHTML = "LIBERAR";
            return;
        }

        // SALVA A FUNÇÃO ANTES DE FECHAR O MODAL E APAGAR A MEMÓRIA
        const executarAcao = window.acaoAposSenha; 
        
        fecharModalSenhaPerigo();
        
        if (typeof mostrarPilula === 'function') mostrarPilula("Acesso liberado!", "sucesso");

        // Executa a ação guardada
        if (typeof executarAcao === 'function') {
            executarAcao();
        }

    } catch (e) {
        console.error("Erro ao validar senha:", e);
        if (typeof mostrarPilula === 'function') mostrarPilula("Erro de conexão", "erro");
    } finally {
        if (btn) {
            btn.disabled = false;
            btn.innerHTML = "LIBERAR";
        }
    }
};

// BÔNUS: Fazer a tecla "Enter" acionar o botão de liberar
document.addEventListener('DOMContentLoaded', () => {
    setTimeout(() => {
        const inputSenha = document.getElementById('input-senha-perigo');
        if (inputSenha) {
            inputSenha.addEventListener('keypress', function (e) {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    window.verificarSenhaPerigo();
                }
            });
        }
    }, 1000);
});

// =================================================================
// SISTEMA DE BACKUP E RESTAURAÇÃO (JSON)
// =================================================================

// 📋 Lista EXATA das tabelas do seu Supabase (Corrigido)
const tabelasParaBackup = [
    'usuarios',
    'produtos',
    'caixa',                // Corrigido para o singular
    'movimentacoes_caixa',  // Substituiu o resumos_caixa
    'despesas',
    'comandas',
    'auditoria'
];

// 1. FUNÇÃO DE EXPORTAR (BAIXAR ARQUIVO)
window.fazerBackupSistema = async function() {
    try {
        if (typeof mostrarPilula === 'function') mostrarPilula("Gerando backup... Aguarde ⏳", "sucesso");
        
        const btn = event.currentTarget;
        const textoOriginal = btn.innerText;
        btn.innerText = "BAIXANDO...";
        btn.disabled = true;

        const backupData = {};

        // Busca os dados de cada tabela
        for (const tabela of tabelasParaBackup) {
            const { data, error } = await _supabase.from(tabela).select('*');
            if (error) {
                console.error(`Erro ao buscar dados da tabela ${tabela}:`, error);
                continue; 
            }
            backupData[tabela] = data;
        }

        // Adiciona a data e hora do backup no arquivo
        backupData['_info'] = {
            data_geracao: new Date().toISOString(),
            sistema: "WebComanda - Espetinho & Cia"
        };

        // Cria o arquivo JSON e força o download
        const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(backupData));
        const downloadAnchorNode = document.createElement('a');
        downloadAnchorNode.setAttribute("href", dataStr);
        
        // Nome do arquivo com a data de hoje (ex: backup_webcomanda_2026-03-31.json)
        const dataAtual = new Date().toISOString().split('T')[0];
        downloadAnchorNode.setAttribute("download", `backup_webcomanda_${dataAtual}.json`);
        
        document.body.appendChild(downloadAnchorNode);
        downloadAnchorNode.click();
        downloadAnchorNode.remove();

        if (typeof mostrarPilula === 'function') mostrarPilula("Backup baixado com sucesso! ✅", "sucesso");
        
        localStorage.setItem('ultimoBackup', new Date().toISOString());
        btn.innerText = textoOriginal;
        btn.disabled = false;

    } catch (error) {
        console.error("Erro no backup:", error);
        if (typeof mostrarPilula === 'function') mostrarPilula("Erro ao gerar backup.", "erro");
    }

    
};

// 2. FUNÇÃO DE RESTAURAR (LER ARQUIVO E ENVIAR PRO BANCO)
window.processarArquivoRestore = function(inputElement) {
    const file = inputElement.files[0];
    if (!file) return;

    // TRUQUE: Guardamos o arquivo na variável "file" e já limpamos o input.
    // Isso evita que o botão "trave" se o usuário cancelar a operação no modal.
    inputElement.value = '';

    // ----------------------------------------------------
    // SUBSTITUIÇÃO DO CONFIRM E ALERT
    // ----------------------------------------------------
    if (typeof confirmarAcao === 'function') {
        confirmarAcao(
            "Você está prestes a sobrescrever os dados do sistema com as informações deste arquivo. Tem certeza absoluta de que deseja continuar?",
            () => executarRestoreBaseDados(file), // Chama a lógica apenas se clicar em SIM
            "⚠️ ATENÇÃO EXTREMA"
        );
    } else {
        // Fallback de segurança
        const confirmacao = confirm("⚠️ ATENÇÃO EXTREMA!\n\nVocê está prestes a sobrescrever os dados...\n\nTem certeza absoluta?");
        if (confirmacao) executarRestoreBaseDados(file);
    }

    // Isolamos a lógica gigante dentro de uma função para o código ficar limpo
    function executarRestoreBaseDados(arquivoBackup) {
        const reader = new FileReader();
        
        reader.onload = async function(e) {
            try {
                if (typeof mostrarPilula === 'function') mostrarPilula("Restaurando dados... NÃO FECHE A TELA! ⏳", "sucesso");
                
                const contents = e.target.result;
                const backupData = JSON.parse(contents);

                // Importa as tabelas na mesma ordem para respeitar dependências
                for (const tabela of tabelasParaBackup) {
                    if (backupData[tabela] && backupData[tabela].length > 0) {
                        
                        // O comando UPSERT insere dados novos e atualiza os que já existem
                        const { error } = await _supabase
                            .from(tabela)
                            .upsert(backupData[tabela]);

                        if (error) {
                            console.error(`❌ Erro ao restaurar a tabela ${tabela}:`, error);
                        } else {
                            console.log(`✅ Tabela ${tabela} restaurada com sucesso!`);
                        }
                    }
                }

                if (typeof mostrarPilula === 'function') mostrarPilula("Restauração concluída! Reiniciando sistema... 🔄", "sucesso");
                
                // Recarrega a página para puxar os dados novos
                setTimeout(() => {
                    window.location.reload();
                }, 2000);

            } catch (error) {
                console.error("Erro na restauração:", error);
                if (typeof mostrarPilula === 'function') mostrarPilula("Erro: Arquivo inválido ou corrompido.", "erro");
                
                // Substituição do Alert final de erro
                if (typeof alertaSistema === 'function') {
                    alertaSistema("Erro ao ler o arquivo. Certifique-se de que é um backup válido gerado pelo sistema.", "Erro de Restauração");
                } else {
                    alert("Erro ao ler o arquivo. Certifique-se de que é um backup válido gerado pelo sistema.");
                }
            }
        };
        
        reader.readAsText(arquivoBackup);
    }
};

// =================================================================
// LEMBRETE AUTOMÁTICO DE BACKUP
// =================================================================
window.verificarLembreteBackup = function() {
    const ultimoBackup = localStorage.getItem('ultimoBackup');
    
    // Pega a função de notificação que estiver disponível
    const notificar = typeof mostrarPilula === 'function' ? mostrarPilula : 
                     (typeof showToast === 'function' ? showToast : alert);

    if (!ultimoBackup) {
        // Se nunca fez backup neste navegador
        setTimeout(() => notificar("⚠️ Recomendado: Faça um Backup!", "erro"), 3000);
    } else {
        // Se já fez, verifica se faz mais de 3 dias
        const dataUltimo = new Date(ultimoBackup);
        const agora = new Date();
        const diferencaDias = (agora - dataUltimo) / (1000 * 60 * 60 * 24);

        if (diferencaDias > 3) {
            setTimeout(() => notificar("⚠️ Atenção: Faça um Backup dos dados!", "erro"), 3000);
        }
    }
};

// Faz o lembrete rodar silenciosamente quando o sistema abre
document.addEventListener('DOMContentLoaded', () => {
    // Dá um tempinho (3 seg) para não embolar com a mensagem de "Login Aprovado"
    setTimeout(() => {
        if (typeof window.verificarLembreteBackup === 'function') {
            window.verificarLembreteBackup();
        }
    }, 3000);
});

// 1. Alterna a exibição da gaveta de datas
window.togglePeriodo = function(contexto) {
    const container = document.getElementById(`container-periodo-${contexto}`);
    if (container) {
        container.classList.toggle('hidden');
        if (!container.classList.contains('hidden')) {
            window.mudarFiltro(99, contexto); // Marca o botão "Período" como ativo
        }
    }
};

// 2. Gerencia o clique e o visual
window.mudarFiltro = function(valor, contexto) {
    const opcoes = [0, 7, 30, 99];

    // Troca o visual dos botões do contexto atual
    opcoes.forEach(id => {
        const btn = document.getElementById(`btn-${contexto}-${id}`);
        if (btn) btn.className = (id === valor) ? window.CSS_FILTRO_ATIVO : window.CSS_FILTRO_INATIVO;
    });

    // Se clicar em algo fixo (0, 7, 30), esconde a gaveta se não for o 99
    if (valor !== 99) {
        const container = document.getElementById(`container-periodo-${contexto}`);
        if (container) container.classList.add('hidden');
    }

    // DISPARADOR DE DADOS: Aqui o sistema decide qual tela atualizar
    executarBuscaRelatorio(valor, contexto);
};

// 3. O "Roteador" de busca (Centraliza as chamadas ao Supabase)
function executarBuscaRelatorio(valor, contexto) {
    let dataInicio, dataFim;

    // 1. Se for o período personalizado (Lupa), pega os valores dos inputs
    if (valor === 'custom') {
        dataInicio = document.getElementById(`data-inicio-${contexto}`).value;
        dataFim = document.getElementById(`data-fim-${contexto}`).value;
        if (!dataInicio || !dataFim) {
            if (typeof showToast === 'function') showToast("SELECIONE AS DATAS", "aviso");
            return;
        }
    }

    // 2. MAPEAMENTO CORRIGIDO (Dicionário de Ações)
    const acoes = {
        // Agora apontando para os nomes reais das suas funções:
        'dash':       () => typeof gerarDashboard === 'function' && gerarDashboard(valor, dataInicio, dataFim),
        'financeiro': () => typeof gerarRelatorioFinanceiro === 'function' && gerarRelatorioFinanceiro(valor, dataInicio, dataFim),
        'produtos':   () => typeof gerarRelatorioProdutos === 'function' && gerarRelatorioProdutos(valor, dataInicio, dataFim),
        'comandas':   () => typeof gerarRelatorioComandas === 'function' && gerarRelatorioComandas(valor, dataInicio, dataFim),
        'estoque':    () => typeof gerarRelatorioEstoque === 'function' && gerarRelatorioEstoque(valor, dataInicio, dataFim)
    };

    // 3. Executa a função do contexto atual
    if (acoes[contexto]) {
        acoes[contexto]();
    } else {
        console.warn(`⚠️ O contexto [${contexto}] não possui uma função de busca mapeada.`);
    }
}

// =====================================================================
// MÓDULO DE ESTORNO: CONFIGURAÇÕES E VARIÁVEIS GLOBAIS
// =====================================================================

// Guarda os dados da venda que será estornada temporariamente
let comandaParaEstornar = { id: null, total: null, tabela: 'comandas' };

/**
 * Abre a tela de estorno ocultando o painel principal
 */
window.abrirTelaEstorno = function() {
    const painel = document.getElementById('admin-menu-principal');
    const telaEstorno = document.getElementById('view-vendas-estorno');

    if (painel && telaEstorno) {
        painel.classList.add('hidden');
        telaEstorno.classList.remove('hidden');
        
        // Carrega as vendas de hoje (0 dias atrás) ao abrir
        if (typeof carregarVendasEstorno === 'function') {
            carregarVendasEstorno(0); 
        }
    } else {
        console.error("IDs não encontrados. Verifique 'admin-menu-principal' e 'view-vendas-estorno'.");
    }
};

/**
 * Volta para o menu de ícones
 */
window.voltarAoPainel = function() {
    const painel = document.getElementById('admin-menu-principal');
    const telaEstorno = document.getElementById('view-vendas-estorno');

    if (painel && telaEstorno) {
        telaEstorno.classList.add('hidden');
        painel.classList.remove('hidden');
    }
};

// =====================================================================
// BUSCA E RENDERIZAÇÃO DE DADOS
// =====================================================================

window.carregarVendasEstorno = async function(valor = 0, iniManual = null, fimManual = null) {
    const container = document.getElementById('container-vendas-estorno');
    if (!container) return;

    container.innerHTML = '<div class="col-span-full text-center py-20 animate-pulse text-[10px] font-black text-slate-300 uppercase tracking-widest">Buscando comandas e balcão...</div>';

    try {
        let inicioStr, fimStr;

        // Define o período de busca
        if (valor === 'custom') {
            const dataI = iniManual || document.getElementById('data-inicio-vEstorno')?.value;
            const dataF = fimManual || document.getElementById('data-fim-vEstorno')?.value;
            if (!dataI || !dataF) return;
            inicioStr = `${dataI}T00:00:00`;
            fimStr = `${dataF}T23:59:59`;
        } else {
            const hoje = new Date();
            const dInicio = new Date();
            dInicio.setDate(hoje.getDate() - parseInt(valor));
            inicioStr = `${dInicio.toISOString().split('T')[0]}T00:00:00`;
            fimStr = `${hoje.toISOString().split('T')[0]}T23:59:59`;
        }

        // Busca simultânea nas duas tabelas
        const reqComandas = _supabase.from('comandas').select('*').eq('status', 'fechada').gte('fechada_em', inicioStr).lte('fechada_em', fimStr);
        // IMPORTANTE: Aqui ele traz tudo, incluindo as canceladas, para podermos ver no histórico
        const reqVendas = _supabase.from('historico_vendas').select('*').is('comanda_id', null).gte('criado_em', inicioStr).lte('criado_em', fimStr);

        const [resComandas, resVendas] = await Promise.all([reqComandas, reqVendas]);
        if (resComandas.error) throw resComandas.error;
        if (resVendas.error) throw resVendas.error;

        let listaMista = [];

        // Padroniza os dados das Comandas
        if (resComandas.data) {
            resComandas.data.forEach(c => {
                listaMista.push({
                    id: c.id,
                    identificacao: c.identificacao || 'COMANDA',
                    total: c.total,
                    forma_pagamento: c.forma_pagamento,
                    dataFinalizacao: c.fechada_em,
                    tabelaOrigem: 'comandas',
                    icone: '📋',
                    status: c.status, // Guardando o status
                    estornado_em: c.estornado_em
                });
            });
        }

        // Padroniza os dados do Balcão
        if (resVendas.data) {
            resVendas.data.forEach(v => {
                listaMista.push({
                    id: v.id,
                    identificacao: v.comanda_origem || 'VENDA BALCÃO',
                    total: v.total,
                    forma_pagamento: v.forma_pagamento,
                    dataFinalizacao: v.criado_em,
                    tabelaOrigem: 'historico_vendas',
                    icone: '🛒',
                    status: v.status, // Guardando o status
                    estornado_em: v.estornado_em
                });
            });
        }

        // Ordenação cronológica
        listaMista.sort((a, b) => new Date(b.dataFinalizacao) - new Date(a.dataFinalizacao));

        if (listaMista.length === 0) {
            container.innerHTML = '<div class="col-span-full text-center py-20 text-[10px] font-black text-slate-400 uppercase italic">Nenhuma venda encontrada.</div>';
            return;
        }

        container.innerHTML = listaMista.map(v => {
            const dataF = new Date(v.dataFinalizacao);
            const valorFormatado = `R$ ${parseFloat(v.total).toFixed(2).replace('.', ',')}`;
            
            // LÓGICA DO CANCELAMENTO AQUI
            const isCancelada = v.status === 'cancelada';
            
            // Ajusta o fundo e a borda se for cancelada
            const estiloCard = isCancelada 
                ? 'bg-red-50/50 dark:bg-red-900/10 border-red-200 dark:border-red-900/50 opacity-80 grayscale-[30%]' 
                : 'bg-white dark:bg-slate-900 border-slate-100 dark:border-slate-800 hover:border-slate-200 dark:hover:border-slate-700';

            // Etiqueta extra caso seja cancelada
            const badgeCancelada = isCancelada
                ? `<span class="px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest shadow-sm bg-red-600 text-white ml-2">ESTORNADA</span>`
                : '';

            // Se for cancelada, troca o botão por um aviso
            const botaoEstornoHtml = isCancelada
                ? `<div class="flex-1 bg-red-100/50 dark:bg-red-900/30 text-red-500 px-5 py-3 rounded-2xl text-[10px] font-black uppercase flex items-center justify-center border border-red-200 dark:border-red-800">Já Cancelada ❌</div>`
                : `<button onclick="solicitarEstorno('${v.id}', '${v.total}', '${v.tabelaOrigem}')" 
                        class="bg-red-600 text-white px-5 py-3 rounded-2xl text-[10px] font-black uppercase shadow-lg shadow-red-500/20 active:scale-95 transition-all hover:bg-red-700">
                        Estornar ↩️
                   </button>`;

            return `
            <div class="${estiloCard} p-5 rounded-[2.2rem] border shadow-sm flex flex-col justify-between gap-4 transition-all">
                
                <div class="flex justify-between items-start">
                    <div class="flex items-center gap-3">
                        <div class="bg-slate-50 dark:bg-slate-800 w-12 h-12 rounded-2xl flex items-center justify-center text-xl shadow-sm border border-slate-100 dark:border-slate-700">
                            ${v.icone}
                        </div>
                        <div>
                            <h4 class="font-black text-sm ${isCancelada ? 'text-red-700 dark:text-red-400' : 'text-slate-800 dark:text-slate-100'} uppercase">${v.identificacao}</h4>
                            <p class="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest mt-0.5">
                                ${dataF.toLocaleTimeString('pt-BR', {hour:'2-digit', minute:'2-digit'})} • ${dataF.toLocaleDateString('pt-BR')}
                            </p>
                        </div>
                    </div>
                    <div class="flex items-center">
                        <span class="px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest shadow-sm ${obterEstiloPilaPagamento(v.forma_pagamento)}">
                            ${v.forma_pagamento || 'DINHEIRO'}
                        </span>
                        ${badgeCancelada}
                    </div>
                </div>

                <div class="flex items-center justify-between mt-2 pt-4 border-t border-slate-50 dark:border-slate-800/50">
                    <div>
                        <span class="block text-[8px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Valor Total</span>
                        <span class="${isCancelada ? 'line-through text-slate-400' : 'text-xl text-slate-800 dark:text-white'} font-black">${valorFormatado}</span>
                    </div>
                    
                    <div class="flex gap-2">
                        <button onclick="visualizarDetalhesVenda('${v.id}', '${v.tabelaOrigem}')" 
                            class="bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 px-4 py-3 rounded-2xl text-[10px] font-black uppercase shadow-sm active:scale-95 transition-all hover:bg-slate-200 dark:hover:bg-slate-700">
                            Ver 👁️
                        </button>
                        
                        ${botaoEstornoHtml}
                    </div>
                </div>
            </div>`;
        }).join('');

    } catch (e) {
        console.error('Erro ao carregar estornos:', e);
    }
};

// =====================================================================
// AUTORIZAÇÃO E PROCESSAMENTO DO ESTORNO
// =====================================================================

window.comandaParaEstornar = null; // Declara a variável globalmente

window.solicitarEstorno = function(id, total, tabelaOrigem) {
    const tabelaCerta = tabelaOrigem ? tabelaOrigem : 'historico_vendas';
    const modal = document.getElementById('modal-estorno');

    // 1. BLINDAGEM MÁXIMA: Salva o ID e a Tabela fisicamente no HTML do modal
    if (modal) {
        modal.setAttribute('data-estorno-id', id);
        modal.setAttribute('data-estorno-tabela', tabelaCerta);
    }
    
    document.getElementById('input-user-estorno').value = '';
    document.getElementById('input-pass-estorno').value = '';
    
    const labelValor = document.getElementById('label-valor-estorno');
    if (labelValor) {
        labelValor.innerText = `VALOR DO ESTORNO: R$ ${parseFloat(total).toFixed(2).replace('.', ',')}`;
    }
    
    if (modal) modal.classList.remove('hidden');
    
    // Pequeno delay para garantir que o modal abriu antes de focar
    setTimeout(() => {
        const inputUser = document.getElementById('input-user-estorno');
        if (inputUser) inputUser.focus();
    }, 100);
};

window.fecharModalEstorno = function() {
    document.getElementById('modal-estorno').classList.add('hidden');
};

window.processarEstornoComSenha = async function() {
    const modal = document.getElementById('modal-estorno');
    
    // 1. O PULO DO GATO: Resgatar o ID e a tabela que o solicitarEstorno guardou
    const idVenda = modal.getAttribute('data-estorno-id');
    const tabela = modal.getAttribute('data-estorno-tabela') || 'historico_vendas';
    
    // Resgatar o que foi digitado
    const usuarioDigitado = document.getElementById('input-user-estorno').value.trim();
    const senhaDigitada = document.getElementById('input-pass-estorno').value.trim();

    // 2. Validações antes de ir para o banco
    if (!idVenda) {
        if (typeof showToast === 'function') showToast('Erro interno: ID da venda não encontrado.', 'erro');
        return;
    }

    if (!usuarioDigitado || !senhaDigitada) {
        if (typeof showToast === 'function') showToast('Preencha usuário e senha para autorizar!', 'erro');
        return;
    }

    // --- LÓGICA DE SENHA AQUI ---
    // Se precisar validar a senha com o banco ou com uma senha fixa, faça aqui.
    // Exemplo: if (senhaDigitada !== '1234') { showToast('Senha incorreta', 'erro'); return; }

    try {
        // Efeito visual no botão (opcional, para evitar cliques duplos)
        const btnConfirmar = document.querySelector('button[onclick="processarEstornoComSenha()"]');
        if (btnConfirmar) {
            btnConfirmar.innerHTML = '<i class="ph-bold ph-spinner animate-spin"></i> PROCESSANDO...';
            btnConfirmar.disabled = true;
        }

        console.log("Iniciando cancelamento no Supabase do ID:", idVenda, "na tabela:", tabela);

        // 3. O UPDATE NO SUPABASE
        const { error } = await _supabase
            .from(tabela)
            .update({ 
                status: 'cancelada',
                estornado_em: new Date().toISOString()
            })
            .eq('id', parseInt(idVenda));

        if (error) throw error;

        // 4. Sucesso!
        if (typeof showToast === 'function') showToast('Venda cancelada com sucesso!', 'sucesso');
        
        // Log de auditoria (se você estiver usando aquela sua função registrarLog)
        if (typeof registrarLog === 'function') {
            await registrarLog('SEGURANÇA', 'ESTORNO', `Venda #${idVenda} cancelada por ${usuarioDigitado}`);
        }

        // Fechar modal e limpar inputs
        document.getElementById('input-user-estorno').value = '';
        document.getElementById('input-pass-estorno').value = '';
        if (typeof fecharModalEstorno === 'function') {
            fecharModalEstorno();
        } else {
            modal.classList.add('hidden');
        }
        
        // Atualizar a tabela na tela
        if (typeof carregarHistoricoVendas === 'function') carregarHistoricoVendas();

    } catch (e) {
        console.error('❌ Erro no estorno:', e);
        if (typeof showToast === 'function') showToast('Erro no banco: ' + e.message, 'erro');
    } finally {
        // Restaurar o botão ao normal
        const btnConfirmar = document.querySelector('button[onclick="processarEstornoComSenha()"]');
        if (btnConfirmar) {
            btnConfirmar.innerHTML = 'CONFIRMAR';
            btnConfirmar.disabled = false;
        }
    }
};

// =====================================================================
// CONTROLES DE FILTRO
// =====================================================================

window.mudarFiltroEstorno = function(valor) {
    const botoes = [0, 7, 99];
    botoes.forEach(b => {
        const btn = document.getElementById(`btn-vEstorno-${b}`);
        if (btn) {
            btn.className = "flex-1 py-3 text-[9px] font-black uppercase rounded-lg transition-all text-slate-500 dark:text-slate-400 hover:bg-white/50 dark:hover:bg-slate-700/50";
        }
    });

    const idAtivo = (valor === 'custom') ? 99 : valor;
    const btnAtivo = document.getElementById(`btn-vEstorno-${idAtivo}`);
    if (btnAtivo) {
        btnAtivo.className = "flex-1 py-3 text-[9px] font-black uppercase rounded-lg transition-all shadow-sm bg-white dark:bg-slate-700 text-slate-800 dark:text-white";
    }

    if (valor === 'custom') {
        const ini = document.getElementById('data-inicio-vEstorno').value;
        const fim = document.getElementById('data-fim-vEstorno').value;
        if (!ini || !fim) return;
        carregarVendasEstorno('custom', ini, fim);
    } else {
        document.getElementById('container-periodo-vEstorno').classList.add('hidden');
        carregarVendasEstorno(valor);
    }
};

window.togglePeriodoEstorno = function() {
    const container = document.getElementById('container-periodo-vEstorno');
    container.classList.toggle('hidden');
};

window.visualizarDetalhesVenda = async function(id, tabelaOrigem) {
    if (typeof showToast === 'function') showToast("Buscando cupom...", "aviso");
    
    try {
        // 1. Usa select('*') para não dar erro caso falte alguma coluna no banco
        const { data, error } = await _supabase
            .from(tabelaOrigem)
            .select('*')
            .eq('id', id)
            .single();

        if (error) {
            console.error("[SUPABASE ERRO]:", error);
            throw error;
        }

        // 2. Normaliza o identificador (Cobre os nomes antigos e novos do banco)
        const identificador = data.identificacao || (data.comanda_id ? `MESA ${data.comanda_id}` : (data.comanda_origem ? `MESA ${data.comanda_origem}` : 'BALCÃO'));
        document.getElementById('recibo-titulo').innerText = `2ª VIA - ${identificador}`;

        // 3. Preenche a Data (Cobre criado_em, created_at ou fechada_em)
        const dataVenda = new Date(data.fechada_em || data.criado_em || data.created_at || new Date());
        const dataStr = dataVenda.toLocaleDateString('pt-BR');
        const horaStr = dataVenda.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
        document.getElementById('recibo-data').innerText = `DATA: ${dataStr}, ${horaStr}`;

        // 4. Normaliza os Itens para exibir na tela
        let htmlItens = '';
        let itensArray = [];
        
        if (typeof data.itens === 'string') {
            try { itensArray = JSON.parse(data.itens); } catch (e) { itensArray = []; }
        } else if (Array.isArray(data.itens)) {
            itensArray = data.itens;
        }

        if (itensArray && itensArray.length > 0) {
            htmlItens = itensArray.map(item => {
                const qtd = item.quantidade || item.qtd || 1;
                const nome = item.nome || item.produto || 'ITEM';
                const preco = parseFloat(item.preco || item.valor || 0);
                const totalItem = preco * qtd;
                
                return `
                <div class="flex justify-between items-start gap-2">
                    <span class="flex-1 leading-tight text-left">${qtd}X ${nome.toUpperCase()}</span>
                    <span class="whitespace-nowrap font-bold">R$ ${totalItem.toFixed(2).replace('.', ',')}</span>
                </div>`;
            }).join('');
        } else {
            htmlItens = '<div class="text-center opacity-50 py-2">Sem detalhes de itens salvos.</div>';
        }
        
        document.getElementById('recibo-itens').innerHTML = htmlItens;

        // 5. Preenche Total e Pagamento na Tela
        document.getElementById('recibo-total').innerText = `R$ ${parseFloat(data.total).toFixed(2).replace('.', ',')}`;
        document.getElementById('recibo-pagamento').innerText = (data.forma_pagamento || 'DINHEIRO').toUpperCase();

        // 6. Guarda os dados padronizados para a nossa Impressora!
        window.dadosReimpressaoAtual = {
            tipo: `2ª VIA - ${identificador}`,
            total: data.total,
            pagamento: data.forma_pagamento || 'DINHEIRO',
            recebido: data.valor_recebido || data.recebido || 0,
            troco: data.troco || 0,
            itens: itensArray,
            data: dataVenda 
        };

        // 7. Abre o modal
        document.getElementById('modal-preview-recibo').classList.remove('hidden');

    } catch (e) {
        console.error("Erro ao buscar detalhes:", e);
        if (typeof showToast === 'function') showToast("Erro ao gerar visualização", "erro");
    }
};

// 8. Função que você vai chamar no botão "Imprimir" dentro do modal de preview
window.dispararReimpressao = function() {
    if (window.dadosReimpressaoAtual) {
        // Dispara o nosso cupom perfeito de 48mm passando os dados retroativos
        window.imprimirTicketVenda(window.dadosReimpressaoAtual);
    } else {
        if (typeof showToast === 'function') showToast("Dados para impressão não encontrados.", "erro");
    }
};

// Mantém a função de fechar logo abaixo
window.fecharPreviewRecibo = function() {
    document.getElementById('modal-preview-recibo').classList.add('hidden');
};
