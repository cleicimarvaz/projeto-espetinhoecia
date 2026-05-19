/* =================================================================================
   1. CONFIGURAÇÃO E ESTADO GLOBAL
   ================================================================================= */

// Controle de Versão (Útil para forçar atualização de cache no futuro)
const VERSION = "1.0.5"; 

// Identidade Visual (Centralizada para facilitar mudanças futuras)
const PRIMARY_COLOR = "#e63946"; // Vermelho padrão Espetinho & CIA

// Credenciais do Supabase
const SUPABASE_URL = 'https://vtexlttnjzmgknmbwbwl.supabase.co';
const SUPABASE_KEY = 'sb_publishable_C5SP_ulU5lhJjTdokxdegA_6ZIdeGPk';

// Configurações Gerais de UX
const TEMPO_LIMITE_INATIVIDADE = 20 * 60 * 1000; // 20 minutos

// Estilos de Interface Padronizados
const STYLE_ACTIVE = `flex-1 py-3 rounded-full bg-[${PRIMARY_COLOR}] text-white text-[9px] font-black uppercase transition-all font-sans italic tracking-widest shadow-sm`;
const STYLE_INACTIVE = "flex-1 py-3 rounded-full bg-transparent text-slate-400 text-[9px] font-black uppercase transition-all font-sans italic tracking-widest hover:bg-slate-50";

window.CSS_FILTRO_ATIVO = "flex-1 py-3 text-[9px] font-black uppercase rounded-lg transition-all shadow-sm bg-white dark:bg-slate-700 text-slate-800 dark:text-white";
window.CSS_FILTRO_INATIVO = "flex-1 py-3 text-[9px] font-black uppercase rounded-lg transition-all text-slate-500 dark:text-slate-400 hover:bg-white/50 dark:hover:bg-slate-700/50";

/* ---------------------------------------------------------------------------------
   VARIÁVEIS GLOBAIS DE ESTADO
   --------------------------------------------------------------------------------- */
let carrinho = [];
let operacaoPendente = null;      
let produtoEdicaoId = null;       
let comandaEmFechamentoId = null; 
let totalFechamentoCache = 0;     
let comandaAtualDivisao = null;   
let itensParaAbater = [];         
let itensExpandidosDivisao = [];  
let dadosUltimaVenda = null;      
let callbackAuth = null;          

const APP_STATE = {
    get carrinho() { return carrinho; },
    get operacao() { return operacaoPendente; },
    get versao() { return VERSION; }
};

console.log(`🚀 Sistema Espetinho & Cia - v${VERSION} carregado.`);


/* =============================================================
   CONFIGURAÇÕES DO SISTEMA (TICKET E PREFERÊNCIAS)
   ============================================================= */

