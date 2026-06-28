/* =================================================================================
   MÓDULO: GERENCIAMENTO DE USUÁRIOS E SEGURANÇA (COMPLETO)
   ================================================================================= */

window.toggleVerSenha = function(idInput) {
    const input = document.getElementById(idInput);
    if (!input) return;

    const sufixo = idInput.includes('novo') ? 'novo' : 'edit';
    const icon   = document.getElementById(`icon-pass-${sufixo}`);

    if (input.type === 'password') {
        input.type = 'text';
        if (icon) { icon.innerText = '🔓'; icon.classList.add('text-emerald-500'); }
    } else {
        input.type = 'password';
        if (icon) { icon.innerText = '👁️'; icon.classList.remove('text-emerald-500'); }
    }
}

window.carregarListaUsuarios = async function() {
    if (typeof isDatabaseReady === 'function' && !isDatabaseReady()) return;

    const termo      = document.getElementById('filtro-pesquisa-usuarios')?.value || '';
    const termoLimpo = typeof removerAcentos === 'function' ? removerAcentos(termo).toLowerCase() : termo.toLowerCase();
    const container  = document.getElementById('lista-usuarios-sistema');
    if (!container) return;

    try {
        const { data: users, error } = await _supabase.from('usuarios').select('*').order('nome');
        if (error) throw error;

        const filtrados = users.filter(u => {
            const nomeAlvo  = (typeof removerAcentos === 'function' ? removerAcentos(u.nome || '') : (u.nome || '')).toLowerCase();
            const loginAlvo = (typeof removerAcentos === 'function' ? removerAcentos(u.usuario || '') : (u.usuario || '')).toLowerCase();
            return nomeAlvo.includes(termoLimpo) || loginAlvo.includes(termoLimpo);
        });

        if (filtrados.length === 0) {
            container.innerHTML = '<p class="text-center text-[10px] text-slate-400 py-10 font-black uppercase italic">Nenhum usuário encontrado.</p>';
            return;
        }

        container.innerHTML = filtrados.map(u => {
            const isAdmin   = u.cargo === 'ADMIN' || u.usuario.toLowerCase() === 'admin';
            const statusCor = u.ativo !== false ? 'bg-emerald-500' : 'bg-slate-300';
            const iconCargo = isAdmin ? '🛡️' : '👨‍🍳';
            const iconNotif = u.recebe_notificacoes ? '<span title="Recebe Alertas" class="text-[10px]">🔔</span>' : '<span title="Notificações Desativadas" class="text-[10px] opacity-40 grayscale">🔕</span>';

            return `
            <div class="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-100 dark:border-slate-800 mb-2 shadow-sm flex items-center justify-between transition-colors ${u.ativo === false ? 'opacity-60' : ''}">
                <div class="flex items-center gap-3">
                    <div class="w-10 h-10 rounded-full ${statusCor} flex items-center justify-center text-white font-black text-xs shadow-inner relative">
                        ${u.nome ? u.nome.charAt(0).toUpperCase() : 'U'}
                        <span class="absolute -bottom-1 -right-1 text-[10px] bg-white dark:bg-slate-800 rounded-full p-[2px]">${iconCargo}</span>
                    </div>
                    <div>
                        <h4 class="text-[11px] font-black text-slate-700 dark:text-slate-200 uppercase italic leading-tight flex items-center gap-1">
                            ${u.nome || u.usuario} ${iconNotif}
                        </h4>
                        <span class="text-[9px] font-bold text-slate-400 dark:text-slate-500 italic">@${u.usuario} • ${isAdmin ? 'Administrador' : 'Operador'}</span>
                    </div>
                </div>
                <div class="flex gap-2">
                    ${u.usuario.toLowerCase() !== 'admin' ? `
                        <button onclick="prepararEdicaoUsuario('${u.id}')" class="bg-slate-50 dark:bg-slate-800 w-9 h-9 rounded-xl flex items-center justify-center border border-slate-200 dark:border-slate-700 hover:bg-slate-100 active:scale-90 transition-all" title="Editar">✏️</button>
                        <button onclick="executarToggleUsuario('${u.id}', '${u.nome}', '${u.usuario}')" class="bg-slate-50 dark:bg-slate-800 w-9 h-9 rounded-xl flex items-center justify-center border border-slate-200 dark:border-slate-700 hover:bg-slate-100 active:scale-90 transition-all" title="${u.ativo !== false ? 'Inativar' : 'Ativar'}">
                            ${u.ativo !== false ? '🟢' : '⚪'}
                        </button>
                    ` : `
                        <span class="text-[8px] font-black text-slate-300 dark:text-slate-600 uppercase p-2 tracking-tighter">PROTEGIDO</span>
                    `}
                </div>
            </div>`;
        }).join('');

    } catch (e) {
        console.error('❌ [USER] Falha ao listar usuários:', e);
        container.innerHTML = '<p class="text-center text-[10px] text-red-400 py-10 font-black uppercase italic">Erro ao carregar usuários.</p>';
    }
}

