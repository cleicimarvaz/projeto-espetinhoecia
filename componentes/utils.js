/* =================================================================================
   MÓDULO: UTILITÁRIOS E FORMATAÇÃO (ARQUIVO INTEGRAL E BLINDADO)
   ================================================================================= */

/**
 * Formata número para string de moeda (Ex: 10.5 -> "10,50")
 */
window.formatarMoeda = function(valor) {
    return parseFloat(valor).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

/**
 * Converte string de moeda para float (Ex: "1.250,50" -> 1250.50)
 */
window.convMoedaFloat = function(valor) {
    if (!valor) return 0;
    if (typeof valor === 'number') return valor;
    let limpo = valor.replace("R$", "").replace(/\./g, "").replace(",", ".").trim();
    return parseFloat(limpo) || 0;
};

/**
 * Máscara para campos de input de moeda
 */
window.mascaraMoeda = function(elemento) {
    const input = elemento.target ? elemento.target : elemento;
    
    // VERIFICAÇÃO DE SEGURANÇA:
    if (!input) return; 
    
    let valor = input.value;
    
    // Se o valor estiver vazio, apenas limpa e retorna
    if (!valor) {
        input.value = '';
        return;
    }

    // O restante da sua lógica continua exatamente igual...
    valor = valor.replace(/\D/g, '');
    valor = (valor / 100).toFixed(2) + '';
    valor = valor.replace('.', ',');
    valor = valor.replace(/(\d)(?=(\d{3})+(?!\d))/g, '$1.');
    input.value = valor === '0,00' ? '' : 'R$ ' + valor;
};

window.removerAcentos = function(str) {
    if (!str) return '';
    return str.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
};

window.toTitleCase = function(str) {
    if (!str) return '';
    return str.toLowerCase().split(' ').map(word => {
        if (word.length === 0) return "";
        return word.charAt(0).toUpperCase() + word.slice(1);
    }).join(' ');
};

window.formatarNomeProduto = function(str) {
    if (!str) return '';
    return window.toTitleCase(str.trim());
};

window.padronizarPagamento = function(metodo) {
    if (!metodo) return 'DINHEIRO';
    let m = window.removerAcentos(metodo).toUpperCase().trim();
    if (m === 'DEBITO' || m.includes('DEBITO')) return 'DÉBITO';
    if (m === 'CREDITO' || m.includes('CREDITO') || m === 'CARTAO') return 'CRÉDITO';
    if (m === 'PIX') return 'PIX';
    return 'DINHEIRO';
};

window.obterLimitesHojeLocal = function() {
    const agora = new Date();
    const inicio = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate(), 0, 0, 0);
    const fim = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate(), 23, 59, 59);
    return { inicio: inicio.toISOString(), fim: fim.toISOString() };
};

/**
 * Sincroniza vendas feitas enquanto o dispositivo estava sem internet
 */
window.sincronizarVendasOffline = async function() {
    // Proteção adicional para caso a base não tenha carregado a tempo
    if (!navigator.onLine || typeof isDatabaseReady !== 'function' || !isDatabaseReady()) return; 
    let fila = JSON.parse(localStorage.getItem('filaVendasOffline') || '[]');
    if (fila.length === 0) return; 
    
    if (typeof showToast === 'function') showToast(`SINCRONIZANDO VENDAS...`);
    for (let venda of fila) {
        try { 
            const { id_local, ...dados } = venda; 
            if (typeof dbInsert === 'function') {
                await dbInsert('historico_vendas', dados); 
            }
        } catch (e) {
            console.error("❌ Falha na sincronização offline:", e);
        }
    }

    // --- REGISTRO DE AUDITORIA: SINCRONIZAÇÃO OFFLINE ---
    if (typeof registrarLog === 'function') {
        await registrarLog('SISTEMA', 'SINCRONIZAÇÃO OFFLINE', `DESPEJOU ${fila.length} VENDA(S) RETIDA(S) LOCALMENTE PARA A NUVEM`);
    }

    localStorage.setItem('filaVendasOffline', '[]');
};