// Função para salvar as preferências do Ticket (AGORA COM CNPJ)
window.salvarConfiguracoes = async function() {
    // 1. Captura os valores do HTML que você mandou
    const nomeLoja = document.getElementById('cfg-nome-loja')?.value || 'Espetinho & Cia';
    const cnpj = document.getElementById('config-cnpj')?.value || '';
    const layout = document.getElementById('cfg-ticket-layout')?.value || 'padrao';
    const modo = document.getElementById('cfg-modo-impressao')?.value || 'direto';
    
    // Identifica quem está logado para salvar o modo de impressão
    const usuarioLogado = localStorage.getItem('userName') || localStorage.getItem('usuarioLogado');

    // Feedback visual no botão
    if (typeof setLoading === 'function') {
        setLoading('btn-salvar-cfg', true);
    }

    try {
        // --- AÇÃO 1: SALVAR DADOS DA LOJA (Nuvem) ---
        const { error: errLoja } = await _supabase.from('configuracoes_sistema').upsert({
            id: 1, 
            nome_loja: nomeLoja,
            cnpj: cnpj,
            ticket_layout: layout,
            updated_at: new Date().toISOString()
        });
        if (errLoja) throw errLoja;

        // --- AÇÃO 2: SALVAR MODO DE IMPRESSÃO DO USUÁRIO (Nuvem) ---
        if (usuarioLogado) {
            const { error: errUser } = await _supabase.from('usuarios')
                .update({ modo_impressao: modo })
                .eq('nome', usuarioLogado); // Certifique-se que a coluna no banco é 'nome' ou 'usuario'
            
            if (errUser) console.error("Erro ao salvar modo do usuário:", errUser);
        }

        // --- AÇÃO 3: SINCRONIZAR MEMÓRIA LOCAL (LocalStorage) ---
        localStorage.setItem('nomeLoja', nomeLoja);
        localStorage.setItem('empresa_cnpj', cnpj);
        localStorage.setItem('ticketLayout', layout);
        localStorage.setItem('modoImpressao', modo);

        // Auditoria
        if (typeof registrarLog === 'function') {
            await registrarLog('SISTEMA', `ALTEROU CONFIGURAÇÕES: ${nomeLoja} | CNPJ: ${cnpj}`);
        }

        if (typeof showToast === 'function') showToast('CONFIGURAÇÕES SALVAS COM SUCESSO!', 'sucesso');

    } catch (e) {
        console.error("Erro geral ao salvar:", e);
        if (typeof showToast === 'function') showToast('ERRO AO CONECTAR COM O BANCO', 'erro');
    } finally {
        if (typeof setLoading === 'function') {
            setLoading('btn-salvar-cfg', false, '💾 SALVAR');
        }
    }
};
// Função para carregar os dados salvos quando a tela abre (AGORA COM CNPJ)
window.carregarConfiguracoesNaTela = async function() {
    // 1. Tenta buscar os dados oficiais lá no banco primeiro (Sincronização)
    try {
        const { data: configBD } = await _supabase.from('configuracoes_sistema').select('*').eq('id', 1).single();
        if (configBD) {
            localStorage.setItem('nomeLoja', configBD.nome_loja || '');
            localStorage.setItem('ticketLayout', configBD.ticket_layout || 'padrao');
            localStorage.setItem('empresa_cnpj', configBD.cnpj || '');
        }
    } catch (e) {
        console.warn("Usando dados locais. Não foi possível conectar ao banco:", e);
    }

    // 2. Agora sim, preenche os campos da tela com o que temos de mais atualizado
    const nome = localStorage.getItem('nomeLoja');
    const layout = localStorage.getItem('ticketLayout');
    const modo = localStorage.getItem('modoImpressao');
    const cnpj = localStorage.getItem('empresa_cnpj');

    if (nome) {
        const inputNome = document.getElementById('cfg-nome-loja');
        if (inputNome) inputNome.value = nome;
    }
    if (layout) {
        const selectLayout = document.getElementById('cfg-ticket-layout');
        if (selectLayout) selectLayout.value = layout;
    }
    if (modo) {
        const selectModo = document.getElementById('cfg-modo-impressao');
        if (selectModo) selectModo.value = modo;
    }
    if (cnpj) {
        const inputCnpj = document.getElementById('config-cnpj');
        if (inputCnpj) inputCnpj.value = cnpj;
    }
};

document.addEventListener('DOMContentLoaded', () => {
    // Chama a função assíncrona para buscar os dados na nuvem assim que abrir
    window.carregarConfiguracoesNaTela();
});

/* -------------------------------------------------------------
   FUNÇÃO DE TESTE DE IMPRESSÃO (CONECTADA AO PRINT.JS)
   ------------------------------------------------------------- */
window.visualizarTicketTeste = function() {
    if (typeof showToast === 'function') showToast('GERANDO TICKETS DE TESTE...', 'aviso');
    
    const vendaTeste = {
        id: 9999,
        data: new Date().toISOString(),
        created_at: new Date().toISOString(),
        total: 31.50, 
        forma_pagamento: 'Dinheiro',
        pagamento: 'Dinheiro',
        vendedor: localStorage.getItem('userName') || 'TESTE',
        itens: [
            { nome: 'ESPETO DE CARNE', qtd: 2, preco: 12.00 }, // Sairão 2 tickets individuais
            { nome: 'REFRIGERANTE LATA', qtd: 1, preco: 7.50 }  // Sairá 1 ticket
        ]
    };

    // Roteia direto para o motor de layout e tickets individuais
    if (typeof window.imprimirCupom === 'function') {
        window.imprimirCupom(vendaTeste);
    } else {
        if (typeof showToast === 'function') showToast('ERRO: MOTOR DE CUPOM NÃO ENCONTRADO', 'erro');
    }
};

window.mascaraCNPJ = function(input) {
    let v = input.value.replace(/\D/g, ''); // Remove tudo que não é número
    if (v.length > 14) v = v.substring(0, 14); // Limita a 14 números
    
    v = v.replace(/^(\d{2})(\d)/, '$1.$2');
    v = v.replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3');
    v = v.replace(/\.(\d{3})(\d)/, '.$1/$2');
    v = v.replace(/(\d{4})(\d)/, '$1-$2');
    
    input.value = v;
};