window.salvarNovoUsuario = async function() {
    const nomeInput    = document.getElementById('novo-user-completo');
    const usuarioInput = document.getElementById('novo-user-nome');
    const senhaInput   = document.getElementById('novo-user-pass');

    const nome    = nomeInput?.value.trim().toUpperCase();
    const usuario = usuarioInput?.value.trim().toLowerCase();
    const senha   = senhaInput?.value;

    if (!nome || !usuario || !senha) return showToast('PREENCHA TODOS OS CAMPOS', 'erro');

    if (typeof setLoading === 'function') setLoading('btn-cadastrar-user', true);

    try {
        const { data: existente } = await _supabase.from('usuarios').select('id').eq('usuario', usuario).maybeSingle();
        if (existente) {
            if (typeof setLoading === 'function') setLoading('btn-cadastrar-user', false, 'CADASTRAR');
            return showToast('ESTE LOGIN JÁ EXISTE!', 'erro');
        }

        // CORREÇÕES APLICADAS:
        // 1. Removido o btoa() para manter o padrão de senha de texto da edição
        // 2. Trocado "cargo" por "nivel" para bater com a sua tabela do banco
        const { error } = await _supabase.from('usuarios').insert([{ 
            nome, 
            usuario, 
            senha: senha, 
            nivel: 'OPERADOR', 
            ativo: true,
            recebe_notificacoes: false 
        }]);
        
        if (error) throw error;

        if (typeof registrarLog === 'function') {
            await registrarLog('SEGURANÇA', 'CADASTRO DE COLABORADOR', `NOME: ${nome} | LOGIN: ${usuario.toUpperCase()}`);
        }

        showToast('USUÁRIO CRIADO!', 'sucesso');
        if (nomeInput) nomeInput.value = ''; 
        if (usuarioInput) usuarioInput.value = ''; 
        if (senhaInput) senhaInput.value = '';
        carregarListaUsuarios();

    } catch (e) {
        console.error('❌ [USER] Erro ao salvar:', e);
        showToast('ERRO AO SALVAR USUÁRIO', 'erro');
    } finally {
        if (typeof setLoading === 'function') setLoading('btn-cadastrar-user', false, 'CADASTRAR');
    }
}

window.prepararEdicaoUsuario = async function(id) {
    if (typeof isDatabaseReady === 'function' && !isDatabaseReady()) return;
    try {
        const { data: user, error } = await _supabase.from('usuarios').select('*').eq('id', id).single();
        if (error || !user) throw new Error('Usuário não encontrado.');

        document.getElementById('edit-user-id').value = user.id;
        document.getElementById('edit-user-completo').value = user.nome || '';
        document.getElementById('edit-user-nome').value = user.usuario || '';
        document.getElementById('edit-user-pass').value = '';
        
        const checkNotifica = document.getElementById('edit-user-notifica');
        if (checkNotifica) checkNotifica.checked = user.recebe_notificacoes !== false;

        const modal = document.getElementById('modal-editar-usuario');
        if (modal) { modal.classList.remove('hidden'); modal.classList.add('flex'); }
    } catch (e) {
        showToast('ERRO AO BUSCAR DADOS', 'erro');
    }
};

window.salvarEdicaoUsuario = async function() {
    const id       = document.getElementById('edit-user-id')?.value;
    const nome     = document.getElementById('edit-user-completo')?.value.trim().toUpperCase();
    const login    = document.getElementById('edit-user-nome')?.value.trim().toLowerCase();
    const novaSenha = document.getElementById('edit-user-pass')?.value;
    const recebeNotificacoes = document.getElementById('edit-user-notifica')?.checked ?? false;

    if (!nome || !login) return showToast('NOME E LOGIN OBRIGATÓRIOS', 'erro');

    try {
        const dadosAtualizados = { nome, usuario: login, recebe_notificacoes: recebeNotificacoes };
        
        // CORREÇÃO MANTIDA: Senha sendo salva como texto comum
        if (novaSenha && novaSenha.trim() !== '') {
            dadosAtualizados.senha = novaSenha; 
        }

        const { error } = await _supabase.from('usuarios').update(dadosAtualizados).eq('id', id);
        if (error) throw error;

        if (typeof registrarLog === 'function') {
            await registrarLog('SEGURANÇA', 'EDIÇÃO DE USUÁRIO', `LOGIN: ${login.toUpperCase()} (ID: ${id})`);
        }

        showToast('DADOS ATUALIZADOS!', 'sucesso');
        fecharModalEdicaoUsuario();
        carregarListaUsuarios();
    } catch (e) {
        showToast('ERRO AO ATUALIZAR', 'erro');
    }
}