window.addEventListener('online', window.sincronizarVendasOffline);

// Função para padronizar as cores das pílulas de pagamento
window.obterEstiloPilaPagamento = function(forma) {
    if (!forma) return "bg-emerald-50 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400"; // Padrão DINHEIRO

    const f = forma.toUpperCase().trim();

    if (f.includes('PIX')) {
        // Azul
        return "bg-blue-50 text-blue-600 border border-blue-100 dark:bg-blue-900/30 dark:text-blue-400 dark:border-blue-800/50";
    }
    if (f.includes('DINHEIRO')) {
        // Verde (Teal/Emerald)
        return "bg-emerald-50 text-emerald-600 border border-emerald-100 dark:bg-emerald-900/30 dark:text-emerald-400 dark:border-emerald-800/50";
    }
    if (f.includes('DÉBITO') || f.includes('DEBITO')) {
        // Roxo (Purple)
        return "bg-purple-50 text-purple-600 border border-purple-100 dark:bg-purple-900/30 dark:text-purple-400 dark:border-purple-800/50";
    }
    if (f.includes('CRÉDITO') || f.includes('CREDITO')) {
        // Laranja (Orange)
        return "bg-orange-50 text-orange-500 border border-orange-100 dark:bg-orange-900/30 dark:text-orange-400 dark:border-orange-800/50";
    }

    // Cor neutra genérica caso seja "Cortesia", "Fiado", etc.
    return "bg-slate-100 text-slate-500 border border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700";
};

// MÁSCARA PARA O CNPJ
window.mascaraCNPJ = function(input) {
    let v = input.value.replace(/\D/g, ''); // Remove tudo que não é dígito
    v = v.replace(/^(\d{2})(\d)/, '$1.$2');
    v = v.replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3');
    v = v.replace(/\.(\d{3})(\d)/, '.$1/$2');
    v = v.replace(/(\d{4})(\d)/, '$1-$2');
    input.value = v.substring(0, 18); // Limita o tamanho
};

/* =================================================================================
   SISTEMA GLOBAL DE ALERTAS E CONFIRMAÇÕES (Substitutos do alert e confirm)
   ================================================================================= */

// 1. Substitui o alert()
window.alertaSistema = function(mensagem, titulo = "Aviso do Sistema") {
    const modal = document.getElementById('modal-alerta-sistema');
    if (!modal) {
        // Fallback de segurança se o HTML não estiver na tela
        alert(mensagem); 
        return;
    }
    
    document.getElementById('titulo-modal-alerta').innerText = titulo;
    document.getElementById('msg-modal-alerta').innerText = mensagem;
    
    modal.classList.remove('hidden');
    modal.classList.add('flex');
};

window.fecharAlertaSistema = function() {
    const modal = document.getElementById('modal-alerta-sistema');
    if (modal) {
        modal.classList.add('hidden');
        modal.classList.remove('flex');
    }
};

// 2. Substitui o confirm()
window.confirmarAcao = function(mensagem, callbackSim, titulo = "Confirmar Ação") {
    const modal = document.getElementById('modal-confirm-sistema');
    if (!modal) {
        // Fallback de segurança
        if (confirm(mensagem)) callbackSim();
        return;
    }
    
    document.getElementById('titulo-modal-confirm').innerText = titulo;
    document.getElementById('msg-modal-confirm').innerText = mensagem;
    
    const btnSim = document.getElementById('btn-executar-confirm');
    
    // Removemos eventos antigos do botão para não duplicar cliques
    btnSim.onclick = null; 
    
    // Atribuímos a nova função
    btnSim.onclick = function() {
        fecharConfirmSistema(); // Fecha o modal
        callbackSim();          // Executa a função que você pediu
    };
    
    modal.classList.remove('hidden');
    modal.classList.add('flex');
};

window.fecharConfirmSistema = function() {
    const modal = document.getElementById('modal-confirm-sistema');
    if (modal) {
        modal.classList.add('hidden');
        modal.classList.remove('flex');
    }
};