// =================================================================================
// CORREÇÃO CRÍTICA: PONTE PARA A SENHA MESTRE
// =================================================================================
window.executarToggleUsuario = function(id, nome, login) {
    // 1. Prepara a "Ação Pendente" na memória (Gaveta)
    window.acaoAdminPendente = {
        acao: `ALTERAR STATUS USUÁRIO: ${login.toUpperCase()}`,
        callback: async () => {
            // Só executa o toggle se a senha mestre for confirmada
            await window._processarToggleUsuario(id);
        }
    };

    // 2. Abre o modal de senha mestre que você tem no sistema
    const modalAuth = document.getElementById('modal-auth-admin');
    if (modalAuth) {
        modalAuth.classList.remove('hidden');
        modalAuth.classList.add('flex');
        setTimeout(() => {
            const inputSenha = document.getElementById('input-auth-senha');
            if (inputSenha) { inputSenha.value = ''; inputSenha.focus(); }
        }, 100);
    } else {
        // Fallback: se o modal não existir por algum motivo, processa direto
        window._processarToggleUsuario(id);
    }
};

window._processarToggleUsuario = async function(id) {
    try {
        const { data: user, error: errFetch } = await _supabase.from('usuarios').select('ativo, nome, usuario').eq('id', id).single();
        if (errFetch || !user) return;
        if (user.usuario.toLowerCase() === 'admin') return showToast('ADMIN PROTEGIDO', 'erro');

        const novoStatus = !user.ativo;
        const { error } = await _supabase.from('usuarios').update({ ativo: novoStatus }).eq('id', id);
        if (error) throw error;

        // --- REGISTRO DE AUDITORIA (DETALHAMENTO PRECISO E CORRIGIDO) ---
        if (typeof registrarLog === 'function') {
            const acaoCurta = novoStatus ? 'ATIVOU USUÁRIO' : 'INATIVOU USUÁRIO';
            const statusAtualTxt = user.ativo ? 'ATIVO' : 'INATIVO';
            const novoStatusTxt = novoStatus ? 'ATIVO' : 'INATIVO';
            
            const detalheCompleto = `COLABORADOR: ${user.nome.toUpperCase()} | LOGIN: ${user.usuario.toUpperCase()} | STATUS ANTERIOR: ${statusAtualTxt} | NOVO STATUS: ${novoStatusTxt}`;

            await registrarLog('SEGURANÇA', acaoCurta, detalheCompleto);
        }

        showToast(`USUÁRIO ${novoStatus ? 'ATIVADO' : 'INATIVADO'}`, 'sucesso');
        carregarListaUsuarios();
    } catch (e) {
        showToast('ERRO AO MUDAR STATUS', 'erro');
    }
};

window.fecharModalEdicaoUsuario = function() {
    const modal = document.getElementById('modal-editar-usuario');
    if (modal) { modal.classList.add('hidden'); modal.classList.remove('flex'); }
}

/* =================================================================================
   MÓDULO DE USUÁRIO, PERFIL GLOBAL E TEMA (user.js)
   ================================================================================= */

// 1. Função que busca e calcula as estatísticas do turno
window.carregarEstatisticasPerfil = async function() {
    const nomeUsuario = localStorage.getItem('userName') || 'Operador';
    const idCaixa = localStorage.getItem('idCaixaAtual');
    const horaAbertura = localStorage.getItem('horaAberturaCaixa');

    // ELEMENTOS
    const elCaixa = document.getElementById('perfil-status-caixa');
    const elTempo = document.getElementById('perfil-tempo-turno');
    const elVendas = document.getElementById('perfil-vendas-hoje');

    // A. LÓGICA DO CAIXA E TEMPO
    if (idCaixa) {
        if (elCaixa) {
            elCaixa.innerText = `ABERTO (#${idCaixa})`;
            elCaixa.className = "text-[11px] font-black text-emerald-500 uppercase";
        }
        
        // Calcula o tempo desde a abertura
        if (horaAbertura && elTempo) {
            const inicio = new Date(horaAbertura);
            const agora = new Date();
            const diffMs = agora - inicio;
            const diffHrs = Math.floor(diffMs / 3600000);
            const diffMins = Math.floor((diffMs % 3600000) / 60000);
            elTempo.innerText = `${diffHrs}h ${diffMins}m`;
            elTempo.className = "text-[11px] font-black text-slate-700 dark:text-slate-200 uppercase";
        } else if (elTempo) {
            elTempo.innerText = "Calculando...";
        }
    } else {
        if (elCaixa) {
            elCaixa.innerText = "FECHADO";
            elCaixa.className = "text-[11px] font-black text-red-500 uppercase";
        }
        if (elTempo) {
            elTempo.innerText = "--:--";
            elTempo.className = "text-[11px] font-black text-slate-400 uppercase";
        }
    }

    // B. LÓGICA DE VENDAS DO OPERADOR (Supabase)
    try {
        if (typeof _supabase !== 'undefined' && elVendas) {
            const agora = new Date();
            const inicioDia = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate(), 0, 0, 0).toISOString();
            const fimDia = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate(), 23, 59, 59).toISOString();

            const { data: vendas, error } = await _supabase
                .from('historico_vendas')
                .select('total')
                .eq('vendedor', nomeUsuario) // Filtra só as vendas desse atendente
                .gte('created_at', inicioDia)
                .lte('created_at', fimDia);

            if (!error && vendas) {
                const totalVendido = vendas.reduce((acc, v) => acc + (parseFloat(v.total) || 0), 0);
                elVendas.innerText = `R$ ${window.fmSeguro ? window.fmSeguro(totalVendido) : totalVendido.toFixed(2)}`;
            }
        }
    } catch (e) {
        console.error("Erro ao carregar vendas do operador:", e);
    }
};

// 2. Atualiza o Modal ao abrir
window.toggleModalPerfilGlobal = function() {
    const modal = document.getElementById('modal-perfil-global');
    if (!modal) return;
    
    if (modal.classList.contains('hidden')) {
        // Puxa o nome
        const nomeUsuario = localStorage.getItem('userName') || 'Operador';
        const elNome = document.getElementById('modal-perfil-nome');
        if (elNome) elNome.innerText = nomeUsuario;
        
        // Dispara a busca de estatísticas e ajusta o botão de tema
        window.carregarEstatisticasPerfil();
        window.sincronizarBotaoTema();
        
        modal.classList.remove('hidden');
    } else {
        modal.classList.add('hidden');
    }
};

// 3. Função que faz a troca do tema (CORRIGIDA E BLINDADA)
window.toggleTemaGlobal = function() {
    const htmlElement = document.documentElement;
    const labelTema = document.getElementById('label-modo-tema');
    const checkboxTema = document.getElementById('toggle-tema-global');
    
    // O comando 'toggle' inverte a cor da tela automaticamente.
    // Ele retorna 'true' se a tela ficou escura, e 'false' se ficou clara.
    const isDarkNow = htmlElement.classList.toggle('dark');
    
    if (isDarkNow) {
        // A TELA FICOU ESCURA
        localStorage.setItem('temaSistema', 'dark');
        if (labelTema) labelTema.innerText = 'MODO ESCURO';
        if (checkboxTema) checkboxTema.checked = true; // Força o botão ir pra direita
    } else {
        // A TELA FICOU CLARA
        localStorage.setItem('temaSistema', 'light');
        if (labelTema) labelTema.innerText = 'MODO CLARO';
        if (checkboxTema) checkboxTema.checked = false; // Força o botão ir pra esquerda
    }
};

// 4. Garante que, ao carregar a página, o texto e o botão fiquem certos
window.sincronizarBotaoTema = function() {
    const isDark = document.documentElement.classList.contains('dark') || localStorage.getItem('temaSistema') === 'dark';
    const labelTema = document.getElementById('label-modo-tema');
    const checkboxTema = document.getElementById('toggle-tema-global');
    
    // Força o botão e o texto a ficarem iguais ao tema atual da tela
    if (checkboxTema) checkboxTema.checked = isDark;
    if (labelTema) labelTema.innerText = isDark ? 'MODO ESCURO' : 'MODO CLARO';
};

// 5. Inicialização Unificada (Roda automaticamente em TODAS as páginas)
document.addEventListener('DOMContentLoaded', () => {
    // Sincroniza visual do botão Dark Mode
    window.sincronizarBotaoTema();

    // Preenche o nome no Header
    const nomeUsuario = localStorage.getItem('userName') || 'Operador';
    const elHeader = document.getElementById('header-usuario');
    if (elHeader) elHeader.innerText = nomeUsuario;
});